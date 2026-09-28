require("dotenv").config();
const db = require("../db");
const { generateEmbedding } = require("../services/embeddingService");

// One-off/reusable script: embeds any document_chunks row where
// embedding IS NULL, without requiring the source PDF to be re-uploaded.
async function backfillEmbeddings() {
  const { rows: chunks } = await db.query(
    `SELECT id, content FROM document_chunks WHERE embedding IS NULL ORDER BY id`
  );

  console.log(`Found ${chunks.length} chunk(s) with no embedding.`);

  let updated = 0;
  let failed = 0;

  for (const chunk of chunks) {
    try {
      const vector = await generateEmbedding(chunk.content);

      await db.query(
        `UPDATE document_chunks SET embedding = $1 WHERE id = $2`,
        [JSON.stringify(vector), chunk.id]
      );

      updated++;
    } catch (error) {
      failed++;
      console.error(`Chunk ${chunk.id} failed:`, error.message);
    }
  }

  console.log(`Done. Updated: ${updated}, Failed: ${failed}`);
}

if (require.main === module) {
  backfillEmbeddings()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Backfill failed:", error);
      process.exit(1);
    });
}

module.exports = { backfillEmbeddings };
