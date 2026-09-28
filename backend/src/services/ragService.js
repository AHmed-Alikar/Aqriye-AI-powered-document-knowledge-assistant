const { searchSimilarChunks } = require("./retrievalService");
const { generateAnswer } = require("./llmService");

const TOP_K = 5;
const NOT_FOUND_MESSAGE =
  "I couldn't find this information in the selected document.";

function buildContext(chunks) {
  return chunks
    .map((chunk) => {
      const page = chunk.metadata?.page_number;
      const section = chunk.metadata?.section;

      const parts = [chunk.document_name];
      if (page) parts.push(`Page ${page}`);
      if (section) parts.push(`Section: ${section}`);

      return `Source: ${parts.join(", ")}\n\n${chunk.content}`;
    })
    .join("\n\n---\n\n");
}

function toSources(chunks) {
  return chunks.map((chunk) => ({
    documentId: chunk.document_id,
    documentName: chunk.document_name,
    chunkId: chunk.chunk_id,
    chunkIndex: chunk.metadata?.chunk_index ?? null,
    page: chunk.metadata?.page_number ?? null,
    section: chunk.metadata?.section ?? null,
    similarity: chunk.similarity,
  }));
}

// Question -> question embedding -> similarity search (scoped to one
// document) -> context -> LLM. The LLM never sees the whole document, only
// the top-K retrieved chunks, and never sees chunks from any other document.
async function answerQuestion(question, documentId, topK = TOP_K) {
  const chunks = await searchSimilarChunks(question, documentId, topK);

  if (chunks.length === 0) {
    return {
      answer: NOT_FOUND_MESSAGE,
      sources: [],
    };
  }

  const context = buildContext(chunks);
  const answer = await generateAnswer(question, context);

  return {
    answer,
    sources: toSources(chunks),
  };
}

module.exports = {
  answerQuestion,
};
