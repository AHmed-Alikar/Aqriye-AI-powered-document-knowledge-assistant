const fs = require("fs");
const { PDFParse } = require("pdf-parse");

async function extractPdfText(filePath) {
  const buffer = fs.readFileSync(filePath);

  const parser = new PDFParse({
    data: buffer,
  });

  try {
    const result = await parser.getText();

    return {
      text: result.text,
      pages: result.total,
    };
  } finally {
    await parser.destroy();
  }
}

module.exports = {
  extractPdfText,
};