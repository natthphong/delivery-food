# AGENTS.md

This file is the repository source of truth for architecture boundaries, workflow expectations, verification commands, and the current feature surface.

## Product Scope

This repository is now a production-style food ordering platform with two major product surfaces:

- customer ordering web app
- admin and branch operations console

==================================================
MANDATORY FIRST STEP
==================================================

Before making any change:
1. Read `AGENTS.md`
2. Read all relevant files under `docs/`
3. Read current checkout/payment/cart flow in frontend and Go backend
4. Read current SQL migrations under `/sql`
5. Read current transaction/order schema and any seed/test helpers
6. Read current admin dashboard/admin role logic
7. Read current branch role scope logic:
    - manager_branch
    - manager
    - owner
8. Read current payment detail page, cart drawer, checkout services, and backend checkout transaction flow
   Treat `AGENTS.md` and `docs/` as the source of truth.

After every meaningful change:
- update docs
- update `AGENTS.md`
- if schema changes, add new versioned SQL under `/sql`
- if behavior/API changes, update docs and tests
- if cleanup/migration is needed for stale cart mismatch data, include SQL/scripts and document them
- do not leave docs stale
- do not leave data migration unclear

The platform supports:

- mobile-first customer ordering
- branch discovery and menu browsing
- cart, checkout, payment, and order history
- backend email verification and provider-login notification email
- LINE notifications for LINE-linked customer order events
- admin login with backend-owned sessions
- employee, attendance, OT, payroll, and branch operations
- stock-aware menu availability
- branch-aware add-on sellability and price overrides
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
- `V7__admin_workflows_and_baan_seed.sql`
- `V8__branch_add_on_controls.sql`
- `V9__baan_json_preset_seed.sql`

Rules:

- add schema changes only via a new `V*__*.sql`
- keep seed/preset data deterministic
- regenerate BAAN preset SQL through `scripts/generate-baan-seed.js` when the source JSON changes
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
- `/signup`
- `/verify-email`
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
- LINE callback handoff on `/web-hook-line` uses a minimal auth shell instead of the customer layout
- locale boot is SSR-safe on first render, then hydrates persisted/browser locale after mount
- minimal login/signup screens with shared locale switching and no customer top nav
- bootstrap hydration
- branch search by keyword/category/location
- branch operating state and fulfillment mode visibility
- menu browsing with stock-aware and branch-aware availability
- add-ons and normalized cart
- cart and order item `addOns` must be normalized to empty arrays before render/persistence
- pickup or rider-delivery checkout
- wallet and Omise PromptPay flows in the active checkout experience
- legacy manual QR/slip support kept backend-side but hidden from customer checkout
- payment detail with provider-backed QR rendering, expiry handling, and retry flow
- shared frontend error mapping converts backend codes/messages into localized user-safe copy
- logout, backend email verification, and order/provider notification delivery
- profile, order history, and transaction history

### Admin / operations

- bootstrap owner login from `ADMIN_USERNAME` and `ADMIN_PASSWORD`
- staff-account login through employee management
- role + permission + branch-scope session model
- shared Thai/English locale switch using the same i18n persistence model as the customer app
- employee creation/update with roles, branches, and compensation data
- modal-based employee and branch create/edit workflows with inline validation and submit-level feedback
- attendance clock in / clock out / correction flows
- OT request and review
- payroll settings, payroll periods, and generated payroll entries
- branch open/close and fulfillment controls
- branch creation with optional menu copy from an existing branch
- stock-aware branch product overrides
- branch-level add-on price and sellability overrides
- branch-level stock quantity, reorder level, and product temporary closure controls
- order queue management
- order detail modal with defensive empty states and backend-shaped item arrays
- kitchen-ready order transition before pickup completion or rider handoff
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

## Order Operations Model

Supported operational order statuses:

- `PENDING`
- `PREPARE`
- `READY`
- `DELIVERY`
- `COMPLETED`
- `REJECTED`

Operational notes:

- backend returns admin order detail with `items` normalized to an empty array
- backend also returns `allowedStatuses` so admin UI can render only valid actions
- `READY` is the kitchen handoff state before pickup completion or rider-delivery dispatch

## Payment Architecture

Payment logic is backend-owned.

- frontend receives payment DTOs and `paymentAction`
- backend normalizes payment method type, provider state, and webhook events
- backend refreshes gateway-backed transaction state and derives `expired` from `expires_at`
- checkout payment-method discovery uses API scope so legacy manual QR methods stay hidden from active customer checkout
- payment gateway logic is abstracted behind `PaymentGateway`
- Omise is the first provider implementation
- another provider should be added by implementing the interface and registering it in `PaymentService`

Notification delivery is also backend-owned.

- `NotificationService` wraps email + LINE delivery
- Resend is used through the `Mailer` abstraction
- LINE bot push is used through the `LineMessenger` abstraction
- order-ready notifications include branch context and a short item summary where available
- frontend never sees provider secrets or notification credentials

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
- auth routes stay focused on sign-in/sign-up tasks and do not reuse the customer top navigation

### Admin app

- web/tablet first, mobile usable
- operational dashboard look
- clean white surfaces with emerald accents
- grouped navigation, modal-first editing, and strong inline validation/error feedback
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

Notes:

- `npm run dev` uses Next.js 16 dev server
- `npm run build` uses `next build --webpack` for stable production builds on the current repo

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
- [`docs/NOTIFICATIONS.md`](./docs/NOTIFICATIONS.md)
- [`docs/PRESET_DATA.md`](./docs/PRESET_DATA.md)
- [`docs/RIDER_DELIVERY.md`](./docs/RIDER_DELIVERY.md)
- [`docs/ROLE_PERMISSION_MATRIX.md`](./docs/ROLE_PERMISSION_MATRIX.md)
