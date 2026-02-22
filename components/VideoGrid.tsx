"use client";

import { useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, Volume2, VolumeX, Video, VideoOff } from "lucide-react";

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
  size: { width: number; height: number };
}

interface VideoGridProps {
  localStream?: MediaStream;
  remotePeers: RemotePeer[];
  videoFrames: VideoFrame[];
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleMinimize: (peerId: string) => void;
  onToggleMaximize: (peerId: string) => void;
  currentUser: string;
  layoutMode: "grid" | "speaker";
}

export function VideoGrid({
  localStream,
  remotePeers,
  videoFrames,
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onToggleMinimize,
  onToggleMaximize,
  currentUser,
  layoutMode
}: VideoGridProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement>>({});

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  console.log("=== VIDEO GRID RENDER ===");
  console.log("Remote peers:", remotePeers);
  console.log("Video frames:", videoFrames);
  console.log("Local stream:", !!localStream);

  const renderVideo = (peer: RemotePeer | VideoFrame, isLocal = false) => {
    const stream = isLocal ? localStream : peer.stream;
    const name = isLocal ? currentUser : peer.name;
    const peerId = isLocal ? "local" : peer.id;

    return (
      <Card 
        key={peerId}
        className={`relative bg-gray-900 ${
          layoutMode === "speaker" && !isLocal ? "col-span-2 row-span-2" : ""
        }`}
      >
        <CardContent className="p-0 h-full">
          <div className="relative w-full h-full">
            {stream ? (
              <video
                ref={isLocal ? localVideoRef : (el) => {
                  if (el && !isLocal) {
                    videoRefs.current[peerId] = el;
                    console.log("Setting stream for remote peer:", peerId, name);
                    console.log("Stream object:", stream);
                    el.srcObject = stream;
                    // Force video to play
                    el.play().catch(err => {
                      console.warn("Video play error:", err);
                    });
                  }
                }}
                data-peer-video={isLocal ? "local" : peer.id}
                autoPlay
                playsInline
                muted={isLocal}
                className="w-full h-full object-cover rounded-lg"
                onLoadedMetadata={(e) => {
                  const video = e.target as HTMLVideoElement;
                  if (!isLocal && stream) {
                    console.log("Video metadata loaded for:", name);
                    video.srcObject = stream;
                  }
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-800 rounded-lg">
                <div className="text-center">
                  <VideoOff className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-400">{name}</p>
                </div>
              </div>
            )}
            
            {/* Overlay with user info and controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 rounded-b-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-medium">
                    {name} {isLocal && "(You)"}
                  </span>
                  {(isLocal ? isMuted : (peer as RemotePeer).isMuted) && (
                    <Badge variant="secondary" className="text-xs">
                      <VolumeX className="w-3 h-3" />
                    </Badge>
                  )}
                  {(isLocal ? isVideoOff : (peer as RemotePeer).isVideoOff) && (
                    <Badge variant="secondary" className="text-xs">
                      <VideoOff className="w-3 h-3" />
                    </Badge>
                  )}
                </div>
                
                {!isLocal && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleMinimize(peer.id)}
                      className="h-6 w-6 p-0 text-white hover:bg-white/20"
                    >
                      {(peer as VideoFrame).isMinimized ? (
                        <Maximize2 className="w-3 h-3" />
                      ) : (
                        <Minimize2 className="w-3 h-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleMaximize(peer.id)}
                      className="h-6 w-6 p-0 text-white hover:bg-white/20"
                    >
                      <Maximize2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const gridClass = layoutMode === "speaker" 
    ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" 
    : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <div className={`grid ${gridClass} gap-4 p-4 h-full`}>
      {/* Local video */}
      {renderVideo({ id: "local", name: currentUser, stream: localStream } as RemotePeer, true)}
      
      {/* Remote videos - use only videoFrames to avoid duplicates */}
      {videoFrames.map(frame => renderVideo(frame as RemotePeer))}
    </div>
  );
}
