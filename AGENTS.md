# AGENTS.md

This file is the source of truth for repository structure, architecture boundaries, developer workflow, and verification commands.

## Overview

This repository is a mobile-first food ordering application with:

- a Next.js frontend in the repository root
- a dedicated Go API in [`go_backend`](./go_backend)
- PostgreSQL migrations and preset data in [`sql`](./sql)

The current architecture intentionally keeps presentation and client orchestration in Next.js while moving business logic, validation, transactional behavior, and SQL access into the Go backend.

## Current Architecture

### Frontend

The frontend uses the Pages Router and follows this structure:

- `src/pages`: route entry points and page orchestration
- `src/components`: reusable UI and interaction components
- `src/services`: frontend-facing API helpers that call the Go backend
- `src/store`: Redux state for auth, cart, config, and notifications
- `src/utils`: shared browser/client utilities
- `src/types`: frontend DTO/domain types aligned with the Go API payloads

Pages should stay thin. Business rules should not move back into page files or Redux reducers unless the logic is purely client-side presentation logic.

### Backend

The Go service lives in `go_backend` and follows a practical layered structure:

- `cmd/server`: API server entrypoint
- `cmd/migrate`: SQL migration runner
- `internal/config`: env loading and runtime configuration
- `internal/db`: PostgreSQL connection and migration execution
- `internal/auth`: access/refresh token helpers and Firebase verification helpers
- `internal/middleware`: HTTP auth middleware
- `internal/handler`: HTTP request parsing and response writing
- `internal/service`: business workflows and validation
- `internal/repository`: SQL queries and transaction boundaries
- `internal/model`: domain models returned to the frontend
- `internal/dto`: request DTOs for API inputs
- `internal/httpapi`: shared JSON envelope helpers

Handlers should stay small. Repositories own SQL. Services own rules, orchestration, and transaction-level decisions.

### Database

All schema work now lives in versioned SQL files under `sql`:

- `V0__baseline.sql`
- `V1__core_schema.sql`
- `V2__preset_data.sql`
- `V3__indexes_and_constraints.sql`

Do not scatter schema definitions into app code or ad hoc SQL files. New schema work should use a new versioned migration.

## Feature Map

The repository currently supports:

- Firebase and LINE login
- access token + refresh token session flow
- bootstrap payload for authenticated app hydration
- branch search by text/category/location
- branch menu browsing and featured items
- product add-ons
- cart add/update/remove/clear by branch
- checkout with single-branch enforcement
- wallet balance payments
- QR/slip-based payments
- deposit/top-up flow
- transaction detail and slip submission
- account profile update
- order and transaction history

## Frontend Conventions

- Route pages orchestrate data loading and compose sections.
- Components stay reusable and UI-focused.
- Services are the only place that should know endpoint paths.
- The frontend API envelope is `{"code","message","body"}` and is unwrapped in `src/services/api.ts`.
- Auth and cart state are persisted in local storage through `src/utils/tokenStorage.ts`.
- Mobile-first UX is required for ordering flows. The cart, checkout, and payment flows should remain touch-friendly.

## Backend Conventions

- Every external request returns the shared JSON envelope.
- Validation belongs at the handler boundary and in services where business constraints apply.
- Database writes that change multiple tables must stay transactional.
- Prefer joined/batched reads over repeated lookup loops.
- Repository methods should match the normalized schema instead of reintroducing JSON blobs or denormalized user-owned cart/order state.

## SQL Conventions

- Keep migrations deterministic and idempotent where practical.
- Seed/preset data needed for local bootstrapping belongs in versioned migrations, not ad hoc scripts.
- Add indexes for hot paths only when tied to real read/write flows.
- Document new tables and relationships in `docs/DB_SCHEMA.md` whenever schema changes.

## Verification Commands

Frontend:

```bash
npm run dev
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

Repo-level shortcuts:

```bash
npm run dev:frontend
npm run dev:backend
npm run backend:migrate
npm run backend:test
npm run verify
```

## Change Checklist

When changing API shape, schema, feature flow, or project structure:

1. Update or add a SQL migration when schema/data shape changes.
2. Update Go DTOs, services, repositories, handlers, and API docs together.
3. Update frontend types and service helpers to match the API contract.
4. Update pages/components if UX or flow changes.
5. Add or update tests on both the Go and frontend side.
6. Update this file and the relevant docs in `docs/`.

## Documentation Map

- [`README.md`](./README.md): quickstart and repo overview
- [`docs/PROJECT_STRUCTURE.md`](./docs/PROJECT_STRUCTURE.md): directory map
- [`docs/FEATURES.md`](./docs/FEATURES.md): user-facing flows
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md): frontend/backend responsibilities
- [`docs/DB_SCHEMA.md`](./docs/DB_SCHEMA.md): schema and relationships
- [`docs/API_CONTRACT.md`](./docs/API_CONTRACT.md): HTTP contract
- [`docs/TESTING.md`](./docs/TESTING.md): test layout and commands
- [`docs/MIGRATION_GUIDE.md`](./docs/MIGRATION_GUIDE.md): migration notes from the old structure
- [`docs/RESPONSIVE_UI_GUIDE.md`](./docs/RESPONSIVE_UI_GUIDE.md): mobile/tablet UX rules
