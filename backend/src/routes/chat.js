const express = require("express");
const rateLimit = require("express-rate-limit");
const { answerQuestionStream } = require("../services/ragService");
const {
  getOrCreateConversation,
  saveMessage,
} = require("../services/conversationService");

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

function sendEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

router.post("/", chatLimiter, async (req, res) => {
  const { message, documentId } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({
      status: "error",
      message: "message is required",
    });
  }

  if (!documentId) {
    return res.status(400).json({
      status: "error",
      message: "Please select a document before asking a question.",
    });
  }

  // Real token streaming via Server-Sent Events: the client gets
  // "status" events tied to actual pipeline stages (search, then
  // generation), "token" events as the LLM's real streamed output
  // arrives, and a final "done" event with sources. Nothing here is a
  // simulated/fake progress indicator.
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const abortController = new AbortController();
  req.on("close", () => abortController.abort());

  try {
    const conversationId = await getOrCreateConversation(documentId);
    await saveMessage(conversationId, "user", message);

    const { answer, sources } = await answerQuestionStream(message, documentId, {
      onStatus: (status) => sendEvent(res, "status", { message: status }),
      onToken: (token) => sendEvent(res, "token", { text: token }),
      signal: abortController.signal,
    });

    const saved = await saveMessage(conversationId, "assistant", answer, sources);

    sendEvent(res, "done", { sources, messageId: saved.id });
    res.end();
  } catch (error) {
    if (error.name === "AbortError") {
      // Client disconnected before the answer finished - nothing to send.
      return res.end();
    }

    console.error("Chat request failed:", error);
    sendEvent(res, "error", {
      message: "Unable to generate an answer right now. Please try again.",
    });
    res.end();
  }
});

module.exports = router;
