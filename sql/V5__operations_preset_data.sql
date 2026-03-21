-- V5__operations_preset_data.sql
-- Seed operational roles, permissions, payroll defaults, and Omise-first payment methods.

BEGIN;

INSERT INTO system_configs (config_key, config_value, description)
VALUES
  ('ATTENDANCE_LATE_GRACE_MINUTES', '15', 'Grace period before a shift is considered late'),
  ('MIN_OT_REQUEST_MINUTES', '30', 'Minimum OT request size in minutes'),
  ('RIDER_DELIVERY_BASE_FEE', '35', 'Default rider delivery fee in THB'),
  ('PAYROLL_DEFAULT_PERIOD_DAYS', '14', 'Default payroll period length in days')
ON CONFLICT (config_key) DO UPDATE
SET config_value = EXCLUDED.config_value,
    description = EXCLUDED.description;

INSERT INTO roles (code, name, description)
VALUES
  ('employee', 'Employee', 'Standard employee access for attendance and self-service views'),
  ('manager_branch', 'Branch Manager', 'Manager access limited to assigned branches'),
  ('manager', 'Manager', 'Cross-branch manager access'),
  ('owner', 'Owner', 'Full owner access across company operations'),
  ('rider', 'Rider', 'Branch-scoped rider delivery access')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

INSERT INTO permissions (code, name, description)
VALUES
  ('dashboard.read', 'Read dashboard', 'View admin dashboard summaries'),
  ('employees.read', 'Read employees', 'View employee lists and profiles'),
  ('employees.manage', 'Manage employees', 'Create, edit, activate, and deactivate employees'),
  ('attendance.self', 'Self attendance', 'Clock in/out and view own attendance'),
  ('attendance.read', 'Read attendance', 'View branch or company attendance'),
  ('attendance.manage', 'Manage attendance', 'Correct attendance sessions'),
  ('payroll.self', 'Self payroll', 'View own payroll summaries'),
  ('payroll.read', 'Read payroll', 'View payroll reports'),
  ('payroll.manage', 'Manage payroll', 'Generate payroll periods and settings'),
  ('ot.self', 'Self OT', 'Create own OT requests'),
  ('ot.review', 'Review OT', 'Approve or reject OT requests'),
  ('branches.read', 'Read branches', 'View branch operational state'),
  ('branches.manage', 'Manage branches', 'Open/close branch operations'),
  ('stock.read', 'Read stock', 'View stock by branch'),
  ('stock.manage', 'Manage stock', 'Adjust stock and availability'),
  ('orders.read', 'Read orders', 'View order queues'),
  ('orders.manage', 'Manage orders', 'Update branch order status'),
  ('rider.jobs.read', 'Read rider jobs', 'View rider delivery queues'),
  ('rider.jobs.claim', 'Claim rider jobs', 'Claim or update assigned rider jobs'),
  ('payments.read', 'Read payments', 'View payment transactions and webhooks'),
  ('payments.manage', 'Manage payments', 'Handle payment operations and investigate failures'),
  ('settings.manage', 'Manage settings', 'Update owner-level operational settings')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

DELETE FROM role_permissions;

INSERT INTO role_permissions (role_code, permission_code)
VALUES
  ('employee', 'attendance.self'),
  ('employee', 'payroll.self'),
  ('employee', 'ot.self'),
  ('rider', 'attendance.self'),
  ('rider', 'payroll.self'),
  ('rider', 'ot.self'),
  ('rider', 'rider.jobs.read'),
  ('rider', 'rider.jobs.claim'),
  ('manager_branch', 'dashboard.read'),
  ('manager_branch', 'employees.read'),
  ('manager_branch', 'attendance.read'),
  ('manager_branch', 'attendance.manage'),
  ('manager_branch', 'payroll.read'),
  ('manager_branch', 'ot.review'),
  ('manager_branch', 'branches.read'),
  ('manager_branch', 'branches.manage'),
  ('manager_branch', 'stock.read'),
  ('manager_branch', 'stock.manage'),
  ('manager_branch', 'orders.read'),
  ('manager_branch', 'orders.manage'),
  ('manager_branch', 'rider.jobs.read'),
  ('manager_branch', 'payments.read'),
  ('manager', 'dashboard.read'),
  ('manager', 'employees.read'),
  ('manager', 'attendance.read'),
  ('manager', 'attendance.manage'),
  ('manager', 'payroll.read'),
  ('manager', 'ot.review'),
  ('manager', 'branches.read'),
  ('manager', 'branches.manage'),
  ('manager', 'stock.read'),
  ('manager', 'stock.manage'),
  ('manager', 'orders.read'),
  ('manager', 'orders.manage'),
  ('manager', 'rider.jobs.read'),
  ('manager', 'payments.read'),
  ('owner', 'dashboard.read'),
  ('owner', 'employees.read'),
  ('owner', 'employees.manage'),
  ('owner', 'attendance.read'),
  ('owner', 'attendance.manage'),
  ('owner', 'payroll.read'),
  ('owner', 'payroll.manage'),
  ('owner', 'ot.review'),
  ('owner', 'branches.read'),
  ('owner', 'branches.manage'),
  ('owner', 'stock.read'),
  ('owner', 'stock.manage'),
  ('owner', 'orders.read'),
  ('owner', 'orders.manage'),
  ('owner', 'rider.jobs.read'),
  ('owner', 'payments.read'),
  ('owner', 'payments.manage'),
  ('owner', 'settings.manage');

