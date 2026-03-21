# DB Schema

## Migration Files

- `V0__baseline.sql`
- `V1__core_schema.sql`
- `V2__preset_data.sql`
- `V3__indexes_and_constraints.sql`
- `V4__operations_schema.sql`
- `V5__operations_preset_data.sql`
- `V6__operations_indexes.sql`
- `V7__admin_workflows_and_baan_seed.sql`
- `V8__branch_add_on_controls.sql`
- `V9__baan_json_preset_seed.sql`
- `V10__payment_refs_cart_cleanup_and_dashboard.sql`

## Domain Groups

### Customer identity and sessions

- `users`
- `refresh_tokens`

### Catalog and branches

- `companies`
- `categories`
- `products`
- `product_categories`
- `product_add_ons`
- `branch_product_add_ons`
- `branches`
- `branch_operating_hours`
- `branch_products`

Branch records now also carry:

- `accepting_orders`
- `supports_pickup`
- `supports_rider_delivery`
- `rider_delivery_fee`
- `operational_note`

Branch product records now also carry:

- `is_temporarily_closed`
- `availability_note`
- `reorder_level`

Branch add-on override records carry:

- `is_enabled`
- `is_temporarily_closed`
- `price_override`
- `availability_note`

### Cart and ordering

- `carts`
- `cart_items`
- `cart_item_add_ons`
- `business_reference_counters`
- `transactions`
- `orders`
- `order_items`
- `order_item_add_ons`
- `delivery_jobs`
- `customer_complaints`

Order records now also carry:

- `reference_code`
- `fulfillment_mode`
- `delivery_fee`
- `customer_note`

Transaction records now also carry:

- `reference_code`
- `expires_at`
- `provider_id`
- `provider_reference`
- `provider_status`
- `payment_action`
- `paid_at`
- `failed_reason`

Current payment hardening reuses these existing fields:

- `expires_at` drives normalized `expired` status
- `payment_action` stores safe provider QR/authorize/source/failure metadata for the frontend
- `provider_status`, `paid_at`, and `failed_reason` stay available for provider debugging and UI summary

### Payments and providers

- `payment_methods`
- `company_payment_methods`
- `payment_providers`
- `payment_webhook_events`
- `system_configs`

### Roles, staff, and operations

- `roles`
- `permissions`
- `role_permissions`
- `employees`
- `employee_role_assignments`
- `employee_branch_assignments`
- `staff_accounts`
- `admin_refresh_tokens`
- `attendance_sessions`
- `ot_requests`
- `payroll_settings`
- `payroll_periods`
- `payroll_entries`
- `branch_stock_movements`

## Relationship Summary

- `users 1:n refresh_tokens`
- `users 0..1:1 employees`
- `employees 1:1 staff_accounts`
- `employees n:n roles` through `employee_role_assignments`
- `employees n:n branches` through `employee_branch_assignments`
- `roles n:n permissions` through `role_permissions`
- `employees 1:n attendance_sessions`
- `employees 1:n ot_requests`
- `payroll_periods 1:n payroll_entries`
- `branches 1:n branch_products`
- `branches 1:n branch_product_add_ons`
- `branches 1:n delivery_jobs`
- `branches 1:n customer_complaints`
- `orders 0..1:1 delivery_jobs`
- `orders 0..n customer_complaints`
- `users 0..n customer_complaints`
- `payment_providers 1:n payment_methods`
- `payment_providers 1:n payment_webhook_events`

## Key Constraints

- role, permission, and provider codes are unique
- employee codes and usernames are unique
- one primary branch assignment per employee
- one open attendance session per employee
- compensation type requires the relevant wage/salary field
- payroll amounts and minutes are non-negative
- rider delivery fee is non-negative
- reorder level is non-negative when present
- transaction and order statuses are constrained
- order status constraint now includes `READY`
- transaction and order `reference_code` values are unique
- `business_reference_counters` allocates daily `TX` and `OD` sequence numbers safely under concurrency

## Preset Data

Preset migrations provide:

- demo catalog + branches
- BAAN-menu-inspired category/product/add-on refresh for local development
- BAAN Phuket branch presets driven from committed JSON source files
- per-branch menu availability and stock presets for the seeded branches
- per-branch add-on pricing/sellability presets
- operational configs
- role and permission matrix
- payroll default settings
- Omise payment provider
- Omise PromptPay payment method

`V10__payment_refs_cart_cleanup_and_dashboard.sql` also provides a DB-level repair path for stale cart data by deleting:

- orphaned `cart_item_add_ons`
- cart items whose branch-product mapping no longer exists
- cart items tied to inactive branch-product rows
- cart items whose selected add-ons no longer belong to the product or are branch-disabled

## Indexes

Important hot-path indexes now cover:

- employee role and branch scope lookups
- active staff accounts
- open attendance lookups
- OT review queues
- payroll period and payroll entry reads
- branch stock history
- provider transaction lookups
- webhook event deduplication
- rider delivery queues
