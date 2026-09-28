const { searchSimilarChunks } = require("./retrievalService");
const { generateAnswer } = require("./llmService");

const TOP_K = 5;

function buildContext(chunks) {
  return chunks
    .map(
      (chunk) =>
        `Source: ${chunk.document_name}\nChunk: ${chunk.metadata?.chunk_index ?? chunk.chunk_id}\n\n${chunk.content}`
    )
    .join("\n\n---\n\n");
}

function toSources(chunks) {
  return chunks.map((chunk) => ({
    documentId: chunk.document_id,
    documentName: chunk.document_name,
    chunkId: chunk.chunk_id,
    chunkIndex: chunk.metadata?.chunk_index ?? null,
    similarity: chunk.similarity,
  }));
}

// Question -> question embedding -> similarity search -> context -> LLM.
// The LLM never sees the whole document, only the top-K retrieved chunks.
async function answerQuestion(question, topK = TOP_K) {
  const chunks = await searchSimilarChunks(question, topK);

  if (chunks.length === 0) {
    return {
      answer: "The information is not available in the provided documents.",
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
