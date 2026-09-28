const { InferenceClient } = require("@huggingface/inference");

const hf = new InferenceClient(process.env.HF_API_KEY);
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "BAAI/bge-small-en-v1.5";

// BAAI/bge-small-en-v1.5 outputs 384-dimensional vectors.
// This must match the document_chunks.embedding column type (vector(384)).
const EMBEDDING_DIMENSIONS = 384;

async function generateEmbedding(text) {
  if (!text || !text.trim()) {
    throw new Error("Cannot generate an embedding for empty text");
  }

  let output;

  try {
    output = await hf.featureExtraction({
      model: EMBEDDING_MODEL,
      provider: "hf-inference",
      inputs: text,
    });
  } catch (error) {
    console.error("Embedding API request failed:", error.message);
    throw new Error("Failed to generate embedding");
  }

  // Some providers return a pooled vector ([dim]), others return
  // per-token vectors ([tokens][dim]). Normalize to a single pooled vector.
  const vector = Array.isArray(output[0]) ? output[0] : output;

  if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Unexpected embedding shape from ${EMBEDDING_MODEL}: expected ${EMBEDDING_DIMENSIONS} dimensions, got ${vector?.length}`
    );
  }

  return vector;
}

async function generateEmbeddings(texts) {
  const vectors = [];

  for (const text of texts) {
    const vector = await generateEmbedding(text);
    vectors.push(vector);
  }

  return vectors;
}

module.exports = {
  generateEmbedding,
  generateEmbeddings,
  EMBEDDING_DIMENSIONS,
};
