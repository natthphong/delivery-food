# Delivery Food

Mobile-first food ordering application with a Next.js frontend, a dedicated Go backend, and versioned PostgreSQL migrations.

## What Changed

The repository is now split clearly by responsibility:

- Next.js handles presentation, route orchestration, and client state
- Go handles API routing, validation, business logic, database access, and transactions
- SQL migrations in `sql/` define schema, baseline configuration, and preset data

Start with [`AGENTS.md`](./AGENTS.md) for the developer source of truth.

## Repository Layout

- `src/`: Next.js frontend
- `go_backend/`: Go API service
- `sql/`: versioned schema, seed, and indexing migrations
- `docs/`: project, architecture, schema, API, testing, and responsive UI docs

## Local Development

### 1. Frontend env

```bash
cp .env.example .env
```

Required frontend vars:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_LINE_LIFF_ID`

### 2. Backend env

```bash
cp go_backend/.env.example go_backend/.env
```

Required backend vars:

- `APP_JWT_SECRET`
- database connection values or `DATABASE_URL`
- `FIREBASE_API_KEY` for Firebase token exchange
- `SLIPOK_*` values if using remote slip verification

### 3. Run migrations

```bash
npm run backend:migrate
```

### 4. Start both services

Frontend:

```bash
npm run dev:frontend
```

Backend:

```bash
npm run dev:backend
```

Default local URLs:

- frontend: `http://localhost:3000`
- backend: `http://localhost:8080`

## Verification

Frontend build:

```bash
npm run build
```

Frontend tests:

```bash
npm test
```

Backend tests:

```bash
npm run backend:test
```

Full verification:

```bash
npm run verify
```

## Main Flows

- login with Firebase or LINE
- discover nearby branches by keyword/category/location
- browse branch menu and featured dishes
- add items with add-ons to a normalized cart
- checkout with delivery location confirmation
- pay by wallet or QR/slip
- view payment details, orders, and account history
- top up wallet balance through deposit transactions

## Documentation

- [`AGENTS.md`](./AGENTS.md)
- [`docs/PROJECT_STRUCTURE.md`](./docs/PROJECT_STRUCTURE.md)
- [`docs/FEATURES.md`](./docs/FEATURES.md)
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- [`docs/DB_SCHEMA.md`](./docs/DB_SCHEMA.md)
- [`docs/API_CONTRACT.md`](./docs/API_CONTRACT.md)
- [`docs/TESTING.md`](./docs/TESTING.md)
- [`docs/MIGRATION_GUIDE.md`](./docs/MIGRATION_GUIDE.md)
- [`docs/RESPONSIVE_UI_GUIDE.md`](./docs/RESPONSIVE_UI_GUIDE.md)
