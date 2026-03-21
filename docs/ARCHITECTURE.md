# Architecture

## Split Model

The repository preserves a strict split:

- Next.js = frontend-first
- Go = backend-first
- PostgreSQL schema = versioned SQL in `sql/`

## Frontend / Backend Boundary

### Frontend owns

- route composition
- page state
- presentation logic
- local persistence
- role-aware navigation
- API consumption through `src/services`

### Backend owns

- auth/session issuance
- permission enforcement
- business rules
- transactional writes
- payment orchestration
- payroll computation
- attendance rules
- stock validation
- rider job status changes
- SQL query design

## Frontend Structure

Pattern:

- page -> component -> service

Meaning:

- pages orchestrate data and route state
- components stay reusable and UI-focused
- services are the only place that know endpoint paths

Two auth clients exist:

- customer API client
- admin API client

They intentionally use separate stored tokens and separate refresh flows.

## Backend Request Flow

1. router registers public, customer, admin, and webhook routes
2. middleware authenticates bearer tokens and injects claims
3. handlers decode DTOs and write the shared envelope
4. services enforce workflow and permissions
5. repositories execute SQL and transaction boundaries

## API Envelope

Every HTTP response uses:

```json
{
  "code": "OK",
  "message": "success",
  "body": {}
}
```

## Permission Model

The admin session carries:

- actor type
- roles
- permissions
- branch scope
- optional employee/staff IDs

Frontend navigation uses this for visibility. Backend services re-check permissions before every sensitive action.

## Payment Architecture

Payment logic is backend-owned through a provider abstraction.

Core pieces:

- `PaymentService`
- `PaymentGateway` interface
- `OmiseGateway`
- payment provider tables
- webhook event persistence

Frontend receives normalized:

- payment methods
- transaction statuses
- payment actions
- provider metadata already safe for UI usage

## Query and Transaction Strategy

Important patterns already implemented:

- branch search uses joined/lateral SQL to avoid frontend fan-out
- branch menu batches add-ons after paged product reads
- cart is grouped by branch server-side
- checkout validates sellable state and commits transaction/order/cart changes in one DB transaction
- payroll generation computes from attendance + OT + pay model in backend
- rider job changes sync order status in the same transaction

## Why This Shape

- clearer separation of concerns
- safer operational workflows
- easier to extend payments and roles
- better foundation for production deployment
