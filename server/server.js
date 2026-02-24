const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "../client")));

const toxicWords = ["useless", "idiot", "stupid", "hate"];

io.on("connection", (socket) => {
    console.log("User connected");

    socket.on("chatMessage", (msg) => {

        const lowerMsg = msg.toLowerCase();

        const isToxic = toxicWords.some(word =>
            lowerMsg.includes(word)
        );

        if (isToxic) {
            socket.emit("warning", "⚠ Toxic message detected!");
        } else {
            io.emit("chatMessage", msg);
        }
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});