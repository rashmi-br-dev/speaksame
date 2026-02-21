import { Server } from "socket.io";

const rooms: Record<string, { id: string; name: string }[]> = {};

export function initSocket(server: any) {
    const io = new Server(server, {
        cors: { origin: "*" },
    });

    io.on("connection", (socket) => {
        console.log("user connected", socket.id);

        // user joins room
        socket.on("join-room", ({ roomId, name }) => {
            console.log("=== USER JOINING ROOM ===");
            console.log("Socket ID:", socket.id);
            console.log("Room ID:", roomId);
            console.log("Name:", name);
            
            socket.join(roomId);

            if (!rooms[roomId]) rooms[roomId] = [];

            const user = { id: socket.id, name };
            rooms[roomId].push(user);

            console.log("Users in room after join:", rooms[roomId]);
            io.to(roomId).emit("users", rooms[roomId]);
        });

        // 🔴 IMPORTANT — WebRTC signaling exchange
        socket.on("signal", ({ to, signal }) => {
            // Find the user's name to send with the signal
            const user = Object.values(rooms).flat().find(u => u.id === socket.id);
            io.to(to).emit("signal", {
                from: socket.id,
                signal,
                userName: user?.name || "Unknown"
            });
        });

        // Chat message handling
        socket.on("chat-message", ({ roomId, message }) => {
            io.to(roomId).emit("chat-message", message);
        });

        // user leaves
        socket.on("disconnect", () => {
            for (const roomId in rooms) {
                rooms[roomId] = rooms[roomId].filter((u) => u.id !== socket.id);
                io.to(roomId).emit("users", rooms[roomId]);
            }
        });
    });
}
