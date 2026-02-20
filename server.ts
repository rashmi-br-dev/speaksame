import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { initSocket } from "./server/socket";

const dev = true;
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
        handle(req, res);
    });

    initSocket(httpServer);

    httpServer.listen(3000, () => {
        console.log("Running on http://localhost:3000");
    });
});
