function chunkText(text, chunkSize = 1000, overlap = 200) {
  if (!text || !text.trim()) {
    return [];
  }

  if (overlap >= chunkSize) {
    throw new Error("Overlap must be smaller than chunk size");
  }

  const chunks = [];

  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);

    const chunk = text.slice(start, end).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= text.length) {
      break;
    }

    start = end - overlap;
  }

  return chunks;
}

// Chunk each page independently so every chunk maps to exactly one real
// page number - no fabricated ranges, no ambiguity about which page a
// chunk came from. Returns a flat list in reading order.
function chunkPages(pageTexts, chunkSize = 1000, overlap = 200) {
  const chunks = [];

  for (const page of pageTexts) {
    const pageChunks = chunkText(page.text, chunkSize, overlap);

    for (const content of pageChunks) {
      chunks.push({ content, pageNumber: page.num });
    }
  }

  return chunks;
}

module.exports = {
  chunkText,
  chunkPages,
};