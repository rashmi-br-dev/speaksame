"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  Monitor,
  MessageSquare,
  Users,
  Settings,
  Maximize2,
  Crown,
  Volume2,
  VolumeX
} from "lucide-react";

interface RoomControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  chatOpen: boolean;
  showParticipants: boolean;
  showInvite: boolean;
  layoutMode: "grid" | "speaker";
  currentUser: string;
  roomId: string;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onToggleInvite: () => void;
  onToggleLayout: () => void;
  onLeaveRoom: () => void;
  participantCount: number;
}

export function RoomControls({
  isMuted,
  isVideoOff,
  isScreenSharing,
  chatOpen,
  showParticipants,
  showInvite,
  layoutMode,
  currentUser,
  roomId,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onToggleChat,
  onToggleParticipants,
  onToggleInvite,
  onToggleLayout,
  onLeaveRoom,
  participantCount
}: RoomControlsProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50">
      <div className="flex items-center justify-between p-4">
        {/* Left side - Room info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              Room: {roomId}
            </Badge>
            <Badge variant="secondary" className="text-sm">
              {currentUser}
            </Badge>
          </div>
          
          <Separator orientation="vertical" className="h-6" />
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleParticipants}
              className={`gap-2 ${showParticipants ? 'bg-accent' : ''}`}
            >
              <Users className="w-4 h-4" />
              {participantCount}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleInvite}
              className={`gap-2 ${showInvite ? 'bg-accent' : ''}`}
            >
              Invite
            </Button>
          </div>
        </div>

        {/* Center - Main controls */}
        <div className="flex items-center gap-2">
          <Button
            variant={isMuted ? "destructive" : "secondary"}
            size="lg"
            onClick={onToggleMute}
            className="rounded-full w-12 h-12"
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>
          
          <Button
            variant={isVideoOff ? "destructive" : "secondary"}
            size="lg"
            onClick={onToggleVideo}
            className="rounded-full w-12 h-12"
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </Button>
          
          <Button
            variant={isScreenSharing ? "default" : "secondary"}
            size="lg"
            onClick={onToggleScreenShare}
            className="rounded-full w-12 h-12"
          >
            <Monitor className="w-5 h-5" />
          </Button>
          
          <Button
            variant="outline"
            size="lg"
            onClick={onToggleLayout}
            className="rounded-full w-12 h-12"
          >
            <Maximize2 className="w-5 h-5" />
          </Button>
          
          <Button
            variant="destructive"
            size="lg"
            onClick={onLeaveRoom}
            className="rounded-full w-12 h-12"
          >
            <Phone className="w-5 h-5 transform rotate-135" />
          </Button>
        </div>

        {/* Right side - Secondary controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleChat}
            className={`gap-2 ${chatOpen ? 'bg-accent' : ''}`}
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
