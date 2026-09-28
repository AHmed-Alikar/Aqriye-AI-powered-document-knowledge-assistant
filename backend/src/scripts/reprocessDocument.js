require("dotenv").config();
const db = require("../db");
const { extractPdfText } = require("../services/documentService");
const { chunkPages } = require("../services/chunkService");
const { detectPageSections } = require("../services/sectionService");
const { generateEmbeddings } = require("../services/embeddingService");
const { readStoredFile } = require("../services/storageService");

// Re-extracts a document from its original file (documents.file_url),
// re-chunks it page-aware, re-embeds, and replaces its document_chunks rows.
// Lets existing documents pick up page/section metadata (or any future
// chunking-strategy change) without requiring the user to re-upload through
// the UI. Usage: node src/scripts/reprocessDocument.js [documentId]
// With no documentId, reprocesses every document.
async function reprocessDocument(documentId) {
  const { rows: docs } = await db.query(
    `SELECT id, file_name, file_url FROM documents WHERE id = $1`,
    [documentId]
  );

  const document = docs[0];

  if (!document) {
    throw new Error(`Document ${documentId} not found`);
  }

  console.log(`Reprocessing ${document.file_name} (id=${document.id})...`);

  const buffer = await readStoredFile(document.file_url);
  const result = await extractPdfText(buffer);
  const pageChunks = chunkPages(result.pageTexts, 1000, 200);
  const pageSections = detectPageSections(result.pageTexts);
  const embeddings = await generateEmbeddings(
    pageChunks.map((chunk) => chunk.content)
  );

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await client.query(`DELETE FROM document_chunks WHERE document_id = $1`, [
      documentId,
    ]);

    for (let i = 0; i < pageChunks.length; i++) {
      const { content, pageNumber } = pageChunks[i];

      await client.query(
        `
        INSERT INTO document_chunks (document_id, content, embedding, metadata)
        VALUES ($1, $2, $3, $4)
        `,
        [
          documentId,
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

    await client.query("COMMIT");
    console.log(
      `Done. ${document.file_name}: ${result.totalPages} pages, ${pageChunks.length} chunks.`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function reprocessAll() {
  const { rows: docs } = await db.query(`SELECT id FROM documents ORDER BY id`);

  for (const doc of docs) {
    await reprocessDocument(doc.id);
  }
}

if (require.main === module) {
  const documentId = process.argv[2];
  const run = documentId ? () => reprocessDocument(documentId) : reprocessAll;

  run()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Reprocessing failed:", error);
      process.exit(1);
    });
}

module.exports = { reprocessDocument, reprocessAll };
