-- V8__branch_add_on_controls.sql
-- Add branch-level add-on sellability and price override controls.

BEGIN;

CREATE TABLE IF NOT EXISTS branch_product_add_ons (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_add_on_id BIGINT NOT NULL REFERENCES product_add_ons(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_temporarily_closed BOOLEAN NOT NULL DEFAULT FALSE,
  price_override NUMERIC(12, 2),
  availability_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT branch_product_add_ons_unique UNIQUE (branch_id, product_add_on_id),
  CONSTRAINT branch_product_add_ons_price_override_non_negative CHECK (price_override IS NULL OR price_override >= 0)
);

CREATE INDEX IF NOT EXISTS branch_product_add_ons_branch_idx
  ON branch_product_add_ons (branch_id, product_add_on_id);

CREATE OR REPLACE TRIGGER branch_product_add_ons_set_updated_at
BEFORE UPDATE ON branch_product_add_ons
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
