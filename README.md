# Delivery Food Platform

Split-architecture food ordering platform with:

- Next.js customer + admin frontend
- Go backend API
- PostgreSQL migrations in `sql/`

Current framework/runtime baseline:

- Next.js `16.2.1`
- React `19`
- Node.js `20+` recommended

Start with [`AGENTS.md`](./AGENTS.md). It is the repository source of truth.

## What This Repo Includes

### Customer app

- mobile-first branch discovery
- menu browsing with stock-aware availability
- cart and checkout
- pickup and rider delivery
- wallet and Omise PromptPay payment flows
- expired-payment retry flow and backend email verification
- dedicated `/login` and `/signup` screens with shared TH/EN locale switching
- LINE callback handoff on `/web-hook-line` with a minimal auth shell and SSR-safe locale boot
- shared localized error handling instead of raw backend error text in normal flows
- account, order history, and transaction history

### Admin / operations

- owner bootstrap login with `ADMIN_USERNAME` / `ADMIN_PASSWORD`
- employee management
- attendance clocking and corrections
- OT request/review
- payroll settings, periods, and generated entries
- branch open/close, creation, and menu-copy controls
- modal-based branch product availability and stock adjustments
- stock adjustments
- order queue management with kitchen-ready actions and safe detail rendering
- rider queue management
- payment/provider/webhook visibility
- admin locale switch with shared app i18n persistence
- Resend email notifications and LINE order notifications

## Architecture

- `src/`: Next.js frontend
- `go_backend/`: Go API service
- `sql/`: versioned SQL migrations
- `docs/`: architecture, schema, API, testing, responsive UI, and operations docs

Responsibility split:

- Next.js owns route orchestration, UI, local state, and API consumption
- Go owns auth, permissions, business rules, transactional writes, payment orchestration, and SQL

## Environment Setup

### Frontend

```bash
cp .env.example .env
```

Important vars:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_LINE_LIFF_ID`

### Backend

```bash
cp go_backend/.env.example go_backend/.env
```

Important vars:

- `APP_JWT_SECRET`
- `DATABASE_URL` or `APP_DB_*`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `FIREBASE_API_KEY`
- `OMISE_SECRET_KEY`
- `OMISE_PUBLIC_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_NOTIFY_TO`
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_TOKEN`
- `SLIPOK_*` when using remote slip verification

## Migrations

Run:

```bash
npm run backend:migrate
```

Current migration set:

- `V0__baseline.sql`
- `V1__core_schema.sql`
- `V2__preset_data.sql`
- `V3__indexes_and_constraints.sql`
- `V4__operations_schema.sql`
- `V5__operations_preset_data.sql`
- `V6__operations_indexes.sql`
- `V7__admin_workflows_and_baan_seed.sql`

## Local Development

Frontend:

```bash
npm run dev:frontend
```

Backend:

```bash
npm run dev:backend
```

Defaults:

- frontend: `http://localhost:3000`
- backend: `http://localhost:8080`

## Verification

Frontend tests:

```bash
npm test
```

Frontend production build:

```bash
npm run build
```

Notes:

- `npm run dev` runs the Next.js 16 dev server
- `npm run build` uses `next build --webpack` for the current repository

Backend tests:

```bash
npm run backend:test
```

Full verification:

```bash
npm run verify
```

## Documentation

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
