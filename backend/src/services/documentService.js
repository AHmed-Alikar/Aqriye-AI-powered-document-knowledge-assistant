const fs = require("fs");
const { PDFParse } = require("pdf-parse");

// Accepts either a local file path (existing behavior) or a Buffer
// (used when the file was read from Supabase Storage instead of disk).
async function extractPdfText(fileOrPath) {
  const buffer = Buffer.isBuffer(fileOrPath)
    ? fileOrPath
    : fs.readFileSync(fileOrPath);

  const parser = new PDFParse({
    data: buffer,
  });

  try {
    const result = await parser.getText();

    return {
      text: result.text,
      totalPages: result.total,
      pageTexts: result.pages,
    };
  } finally {
    await parser.destroy();
  }
}

module.exports = {
  extractPdfText,
};