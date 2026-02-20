"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RoomRedirect() {
    const router = useRouter();

    // Generate a random room ID and redirect
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    if (typeof window !== "undefined") {
        router.push(`/room/${roomId}`);
    }

    return (
        <main className="min-h-screen bg-background flex items-center justify-center p-6">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Creating Room...</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-muted-foreground">Redirecting to your room...</p>
                </CardContent>
            </Card>
        </main>
    );
}
