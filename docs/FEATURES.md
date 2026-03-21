# Features

## Customer Experience

### Authentication

- Firebase login
- LINE LIFF login
- dedicated login/signup screens with the shared app locale switch
- minimal LINE callback handoff screen without the customer navbar
- access token + refresh token session flow
- bootstrap hydration from `/v1/bootstrap`
- backend email verification link flow
- provider-login notification email

### Branch discovery and ordering

- branch search by keyword, category, and location
- branch cards with operating state, pickup/rider-delivery support, and sample products
- branch menu with stock-aware product availability
- product add-ons
- cart grouped by branch
- checkout draft persisted in local storage

### Checkout and payment

- single-branch checkout validation
- pickup or rider-delivery fulfillment mode
- delivery fee support for rider delivery
- wallet balance payment
- Omise PromptPay gateway checkout
- payment detail page with backend-driven QR rendering and live expiry countdown
- expired payment detection from `expires_at`
- create-new-payment retry flow for expired/rejected transactions
- order and transaction history show business reference codes instead of plain numeric ids
- stale checkout drafts are reconciled against current server cart truth after checkout/payment errors
- legacy manual QR/slip path kept as backend support only and hidden from active checkout

### Customer account

- profile editing
- shared localized error feedback for profile/account actions
- wallet balance display
- transaction history
- order history with fulfillment and rider status detail
- logout from the account menu and account page

## Admin / Operations

### Admin auth

- owner bootstrap login from environment credentials
- staff account login backed by `staff_accounts`
- dedicated admin refresh tokens and admin session scope
- admin Thai/English locale switch using the shared frontend i18n store

### Roles and permissions

- `employee`
- `manager_branch`
- `manager`
- `owner`
- `rider`

Role-aware menus exist in the frontend, but Go remains authoritative for access control.

### Employee management

- create employee
- edit employee
- modal-based employee entry with inline field validation and submit-level error feedback
- activate/deactivate employee
- assign roles
- assign one or more branches
- configure compensation model and OT behavior
- provision optional staff login

### Attendance and OT

- clock in
- clock out
- open attendance tracking
- attendance correction with audit note
- OT request submission
- OT review/approval

### Payroll

- owner-managed payroll settings
- payroll period creation
- payroll period generation
- hourly and salary payroll calculations
- OT pay calculation
- per-employee payroll breakdown

### Branch and stock operations

- force close / reopen branch
- accepting orders toggle
- pickup / rider-delivery enablement
- rider delivery fee configuration
- create branch with copy-all or copy-selected menu flow from another branch
- branch product enable/disable
- branch product price override editing
- temporary product closure
- branch add-on price and sellability editing
- stock quantity and reorder level
- stock movement recording
- cleaner branch/product editing through modal workflows

### Orders, riders, and payments

- branch order queue view
- safe order detail inspection with empty/fallback states
- order status updates including kitchen `READY` handoff
- role-aware operations dashboard with sales trend, complaints, OT queue, staffing trend, and schedule summary
- rider job queue
- rider claim and delivery status progression
- payment records
- payment providers
- webhook event visibility
- customer/admin notification fan-out by email and LINE

## Seeded Local Data

Preset data includes:

- demo company
- demo catalog and branches
- BAAN JSON-driven categories, products, inferred add-ons, images, and branch menu availability
- BAAN Phuket branch presets with sample branch add-on overrides
- role and permission matrix
- payroll defaults
- Omise payment provider
- gateway and legacy payment methods
