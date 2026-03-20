# Project Structure

## Top Level

- `AGENTS.md`: developer source of truth
- `README.md`: quickstart
- `docs/`: deeper project documentation
- `sql/`: versioned PostgreSQL migrations and preset data
- `go_backend/`: Go API
- `src/`: Next.js frontend
- `tests/`: Node runner tests and Jest setup
- `scripts/run-tests.js`: combined frontend test harness

## Frontend

### Pages

- `src/pages/index.tsx`: branch discovery and primary landing page
- `src/pages/search.tsx`: search alias
- `src/pages/branches/[id].tsx`: branch menu and add-to-cart flow
- `src/pages/checkout/index.tsx`: checkout, payment method selection, location confirmation
- `src/pages/payment/[txnId].tsx`: payment detail, QR, slip upload, order detail
- `src/pages/account/index.tsx`: profile, transactions, orders
- `src/pages/login.tsx`: Firebase auth entry point
- `src/pages/web-hook-line.tsx`: LINE LIFF callback/login flow

### UI Components

- `src/components/branch`: branch/menu browsing UI
- `src/components/cart`: floating cart button and bottom-sheet drawer
- `src/components/payment`: method picker, deposit modal, slip upload
- `src/components/checkout`: location confirmation map
- `src/components/auth`: login forms and OTP modal
- `src/components/search`: search input and branch cards
- `src/components/common`: shared low-level components

### Frontend Data Layer

- `src/services`: Go API callers
- `src/store`: Redux slices for auth, cart, config, notifications
- `src/types`: frontend domain types aligned to Go responses
- `src/utils/tokenStorage.ts`: browser persistence
- `src/utils/apiClient.tsx`: Axios client with token refresh

## Backend

### Entry Points

- `go_backend/cmd/server/main.go`
- `go_backend/cmd/migrate/main.go`

### Request Flow

1. `internal/server/router.go` registers routes.
2. `internal/middleware` enforces auth where needed.
3. `internal/handler` parses inputs and writes envelopes.
4. `internal/service` executes business rules.
5. `internal/repository` runs SQL and transactions.

## SQL

- `V0__baseline.sql`: shared extension and trigger function
- `V1__core_schema.sql`: normalized schema
- `V2__preset_data.sql`: baseline config and demo catalog data
- `V3__indexes_and_constraints.sql`: hot-path indexes and uniqueness guards

## Tests

- `tests/*.test.ts`: Node runner tests for utility/state behavior
- `src/**/__tests__/*.test.ts?(x)`: Jest component/service/store tests
- `go_backend/**/*_test.go`: Go unit tests
