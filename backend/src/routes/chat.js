const express = require("express");
const rateLimit = require("express-rate-limit");
const { answerQuestion } = require("../services/ragService");

const router = express.Router();

// Each question triggers one embedding call + one LLM call, both billed
// against Hugging Face's shared Inference Providers credit pool. Rate
// limiting keeps a single client from burning through that budget.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many questions. Please slow down and try again shortly.",
  },
});

router.post("/", chatLimiter, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        status: "error",
        message: "message is required",
      });
    }

    const { answer, sources } = await answerQuestion(message);

    res.json({
      status: "ok",
      answer,
      sources,
    });
  } catch (error) {
    console.error("Chat request failed:", error);

    res.status(500).json({
      status: "error",
      message: "Failed to answer the question",
    });
  }
});

module.exports = router;
