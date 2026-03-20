# Migration Guide

## Summary

The repository moved from a Next.js-mixed frontend/backend structure to a split architecture with:

- frontend in Next.js
- backend in Go
- normalized PostgreSQL schema in versioned SQL files

## Major Changes

### Backend Extraction

Removed:

- `src/pages/api/*`
- `src/repository/*`
- frontend-side backend helpers tied to the old API layer

Added:

- `go_backend/cmd/server`
- `go_backend/cmd/migrate`
- layered Go packages for config, handlers, services, repositories, models, DTOs, and middleware

### Database Normalization

Old behavior mixed domain state more loosely across frontend/backend assumptions.

New schema explicitly models:

- refresh sessions
- carts and cart line add-ons
- transactions
- orders and immutable order item snapshots
- payment method assignment by company

### Frontend Integration

The frontend now calls the Go API through `src/services/*` and hydrates app state through `/v1/bootstrap`.

Key refactors:

- cart state moved to `src/store/cartSlice.ts`
- pages use service helpers instead of local API routes
- account, payment, checkout, and branch flows align to the new backend contract

## Local Upgrade Steps

1. Copy `.env.example` to `.env`.
2. Copy `go_backend/.env.example` to `go_backend/.env`.
3. Run `npm run backend:migrate`.
4. Run `npm run dev:backend`.
5. Run `npm run dev:frontend`.

## Developer Notes

- Use `AGENTS.md` as the repo source of truth.
- Add all new schema work under `sql/` with the next `V*__*.sql` file.
- Do not reintroduce domain logic into `src/pages/api`.
