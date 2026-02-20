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
            socket.join(roomId);

            if (!rooms[roomId]) rooms[roomId] = [];

            const user = { id: socket.id, name };
            rooms[roomId].push(user);

            io.to(roomId).emit("users", rooms[roomId]);
        });

        // 🔴 IMPORTANT — WebRTC signaling exchange
        socket.on("signal", ({ to, signal }) => {
            io.to(to).emit("signal", {
                from: socket.id,
                signal,
            });
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
