"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChatPanel } from "@/components/ChatPanel";
import { VideoGrid } from "@/components/VideoGrid";
import { RoomControls } from "@/components/RoomControls";
import { useSocket } from "@/hooks/useSocket";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useTranslation } from "@/hooks/useTranslation";
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

export default function RoomPage() {
  const params = useParams();
  const search = useSearchParams();
  const { theme } = useTheme();
  
  const roomId = params.id as string;
  const nameFromUrl = search.get("name");
  const name = nameFromUrl || "Anonymous";
  
  console.log("=== ROOM PAGE INIT ===");
  console.log("Room ID:", roomId);
  console.log("Raw name from URL:", nameFromUrl);
  console.log("Final name:", name);
  console.log("Full search params:", Object.fromEntries(search.entries()));
  console.log("Current URL:", typeof window !== 'undefined' ? window.location.href : 'SSR');

  // Media refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Socket and WebRTC hooks
  const { socket, myId, users, messages, isConnected, connect, sendMessage, emitSignal } = useSocket();
  const { 
    remotePeers, 
    videoFrames, 
    createPeer, 
    handleSignal, 
    cleanup, 
    toggleVideoFrameMinimize, 
    toggleVideoFrameMaximize,
    peersRef
  } = useWebRTC(socket, myId, streamRef.current || undefined);
  
  // Translation hook
  const translation = useTranslation();

  // Local state
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"grid" | "speaker">("grid");
  const [newMessage, setNewMessage] = useState("");
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Initialize media stream
  useEffect(() => {
    const initMedia = async () => {
      console.log("=== INITIALIZING MEDIA STREAM ===");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        console.log("Stream obtained successfully:", stream);
        console.log("Video tracks:", stream.getVideoTracks().length);
        console.log("Audio tracks:", stream.getAudioTracks().length);
        
        streamRef.current = stream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          // Force video to play
          localVideoRef.current.play().then(() => {
            console.log("Local video playing successfully");
          }).catch(err => {
            console.warn("Local video play error:", err);
            // Try muted first
            if (localVideoRef.current) {
              localVideoRef.current.muted = true;
              localVideoRef.current.play().then(() => {
                console.log("Local video playing (muted)");
                setTimeout(() => {
                  if (localVideoRef.current) {
                    localVideoRef.current.muted = false;
                  }
                }, 1000);
              }).catch(unmuteErr => {
                console.warn("Local video unmute error:", unmuteErr);
              });
            }
          });
        }
      } catch (error: any) {
        console.error("Error accessing media devices:", error);
        
        // Handle different permission errors
        if (error.name === 'NotAllowedError') {
          setMediaError('Camera and microphone access is required for full functionality. You can still chat with other participants.');
        } else if (error.name === 'NotFoundError') {
          setMediaError('No camera or microphone found. Please connect your devices and refresh the page.');
        } else if (error.name === 'NotReadableError') {
          setMediaError('Camera or microphone is already in use by another application.');
        } else {
          setMediaError('Error accessing media devices: ' + error.message);
        }
      }
    };

    initMedia();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      cleanup();
    };
  }, [cleanup]);

  // Update WebRTC hook when stream changes
  useEffect(() => {
    if (streamRef.current) {
      console.log("Stream updated, WebRTC hook should have access to it");
    }
  }, [streamRef.current]);

  // Re-initialize WebRTC hook when stream becomes available
  useEffect(() => {
    if (streamRef.current && socket) {
      console.log("Re-initializing WebRTC with available stream");
      // Force re-render of WebRTC hook with stream
      const dummy = Math.random();
    }
  }, [streamRef.current, socket]);

  // Connect to room
  useEffect(() => {
    if (roomId && name && !isConnected && socket) {
      console.log("Setting up socket listeners for room:", roomId, "name:", name);
      
      // Set up signal handler
      socket.on("signal", (data) => {
        console.log("=== SOCKET SIGNAL EVENT ===");
        console.log("Signal data received:", data);
        handleSignal(data);
      });
      
      return () => {
        console.log("Cleaning up signal listener");
        socket.off("signal", handleSignal);
      };
    }
  }, [roomId, name, isConnected, socket, handleSignal]);

  // Handle peer creation when users list changes
  useEffect(() => {
    console.log("=== PEER CREATION CHECK ===");
    console.log("Socket exists:", !!socket);
    console.log("Stream exists:", !!streamRef.current);
    console.log("Stream ref value:", streamRef.current);
    console.log("Users count:", users.length);
    console.log("My ID:", myId);
    console.log("Users:", users);
    
    // Add a small delay to ensure stream is properly set
    const timer = setTimeout(() => {
      if (socket && streamRef.current && users.length > 0) {
        console.log("Users changed, creating peers for:", users);
        users.forEach((user: any) => {
          if (user.id === myId) {
            console.log("Skipping self:", user.id);
            return;
          }
          if (!user.name) {
            console.log("User has no name, skipping:", user);
            return;
          }
          
          // Check if peer already exists
          if (!peersRef.current || !peersRef.current[user.id]) {
            const initiator = myId < user.id;
            console.log("Creating peer for user:", user.id, user.name, "initiator:", initiator);
            console.log("Using stream:", streamRef.current);
            createPeer(user.id, initiator, streamRef.current!, user.name);
          } else {
            console.log("Peer already exists for:", user.id);
          }
        });
      } else {
        console.log("=== PEER CREATION SKIPPED ===");
        console.log("Reason:", !socket ? "No socket" : !streamRef.current ? "No stream" : "No users");
      }
    }, 1000); // Increased to 1 second to prevent rapid re-creation
    
    return () => clearTimeout(timer);
  }, [users, myId, streamRef.current, socket, createPeer]);

  // Initialize connection
  useEffect(() => {
    if (roomId && name && !isConnected) {
      console.log("=== INITIALIZING CONNECTION ===");
      console.log("Calling connect with:", roomId, name);
      connect(roomId, name);
    }
  }, [roomId, name, isConnected, connect]);

  // Prevent multiple connections
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log("Page unloading, cleaning up connections");
      cleanup();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [cleanup]);

  // Control handlers
  const toggleMute = () => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTracks = streamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        // Stop screen sharing
        if (streamRef.current) {
          const screenTracks = streamRef.current.getVideoTracks().filter(track => 
            track.label.includes("screen")
          );
          screenTracks.forEach(track => track.stop());
          
          // Restart camera
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const videoTrack = videoStream.getVideoTracks()[0];
          streamRef.current.addTrack(videoTrack);
        }
        setIsScreenSharing(false);
      } else {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        
        if (streamRef.current) {
          // Replace camera track with screen track
          const videoTracks = streamRef.current.getVideoTracks();
          videoTracks.forEach(track => track.stop());
          streamRef.current.removeTrack(videoTracks[0]);
          streamRef.current.addTrack(screenTrack);
        }
        
        screenTrack.onended = () => {
          setIsScreenSharing(false);
          toggleVideo(); // Restart camera
        };
        
        setIsScreenSharing(true);
      }
    } catch (error) {
      console.error("Error toggling screen share:", error);
    }
  };

  const handleSendMessage = (message: string) => {
    if (message.trim()) {
      sendMessage(message, name);
      setNewMessage("");
    }
  };

  const leaveRoom = () => {
    cleanup();
    window.location.href = "/";
  };

  const toggleLayout = () => {
    setLayoutMode(prev => prev === "grid" ? "speaker" : "grid");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Media Error Alert */}
      {mediaError && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="text-red-500 mt-1">
                  <VideoOff className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-red-800">Media Access Issue</h4>
                  <p className="text-sm text-red-600 mt-1">{mediaError}</p>
                  <div className="flex gap-2 mt-3">
                    <Button 
                      size="sm" 
                      onClick={() => {
                        setMediaError(null);
                        window.location.reload();
                      }}
                    >
                      Retry
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setMediaError(null)}
                    >
                      Continue without Camera/Mic
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">SpeakSame Room</h1>
            <Badge variant="outline">{roomId}</Badge>
            <Badge variant="secondary">{name}</Badge>
            {mediaError && (
              <Badge variant="destructive" className="text-xs">
                Limited Mode
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-20">
        <div className="container mx-auto px-4 py-4">
          <VideoGrid
            localStream={streamRef.current || undefined}
            remotePeers={remotePeers}
            videoFrames={videoFrames}
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            onToggleMute={toggleMute}
            onToggleVideo={toggleVideo}
            onToggleMinimize={toggleVideoFrameMinimize}
            onToggleMaximize={toggleVideoFrameMaximize}
            currentUser={name}
            layoutMode={layoutMode}
          />
        </div>
      </main>

      {/* Controls */}
      <RoomControls
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        isScreenSharing={isScreenSharing}
        chatOpen={chatOpen}
        showParticipants={showParticipants}
        showInvite={showInvite}
        layoutMode={layoutMode}
        currentUser={name}
        roomId={roomId}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
        onToggleChat={() => setChatOpen(!chatOpen)}
        onToggleParticipants={() => setShowParticipants(!showParticipants)}
        onToggleInvite={() => setShowInvite(!showInvite)}
        onToggleLayout={toggleLayout}
        onLeaveRoom={leaveRoom}
        participantCount={users.length}
      />

      {/* Chat Panel */}
      <ChatPanel
        messages={messages}
        newMessage={newMessage}
        onSendMessage={handleSendMessage}
        onMessageChange={setNewMessage}
        isOpen={chatOpen}
        onToggle={() => setChatOpen(!chatOpen)}
        currentUser={name}
      />

      {/* Translation Panel (if needed) */}
      {translation.isListening && (
        <Card className="fixed bottom-20 left-4 w-80 z-40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🎤 Live Translation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              <div className="font-medium">ORIGINAL SPEECH</div>
              <div className="text-gray-600">{translation.detectedLanguage}</div>
              <div className="bg-gray-100 p-2 rounded mt-1">
                {translation.transcript || "🎤 Start speaking..."}
              </div>
            </div>
            
            <div className="text-sm">
              <div className="font-medium">TRANSLATED</div>
              <div className="text-gray-600">{translation.targetLanguage}</div>
              <div className="bg-blue-50 p-2 rounded mt-1">
                {translation.isProcessing ? "⏳ Waiting for translation..." : translation.translated || "⏳ Waiting for translation..."}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button size="sm" onClick={translation.speakTranslation} disabled={!translation.translated}>
                🔊 Speak Translation
              </Button>
              <Button size="sm" variant="outline" onClick={translation.copyTranslation} disabled={!translation.translated}>
                📋 Copy Translation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96">
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
                    onClick={() => {
                      navigator.clipboard.writeText(roomId);
                      // You could add a toast notification here
                    }}
                    variant="outline"
                    size="sm"
                  >
                    📋
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
                  <Button
                    onClick={() => {
                      const inviteLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/room/${roomId}?name=Guest`;
                      navigator.clipboard.writeText(inviteLink);
                      // You could add a toast notification here
                    }}
                    variant="outline"
                    size="sm"
                  >
                    📋
                  </Button>
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
    </div>
  );
}
