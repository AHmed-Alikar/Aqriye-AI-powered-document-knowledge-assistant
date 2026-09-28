const express = require("express");
const { answerQuestion } = require("../services/ragService");

const router = express.Router();

router.post("/", async (req, res) => {
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
