# AGENTS.md

This file is the repository source of truth for architecture boundaries, workflow expectations, verification commands, and the current feature surface.

## Product Scope

This repository is now a production-style food ordering platform with two major product surfaces:

- customer ordering web app
- admin and branch operations console

The platform supports:

- mobile-first customer ordering
- branch discovery and menu browsing
- cart, checkout, payment, and order history
- admin login with backend-owned sessions
- employee, attendance, OT, payroll, and branch operations
- stock-aware menu availability
- pluggable payment gateways with Omise first
- rider-based branch delivery workflow

## Current Architecture

### Frontend

The frontend lives in the repository root and stays frontend-first:

- `src/pages`: route orchestration
- `src/components`: reusable UI
- `src/services`: frontend API callers and FE-side interaction helpers
- `src/store`: Redux slices for customer auth, admin auth, cart, config, notifications
- `src/types`: frontend payload types aligned to Go JSON responses
- `src/utils`: storage, API clients, helpers

Rules:

- keep pages thin
- keep reusable UI in components
- keep endpoint knowledge inside `src/services`
- do not reintroduce business logic or data writes into Next.js API routes

### Backend

The Go API lives in `go_backend`:

- `cmd/server`: HTTP server entrypoint
- `cmd/migrate`: migration runner
- `internal/config`: env/runtime config
- `internal/db`: PostgreSQL connection + migration execution
- `internal/auth`: JWT + identity helpers
- `internal/middleware`: customer/admin auth and permission enforcement
- `internal/handler`: request parsing + envelope writing
- `internal/service`: business workflows
- `internal/repository`: SQL and transaction-safe persistence
- `internal/model`: response models
- `internal/dto`: request DTOs
- `internal/httpapi`: common response helpers

Rules:

- handlers stay small
- services own workflow, validation, money/status transitions, and permission-aware orchestration
- repositories own SQL
- money, payroll, attendance, stock, and payment state remain backend-owned

### Database

All schema work lives under `sql/` as versioned migrations:

- `V0__baseline.sql`
- `V1__core_schema.sql`
- `V2__preset_data.sql`
- `V3__indexes_and_constraints.sql`
- `V4__operations_schema.sql`
- `V5__operations_preset_data.sql`
- `V6__operations_indexes.sql`

Rules:

- add schema changes only via a new `V*__*.sql`
- keep seed/preset data deterministic
- update docs whenever tables, indexes, or constraints change

## Frontend Route Map

### Customer routes

- `/`
- `/search`
- `/branches/[id]`
- `/checkout`
- `/payment/[txnId]`
- `/account`
- `/login`
- `/web-hook-line`

### Admin routes

- `/admin/login`
- `/admin`
- `/admin/employees`
- `/admin/attendance`
- `/admin/payroll`
- `/admin/branches`
- `/admin/menu` -> branch/menu operations alias
- `/admin/stock` -> stock operations alias
- `/admin/orders`
- `/admin/riders`
- `/admin/payments`

Customer and admin auth/session state are intentionally separate.

## Feature Map

### Customer app

- Firebase + LINE login
- bootstrap hydration
- branch search by keyword/category/location
- branch operating state and fulfillment mode visibility
- menu browsing with stock-aware and branch-aware availability
- add-ons and normalized cart
- pickup or rider-delivery checkout
- wallet, manual QR/slip, and Omise PromptPay flows
- payment detail with provider/manual actions
- profile, order history, and transaction history

### Admin / operations

- bootstrap owner login from `ADMIN_USERNAME` and `ADMIN_PASSWORD`
- staff-account login through employee management
- role + permission + branch-scope session model
- employee creation/update with roles, branches, and compensation data
- attendance clock in / clock out / correction flows
- OT request and review
- payroll settings, payroll periods, and generated payroll entries
- branch open/close and fulfillment controls
- stock-aware branch product overrides
- order queue management
- rider job queue, claim, and delivery status transitions
- payment provider list, payment records, and webhook event visibility

## Role Model

Supported roles:

- `employee`
- `manager_branch`
- `manager`
- `owner`
- `rider`

Permissions are stored in SQL and enforced by Go middleware/services. Frontend navigation is role-aware but not authoritative.

## Payment Architecture

Payment logic is backend-owned.

- frontend receives payment DTOs and `paymentAction`
- backend normalizes payment method type, provider state, and webhook events
- payment gateway logic is abstracted behind `PaymentGateway`
- Omise is the first provider implementation
- another provider should be added by implementing the interface and registering it in `PaymentService`

## Rider Delivery Model

Supported fulfillment modes:

- `pickup`
- `rider_delivery`

Delivery jobs are created only for rider-delivery orders. Rider flow is branch-local and intentionally non-realtime.

Typical statuses:

- `waiting_for_rider`
- `assigned_to_rider`
- `picked_up`
- `delivered`
- `failed_delivery`
- `cancelled`

## UI Standards

### Customer app

- mobile first
- tablet intentional, not stretched mobile
- white surfaces, emerald/soft green primary accents, slate neutrals
- strong cart/checkout/payment hierarchy
- large touch targets
- sticky CTAs where helpful

### Admin app

- web/tablet first, mobile usable
- operational dashboard look
- clean white surfaces with emerald accents
- page -> component -> service structure still applies

## Change Checklist

When changing schema, API shape, features, permissions, or project structure:

1. add/update SQL migration files
2. update Go DTOs, services, repositories, handlers, and middleware together
3. update frontend types and `src/services`
4. update customer/admin pages and reusable components
5. update tests
6. update this file and relevant docs in `docs/`

## Verification Commands

Frontend:

```bash
npm run dev:frontend
npm run build
npm test
```

Backend:

```bash
cd go_backend
go run ./cmd/migrate
go run ./cmd/server
go test ./...
```

Repo level:

```bash
npm run backend:migrate
npm run backend:test
npm run verify
```

## Documentation Map

- [`README.md`](./README.md)
- [`docs/PROJECT_STRUCTURE.md`](./docs/PROJECT_STRUCTURE.md)
- [`docs/FEATURES.md`](./docs/FEATURES.md)
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- [`docs/DB_SCHEMA.md`](./docs/DB_SCHEMA.md)
- [`docs/API_CONTRACT.md`](./docs/API_CONTRACT.md)
- [`docs/TESTING.md`](./docs/TESTING.md)
- [`docs/MIGRATION_GUIDE.md`](./docs/MIGRATION_GUIDE.md)
- [`docs/RESPONSIVE_UI_GUIDE.md`](./docs/RESPONSIVE_UI_GUIDE.md)
- [`docs/ADMIN_MODE.md`](./docs/ADMIN_MODE.md)
- [`docs/EMPLOYEE_PAYROLL.md`](./docs/EMPLOYEE_PAYROLL.md)
- [`docs/PAYMENT_GATEWAYS.md`](./docs/PAYMENT_GATEWAYS.md)
- [`docs/RIDER_DELIVERY.md`](./docs/RIDER_DELIVERY.md)
- [`docs/ROLE_PERMISSION_MATRIX.md`](./docs/ROLE_PERMISSION_MATRIX.md)
