const db = require("../db");
const { generateEmbedding } = require("./embeddingService");

const DEFAULT_TOP_K = 5;
const CANDIDATE_POOL = 20;
const SIMILARITY_FLOOR = 0.35;
const SECTION_MATCH_BOOST = 0.15;
const SECTION_NUMBER_BOOST = 0.25;

const STOPWORDS = new Set([
  "what", "is", "the", "are", "this", "that", "about", "does", "do",
  "of", "in", "on", "for", "and", "or", "a", "an", "to", "how", "why",
  "which", "who", "with", "project", "document",
]);

function extractKeywords(text) {
  const words = text.toLowerCase().match(/[a-z]{3,}/g) || [];
  return new Set(words.filter((w) => !STOPWORDS.has(w)));
}

// Only matches dotted numbers like "1.7" or "1.5.2" (not bare numbers like
// "80" or "2024"), so a question like "What is discussed in section 1.7?"
// can be boosted toward the chunk actually numbered 1.7, even though
// keyword overlap alone can't help here (the question shares no title
// words with "1.7 Significance of the Project").
function extractSectionNumbers(text) {
  return new Set(text.match(/\d+(?:\.\d+)+/g) || []);
}

function getSectionNumber(section) {
  const match = section.match(/^(\d+(?:\.\d+)+)\s/);
  return match ? match[1] : null;
}

// Vector similarity alone can rank a chunk that merely *mentions* a topic
// (e.g. a chapter-summary section that recaps "the introduction covers...")
// above the chunk that actually *is* that section. Boosting candidates
// whose detected section heading shares a keyword with the question fixes
// this cheaply, without a new dependency or a second retrieval pass -
// still strictly scoped to one document_id, and still grounded in real
// metadata (never invents a section).
function rerank(candidates, question) {
  const questionKeywords = extractKeywords(question);
  const questionSectionNumbers = extractSectionNumbers(question);

  return candidates
    .map((chunk) => {
      const section = chunk.metadata?.section || "";
      const sectionKeywords = extractKeywords(section);

      let overlap = 0;
      for (const word of sectionKeywords) {
        if (questionKeywords.has(word)) overlap++;
      }

      const sectionNumber = getSectionNumber(section);
      const numberBoost =
        sectionNumber && questionSectionNumbers.has(sectionNumber)
          ? SECTION_NUMBER_BOOST
          : 0;

      return {
        ...chunk,
        similarity: chunk.similarity + overlap * SECTION_MATCH_BOOST + numberBoost,
      };
    })
    .sort((a, b) => b.similarity - a.similarity);
}

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
    [embeddingParam, CANDIDATE_POOL, documentId]
  );

  const reranked = rerank(result.rows, question).filter(
    (chunk) => chunk.similarity >= SIMILARITY_FLOOR
  );

  return reranked.slice(0, topK);
}

module.exports = {
  searchSimilarChunks,
};
