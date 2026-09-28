const db = require("../db");
const { generateEmbedding } = require("./embeddingService");

const DEFAULT_TOP_K = 5;

// Retrieval: turn the question into the same kind of vector as the chunks,
// then let pgvector rank every chunk by cosine distance to that vector.
// `<=>` is pgvector's cosine distance operator (0 = identical direction,
// 2 = opposite). We convert it to similarity (1 - distance) so higher
// is more relevant, matching how similarity is usually reported.
// documentId is required, never optional: retrieval must always be scoped
// to the document the user is actually chatting with. Without this filter,
// chunks from unrelated uploaded documents can outrank the right ones on
// pure semantic similarity and leak into the answer.
async function searchSimilarChunks(question, documentId, topK = DEFAULT_TOP_K) {
  if (!question || !question.trim()) {
    throw new Error("Question is required for retrieval");
  }

  if (!documentId) {
    throw new Error("documentId is required for scoped retrieval");
  }

  const questionEmbedding = await generateEmbedding(question);
  const embeddingParam = JSON.stringify(questionEmbedding);

  const result = await db.query(
    `
    SELECT
      dc.id AS chunk_id,
      dc.document_id,
      dc.content,
      dc.metadata,
      d.file_name AS document_name,
      1 - (dc.embedding <=> $1::vector) AS similarity
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE dc.embedding IS NOT NULL
      AND dc.document_id = $3
    ORDER BY dc.embedding <=> $1::vector
    LIMIT $2
    `,
    [embeddingParam, topK, documentId]
  );

  return result.rows;
}

module.exports = {
  searchSimilarChunks,
};
