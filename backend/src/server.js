const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./db");
const documentsRouter = require("./routes/documents");
const chatRouter = require("./routes/chat");

const app = express();

// Permissive by default for local development. Once FRONTEND_URL is set
// (production), only that origin is allowed to call the API.
const corsOptions = process.env.FRONTEND_URL
  ? { origin: process.env.FRONTEND_URL }
  : {};
app.use(cors(corsOptions));
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

// 404 for anything that didn't match a route above.
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Not found",
  });
});

// Central error handler. Catches multer errors (bad file type/size),
// synchronous throws, and anything passed to next(err). Never leaks
// stack traces or internal error messages to the client.
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      status: "error",
      message: "File exceeds the 10MB limit",
    });
  }

  if (err.message === "Only PDF files are allowed") {
    return res.status(400).json({
      status: "error",
      message: err.message,
    });
  }

  res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Aqriye API running on port ${PORT}`);
});
