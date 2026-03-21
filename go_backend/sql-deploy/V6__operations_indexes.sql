-- V6__operations_indexes.sql
-- Hot-path indexes for admin, payroll, stock, payment provider, and rider workflows.

BEGIN;

CREATE INDEX IF NOT EXISTS employee_role_assignments_role_idx
  ON employee_role_assignments (role_code, employee_id);

CREATE INDEX IF NOT EXISTS employee_branch_assignments_branch_idx
  ON employee_branch_assignments (branch_id, employee_id);

CREATE UNIQUE INDEX IF NOT EXISTS employee_branch_assignments_primary_idx
  ON employee_branch_assignments (employee_id)
  WHERE is_primary = TRUE;

CREATE INDEX IF NOT EXISTS staff_accounts_status_idx
  ON staff_accounts (status, username);

CREATE INDEX IF NOT EXISTS admin_refresh_tokens_actor_idx
  ON admin_refresh_tokens (actor_type, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS attendance_sessions_employee_clock_in_idx
  ON attendance_sessions (employee_id, clock_in_at DESC);

CREATE INDEX IF NOT EXISTS attendance_sessions_branch_clock_in_idx
  ON attendance_sessions (branch_id, clock_in_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_sessions_open_idx
  ON attendance_sessions (employee_id)
  WHERE clock_out_at IS NULL;

CREATE INDEX IF NOT EXISTS ot_requests_employee_status_idx
  ON ot_requests (employee_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS ot_requests_branch_status_idx
  ON ot_requests (branch_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS payroll_periods_company_date_idx
  ON payroll_periods (company_id, starts_at DESC, ends_at DESC);

CREATE INDEX IF NOT EXISTS payroll_entries_employee_idx
  ON payroll_entries (employee_id, payroll_period_id DESC);

CREATE INDEX IF NOT EXISTS branch_stock_movements_branch_product_idx
  ON branch_stock_movements (branch_id, product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS branch_products_low_stock_idx
  ON branch_products (branch_id, stock_qty, reorder_level)
  WHERE is_enabled = TRUE;

CREATE INDEX IF NOT EXISTS transactions_provider_reference_idx
  ON transactions (provider_id, provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_events_provider_external_idx
  ON payment_webhook_events (provider_id, external_event_id)
  WHERE external_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS delivery_jobs_branch_status_idx
  ON delivery_jobs (branch_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS delivery_jobs_rider_status_idx
  ON delivery_jobs (assigned_rider_employee_id, status, created_at DESC)
  WHERE assigned_rider_employee_id IS NOT NULL;

COMMIT;
