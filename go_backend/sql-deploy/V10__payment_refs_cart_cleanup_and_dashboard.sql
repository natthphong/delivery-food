-- V10__payment_refs_cart_cleanup_and_dashboard.sql
-- Add business reference codes, complaint storage for dashboard analytics,
-- and a safe cleanup pass for invalid/stale cart rows.

BEGIN;

CREATE TABLE IF NOT EXISTS business_reference_counters (
  ref_type TEXT NOT NULL CHECK (ref_type IN ('OD', 'TX')),
  ref_date DATE NOT NULL,
  last_value INT NOT NULL DEFAULT 0 CHECK (last_value >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ref_type, ref_date)
);

CREATE TABLE IF NOT EXISTS customer_complaints (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  resolved_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER business_reference_counters_set_updated_at
BEFORE UPDATE ON business_reference_counters
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER customer_complaints_set_updated_at
BEFORE UPDATE ON customer_complaints
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS reference_code TEXT;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS reference_code TEXT;

WITH ranked AS (
  SELECT
    id,
    'TX' || TO_CHAR(((created_at AT TIME ZONE 'Asia/Bangkok')::date), 'YYMMDD') ||
      LPAD(ROW_NUMBER() OVER (
        PARTITION BY ((created_at AT TIME ZONE 'Asia/Bangkok')::date)
        ORDER BY created_at, id
      )::text, 6, '0') AS next_reference_code
  FROM transactions
)
UPDATE transactions AS t
SET reference_code = ranked.next_reference_code
FROM ranked
WHERE t.id = ranked.id
  AND t.reference_code IS NULL;

WITH ranked AS (
  SELECT
    id,
    'OD' || TO_CHAR(((created_at AT TIME ZONE 'Asia/Bangkok')::date), 'YYMMDD') ||
      LPAD(ROW_NUMBER() OVER (
        PARTITION BY ((created_at AT TIME ZONE 'Asia/Bangkok')::date)
        ORDER BY created_at, id
      )::text, 6, '0') AS next_reference_code
  FROM orders
)
UPDATE orders AS o
SET reference_code = ranked.next_reference_code
FROM ranked
WHERE o.id = ranked.id
  AND o.reference_code IS NULL;

INSERT INTO business_reference_counters (ref_type, ref_date, last_value)
SELECT 'TX', ref_date, MAX(seq)
FROM (
  SELECT
    ((created_at AT TIME ZONE 'Asia/Bangkok')::date) AS ref_date,
    ROW_NUMBER() OVER (
      PARTITION BY ((created_at AT TIME ZONE 'Asia/Bangkok')::date)
      ORDER BY created_at, id
    ) AS seq
  FROM transactions
) AS ranked_transactions
GROUP BY ref_date
ON CONFLICT (ref_type, ref_date)
DO UPDATE SET
  last_value = GREATEST(business_reference_counters.last_value, EXCLUDED.last_value),
  updated_at = NOW();

INSERT INTO business_reference_counters (ref_type, ref_date, last_value)
SELECT 'OD', ref_date, MAX(seq)
FROM (
  SELECT
    ((created_at AT TIME ZONE 'Asia/Bangkok')::date) AS ref_date,
    ROW_NUMBER() OVER (
      PARTITION BY ((created_at AT TIME ZONE 'Asia/Bangkok')::date)
      ORDER BY created_at, id
    ) AS seq
  FROM orders
) AS ranked_orders
GROUP BY ref_date
ON CONFLICT (ref_type, ref_date)
DO UPDATE SET
  last_value = GREATEST(business_reference_counters.last_value, EXCLUDED.last_value),
  updated_at = NOW();

CREATE UNIQUE INDEX IF NOT EXISTS transactions_reference_code_unique
  ON transactions (reference_code);

CREATE UNIQUE INDEX IF NOT EXISTS orders_reference_code_unique
  ON orders (reference_code);

ALTER TABLE transactions
  ALTER COLUMN reference_code SET NOT NULL;

ALTER TABLE orders
  ALTER COLUMN reference_code SET NOT NULL;

CREATE INDEX IF NOT EXISTS customer_complaints_branch_status_idx
  ON customer_complaints (branch_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS customer_complaints_order_idx
  ON customer_complaints (order_id)
  WHERE order_id IS NOT NULL;

DELETE FROM cart_item_add_ons cia
WHERE NOT EXISTS (
  SELECT 1
  FROM cart_items ci
  WHERE ci.id = cia.cart_item_id
);

DELETE FROM cart_items ci
WHERE NOT EXISTS (
  SELECT 1
  FROM branch_products bp
  JOIN products p ON p.id = bp.product_id
  WHERE bp.branch_id = ci.branch_id
    AND bp.product_id = ci.product_id
    AND bp.is_enabled = TRUE
    AND p.is_active = TRUE
);

DELETE FROM cart_items ci
WHERE EXISTS (
  SELECT 1
  FROM cart_item_add_ons cia
  LEFT JOIN product_add_ons pa
    ON pa.id = cia.product_add_on_id
    AND pa.product_id = ci.product_id
  LEFT JOIN branch_product_add_ons bpa
    ON bpa.branch_id = ci.branch_id
    AND bpa.product_add_on_id = cia.product_add_on_id
  WHERE cia.cart_item_id = ci.id
    AND (
      pa.id IS NULL
      OR COALESCE(bpa.is_enabled, TRUE) = FALSE
      OR COALESCE(bpa.is_temporarily_closed, FALSE) = TRUE
    )
);

UPDATE carts
SET updated_at = NOW();

COMMIT;
