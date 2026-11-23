const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));

let gameEnabled = true;

const rooms = {};

app.get("/api/status", (req, res) => {
    res.json({
        online: gameEnabled,
        players: io.engine.clientsCount,
        rooms: Object.keys(rooms).length
    });
});

app.post("/api/admin/toggle", (req, res) => {
    const adminKey = process.env.ADMIN_KEY;

    if (!adminKey || req.headers["x-admin-key"] !== adminKey) {
        return res.status(403).json({
            error: "دسترسی غیرمجاز"
        });
    }

    gameEnabled = !gameEnabled;

    io.emit("game-status", gameEnabled);

    res.json({
        success: true,
        online: gameEnabled
    });
});

io.on("connection", (socket) => {

    socket.emit("game-status", gameEnabled);

    socket.on("join-room", (roomName) => {
        if (!gameEnabled) {
            socket.emit("error-message", "بازی موقتاً غیرفعال است");
            return;
        }

        if (typeof roomName !== "string" ||
            !/^[a-zA-Z0-9_-]{1,20}$/.test(roomName)) {
            return;
        }

        socket.join(roomName);

        if (!rooms[roomName]) {
            rooms[roomName] = {
                players: 0
            };
        }

        rooms[roomName].players++;

        io.to(roomName).emit("room-update", {
            players: rooms[roomName].players
        });
    });

    socket.on("disconnecting", () => {
        for (const roomName of socket.rooms) {
            if (rooms[roomName]) {
                rooms[roomName].players--;

                if (rooms[roomName].players <= 0) {
                    delete rooms[roomName];
                } else {
                    io.to(roomName).emit("room-update", {
                        players: rooms[roomName].players
                    });
                }
            }
        }
    });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log("ACADEMY 11 Server Started!");
});
