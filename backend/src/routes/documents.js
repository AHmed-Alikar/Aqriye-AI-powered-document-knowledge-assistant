const express = require("express");
const multer = require("multer");
const path = require("path");
const rateLimit = require("express-rate-limit");

const db = require("../db");
const { extractPdfText } = require("../services/documentService");
const { chunkPages } = require("../services/chunkService");
const { detectPageSections } = require("../services/sectionService");
const { generateEmbeddings } = require("../services/embeddingService");
const { storeUploadedFile } = require("../services/storageService");
const { getMessages } = require("../services/conversationService");
const { getSuggestedQuestions } = require("../services/suggestionService");

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
    let result;
    try {
      result = await extractPdfText(req.file.path);
    } catch (parseError) {
      console.error("PDF parsing failed:", parseError);
      return res.status(400).json({
        status: "error",
        message: "This PDF could not be read. It may be corrupted.",
      });
    }

    if (!result.text || !result.text.trim()) {
      // Most commonly a scanned/image-only PDF with no OCR text layer.
      // Aqriye does not perform OCR, so this is reported honestly rather
      // than silently generating chunks/embeddings from empty text.
      return res.status(400).json({
        status: "error",
        message: "This PDF does not contain readable text.",
      });
    }

    // 2. Split into page-aware chunks + detect section headings per page
    const pageChunks = chunkPages(result.pageTexts, 1000, 200);
    const pageSections = detectPageSections(result.pageTexts);

    if (pageChunks.length === 0) {
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
    const safeFileName = req.file.originalname.slice(0, 255);

    // Persists to Supabase Storage when configured, otherwise keeps the
    // local temp path multer already wrote - see storageService.js.
    const fileUrl = await storeUploadedFile(req.file.path, safeFileName);

    const documentResult = await client.query(
      `
      INSERT INTO documents (file_name, file_url)
      VALUES ($1, $2)
      RETURNING id, file_name, created_at
      `,
      [safeFileName, fileUrl]
    );

    const document = documentResult.rows[0];

    // 6. Generate embeddings for every chunk
    const embeddings = await generateEmbeddings(
      pageChunks.map((chunk) => chunk.content)
    );

    // 7. Save chunks with their embeddings
    for (let i = 0; i < pageChunks.length; i++) {
      const { content, pageNumber } = pageChunks[i];

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
          content,
          JSON.stringify(embeddings[i]),
          JSON.stringify({
            chunk_index: i,
            total_chunks: pageChunks.length,
            page_number: pageNumber,
            total_pages: result.totalPages,
            section: pageSections[pageNumber - 1] ?? null,
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
        totalPages: result.totalPages,
        textLength: result.text.length,
        totalChunks: pageChunks.length,
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

router.get("/", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        d.id,
        d.file_name,
        d.created_at,
        COUNT(DISTINCT dc.metadata->>'page_number') AS page_count
      FROM documents d
      LEFT JOIN document_chunks dc ON dc.document_id = d.id
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `);

    res.json({
      status: "ok",
      documents: result.rows.map((row) => ({
        id: row.id,
        fileName: row.file_name,
        createdAt: row.created_at,
        pageCount: Number(row.page_count) > 0 ? Number(row.page_count) : null,
      })),
    });
  } catch (error) {
    console.error("Failed to list documents:", error);

    res.status(500).json({
      status: "error",
      message: "Failed to list documents",
    });
  }
});

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many requests. Please slow down.",
  },
});

router.get("/:id/messages", readLimiter, async (req, res) => {
  try {
    const messages = await getMessages(req.params.id);

    res.json({
      status: "ok",
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: m.sources,
        createdAt: m.created_at,
      })),
    });
  } catch (error) {
    console.error("Failed to load conversation history:", error);

    res.status(500).json({
      status: "error",
      message: "Unable to access the document right now. Please try again.",
    });
  }
});

router.get("/:id/suggestions", readLimiter, async (req, res) => {
  try {
    const suggestions = await getSuggestedQuestions(req.params.id);

    res.json({
      status: "ok",
      suggestions,
    });
  } catch (error) {
    console.error("Failed to generate suggestions:", error);

    res.status(500).json({
      status: "error",
      message: "Unable to access the document right now. Please try again.",
    });
  }
});

module.exports = router;