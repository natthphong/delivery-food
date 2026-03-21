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
- shared locale persistence and translation lookup
- SSR-safe locale initialization before hydration, then post-mount locale reconciliation from query/storage/browser runtime
- role-aware navigation
- customer/admin layout separation
- checkout-draft persistence plus server-truth reconciliation after checkout/payment transitions
- defensive response normalization before render
- shared API error mapping from backend code/message -> localized frontend copy
- API consumption through `src/services`

### Backend owns

- auth/session issuance
- permission enforcement
- business rules
- validation error shaping
- transactional writes
- payment orchestration
- business-facing order/transaction reference generation
- payroll computation
- attendance rules
- stock validation
- branch cloning/menu copy workflows
- branch-level product and add-on pricing / sellability overrides
- order status transitions and allowed-action calculation
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
Each client also owns its own session-expiry recovery path and login redirect.

Navigation rule:

- admin is not rendered as a normal customer tab
- admin entry appears only inside the account menu and only when an admin session exists
- auth callback routes such as `/web-hook-line` should avoid rendering the full customer chrome

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

Validation failures may also return structured `body.fieldErrors` data for field-level UI feedback.

## Permission Model

The admin session carries:

- actor type
- roles
- permissions
- branch scope
- optional employee/staff IDs

Frontend navigation uses this for visibility. Backend services re-check permissions before every sensitive action.

Important operational guardrails:

- owner/bootstrap admin/manager can create branches
- branch-scoped users cannot create branches outside their role allowance
- owner/manager can manage branch controls across broader scope
- manager_branch can manage only the branches inside `branchIds`, including branch open/close, fulfillment toggles, branch-product overrides, and branch add-on overrides
- admin order actions are rendered from backend-computed `allowedStatuses`
- order detail is shaped in Go so `items` is always an array

## Payment Architecture

Payment logic is backend-owned through a provider abstraction.

Core pieces:

- `PaymentService`
- `PaymentGateway` interface
- `OmiseGateway`
- payment provider tables
- webhook event persistence
- retry-payment endpoint for expired/rejected order payments

Frontend receives normalized:

- payment methods
- transaction statuses
- payment actions
- provider metadata already safe for UI usage

Payment rules:

- frontend does not infer Omise state client-side
- backend treats `pending + expires_at < now + not paid` as `expired`
- checkout hides legacy manual-slip methods through payment-method scope filtering
- payment detail renders Omise QR from backend-provided `paymentAction.qrImageUrl`
- customer payment countdown uses backend `expiresAt` as the source of truth, with client ticking only for presentation
- order and transaction APIs now expose `referenceCode` while numeric ids stay internal implementation detail

## Notification Architecture

Notifications are backend-owned through `NotificationService`.

- `Mailer` abstraction -> Resend implementation
- `LineMessenger` abstraction -> LINE Bot push implementation
- email verification and provider-login notices are sent from Go only
- order placed / ready / rider-assigned / on-the-way notifications can fan out by email and LINE
- frontend only shows local UI notices and never receives mail or LINE credentials

## Query and Transaction Strategy

Important patterns already implemented:

- branch search uses joined/lateral SQL to avoid frontend fan-out
- branch menu batches add-ons after paged product reads
- customer catalog and cart reads apply branch add-on override state and effective pricing in SQL-backed backend reads
- cart is grouped by branch server-side
- stale cart item update/delete requests reconcile back to current server cart truth instead of leaving the client stuck on an already-consumed row
- checkout validates sellable state and commits transaction/order/cart changes in one DB transaction
- checkout keeps a best-effort post-commit response path so successful order creation does not surface as a false frontend failure when detail/cart readback needs fallback data
- payroll generation computes from attendance + OT + pay model in backend
- branch creation can copy all or selected source-branch menu items within backend workflow rules
- BAAN preset data is generated from committed JSON source files through `scripts/generate-baan-seed.js` and committed as versioned SQL
- business reference counters are allocated in SQL-backed backend writes for daily `TXyyMMdd######` / `ODyyMMdd######` codes
- admin order detail uses a dedicated read path and normalizes empty item collections
- admin dashboard analytics are branch-scoped in Go and queried through one role-aware dashboard endpoint with optional `branchId` and `days`
- rider job changes sync order status in the same transaction

## Why This Shape

- clearer separation of concerns
- safer operational workflows
- easier to extend payments and roles
- better foundation for production deployment
