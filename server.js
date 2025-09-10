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
  cors: { origin: "*" } // Erlaubt Verbindungen von allen Clients
});

app.use(express.json());

const dataFile = path.join(__dirname, "cards.json");
let cards = [];

// Laden der Karten beim Start
function loadCards() {
  if (fs.existsSync(dataFile)) {
    try { cards = JSON.parse(fs.readFileSync(dataFile, "utf8")); } 
    catch (e) { cards = []; }
  } else {
    cards = [];
  }
}

// Speichern der Karten + optionales Backup
function saveCards() {
  fs.writeFileSync(dataFile, JSON.stringify(cards, null, 2));
  // Backup optional: jede Änderung in data-backup.json speichern
  fs.writeFileSync(path.join(__dirname, "cards-backup.json"), JSON.stringify(cards, null, 2));
}

loadCards();

// Test-Route
app.get('/', (req, res) => {
  res.send('Whiteboard läuft!');
});

// REST-Endpoints
app.get("/cards", (req, res) => res.json(cards));

app.post("/cards", (req, res) => {
  const card = { id: Date.now(), ...req.body };
  cards.push(card);
  saveCards();
  io.emit("card_added", card); // Broadcast an alle Clients
  res.json(card);
});

app.put("/cards/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const idx = cards.findIndex(c => c.id === id);
  if (idx >= 0) {
    cards[idx] = { ...cards[idx], ...req.body };
    saveCards();
    io.emit("card_updated", cards[idx]); // Broadcast an alle Clients
    res.json(cards[idx]);
  } else res.status(404).end();
});

// PUT /cards/:id/uml
app.put("/cards/:id/uml", (req, res) => {
  const id = parseInt(req.params.id);
  const idx = cards.findIndex(c => c.id === id);
  if (idx >= 0) {
    cards[idx].uml = req.body; // erwartet JSON { type, nodes, edges }
    saveCards();
    io.emit("uml_updated", { cardId: id, umlData: cards[idx].uml });
    res.json(cards[idx].uml);
  } else {
    res.status(404).json({ error: "Karte nicht gefunden" });
  }
});

app.delete("/cards/:id", (req, res) => {
  const id = parseInt(req.params.id);
  cards = cards.filter(c => c.id !== id);
  saveCards();
  io.emit("card_deleted", id); // Broadcast an alle Clients
  res.json({ success: true });
});

// Socket.IO Verbindung
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Initialisierung beim Client
  socket.emit("init", cards);

  // Optional: neue Karten direkt vom Socket empfangen
  socket.on("add_card", (cardData) => {
    const card = { id: Date.now(), ...cardData };
    cards.push(card);
    saveCards();
    io.emit("card_added", card);
  });

  socket.on("update_card", ({ id, updates }) => {
    const idx = cards.findIndex(c => c.id === id);
    if (idx >= 0) {
      cards[idx] = { ...cards[idx], ...updates };
      saveCards();
      io.emit("card_updated", cards[idx]);
    }
  });

  socket.on("delete_card", (id) => {
    cards = cards.filter(c => c.id !== id);
    saveCards();
    io.emit("card_deleted", id);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Server starten
server.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});

// ------------------- UML Sub-Board -------------------
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Sende Initialdaten
  socket.emit("init", cards);

  // Andere Events (wie schon vorhanden) ...
  
  // Event: UML Diagramm aktualisiert
  socket.on("uml_updated", ({ cardId, umlData }) => {
    const idx = cards.findIndex(c => c.id === cardId);
    if (idx >= 0) {
      cards[idx].uml = umlData;   // Speichert das UML-Subboard in der Karte
      saveCards();                // JSON-Datei aktualisieren
      io.emit("uml_updated", { cardId, umlData }); // Broadcast an alle Clients
    }
  });
});