INSERT INTO payroll_settings (company_id, standard_daily_minutes, standard_monthly_minutes, overtime_rounding_minutes, default_ot_multiplier)
VALUES
  (1, 480, 9600, 15, 1.50)
ON CONFLICT (company_id) DO UPDATE
SET standard_daily_minutes = EXCLUDED.standard_daily_minutes,
    standard_monthly_minutes = EXCLUDED.standard_monthly_minutes,
    overtime_rounding_minutes = EXCLUDED.overtime_rounding_minutes,
    default_ot_multiplier = EXCLUDED.default_ot_multiplier;

INSERT INTO payment_providers (id, code, name, is_active, public_key, settings)
VALUES
  (1, 'OMISE', 'Omise', TRUE, NULL, '{"mode":"redirect_or_qr"}'::JSONB)
ON CONFLICT (id) DO UPDATE
SET code = EXCLUDED.code,
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active,
    public_key = EXCLUDED.public_key,
    settings = EXCLUDED.settings;

SELECT setval(pg_get_serial_sequence('payment_providers', 'id'), GREATEST((SELECT MAX(id) FROM payment_providers), 1), TRUE);

UPDATE branches
SET
  accepting_orders = TRUE,
  supports_pickup = TRUE,
  supports_rider_delivery = TRUE,
  rider_delivery_fee = 35.00,
  operational_note = NULL
WHERE company_id = 1;

UPDATE branch_products
SET
  is_temporarily_closed = FALSE,
  availability_note = NULL,
  reorder_level = COALESCE(reorder_level, 10)
WHERE branch_id IN (1, 2, 3);

INSERT INTO payment_methods (id, code, name, method_type, is_active, details, provider_id, provider_method_code, checkout_flow, metadata)
VALUES
  (3, 'OMISE_PROMPTPAY', 'Omise PromptPay', 'gateway', TRUE, '{}'::JSONB, 1, 'promptpay', 'gateway_qr', '{"recommended":true}'::JSONB)
ON CONFLICT (id) DO UPDATE
SET code = EXCLUDED.code,
    name = EXCLUDED.name,
    method_type = EXCLUDED.method_type,
    is_active = EXCLUDED.is_active,
    details = EXCLUDED.details,
    provider_id = EXCLUDED.provider_id,
    provider_method_code = EXCLUDED.provider_method_code,
    checkout_flow = EXCLUDED.checkout_flow,
    metadata = EXCLUDED.metadata;

UPDATE payment_methods
SET
  checkout_flow = 'manual_slip',
  provider_id = NULL,
  provider_method_code = NULL
WHERE code = 'QR_SLIP';

UPDATE payment_methods
SET checkout_flow = 'wallet'
WHERE code = 'WALLET';

SELECT setval(pg_get_serial_sequence('payment_methods', 'id'), GREATEST((SELECT MAX(id) FROM payment_methods), 1), TRUE);

INSERT INTO company_payment_methods (company_id, payment_method_id, sort_order, is_enabled)
VALUES
  (1, 3, 1, TRUE),
  (1, 2, 2, TRUE),
  (1, 1, 3, TRUE)
ON CONFLICT (company_id, payment_method_id) DO UPDATE
SET sort_order = EXCLUDED.sort_order,
    is_enabled = EXCLUDED.is_enabled;

COMMIT;
