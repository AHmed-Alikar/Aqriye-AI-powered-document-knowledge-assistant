const { searchSimilarChunks } = require("./retrievalService");
const { generateAnswer, generateAnswerStream } = require("./llmService");

const TOP_K = 5;
const NOT_FOUND_MESSAGE =
  "I couldn't find this information in the selected document.";

function buildContext(chunks) {
  // Chunks arrive in relevance-rank order, which can scramble a section
  // that spans multiple chunks (e.g. the chunk containing a heading ends
  // up after the chunk containing its continuation). Reordering into
  // natural reading order (page, then chunk_index) before joining gives
  // the LLM coherent, sequential text to reason over instead of
  // out-of-order fragments - this measurably reduced false "not found"
  // refusals on section-spanning content during evaluation.
  const inReadingOrder = [...chunks].sort((a, b) => {
    const pageDiff = (a.metadata?.page_number ?? 0) - (b.metadata?.page_number ?? 0);
    if (pageDiff !== 0) return pageDiff;
    return (a.metadata?.chunk_index ?? 0) - (b.metadata?.chunk_index ?? 0);
  });

  return inReadingOrder
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
  let answer = await generateAnswer(question, context);

  // Observed, reproducible flakiness: the model occasionally refuses with
  // the exact "couldn't find" phrase even when relevant context was
  // retrieved (confirmed via direct retrieval checks during evaluation).
  // One silent retry catches most of these without masking a genuine
  // "not in this document" case, which - if real - will usually refuse
  // again anyway. Bounded to a single retry, not a loop.
  if (answer.trim() === NOT_FOUND_MESSAGE) {
    answer = await generateAnswer(question, context);
  }

  return {
    answer,
    sources: toSources(chunks),
  };
}

// Streaming variant used by the SSE chat endpoint. `onStatus` is called
// once retrieval starts and again once generation starts, so the caller
// can surface real "Searching document..." / "Generating answer..."
// progress tied to actual pipeline stages - not a fake timer.
async function answerQuestionStream(
  question,
  documentId,
  { onStatus, onToken, signal },
  topK = TOP_K
) {
  onStatus?.("Searching document...");

  const chunks = await searchSimilarChunks(question, documentId, topK);

  if (chunks.length === 0) {
    // Keep the streaming contract uniform: the caller always gets its
    // answer text via onToken, even for this no-context short-circuit.
    onToken?.(NOT_FOUND_MESSAGE);
    return {
      answer: NOT_FOUND_MESSAGE,
      sources: [],
    };
  }

  const context = buildContext(chunks);

  onStatus?.("Generating answer...");
  const answer = await generateAnswerStream(question, context, onToken, signal);

  return {
    answer,
    sources: toSources(chunks),
  };
}

module.exports = {
  answerQuestion,
  answerQuestionStream,
};
