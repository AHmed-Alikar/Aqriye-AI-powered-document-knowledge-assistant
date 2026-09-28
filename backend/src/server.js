const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./db");
const documentsRouter = require("./routes/documents");
const chatRouter = require("./routes/chat");
const { chunkText } = require("./services/chunkService");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Aqriye API is running",
  });
});
app.use("/api/documents", documentsRouter);
app.use("/api/chat", chatRouter);
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Aqriye API is running",
  });
});
app.get("/api/test-chunking", (req, res) => {
  const text = `
Aqriye is an AI-powered document knowledge assistant.
It allows users to upload documents and ask questions.
The system extracts text from documents and divides the text
into smaller chunks before generating embeddings.
These embeddings are stored in a vector database.
  `;

  const chunks = chunkText(text, 100, 20);

  res.json({
    status: "ok",
    totalChunks: chunks.length,
    chunks,
  });
});
app.get("/api/test-db", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW() AS current_time");

    res.json({
      status: "ok",
      database: "connected",
      time: result.rows[0].current_time,
    });
  } catch (error) {
    console.error("Database connection failed:", error);

    res.status(500).json({
      status: "error",
      database: "connection failed",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Aqriye API running on port ${PORT}`);
});
