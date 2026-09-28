-- The database was originally created with VECTOR(1536), anticipating an
-- OpenAI-style embedding model. Aqriye now uses BAAI/bge-small-en-v1.5 via
-- Hugging Face Inference Providers, which produces 384-dimensional vectors.
-- This migration deliberately resizes the column to match the real model
-- output. Safe to run because embedding is currently NULL for every row
-- (no vector data exists yet to be truncated or corrupted).

ALTER TABLE document_chunks
  ALTER COLUMN embedding TYPE vector(384);
