-- Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to transactions table
-- Using vector(3072) for OpenAI text-embedding-3-large
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS embedding vector(3072);

-- Create index for vector similarity search (HNSW algorithm for fast ANN search)
CREATE INDEX IF NOT EXISTS transactions_embedding_idx
ON transactions
USING hnsw (embedding vector_cosine_ops);

-- Optional: Add a function to search transactions by similarity
CREATE OR REPLACE FUNCTION search_transactions_by_embedding(
  query_embedding vector(3072),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_user_id text DEFAULT NULL
)
RETURNS TABLE (
  id text,
  user_id text,
  amount numeric,
  currency text,
  merchant text,
  category text,
  date timestamp,
  description text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.user_id,
    t.amount,
    t.currency,
    t.merchant,
    t.category,
    t.date,
    t.description,
    1 - (t.embedding <=> query_embedding) AS similarity
  FROM transactions t
  WHERE
    (filter_user_id IS NULL OR t.user_id = filter_user_id)
    AND t.embedding IS NOT NULL
    AND 1 - (t.embedding <=> query_embedding) > match_threshold
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
