"use client";

import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, Phone, PhoneOff } from "lucide-react";

interface VideoControlsProps {
    isMuted: boolean;
    isVideoOff: boolean;
    onToggleMute: () => void;
    onToggleVideo: () => void;
    onEndCall: () => void;
    isSpeaking: boolean;
}

export function VideoControls({ 
    isMuted, 
    isVideoOff, 
    onToggleMute, 
    onToggleVideo, 
    onEndCall,
    isSpeaking = false 
}: VideoControlsProps) {
    return (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex gap-2 bg-black/90 backdrop-blur-sm p-4 rounded-full shadow-2xl">
            <Button
                onClick={onToggleMute}
                variant={isMuted ? "destructive" : "secondary"}
                size="sm"
                className="rounded-full h-12 w-12"
            >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
            <Button
                onClick={onToggleVideo}
                variant={isVideoOff ? "destructive" : "secondary"}
                size="sm"
                className="rounded-full h-12 w-12"
            >
                {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </Button>
            <Button
                onClick={onEndCall}
                variant="destructive"
                size="sm"
                className="rounded-full h-12 w-12"
            >
                <PhoneOff className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                <span className="text-xs text-white font-medium">
                    {isSpeaking ? "Speaking" : "Silent"}
                </span>
            </div>
        </div>
    );
}
