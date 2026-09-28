const express = require("express");
const multer = require("multer");
const path = require("path");
const rateLimit = require("express-rate-limit");

const db = require("../db");
const { extractPdfText } = require("../services/documentService");
const { chunkText } = require("../services/chunkService");
const { generateEmbeddings } = require("../services/embeddingService");

const router = express.Router();

// Upload triggers PDF parsing + one embedding call per chunk, so it's
// worth limiting per IP to avoid accidental abuse and runaway API cost.
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many uploads. Please try again later.",
  },
});

const upload = multer({
  dest: path.join(__dirname, "../../uploads"),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const hasValidExtension =
      path.extname(file.originalname).toLowerCase() === ".pdf";

    if (file.mimetype === "application/pdf" && hasValidExtension) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

router.post("/upload", uploadLimiter, upload.single("file"), async (req, res) => {
  let client;

  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "PDF file is required",
      });
    }

    // 1. Extract text from PDF
    const result = await extractPdfText(req.file.path);

    if (!result.text || !result.text.trim()) {
      return res.status(400).json({
        status: "error",
        message: "No readable text was found in the PDF",
      });
    }

    // 2. Split text into chunks
    const chunks = chunkText(result.text, 1000, 200);

    if (chunks.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No chunks could be created from the PDF",
      });
    }

    // 3. Get database connection
    client = await db.connect();

    // 4. Start transaction
    await client.query("BEGIN");

    // 5. Save document
    const documentResult = await client.query(
      `
      INSERT INTO documents (file_name, file_url)
      VALUES ($1, $2)
      RETURNING id, file_name, created_at
      `,
      [req.file.originalname, req.file.path]
    );

    const document = documentResult.rows[0];

    // 6. Generate embeddings for every chunk
    const embeddings = await generateEmbeddings(chunks);

    // 7. Save chunks with their embeddings
    for (let i = 0; i < chunks.length; i++) {
      await client.query(
        `
        INSERT INTO document_chunks (
          document_id,
          content,
          embedding,
          metadata
        )
        VALUES ($1, $2, $3, $4)
        `,
        [
          document.id,
          chunks[i],
          JSON.stringify(embeddings[i]),
          JSON.stringify({
            chunk_index: i,
            total_chunks: chunks.length,
          }),
        ]
      );
    }

    // 8. Commit transaction
    await client.query("COMMIT");

    res.status(201).json({
      status: "ok",
      message: "PDF uploaded, extracted, chunked, and saved successfully",
      document: {
        id: document.id,
        originalName: req.file.originalname,
        pages: result.pages,
        textLength: result.text.length,
        totalChunks: chunks.length,
      },
    });
  } catch (error) {
    // Rollback database changes if something fails
    if (client) {
      await client.query("ROLLBACK");
    }

    console.error("PDF processing failed:", error);

    res.status(500).json({
      status: "error",
      message: "Failed to process PDF",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

module.exports = router;