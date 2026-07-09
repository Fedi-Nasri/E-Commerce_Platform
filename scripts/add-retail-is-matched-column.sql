ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_matched BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE products
SET is_matched = COALESCE(is_matched, TRUE)
WHERE is_matched IS NULL;
