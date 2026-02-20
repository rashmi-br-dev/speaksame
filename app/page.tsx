"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");

  function createRoom() {
    if (!name) return alert("Enter your name");
    const id = nanoid(8);
    router.push(`/room/${id}?name=${encodeURIComponent(name)}`);
  }

  function joinRoom() {
    if (!name || !room) return alert("Enter name and room id");
    router.push(`/room/${room}?name=${encodeURIComponent(name)}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-[380px]">
        <CardHeader>
          <CardTitle className="text-center text-2xl">SpeakSame</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Your name</Label>
            <Input
              placeholder="Rahul"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <Button onClick={createRoom} className="w-full">
            Create Room
          </Button>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-px bg-border flex-1" />
            OR
            <div className="h-px bg-border flex-1" />
          </div>

          <div className="space-y-2">
            <Label>Room ID</Label>
            <Input
              placeholder="Enter room id"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            />
          </div>

          <Button variant="secondary" onClick={joinRoom} className="w-full">
            Join Room
          </Button>
        </CardContent>
      </Card>
    </main>
  );

}
