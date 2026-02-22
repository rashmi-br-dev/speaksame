"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

interface RoomHeaderProps {
    roomId: string;
    participantCount: number;
    onInvite: () => void;
    onShowParticipants: () => void;
    onShowInvite: () => void;
    layoutMode: "grid" | "speaker" | "gallery";
    onLayoutChange: (mode: "grid" | "speaker" | "gallery") => void;
}

export function RoomHeader({ 
    roomId, 
    participantCount, 
    onInvite, 
    onShowParticipants, 
    onShowInvite, 
    layoutMode, 
    onLayoutChange 
}: RoomHeaderProps) {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b px-4 py-2">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                        SpeakSame Room
                    </h1>
                    <Badge variant="secondary" className="text-xs">
                        {roomId}
                    </Badge>
                </div>

                <div className="flex items-center gap-2">
                    {/* Layout Mode Selector */}
                    <select
                        value={layoutMode}
                        onChange={(e) => onLayoutChange(e.target.value)}
                        className="w-32 px-3 py-2 border border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                        <option value="grid">Grid View</option>
                        <option value="speaker">Speaker View</option>
                        <option value="gallery">Gallery</option>
                    </select>

                    {/* Invite Button */}
                    <Button
                        onClick={onShowInvite}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                    >
                        <Users className="w-4 h-4" />
                        Invite
                    </Button>

                    {/* Participants */}
                    <Button
                        onClick={onShowParticipants}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                    >
                        <Users className="w-4 h-4" />
                        {participantCount}
                    </Button>

                    {/* Settings */}
                    <Button variant="outline" size="sm">
                        <Settings className="w-4 h-4" />
                    </Button>

                    {/* Theme Toggle */}
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
