const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.json());

const dataFile = path.join(__dirname, "cards.json");
let cards = [];

function loadCards(){
  if (fs.existsSync(dataFile)) {
    try { cards = JSON.parse(fs.readFileSync(dataFile,"utf8")); } catch(e){ cards = []; }
  } else {
    cards = [];
  }
}
function saveCards(){
  fs.writeFileSync(dataFile, JSON.stringify(cards, null, 2));
}

loadCards();

app.get("/cards", (req, res) => res.json(cards));

app.post("/cards", (req, res) => {
  const card = { id: Date.now(), ...req.body };
  cards.push(card);
  saveCards();
  io.emit("card_added", card);
  res.json(card);
});

app.put("/cards/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const idx = cards.findIndex(c => c.id === id);
  if (idx >= 0) {
    cards[idx] = { ...cards[idx], ...req.body };
    saveCards();
    io.emit("card_updated", cards[idx]);
    res.json(cards[idx]);
  } else res.status(404).end();
});

app.delete("/cards/:id", (req, res) => {
  const id = parseInt(req.params.id);
  cards = cards.filter(c => c.id !== id);
  saveCards();
  io.emit("card_deleted", id);
  res.json({ success: true });
});

io.on("connection", (socket) => {
  console.log("Client connected");
  socket.emit("init", cards);
});

server.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});