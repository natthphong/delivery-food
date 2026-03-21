-- V4__operations_schema.sql
-- Admin/staff operations, payroll, stock controls, payment provider metadata, and rider delivery.

BEGIN;

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS accepting_orders BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS supports_pickup BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS supports_rider_delivery BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rider_delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS operational_note TEXT;

ALTER TABLE branches
  DROP CONSTRAINT IF EXISTS branches_rider_delivery_fee_non_negative;

ALTER TABLE branches
  ADD CONSTRAINT branches_rider_delivery_fee_non_negative CHECK (rider_delivery_fee >= 0);

ALTER TABLE branch_products
  ADD COLUMN IF NOT EXISTS is_temporarily_closed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS availability_note TEXT,
  ADD COLUMN IF NOT EXISTS reorder_level INT;

ALTER TABLE branch_products
  DROP CONSTRAINT IF EXISTS branch_products_reorder_level_non_negative;

ALTER TABLE branch_products
  ADD CONSTRAINT branch_products_reorder_level_non_negative CHECK (reorder_level IS NULL OR reorder_level >= 0);

CREATE TABLE IF NOT EXISTS roles (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_code TEXT NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_code, permission_code)
);

CREATE TABLE IF NOT EXISTS employees (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  employee_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  employment_type TEXT NOT NULL CHECK (employment_type IN ('part_time', 'full_time', 'rider')),
  compensation_type TEXT NOT NULL CHECK (compensation_type IN ('hourly', 'salary')),
  hourly_wage NUMERIC(12, 2),
  monthly_salary NUMERIC(12, 2),
  ot_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  ot_multiplier NUMERIC(5, 2) NOT NULL DEFAULT 1.50,
  payroll_visibility BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  joined_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employees_hourly_wage_non_negative CHECK (hourly_wage IS NULL OR hourly_wage >= 0),
  CONSTRAINT employees_monthly_salary_non_negative CHECK (monthly_salary IS NULL OR monthly_salary >= 0),
  CONSTRAINT employees_ot_multiplier_positive CHECK (ot_multiplier > 0),
  CONSTRAINT employees_compensation_required CHECK (
    (compensation_type = 'hourly' AND hourly_wage IS NOT NULL)
    OR (compensation_type = 'salary' AND monthly_salary IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS employees_user_unique
  ON employees (user_id)
  WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS employee_role_assignments (
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role_code TEXT NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (employee_id, role_code)
);

CREATE TABLE IF NOT EXISTS employee_branch_assignments (
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (employee_id, branch_id)
);

CREATE TABLE IF NOT EXISTS staff_accounts (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  must_reset_password BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  staff_account_id BIGINT REFERENCES staff_accounts(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('bootstrap_admin', 'staff_account')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by_hash TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  clock_in_at TIMESTAMPTZ NOT NULL,
  clock_out_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'clocked_in' CHECK (status IN ('clocked_in', 'clocked_out', 'corrected')),
  note TEXT,
  correction_note TEXT,
  corrected_by_employee_id BIGINT REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_sessions_clock_order CHECK (clock_out_at IS NULL OR clock_out_at >= clock_in_at)
);

CREATE TABLE IF NOT EXISTS payroll_settings (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  standard_daily_minutes INT NOT NULL DEFAULT 480,
  standard_monthly_minutes INT NOT NULL DEFAULT 9600,
  overtime_rounding_minutes INT NOT NULL DEFAULT 15,
  default_ot_multiplier NUMERIC(5, 2) NOT NULL DEFAULT 1.50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payroll_settings_daily_minutes_positive CHECK (standard_daily_minutes > 0),
  CONSTRAINT payroll_settings_monthly_minutes_positive CHECK (standard_monthly_minutes > 0),
  CONSTRAINT payroll_settings_rounding_positive CHECK (overtime_rounding_minutes > 0),
  CONSTRAINT payroll_settings_ot_multiplier_positive CHECK (default_ot_multiplier > 0)
);

CREATE TABLE IF NOT EXISTS ot_requests (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  attendance_session_id BIGINT REFERENCES attendance_sessions(id) ON DELETE SET NULL,
  requested_minutes INT NOT NULL CHECK (requested_minutes > 0),
  approved_minutes INT CHECK (approved_minutes IS NULL OR approved_minutes >= 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by_employee_id BIGINT REFERENCES employees(id) ON DELETE SET NULL,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_periods (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  starts_at DATE NOT NULL,
  ends_at DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'calculated', 'closed')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payroll_periods_date_order CHECK (ends_at >= starts_at)
);

CREATE TABLE IF NOT EXISTS payroll_entries (
  id BIGSERIAL PRIMARY KEY,
  payroll_period_id BIGINT NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  branch_id BIGINT REFERENCES branches(id) ON DELETE SET NULL,
  attendance_minutes INT NOT NULL DEFAULT 0,
  regular_minutes INT NOT NULL DEFAULT 0,
  overtime_minutes INT NOT NULL DEFAULT 0,
  regular_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  overtime_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  adjustment_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  gross_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  note TEXT,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payroll_entries_attendance_minutes_non_negative CHECK (attendance_minutes >= 0),
  CONSTRAINT payroll_entries_regular_minutes_non_negative CHECK (regular_minutes >= 0),
  CONSTRAINT payroll_entries_overtime_minutes_non_negative CHECK (overtime_minutes >= 0),
  CONSTRAINT payroll_entries_amounts_non_negative CHECK (
    regular_amount >= 0 AND overtime_amount >= 0 AND gross_amount >= 0
  ),
  CONSTRAINT payroll_entries_period_employee_unique UNIQUE (payroll_period_id, employee_id)
);

CREATE TABLE IF NOT EXISTS branch_stock_movements (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  delta_qty INT NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  created_by_employee_id BIGINT REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_providers (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  public_key TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payment_methods
  ADD COLUMN IF NOT EXISTS provider_id BIGINT REFERENCES payment_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_method_code TEXT,
  ADD COLUMN IF NOT EXISTS checkout_flow TEXT NOT NULL DEFAULT 'manual_slip',
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE payment_methods
  DROP CONSTRAINT IF EXISTS payment_methods_method_type_check;

ALTER TABLE payment_methods
  ADD CONSTRAINT payment_methods_method_type_check CHECK (method_type IN ('qr', 'balance', 'gateway'));

ALTER TABLE payment_methods
  DROP CONSTRAINT IF EXISTS payment_methods_checkout_flow_check;

ALTER TABLE payment_methods
  ADD CONSTRAINT payment_methods_checkout_flow_check CHECK (checkout_flow IN ('wallet', 'manual_slip', 'gateway_qr', 'gateway_redirect'));

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS provider_id BIGINT REFERENCES payment_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_reference TEXT,
  ADD COLUMN IF NOT EXISTS provider_status TEXT,
  ADD COLUMN IF NOT EXISTS payment_action JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_reason TEXT;

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id BIGSERIAL PRIMARY KEY,
  provider_id BIGINT NOT NULL REFERENCES payment_providers(id) ON DELETE CASCADE,
  external_event_id TEXT,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_mode TEXT NOT NULL DEFAULT 'pickup',
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_note TEXT;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_fulfillment_mode_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_fulfillment_mode_check CHECK (fulfillment_mode IN ('pickup', 'rider_delivery'));

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_delivery_fee_non_negative;

ALTER TABLE orders
  ADD CONSTRAINT orders_delivery_fee_non_negative CHECK (delivery_fee >= 0);

CREATE TABLE IF NOT EXISTS delivery_jobs (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting_for_rider'
    CHECK (status IN ('waiting_for_rider', 'assigned_to_rider', 'picked_up', 'delivered', 'failed_delivery', 'cancelled')),
  delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
  assigned_rider_employee_id BIGINT REFERENCES employees(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT delivery_jobs_delivery_fee_non_negative CHECK (delivery_fee >= 0)
);

CREATE OR REPLACE TRIGGER roles_set_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER permissions_set_updated_at
BEFORE UPDATE ON permissions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER employees_set_updated_at
BEFORE UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER staff_accounts_set_updated_at
BEFORE UPDATE ON staff_accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER attendance_sessions_set_updated_at
BEFORE UPDATE ON attendance_sessions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER payroll_settings_set_updated_at
BEFORE UPDATE ON payroll_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER ot_requests_set_updated_at
BEFORE UPDATE ON ot_requests
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER payroll_periods_set_updated_at
BEFORE UPDATE ON payroll_periods
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER payroll_entries_set_updated_at
BEFORE UPDATE ON payroll_entries
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER payment_providers_set_updated_at
BEFORE UPDATE ON payment_providers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER delivery_jobs_set_updated_at
BEFORE UPDATE ON delivery_jobs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
