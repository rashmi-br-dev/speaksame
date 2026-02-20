"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { io } from "socket.io-client";
import Peer from "simple-peer";
import { useTheme } from "next-themes";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import {
    Mic,
    MicOff,
    Video,
    VideoOff,
    Send,
    Users,
    Settings,
    Maximize2,
    Minimize2,
    Copy,
    Phone,
    Monitor,
    MessageSquare,
    Crown,
    Volume2,
    VolumeX
} from "lucide-react";

const socket = io("http://localhost:3000");

interface Message {
    id: string;
    user: string;
    text: string;
    timestamp: Date;
}

interface RemotePeer {
    id: string;
    name: string;
    stream?: MediaStream;
    isMuted?: boolean;
    isVideoOff?: boolean;
}

interface VideoFrame {
    id: string;
    name: string;
    stream?: MediaStream;
    isMinimized: boolean;
    isMaximized: boolean;
    position: { x: number; y: number };
}

export default function RoomPage() {
    const params = useParams();
    const search = useSearchParams();
    const { theme } = useTheme();

    const roomId = params.id as string;
    const name = search.get("name") || "Anonymous";

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const peersRef = useRef<Record<string, Peer.Instance>>({});
    const streamRef = useRef<MediaStream | null>(null);
    const startedRef = useRef(false);
    const recognitionRef = useRef<any>(null);

    const [speaking, setSpeaking] = useState(false);
    const [language, setLanguage] = useState<string | null>(null);
    const [transcript, setTranscript] = useState("");
    const [translated, setTranslated] = useState("");
    const [detectedLanguage, setDetectedLanguage] = useState<string>("en");
    const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
    const silentTrackRef = useRef<MediaStreamTrack | null>(null);
    const sendersRef = useRef<Record<string, RTCRtpSender>>({});

    // New states for advanced features
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
    const [chatOpen, setChatOpen] = useState(true);
    const [showParticipants, setShowParticipants] = useState(false);
    const [showInvite, setShowInvite] = useState(false);
    const [videoFrames, setVideoFrames] = useState<VideoFrame[]>([]);
    const [layoutMode, setLayoutMode] = useState<"grid" | "speaker" | "gallery">("grid");
    const [copiedRoomId, setCopiedRoomId] = useState(false);

    const isTranslateMode = language !== null;

    // ---------------- speaking detection ----------------
    function startSpeakingDetection(stream: MediaStream) {
        const ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);

        function detect() {
            analyser.getByteFrequencyData(data);
            const volume = data.reduce((a, b) => a + b, 0) / data.length;
            setSpeaking(volume > 10);
            requestAnimationFrame(detect);
        }
        detect();
    }

    // ---------------- silent track ----------------
    function getSilentTrack(): MediaStreamTrack {
        if (silentTrackRef.current) return silentTrackRef.current;

        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const dst = ctx.createMediaStreamDestination();
        oscillator.connect(dst);
        oscillator.start();

        silentTrackRef.current = dst.stream.getAudioTracks()[0];
        silentTrackRef.current.enabled = false;
        return silentTrackRef.current;
    }

    // ---------------- control functions ----------------
    function toggleMute() {
        if (streamRef.current) {
            const audioTracks = streamRef.current.getAudioTracks();
            audioTracks.forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!isMuted);
        }
    }

    function toggleVideo() {
        if (streamRef.current) {
            const videoTracks = streamRef.current.getVideoTracks();
            videoTracks.forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsVideoOff(!isVideoOff);
        }
    }

    function copyRoomId() {
        navigator.clipboard.writeText(roomId);
        setCopiedRoomId(true);
        setTimeout(() => setCopiedRoomId(false), 2000);
    }

    function sendMessage() {
        if (newMessage.trim()) {
            const message: Message = {
                id: Date.now().toString(),
                user: name,
                text: newMessage.trim(),
                timestamp: new Date()
            };

            socket.emit("chat-message", { roomId, message });
            setMessages(prev => [...prev, message]);
            setNewMessage("");
        }
    }

    function toggleVideoFrameMinimize(peerId: string) {
        setVideoFrames(prev => prev.map(frame =>
            frame.id === peerId ? { ...frame, isMinimized: !frame.isMinimized } : frame
        ));
    }

    function toggleVideoFrameMaximize(peerId: string) {
        setVideoFrames(prev => prev.map(frame =>
            frame.id === peerId ? { ...frame, isMaximized: !frame.isMaximized } : frame
        ));
    }

    // ---------------- peer ----------------
    function createPeer(userId: string, initiator: boolean, stream: MediaStream, userName: string) {
        if (peersRef.current[userId]) {
            peersRef.current[userId].destroy();
        }

        const peer = new Peer({
            initiator,
            trickle: false,
            stream,
            config: {
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:stun1.l.google.com:19302" },
                    { urls: "stun:stun2.l.google.com:19302" },
                    {
                        urls: "turn:numb.viagenie.ca",
                        username: "webrtc@live.com",
                        credential: "muazkh"
                    }
                ]
            },
        });

        peer.on("signal", (signal) => {
            socket.emit("signal", { to: userId, signal });
        });

        peer.on("stream", async (remoteStream) => {
            console.log("Received remote stream from", userId, remoteStream);

            // Add to remote peers
            setRemotePeers(prev => {
                const existing = prev.find(p => p.id === userId);
                if (existing) {
                    return prev.map(p => p.id === userId ? { ...p, stream: remoteStream } : p);
                } else {
                    return [...prev, { id: userId, name: userName, stream: remoteStream }];
                }
            });

            // Initialize video frame
            setVideoFrames(prev => {
                const existing = prev.find(f => f.id === userId);
                if (!existing) {
                    return [...prev, {
                        id: userId,
                        name: userName,
                        stream: remoteStream,
                        isMinimized: false,
                        isMaximized: false,
                        position: { x: 0, y: 0 }
                    }];
                }
                return prev.map(f => f.id === userId ? { ...f, stream: remoteStream } : f);
            });

            // Set the first remote stream to the video element as fallback
            const videoElements = document.querySelectorAll(`[data-peer-video="${userId}"]`);
            for (const el of videoElements) {
                const videoEl = el as HTMLVideoElement;
                if (videoEl.srcObject !== remoteStream) {
                    videoEl.srcObject = remoteStream;
                    try {
                        await videoEl.play();
                        console.log("Video playing for", userId);
                    } catch (err) {
                        console.warn("Video play error:", err);
                    }
                }
            }
        });

        peer.on("connect", () => {
            const pc = (peer as any)._pc as RTCPeerConnection;
            const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
            if (sender) sendersRef.current[userId] = sender;
        });

        peer.on("error", (error) => {
            console.error("Peer connection error for user", userId, ":", error);
            delete peersRef.current[userId];
            delete sendersRef.current[userId];
            setRemotePeers(prev => prev.filter(p => p.id !== userId));
            setVideoFrames(prev => prev.filter(f => f.id !== userId));

            setTimeout(() => {
                if (streamRef.current) {
                    createPeer(userId, false, streamRef.current, userName);
                }
            }, 2000);
        });

        peer.on("close", () => {
            console.log("Peer connection closed for user:", userId);
            delete peersRef.current[userId];
            delete sendersRef.current[userId];
            setRemotePeers(prev => prev.filter(p => p.id !== userId));
            setVideoFrames(prev => prev.filter(f => f.id !== userId));
        });

        peersRef.current[userId] = peer;
    }

    // ---------------- connection ----------------
    useEffect(() => {
        if (startedRef.current) return;
        startedRef.current = true;

        async function init() {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });

            streamRef.current = stream;

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
                localVideoRef.current.play().catch(err => console.warn("Local video play error:", err));
            }

            startSpeakingDetection(stream);
            console.log("Camera and microphone active - tracks:", stream.getTracks());

            socket.emit("join-room", { roomId, name });

            socket.on("users", (users) => {
                const myId = socket.id;
                if (!myId) return;

                users.forEach((user: any) => {
                    if (user.id === myId) return;
                    if (peersRef.current[user.id]) return;

                    const initiator = myId < user.id;
                    createPeer(user.id, initiator, stream, user.name);
                });
            });

            socket.on("signal", ({ from, signal, userName }) => {
                let peer = peersRef.current[from];

                if (!peer) {
                    createPeer(from, false, stream, userName);
                    peer = peersRef.current[from];
                }

                if (peer && !peer.destroyed) {
                    try {
                        setTimeout(() => {
                            if (peer && !peer.destroyed) {
                                peer.signal(signal);
                            }
                        }, 100);
                    } catch (error) {
                        console.error("Error signaling peer:", error);
                        if (peersRef.current[from]) {
                            peersRef.current[from].destroy();
                        }
                        setTimeout(() => {
                            createPeer(from, false, stream, userName);
                            if (peersRef.current[from]) {
                                peersRef.current[from].signal(signal);
                            }
                        }, 500);
                    }
                }
            });

            socket.on("chat-message", (message: Message) => {
                setMessages(prev => [...prev, message]);
            });
        }

        init();

        return () => {
            Object.values(peersRef.current).forEach((p) => p.destroy());
            socket.off("signal");
            socket.off("chat-message");
            socket.off("users");
            startedRef.current = false;
        };
    }, [roomId, name]);

    // ---------------- language detection ----------------
    async function detectLanguage(text: string): Promise<string> {
        try {
            const response = await fetch("/api/detect-language", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
            });
            const data = await response.json();
            return data.language || "en";
        } catch {
            return "en";
        }
    }

    // ---------------- speech recognition ----------------
    useEffect(() => {
        if (!isTranslateMode) {
            recognitionRef.current?.stop();
            setTranscript("");
            setTranslated("");
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = async (event: any) => {
            let text = "";
            let isFinal = false;

            for (let i = event.resultIndex; i < event.results.length; i++) {
                text += event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    isFinal = true;
                }
            }

            setTranscript(text);

            if (isFinal && text.length > 10) {
                const detected = await detectLanguage(text);
                setDetectedLanguage(detected);

                if (detected !== recognition.lang) {
                    recognition.lang = detected === "hi" ? "hi-IN" :
                        detected === "ta" ? "ta-IN" :
                            detected === "kn" ? "kn-IN" : "en-US";
                }
            }
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error:", event.error);
        };

        recognition.start();
        recognitionRef.current = recognition;

        return () => {
            recognition.stop();
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        };
    }, [isTranslateMode]);

    // ---------------- text-to-speech ----------------
    function speakTranslatedText(text: string, targetLang: string) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = targetLang;
            utterance.rate = 1.1;
            utterance.pitch = 1;
            utterance.volume = 0.8;

            window.speechSynthesis.speak(utterance);
            speechSynthesisRef.current = utterance;
        }
    }

    // ---------------- translation ----------------
    useEffect(() => {
        if (!transcript || !language) return;

        const id = setTimeout(async () => {
            try {
                const res = await fetch("/api/translate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: transcript, targetLang: language }),
                });
                const data = await res.json();
                setTranslated(data.translatedText);

                if (data.translatedText) {
                    speakTranslatedText(data.translatedText, language);
                }
            } catch { }
        }, 300);

        return () => clearTimeout(id);
    }, [transcript, language]);

    // ---------------- UI ----------------
    return (
        <main className={`min-h-screen ${theme === 'dark' ? 'bg-gray-950' : 'bg-gray-50'} flex`}>
            {/* Header */}
            <header className={`fixed top-0 left-0 right-0 z-50 ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} border-b px-4 py-2`}>
                <div className="flex items-center justify-between max-w-7xl mx-auto">
                    <div className="flex items-center gap-4">
                        <h1 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            SpeakSame Room
                        </h1>
                        <Badge variant="secondary" className="text-xs">
                            {roomId}
                        </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Layout Mode Selector */}
                        <Select value={layoutMode} onValueChange={(value: any) => setLayoutMode(value)}>
                            <SelectTrigger className="w-32">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="grid">Grid View</SelectItem>
                                <SelectItem value="speaker">Speaker View</SelectItem>
                                <SelectItem value="gallery">Gallery</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Invite Button */}
                        <Button
                            onClick={() => setShowInvite(!showInvite)}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                        >
                            <Users className="w-4 h-4" />
                            Invite
                        </Button>

                        {/* Participants */}
                        <Button
                            onClick={() => setShowParticipants(!showParticipants)}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                        >
                            <Users className="w-4 h-4" />
                            {remotePeers.length + 1}
                        </Button>

                        {/* Theme Toggle */}
                        <ThemeToggle />

                        {/* Settings */}
                        <Button variant="outline" size="sm">
                            <Settings className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 pt-16">
                {/* Video Grid */}
                <div className="p-4">
                    {layoutMode === "grid" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-7xl mx-auto">
                            {/* Local Video */}
                            <Card className={`relative group ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                <CardContent className="p-0">
                                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                                        <video
                                            ref={localVideoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            className="w-full h-full object-cover"
                                        />
                                        {isVideoOff && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                                                <VideoOff className="w-12 h-12 text-gray-400" />
                                            </div>
                                        )}

                                        {/* Video Controls Overlay */}
                                        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Badge variant="secondary" className="text-xs">
                                                You ({name})
                                            </Badge>
                                        </div>

                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="h-6 w-6 p-0"
                                                onClick={() => toggleVideoFrameMinimize('local')}
                                            >
                                                <Minimize2 className="w-3 h-3" />
                                            </Button>
                                        </div>

                                        <div className="absolute bottom-2 left-2">
                                            <Badge variant={speaking ? "default" : "secondary"} className="text-xs">
                                                {isMuted ? <VolumeX className="w-3 h-3 mr-1" /> : <Volume2 className="w-3 h-3 mr-1" />}
                                                {speaking ? "Speaking" : "Silent"}
                                            </Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Remote Videos */}
                            {videoFrames.map((frame) => (
                                <Card
                                    key={frame.id}
                                    className={`relative group ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} ${frame.isMaximized ? 'col-span-full row-span-full' : ''
                                        } ${frame.isMinimized ? 'scale-75 opacity-75' : ''}`}
                                >
                                    <CardContent className="p-0">
                                        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                                            {frame.stream ? (
                                                <video
                                                    autoPlay
                                                    playsInline
                                                    muted={false}
                                                    className="w-full h-full object-cover"
                                                    data-peer-video={frame.id}
                                                    ref={(el) => {
                                                        if (el && frame.stream) {
                                                            el.srcObject = frame.stream;
                                                            el.play().catch(err => console.warn("Video play error:", err));
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                                                    <div className="text-center">
                                                        <Video className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                                                        <p className="text-gray-400 text-sm">Connecting...</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Video Controls Overlay */}
                                            <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Badge variant="secondary" className="text-xs">
                                                    {frame.name}
                                                </Badge>
                                            </div>

                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="h-6 w-6 p-0"
                                                    onClick={() => toggleVideoFrameMinimize(frame.id)}
                                                >
                                                    {frame.isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="h-6 w-6 p-0"
                                                    onClick={() => toggleVideoFrameMaximize(frame.id)}
                                                >
                                                    <Maximize2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {layoutMode === "speaker" && (
                        <div className="max-w-7xl mx-auto">
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                                {/* Main Speaker */}
                                <div className="lg:col-span-3">
                                    <Card className={`relative ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                        <CardContent className="p-0">
                                            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                                                <video
                                                    ref={localVideoRef}
                                                    autoPlay
                                                    playsInline
                                                    muted
                                                    className="w-full h-full object-cover"
                                                />
                                                {isVideoOff && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                                                        <VideoOff className="w-16 h-16 text-gray-400" />
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Side Panel */}
                                <div className="space-y-2">
                                    {videoFrames.slice(0, 4).map((frame) => (
                                        <Card key={frame.id} className={`relative ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                            <CardContent className="p-0">
                                                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                                                    {frame.stream ? (
                                                        <video
                                                            autoPlay
                                                            playsInline
                                                            muted={false}
                                                            className="w-full h-full object-cover"
                                                            data-peer-video={frame.id}
                                                            ref={(el) => {
                                                                if (el && frame.stream) {
                                                                    el.srcObject = frame.stream;
                                                                    el.play().catch(err => console.warn("Video play error:", err));
                                                                }
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                                                            <Video className="w-8 h-8 text-gray-400" />
                                                        </div>
                                                    )}
                                                    <div className="absolute bottom-1 left-1">
                                                        <Badge variant="secondary" className="text-xs">
                                                            {frame.name}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex gap-2 bg-black/90 backdrop-blur-sm p-4 rounded-full shadow-2xl">
                    <Button
                        onClick={toggleMute}
                        variant={isMuted ? "destructive" : "secondary"}
                        size="sm"
                        className="rounded-full h-12 w-12"
                    >
                        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </Button>
                    <Button
                        onClick={toggleVideo}
                        variant={isVideoOff ? "destructive" : "secondary"}
                        size="sm"
                        className="rounded-full h-12 w-12"
                    >
                        {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                    </Button>
                    <Separator orientation="vertical" className="h-8" />
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full h-12 w-12"
                        onClick={() => setChatOpen(!chatOpen)}
                    >
                        <MessageSquare className="w-5 h-5" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full h-12 w-12"
                        onClick={() => setShowParticipants(!showParticipants)}
                    >
                        <Users className="w-5 h-5" />
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        className="rounded-full h-12 w-12"
                        onClick={() => window.location.href = '/'}
                    >
                        <Phone className="w-5 h-5 rotate-135" />
                    </Button>
                </div>
            </div>

            {/* Invite Modal */}
            {showInvite && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className={`w-96 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="w-5 h-5" />
                                Invite Others
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">Room ID</label>
                                <div className="flex gap-2 mt-1">
                                    <Input
                                        value={roomId}
                                        readOnly
                                        className="flex-1"
                                    />
                                    <Button
                                        onClick={copyRoomId}
                                        variant="outline"
                                        size="sm"
                                    >
                                        {copiedRoomId ? "Copied!" : <Copy className="w-4 h-4" />}
                                    </Button>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Invite Link</label>
                                <div className="flex gap-2 mt-1">
                                    <Input
                                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/room/${roomId}?name=Guest`}
                                        readOnly
                                        className="flex-1 text-sm"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setShowInvite(false)}>
                                    Close
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Participants Sidebar */}
            {showParticipants && (
                <div className={`fixed right-0 top-16 h-full w-80 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-l shadow-xl z-40`}>
                    <Card className="h-full rounded-none border-0">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    Participants ({remotePeers.length + 1})
                                </CardTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowParticipants(false)}
                                >
                                    ×
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-2">
                            <div className="space-y-2">
                                {/* Local User */}
                                <div className={`flex items-center gap-3 p-2 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                                    <div className="relative">
                                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                                            <Crown className="w-4 h-4 text-white" />
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-sm">{name} (You)</p>
                                        <p className="text-xs text-gray-500">Host</p>
                                    </div>
                                    <div className="flex gap-1">
                                        {isMuted && <MicOff className="w-4 h-4 text-red-500" />}
                                        {isVideoOff && <VideoOff className="w-4 h-4 text-red-500" />}
                                    </div>
                                </div>

                                {/* Remote Users */}
                                {remotePeers.map((peer) => (
                                    <div key={peer.id} className={`flex items-center gap-3 p-2 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                                        <div className="relative">
                                            <div className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center">
                                                <span className="text-white text-sm font-medium">
                                                    {peer.name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-sm">{peer.name}</p>
                                            <p className="text-xs text-gray-500">Participant</p>
                                        </div>
                                        <div className="flex gap-1">
                                            {peer.isMuted && <MicOff className="w-4 h-4 text-red-500" />}
                                            {peer.isVideoOff && <VideoOff className="w-4 h-4 text-red-500" />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Chat Sidebar */}
            {chatOpen && (
                <div className={`fixed right-0 top-16 h-full w-80 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-l shadow-xl z-40`}>
                    <Card className="h-full rounded-none border-0">
                        <CardHeader className="pb-0">
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4" />
                                    Chat
                                </CardTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setChatOpen(false)}
                                >
                                    ×
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="flex flex-col h-[calc(100%-120px)] p-4">
                            <div className="flex-1 overflow-y-auto mb-4 p-2 border rounded">
                                {messages.map((message) => (
                                    <div key={message.id} className="mb-2">
                                        <div className="flex items-baseline gap-2">
                                            <span className="font-semibold text-sm">{message.user}:</span>
                                            <span className="text-xs text-gray-500">
                                                {message.timestamp.toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <p className="text-sm mt-1">{message.text}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                    className="flex-1"
                                />
                                <Button onClick={sendMessage} size="sm">
                                    <Send className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Translation Panel */}
            {isTranslateMode && (
                <Card className={`fixed bottom-24 left-6 w-80 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-xl`}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Monitor className="w-4 h-4" />
                            Translation
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Listen Language</label>
                            <Select onValueChange={(v) => setLanguage(v === "none" ? null : v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="No translation" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No translation</SelectItem>
                                    <SelectItem value="en">English</SelectItem>
                                    <SelectItem value="hi">Hindi</SelectItem>
                                    <SelectItem value="kn">Kannada</SelectItem>
                                    <SelectItem value="ta">Tamil</SelectItem>
                                    <SelectItem value="es">Spanish</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className={`p-2 rounded text-sm ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                            <p className="text-xs text-gray-500 mb-1">Live speech ({detectedLanguage})</p>
                            {transcript || "Start speaking..."}
                        </div>

                        <div className={`p-2 rounded text-sm ${theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
                            <p className="text-xs text-gray-500 mb-1">Translated</p>
                            {translated || "..."}
                        </div>
                    </CardContent>
                </Card>
            )}
        </main>
    );
}
