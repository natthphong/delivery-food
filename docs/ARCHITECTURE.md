# Architecture

## Goal

The repository was refactored so that Next.js is frontend-first and Go is backend-first.

## Frontend / Backend Boundary

### Frontend Responsibilities

- route composition
- user interaction
- local UI state
- persisted auth/cart/config hydration
- calling the Go API through `src/services`
- rendering mobile-first ordering flows

### Backend Responsibilities

- API route ownership
- request validation
- auth verification and token lifecycle
- business rules
- transactions
- SQL access and query shaping
- returning frontend-ready JSON models

## Data Flow

1. User authenticates from the frontend.
2. Frontend exchanges credentials with the Go API.
3. Go issues access and refresh tokens.
4. Frontend stores tokens and calls `/v1/bootstrap`.
5. Frontend renders from normalized user/config/cart data.
6. Cart and checkout changes are submitted to Go services.
7. Go repositories read/write PostgreSQL and return updated state.

## API Shape

All endpoints return:

```json
{
  "code": "OK",
  "message": "success",
  "body": {}
}
```

The frontend unwraps this envelope in `src/services/api.ts`.

## Query Optimization Highlights

- branch search uses lateral joins to return branch hours, match counts, distance, and product samples in one query
- branch menu loads paged products first, then batches add-ons by product IDs
- cart reads group cart items by branch instead of repeatedly fetching related entities
- checkout loads the selected cart items in one query, validates branch consistency once, and commits transaction/order/cart cleanup in one DB transaction
- transactions and orders are loaded with associated method/order data from repository-level joins instead of frontend fan-out requests

## State Model Changes

Old shape:

- cart, order history, and transaction history embedded or mirrored in frontend-heavy flows
- Next.js API routes mixed transport and business logic

New shape:

- normalized cart tables in PostgreSQL
- normalized order and transaction tables
- frontend Redux slices mirror API payloads, not legacy database shapes

## Why This Split

- easier to reason about responsibilities
- better testability
- fewer frontend/backend coupling leaks
- safer transactional checkout and payment logic
- clearer path to production deployment and scaling
