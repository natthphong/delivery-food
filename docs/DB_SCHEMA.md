# DB Schema

## Migration Files

- `V0__baseline.sql`
- `V1__core_schema.sql`
- `V2__preset_data.sql`
- `V3__indexes_and_constraints.sql`
- `V4__operations_schema.sql`
- `V5__operations_preset_data.sql`
- `V6__operations_indexes.sql`

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

### Cart and ordering

- `carts`
- `cart_items`
- `cart_item_add_ons`
- `transactions`
- `orders`
- `order_items`
- `order_item_add_ons`
- `delivery_jobs`

Order records now also carry:

- `fulfillment_mode`
- `delivery_fee`
- `customer_note`

Transaction records now also carry:

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
- `branches 1:n delivery_jobs`
- `orders 0..1:1 delivery_jobs`
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

## Preset Data

Preset migrations provide:

- demo catalog + branches
- operational configs
- role and permission matrix
- payroll default settings
- Omise payment provider
- Omise PromptPay payment method

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
