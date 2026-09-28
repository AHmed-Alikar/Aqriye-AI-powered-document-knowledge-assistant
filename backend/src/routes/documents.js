const express = require("express");
const multer = require("multer");
const path = require("path");

const { extractPdfText } = require("../services/documentService");

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, "../../uploads"),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "PDF file is required",
      });
    }

    const result = await extractPdfText(req.file.path);

    res.status(201).json({
      status: "ok",
      message: "PDF uploaded and text extracted successfully",
      document: {
        originalName: req.file.originalname,
        fileName: req.file.filename,
        pages: result.pages,
        textLength: result.text.length,
        text: result.text,
      },
    });
  } catch (error) {
    console.error("PDF processing failed:", error);

    res.status(500).json({
      status: "error",
      message: "Failed to process PDF",
    });
  }
});

module.exports = router;