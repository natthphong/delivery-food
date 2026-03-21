# Features

## Customer Experience

### Authentication

- Firebase login
- LINE LIFF login
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
- payment detail page with backend-driven QR rendering
- expired payment detection from `expires_at`
- create-new-payment retry flow for expired/rejected transactions
- legacy manual QR/slip path kept as backend support only and hidden from active checkout

### Customer account

- profile editing
- wallet balance display
- transaction history
- order history with fulfillment and rider status detail
- logout from the account menu and account page

## Admin / Operations

### Admin auth

- owner bootstrap login from environment credentials
- staff account login backed by `staff_accounts`
- dedicated admin refresh tokens and admin session scope

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
- branch product enable/disable
- temporary product closure
- stock quantity and reorder level
- stock movement recording

### Orders, riders, and payments

- branch order queue view
- order status updates
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
- role and permission matrix
- payroll defaults
- Omise payment provider
- gateway and legacy payment methods
