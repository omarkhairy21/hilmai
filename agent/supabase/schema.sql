-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id BIGINT UNIQUE NOT NULL,
  telegram_username TEXT,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  merchant TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transaction_date_normalized DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_chat_id ON transactions(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_date_normalized ON transactions(transaction_date_normalized);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_users_chat_id ON users(telegram_chat_id);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS transaction_date_normalized DATE NOT NULL DEFAULT CURRENT_DATE;

UPDATE transactions
SET transaction_date_normalized = (transaction_date AT TIME ZONE 'UTC')::date
WHERE (transaction_date AT TIME ZONE 'UTC')::date <> transaction_date_normalized;

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now, restrict later based on user authentication)
CREATE POLICY "Allow all operations on users" ON users FOR ALL USING (true);
CREATE POLICY "Allow all operations on transactions" ON transactions FOR ALL USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Aggregation helpers
CREATE OR REPLACE FUNCTION aggregate_transactions(
  p_user_id UUID,
  p_start TIMESTAMPTZ DEFAULT NULL,
  p_end TIMESTAMPTZ DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_merchant TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_amount NUMERIC,
  average_amount NUMERIC,
  tx_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(amount), 0) AS total_amount,
    AVG(amount) AS average_amount,
    COUNT(*) AS tx_count
  FROM transactions
  WHERE user_id = p_user_id
    AND (p_start IS NULL OR transaction_date >= p_start)
    AND (p_end IS NULL OR transaction_date <= p_end)
    AND (p_category IS NULL OR category ILIKE p_category)
    AND (p_merchant IS NULL OR merchant ILIKE p_merchant);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION aggregate_transactions_trend(
  p_user_id UUID,
  p_bucket TEXT,
  p_start TIMESTAMPTZ DEFAULT NULL,
  p_end TIMESTAMPTZ DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_merchant TEXT DEFAULT NULL
)
RETURNS TABLE (
  bucket_start TIMESTAMPTZ,
  bucket_end TIMESTAMPTZ,
  total_amount NUMERIC,
  tx_count BIGINT
) AS $$
BEGIN
  IF p_bucket NOT IN ('day', 'week', 'month') THEN
    RAISE EXCEPTION 'Invalid bucket size: %', p_bucket;
  END IF;

  RETURN QUERY
  SELECT
    date_trunc(p_bucket, transaction_date) AS bucket_start,
    date_trunc(p_bucket, transaction_date) +
      CASE
        WHEN p_bucket = 'day' THEN INTERVAL '1 day'
        WHEN p_bucket = 'week' THEN INTERVAL '1 week'
        ELSE INTERVAL '1 month'
      END AS bucket_end,
    COALESCE(SUM(amount), 0) AS total_amount,
    COUNT(*) AS tx_count
  FROM transactions
  WHERE user_id = p_user_id
    AND (p_start IS NULL OR transaction_date >= p_start)
    AND (p_end IS NULL OR transaction_date <= p_end)
    AND (p_category IS NULL OR category ILIKE p_category)
    AND (p_merchant IS NULL OR merchant ILIKE p_merchant)
  GROUP BY 1, 2
  ORDER BY bucket_start;
END;
$$ LANGUAGE plpgsql;

-- Sample data (optional, comment out if not needed)
-- INSERT INTO users (telegram_chat_id, telegram_username, first_name)
-- VALUES (123456789, 'testuser', 'Test')
-- ON CONFLICT (telegram_chat_id) DO NOTHING;
