-- V3__indexes_and_constraints.sql
-- Hot-path indexes and data integrity guards.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_ci
  ON users (LOWER(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique
  ON users (phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx
  ON refresh_tokens (user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS categories_company_sort_idx
  ON categories (company_id, sort_order, id)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS products_company_active_idx
  ON products (company_id, is_active, id);

CREATE INDEX IF NOT EXISTS products_search_trgm_idx
  ON products
  USING GIN ((LOWER(COALESCE(name, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(search_terms, ''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS branches_company_idx
  ON branches (company_id, id);

CREATE INDEX IF NOT EXISTS branch_operating_hours_branch_day_idx
  ON branch_operating_hours (branch_id, day_of_week, open_time);

CREATE INDEX IF NOT EXISTS branch_products_branch_sort_idx
  ON branch_products (branch_id, sort_order, product_id)
  WHERE is_enabled = TRUE;

CREATE INDEX IF NOT EXISTS branch_products_product_idx
  ON branch_products (product_id, branch_id);

CREATE INDEX IF NOT EXISTS branch_products_recommended_idx
  ON branch_products (branch_id, is_recommended DESC, sort_order, product_id)
  WHERE is_enabled = TRUE;

CREATE INDEX IF NOT EXISTS product_categories_category_idx
  ON product_categories (category_id, product_id);

CREATE INDEX IF NOT EXISTS company_payment_methods_company_idx
  ON company_payment_methods (company_id, sort_order, payment_method_id)
  WHERE is_enabled = TRUE;

CREATE INDEX IF NOT EXISTS cart_items_cart_branch_idx
  ON cart_items (cart_id, branch_id, created_at);

CREATE INDEX IF NOT EXISTS cart_item_add_ons_cart_item_idx
  ON cart_item_add_ons (cart_item_id);

CREATE INDEX IF NOT EXISTS transactions_user_created_idx
  ON transactions (user_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS transactions_company_status_idx
  ON transactions (company_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS transactions_slip_reference_unique
  ON transactions (slip_reference, slip_date)
  WHERE slip_reference IS NOT NULL AND slip_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_user_created_idx
  ON orders (user_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS orders_branch_status_idx
  ON orders (branch_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS order_items_order_idx
  ON order_items (order_id, id);

CREATE INDEX IF NOT EXISTS order_item_add_ons_order_item_idx
  ON order_item_add_ons (order_item_id);

COMMIT;
