# Delivery Food Go Backend

This service owns the application API, business logic, PostgreSQL queries, and transactional workflows for the delivery app frontend in the repository root.

## Packages

- `cmd/server`: starts the HTTP server
- `cmd/migrate`: executes SQL migrations from `../sql`
- `internal/config`: environment loading
- `internal/db`: pgx pool and migration helpers
- `internal/auth`: JWT and Firebase-related auth helpers
- `internal/middleware`: auth middleware
- `internal/handler`: request parsing and response writing
- `internal/service`: business workflows
- `internal/repository`: SQL and transaction helpers
- `internal/model`: JSON-facing domain models
- `internal/dto`: request DTOs
- `internal/httpapi`: shared response envelope helpers

## Environment

Copy the example file:

```bash
cp .env.example .env
```

Key variables:

- `APP_PORT`
- `APP_FRONTEND_ORIGIN`
- `DATABASE_URL` or `APP_DB_*`
- `APP_JWT_SECRET`
- `APP_ACCESS_TOKEN_TTL_MINUTES`
- `APP_REFRESH_TOKEN_TTL_HOURS`
- `APP_AUTO_MIGRATE`
- `APP_MIGRATION_DIR`
- `FIREBASE_API_KEY`
- `SLIPOK_MODE`
- `SLIPOK_VERIFY_URL`
- `SLIPOK_TOKEN`

## Run

```bash
go run ./cmd/migrate
go run ./cmd/server
```

Defaults:

- API: `http://localhost:8080`
- expected frontend origin: `http://localhost:3000`

## Test

```bash
go test ./...
```

## Contract Notes

- All endpoints return the shared JSON envelope: `code`, `message`, `body`
- Authenticated routes use bearer access tokens
- Refresh rotation is handled by `/v1/auth/refresh`
- SQL schema is defined only by the versioned files in `../sql`
