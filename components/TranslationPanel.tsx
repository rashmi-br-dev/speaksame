"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Monitor, Volume2, X } from "lucide-react";

interface TranslationPanelProps {
    transcript: string;
    translated: string;
    detectedLanguage: string;
    targetLanguage: string | null;
    onLanguageChange: (language: string | null) => void;
    isListening: boolean;
    isOpen: boolean;
    onToggle: () => void;
}

export function TranslationPanel({ 
    transcript, 
    translated, 
    detectedLanguage, 
    targetLanguage, 
    onLanguageChange, 
    isListening = false,
    isOpen,
    onToggle
}: TranslationPanelProps) {
    return (
        <>
            {/* Translation Toggle Button */}
            {!isOpen && (
                <Button
                    onClick={onToggle}
                    className="fixed top-20 left-4 h-12 w-12 rounded-full shadow-lg z-30"
                    size="icon"
                >
                    <Monitor className="w-5 h-5" />
                </Button>
            )}
            
            {/* Translation Panel */}
            <Card className={`fixed left-0 top-16 h-[calc(100vh-4rem)] w-96 ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out ${isOpen ? 'shadow-xl' : ''} z-40 rounded-none border-0`}>
                <CardHeader className="pb-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Monitor className="w-5 h-5" />
                            🎤 Live Translation
                        </CardTitle>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onToggle}
                            className="h-8 w-8 p-0 text-white hover:bg-white/20"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </CardHeader>
            <CardContent className="space-y-4 p-4">
                {/* Translation Status */}
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-sm font-medium text-green-600">
                        🎧 Listening for speech...
                    </span>
                </div>

                {/* Original Speech */}
                <div className={`p-3 rounded-lg ${detectedLanguage ? 'bg-gray-100' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-gray-500">ORIGINAL SPEECH</span>
                        <Badge variant="outline" className="text-xs">
                            {detectedLanguage.toUpperCase()}
                        </Badge>
                    </div>
                    <p className="text-sm">
                        {transcript || "🎤 Start speaking..."}
                    </p>
                </div>

                {/* Translated Text */}
                <div className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-blue-600">TRANSLATED</span>
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                            {targetLanguage?.toUpperCase() || "NONE"}
                        </Badge>
                    </div>
                    <p className="text-sm font-medium text-blue-800">
                        {translated || "⏳ Waiting for translation..."}
                    </p>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1">
                        🔊 Speak Translation
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                        📋 Copy Translation
                    </Button>
                </div>
            </CardContent>
        </Card>
        </>
    );
}
