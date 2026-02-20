"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { io } from "socket.io-client";
import Peer from "simple-peer";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const socket = io("http://localhost:3000");

export default function RoomPage() {
    const params = useParams();
    const search = useSearchParams();

    const roomId = params.id as string;
    const name = search.get("name") || "Anonymous";

    const audioRef = useRef<HTMLAudioElement>(null);
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

    // ---------------- peer ----------------
    function createPeer(userId: string, initiator: boolean, stream: MediaStream) {
        // Destroy existing peer if any
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
            if (audioRef.current) {
                audioRef.current.srcObject = remoteStream;
                try { await audioRef.current.play(); } catch { }
            }
        });

        peer.on("connect", () => {
            const pc = (peer as any)._pc as RTCPeerConnection;
            const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
            if (sender) sendersRef.current[userId] = sender;
        });

        peer.on("error", (error) => {
            console.error("Peer connection error for user", userId, ":", error);
            
            // Try to access connection state safely
            try {
                const pc = (peer as any)._pc as RTCPeerConnection;
                console.log("Connection state:", pc?.connectionState);
                console.log("ICE connection state:", pc?.iceConnectionState);
            } catch (e) {
                console.log("Could not access peer connection state:", e);
            }
            
            // Clean up on error
            delete peersRef.current[userId];
            delete sendersRef.current[userId];
            
            // Attempt to reconnect after a delay with fallback config
            setTimeout(() => {
                if (streamRef.current) {
                    console.log("Attempting reconnection with fallback config...");
                    createPeer(userId, false, streamRef.current);
                }
            }, 2000);
        });

        peer.on("close", () => {
            console.log("Peer connection closed for user:", userId);
            // Clean up on close
            delete peersRef.current[userId];
            delete sendersRef.current[userId];
            
            // Attempt to reconnect after a delay if still in room
            setTimeout(() => {
                if (streamRef.current && !peersRef.current[userId]) {
                    console.log("Attempting to reconnect to user:", userId);
                    createPeer(userId, false, streamRef.current);
                }
            }, 3000);
        });

        peersRef.current[userId] = peer;
    }

    // ---------------- connection ----------------
    useEffect(() => {
        if (startedRef.current) return;
        startedRef.current = true;

        async function init() {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });

            streamRef.current = stream;
            startSpeakingDetection(stream);
            
            // Remove local audio playback - you shouldn't hear your own voice in a meeting
            // Only others should hear you through their speakers
            console.log("Microphone active - others will hear you, but you won't hear yourself");

            socket.emit("join-room", { roomId, name });

            socket.on("users", (users) => {
                const myId = socket.id;
                if (!myId) return;

                users.forEach((user: any) => {
                    if (user.id === myId) return;
                    if (peersRef.current[user.id]) return;

                    const initiator = myId < user.id;
                    createPeer(user.id, initiator, stream);
                });
            });

            socket.on("signal", ({ from, signal }) => {
                let peer = peersRef.current[from];
                
                if (!peer) {
                    // Only create peer if it doesn't exist
                    createPeer(from, false, stream);
                    peer = peersRef.current[from];
                }
                
                // Check peer state before signaling
                if (peer && !peer.destroyed) {
                    try {
                        // Add delay to prevent race conditions
                        setTimeout(() => {
                            if (peer && !peer.destroyed) {
                                peer.signal(signal);
                            }
                        }, 100);
                    } catch (error) {
                        console.error("Error signaling peer:", error);
                        // Recreate peer if signaling fails
                        if (peersRef.current[from]) {
                            peersRef.current[from].destroy();
                        }
                        setTimeout(() => {
                            createPeer(from, false, stream);
                            if (peersRef.current[from]) {
                                peersRef.current[from].signal(signal);
                            }
                        }, 500);
                    }
                }
            });
        }

        init();

        return () => {
            Object.values(peersRef.current).forEach((p) => p.destroy());
            socket.off("signal");
            startedRef.current = false;
        };
    }, [roomId, name]);

    // ---------------- track replacement ----------------
    // REMOVED: Don't replace tracks for others
    // Everyone should send their actual voice, translation happens on receiving side
    useEffect(() => {
        // No track replacement needed - send your actual voice to others
        // Translation happens when others receive your audio
    }, []);

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

        const SpeechRecognition =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;

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
                
                // Speak the translated text immediately
                if (data.translatedText) {
                    speakTranslatedText(data.translatedText, language);
                }
            } catch { }
        }, 300); // Reduced from 700ms for faster response

        return () => clearTimeout(id);
    }, [transcript, language]);

    // ---------------- UI ----------------
    return (
        <main className="min-h-screen bg-background flex items-center justify-center p-6">
            <Card className="w-full max-w-xl">
                <CardHeader>
                    <CardTitle>SpeakSame Room</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Room ID: <span className="font-mono">{roomId}</span>
                    </p>
                </CardHeader>

                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">You</p>
                            <p className="font-medium">{name}</p>
                        </div>
                        <Badge variant={speaking ? "default" : "secondary"}>
                            {speaking ? "Speaking 🎤" : "Silent"}
                        </Badge>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Listen Language</label>
                        <Select onValueChange={(v) => setLanguage(v === "none" ? null : v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="No translation (Meeting mode)" />
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

                    {isTranslateMode && (
                        <>
                            <Separator />
                            <div className="p-3 rounded-md bg-muted text-sm">
                                <p className="text-xs text-muted-foreground mb-1">Live speech ({detectedLanguage})</p>
                                {transcript || "Start speaking..."}
                            </div>

                            <div className="p-3 rounded-md bg-primary/10 text-sm">
                                <p className="text-xs text-muted-foreground mb-1">Translated</p>
                                {translated || "..."}
                            </div>
                        </>
                    )}

                    <audio ref={audioRef} autoPlay playsInline />
                </CardContent>
            </Card>
        </main>
    );
}
