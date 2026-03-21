# Project Structure

## Top Level

- `AGENTS.md`: developer source of truth
- `README.md`: quickstart
- `docs/`: human-readable system guides
- `sql/`: versioned PostgreSQL migrations
- `go_backend/`: Go API service
- `src/`: Next.js frontend
- `tests/`: Node-runner tests
- `scripts/run-tests.js`: combined frontend test harness

## Frontend

### Pages

Customer routes:

- `src/pages/index.tsx`
- `src/pages/search.tsx`
- `src/pages/branches/[id].tsx`
- `src/pages/checkout/index.tsx`
- `src/pages/payment/[txnId].tsx`
- `src/pages/account/index.tsx`
- `src/pages/login.tsx`
- `src/pages/web-hook-line.tsx`

Admin routes:

- `src/pages/admin/login.tsx`
- `src/pages/admin/index.tsx`
- `src/pages/admin/employees.tsx`
- `src/pages/admin/attendance.tsx`
- `src/pages/admin/payroll.tsx`
- `src/pages/admin/branches.tsx`
- `src/pages/admin/menu.tsx`
- `src/pages/admin/stock.tsx`
- `src/pages/admin/orders.tsx`
- `src/pages/admin/riders.tsx`
- `src/pages/admin/payments.tsx`

### Components

- `src/components/branch`: customer menu browsing and product detail UI
- `src/components/cart`: floating cart CTA and drawer/bottom sheet
- `src/components/payment`: method picker, deposit modal, slip upload
- `src/components/search`: branch discovery UI
- `src/components/admin`: admin shell, cards, permissions, and shared admin UI primitives
- `src/components/common`: low-level reusable UI

### Frontend data and state

- `src/services`: customer and admin API clients
- `src/store`: `auth`, `adminAuth`, `cart`, `config`, `notifications`
- `src/types`: customer, transaction, and admin payload types
- `src/utils/apiClient.tsx`: customer axios client with refresh
- `src/utils/adminApiClient.tsx`: admin axios client with separate refresh flow
- `src/utils/tokenStorage.ts`: persisted customer/admin session helpers

## Backend

### Entry points

- `go_backend/cmd/server/main.go`
- `go_backend/cmd/migrate/main.go`

### Internal packages

- `internal/config`
- `internal/db`
- `internal/auth`
- `internal/middleware`
- `internal/handler`
- `internal/service`
- `internal/repository`
- `internal/model`
- `internal/dto`
- `internal/httpapi`

### Operational backend modules

The backend now includes dedicated logic for:

- admin auth and scoped JWT claims
- employee and staff account management
- attendance and corrections
- OT requests and review
- payroll settings, periods, and generation
- branch operational state and stock management
- payment providers and webhook records
- rider delivery jobs

## SQL

Current migration set:

- `V0__baseline.sql`
- `V1__core_schema.sql`
- `V2__preset_data.sql`
- `V3__indexes_and_constraints.sql`
- `V4__operations_schema.sql`
- `V5__operations_preset_data.sql`
- `V6__operations_indexes.sql`

Legacy SQL under `sql/migrations/` is not the current source of truth.

## Tests

- `tests/*.test.ts`: Node-runner utility/storage tests
- `src/**/__tests__/*.test.ts?(x)`: Jest tests for components and selectors
- `go_backend/**/*_test.go`: Go unit tests
