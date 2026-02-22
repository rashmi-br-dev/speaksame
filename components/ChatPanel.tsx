"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, Users } from "lucide-react";

interface Message {
    id: string;
    user: string;
    text: string;
    timestamp: Date;
}

interface ChatPanelProps {
    messages: Message[];
    newMessage: string;
    onSendMessage: (message: string) => void;
    onMessageChange: (message: string) => void;
    isOpen: boolean;
    onToggle: () => void;
    currentUser: string;
}

export function ChatPanel({ 
    messages, 
    newMessage, 
    onSendMessage, 
    onMessageChange,
    isOpen, 
    onToggle, 
    currentUser 
}: ChatPanelProps) {
    return (
        <Card className={`fixed right-0 top-16 h-[calc(100vh-4rem)] w-80 ${isOpen ? 'translate-x-0' : 'translate-x-full'} transition-transform duration-300 ease-in-out ${isOpen ? 'shadow-xl' : ''} z-40`}>
            <CardHeader className="pb-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <MessageSquare className="w-5 h-5" />
                        Chat
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggle}
                        className="h-8 w-8 p-0"
                    >
                        ×
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="flex flex-col h-[calc(100%-60px)] p-4">
                <div className="flex-1 overflow-y-auto mb-4 p-2 border rounded">
                    {messages.map((message) => (
                        <div key={message.id} className="mb-2">
                            <div className="flex items-baseline gap-2">
                                <span className="font-semibold text-sm">
                                    {message.user === currentUser ? `${message.user} (You)` : message.user}:
                                </span>
                                <span className="text-xs text-gray-500">
                                    {new Date(message.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                            <p className="text-sm mt-1">{message.text}</p>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <Input
                        value={newMessage}
                        onChange={(e) => onMessageChange(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1"
                        onKeyPress={(e) => {
                            if (e.key === 'Enter' && newMessage.trim()) {
                                onSendMessage(newMessage);
                            }
                        }}
                    />
                    <Button
                        onClick={() => onSendMessage(newMessage)}
                        size="sm"
                        className="px-4 py-2"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
