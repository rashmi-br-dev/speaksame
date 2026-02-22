"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Minimize2, Maximize2, VideoOff } from "lucide-react";
import { useEffect, useRef } from "react";

interface VideoCardProps {
    stream?: MediaStream;
    userName: string;
    isVideoOff?: boolean;
    isMinimized?: boolean;
    isMaximized?: boolean;
    onMinimize?: () => void;
    onMaximize?: () => void;
    showControls?: boolean;
    isActive?: boolean;
    isSpeaking?: boolean;
}

export function VideoCard({ 
    stream, 
    userName, 
    isVideoOff = false, 
    isMinimized = false, 
    isMaximized = false, 
    onMinimize, 
    onMaximize, 
    showControls = true, 
    isActive = false,
    isSpeaking = false 
}: VideoCardProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    
    console.log("VideoCard render:", { userName, hasStream: !!stream, isVideoOff, streamTracks: stream?.getTracks().length || 0 });
    
    // Debug stream tracks
    if (stream) {
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        console.log(`VideoCard ${userName}:`, {
            videoTracks: videoTracks.length,
            audioTracks: audioTracks.length,
            videoTrackEnabled: videoTracks[0]?.enabled,
            audioTrackEnabled: audioTracks[0]?.enabled
        });
    }
    
    // Use useEffect to handle stream changes
    useEffect(() => {
        if (videoRef.current && stream) {
            console.log("Setting stream with useEffect for:", userName);
            videoRef.current.srcObject = stream;
            
            const playVideo = () => {
                if (videoRef.current) {
                    videoRef.current.play().then(() => {
                        console.log(`Video playing with useEffect for ${userName}`);
                    }).catch(err => {
                        console.error(`Play failed with useEffect for ${userName}:`, err);
                    });
                }
            };
            
            if (videoRef.current.readyState >= 2) {
                playVideo();
            } else {
                videoRef.current.onloadedmetadata = playVideo;
            }
        }
    }, [stream, userName]);
    
    return (
        <Card className={`relative group ${isMinimized ? 'scale-75 opacity-75' : ''} ${isMaximized ? 'col-span-full row-span-full' : ''}`}>
            <CardContent className="p-0">
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                    {stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled ? (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted={true}
                            className="w-full h-full object-cover"
                            controls={false}
                        />
                    ) : stream ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                            <div className="text-center">
                                <VideoOff className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                                <p className="text-gray-400 text-sm">Video Off</p>
                            </div>
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                            <div className="text-center">
                                <VideoOff className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                                <p className="text-gray-400 text-sm">Camera Off</p>
                            </div>
                        </div>
                    )}

                    {/* Video Controls Overlay */}
                    {showControls && (
                        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                    {isVideoOff ? userName.charAt(0).toUpperCase() : userName}
                                </Badge>
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-6 w-6 p-0"
                                        onClick={onMinimize}
                                    >
                                        <Minimize2 className="w-3 h-3" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-6 w-6 p-0"
                                        onClick={onMaximize}
                                    >
                                        <Maximize2 className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
