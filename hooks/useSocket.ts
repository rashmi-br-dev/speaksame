"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface Message {
  id: string;
  user: string;
  text: string;
  timestamp: Date;
}

interface User {
  id: string;
  name: string;
}

export const useSocket = (serverUrl: string = "http://localhost:3000") => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [myId, setMyId] = useState<string>("");
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback((roomId: string, userName: string) => {
    console.log("=== CONNECTING TO ROOM ===");
    console.log("Room ID:", roomId);
    console.log("User Name:", userName);
    
    // Create new socket connection
    const newSocket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: false, // Disable auto-reconnection to prevent loops
      reconnectionAttempts: 0,
      reconnectionDelay: 0,
      timeout: 20000,
      forceNew: true, // Force new connection
    });
    
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Connected to server with ID:", newSocket.id);
      setMyId(newSocket.id || "");
      setIsConnected(true);
      
      console.log("Emitting join-room with:", { roomId, name: userName });
      newSocket.emit("join-room", {
        roomId,
        name: userName,
      });
    });

    newSocket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      console.error("Connection failed details:", {
        url: serverUrl,
        error: error.message,
        transports: ['websocket', 'polling']
      });
      
      // Try fallback to polling if websocket fails
      if (error.message?.includes('websocket')) {
        console.log("WebSocket failed, trying polling transport...");
        setTimeout(() => {
          newSocket.io.opts.transports = ['polling'];
          newSocket.connect();
        }, 2000);
      }
    });

    newSocket.on("disconnect", (reason) => {
      console.log("Disconnected from server:", reason);
      setIsConnected(false);
    });

    newSocket.on("users", (roomUsers: User[]) => {
      console.log("Users in room:", roomUsers);
      setUsers(roomUsers);
    });

    newSocket.on("chat-message", (message: Message) => {
      console.log("Received chat message:", message);
      setMessages(prev => {
        if (prev.find(m => m.id === message.id)) {
          return prev;
        }
        return [...prev, message].slice(-50);
      });
    });

    return newSocket;
  }, [serverUrl]);

  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  }, [socket]);

  const sendMessage = useCallback((message: string, userName: string) => {
    if (socket && isConnected) {
      const newMessage: Message = {
        id: `${Date.now()}-${Math.random()}`,
        user: userName,
        text: message,
        timestamp: new Date(),
      };
      socket.emit("chat-message", newMessage);
    }
  }, [socket, isConnected]);

  const emitSignal = useCallback((to: string, signal: any, userName: string) => {
    if (socket && isConnected) {
      socket.emit("signal", { to, signal, userName });
    }
  }, [socket, isConnected]);

  useEffect(() => {
    return () => {
      if (socket) {
        console.log("Cleaning up socket connection");
        socket.disconnect();
        socket.removeAllListeners();
      }
    };
  }, [socket]);

  return {
    socket,
    myId,
    users,
    messages,
    isConnected,
    connect,
    disconnect,
    sendMessage,
    emitSignal,
    setMessages
  };
};