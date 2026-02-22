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

            // Remove any existing user with same socket ID (prevent duplicates)
            rooms[roomId] = rooms[roomId].filter(u => u.id !== socket.id);
            
            // Also remove any existing user with same name (prevent name duplicates)
            rooms[roomId] = rooms[roomId].filter(u => u.name !== name || u.id === socket.id);
            
            const user = { id: socket.id, name: name || `User-${socket.id.slice(-4)}` };
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
        socket.on("leave-room", ({ roomId }) => {
            console.log("=== USER LEAVING ROOM ===");
            console.log("Socket ID:", socket.id);
            console.log("Room ID:", roomId);
            
            socket.leave(roomId);
            
            if (rooms[roomId]) {
                rooms[roomId] = rooms[roomId].filter((u) => u.id !== socket.id);
                console.log("Users in room after leave:", rooms[roomId]);
                io.to(roomId).emit("users", rooms[roomId]);
            }
        });

        socket.on("disconnect", () => {
            console.log("=== USER DISCONNECTED ===");
            console.log("Socket ID:", socket.id);
            
            for (const roomId in rooms) {
                // Remove user from room and update list
                const originalLength = rooms[roomId].length;
                rooms[roomId] = rooms[roomId].filter((u) => u.id !== socket.id);
                
                if (rooms[roomId].length < originalLength) {
                    console.log(`Removed user ${socket.id} from room ${roomId}`);
                    console.log("Users in room after disconnect:", rooms[roomId]);
                    io.to(roomId).emit("users", rooms[roomId]);
                }
            }
        });

        // Additional cleanup on connection close
        socket.on("close", () => {
            console.log("=== SOCKET CLOSED ===");
            console.log("Socket ID:", socket.id);
            
            for (const roomId in rooms) {
                const originalLength = rooms[roomId].length;
                rooms[roomId] = rooms[roomId].filter((u) => u.id !== socket.id);
                
                if (rooms[roomId].length < originalLength) {
                    console.log(`Cleaned up user ${socket.id} from room ${roomId}`);
                    io.to(roomId).emit("users", rooms[roomId]);
                }
            }
        });
    });
}
