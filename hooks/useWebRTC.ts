"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Peer from "simple-peer";

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

export const useWebRTC = (socket: any, myId: string, stream?: MediaStream) => {
  const peersRef = useRef<Record<string, Peer.Instance>>({});
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [videoFrames, setVideoFrames] = useState<VideoFrame[]>([]);

  const createPeer = useCallback((userId: string, initiator: boolean, mediaStream: MediaStream, userName: string) => {
    console.log("=== CREATING PEER ===");
    console.log("Target user:", userId, userName);
    console.log("Am I initiator:", initiator);
    console.log("Stream tracks:", mediaStream.getTracks().length);
    
    // Destroy existing peer if any
    if (peersRef.current[userId]) {
      console.log("Peer already exists for", userId, "destroying old one");
      peersRef.current[userId].destroy();
    }

    const peer = new Peer({
      initiator,
      trickle: false,
      stream: mediaStream, // Pass the stream directly
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
        ],
      },
    });

    peer.on("signal", (signal) => {
      console.log("Sending signal to:", userId);
      socket?.emit("signal", { 
        to: userId, 
        signal,
        userName: userName 
      });
    });

    peer.on("stream", (remoteStream) => {
      console.log("=== RECEIVED REMOTE STREAM ===");
      console.log("From user:", userId, userName);
      console.log("Remote tracks:", remoteStream.getTracks().length);

      // Update remote peers
      setRemotePeers(prev => {
        const existing = prev.find(p => p.id === userId);
        if (existing) {
          return prev.map(p => p.id === userId ? { ...p, stream: remoteStream } : p);
        } else {
          return [...prev, { id: userId, name: userName, stream: remoteStream }];
        }
      });

      // Update video frames
      setVideoFrames(prev => {
        const existing = prev.find(f => f.id === userId);
        if (existing) {
          return prev.map(f => f.id === userId ? { ...f, stream: remoteStream } : f);
        } else {
          const newFrame: VideoFrame = {
            id: userId,
            name: userName,
            stream: remoteStream,
            isMinimized: false,
            isMaximized: false,
            position: { x: 0, y: 0 },
            size: { width: 320, height: 240 }
          };
          return [...prev, newFrame];
        }
      });
    });

    peer.on("connect", () => {
      console.log("=== PEER CONNECTED ===", userId, userName);
    });

    peer.on("error", (error) => {
      console.error("Peer error for user", userId, ":", error);
    });

    peer.on("close", () => {
      console.log("Peer closed for user:", userId);
      delete peersRef.current[userId];
      setRemotePeers(prev => prev.filter(p => p.id !== userId));
      setVideoFrames(prev => prev.filter(f => f.id !== userId));
    });

    peersRef.current[userId] = peer;
    return peer;
  }, [socket]);

  const handleSignal = useCallback(({ from, signal, userName }: { from: string; signal: any; userName: string }) => {
    console.log("=== SIGNAL RECEIVED ===");
    console.log("From user:", from, userName);
    console.log("Signal type:", typeof signal, signal);
    
    let peer = peersRef.current[from];

    if (!peer) {
      console.log("Creating peer for signal from:", from);
      // For incoming connections, we need to create a peer with initiator=false
      // and pass local stream
      if (stream) {
        peer = createPeer(from, false, stream, userName);
      } else {
        console.error("No local stream available for peer creation");
        return;
      }
    }

    // Process signal
    try {
      peer.signal(signal);
      console.log("Signal processed successfully for:", from);
    } catch (error) {
      console.error("Error processing signal for", from, ":", error);
    }
  }, [createPeer, stream]);

  const cleanup = useCallback(() => {
    Object.values(peersRef.current).forEach(peer => {
      if (peer && !peer.destroyed) {
        peer.destroy();
      }
    });
    peersRef.current = {};
    setRemotePeers([]);
    setVideoFrames([]);
  }, []);

  const toggleVideoFrameMinimize = useCallback((peerId: string) => {
    setVideoFrames(prev => prev.map(frame =>
      frame.id === peerId ? { ...frame, isMinimized: !frame.isMinimized } : frame
    ));
  }, []);

  const toggleVideoFrameMaximize = useCallback((peerId: string) => {
    setVideoFrames(prev => prev.map(frame =>
      frame.id === peerId ? { ...frame, isMaximized: !frame.isMaximized } : frame
    ));
  }, []);

  return {
    remotePeers,
    videoFrames,
    createPeer,
    handleSignal,
    cleanup,
    toggleVideoFrameMinimize,
    toggleVideoFrameMaximize,
    peersRef,
  };
};