# Migration Guide

## Summary

The repo has now moved through two major phases:

1. mixed Next.js frontend/backend -> split Next.js + Go architecture
2. customer ordering app -> customer app + operations/admin platform

## What Changed

### Backend

Added and expanded:

- dedicated Go backend structure
- admin auth sessions
- role + permission enforcement
- employee/attendance/payroll services
- stock and branch operations services
- payment gateway abstraction
- Omise integration + webhook processing
- backend notification service for Resend + LINE
- rider delivery workflows

### Frontend

Added and expanded:

- dedicated admin route space under `/admin/*`
- separate admin token/session handling
- shared locale handling across customer and admin auth surfaces
- improved customer checkout for pickup vs rider delivery
- richer payment detail rendering from backend `paymentAction`
- payment expiry + retry UX
- account-driven admin entry instead of a customer navigation tab
- responsive customer and admin surfaces
- focused `/login` and `/signup` screens without customer top navigation
- modal-based admin employee/branch workflows

### Database

Extended with:

- roles, permissions, and staff accounts
- employee assignments
- attendance and OT
- payroll settings, periods, and entries
- branch stock movements
- payment providers and webhook events
- fulfillment mode and rider delivery tables/fields
- `READY` order state in `V7__admin_workflows_and_baan_seed.sql`
- branch add-on override controls in `V8__branch_add_on_controls.sql`
- BAAN JSON-driven preset catalog refresh in `V9__baan_json_preset_seed.sql`

Existing transaction fields already cover:

- `expires_at`
- `provider_status`
- `payment_action`
- `paid_at`
- `failed_reason`

## Upgrade Steps For Local Environments

1. update frontend env from `.env.example`
2. update backend env from `go_backend/.env.example`
3. add admin credentials, Omise keys, and notification credentials where needed
4. run:

```bash
npm run backend:migrate
```

5. restart backend and frontend
6. if you need the refreshed local/demo catalog, ensure `V8__branch_add_on_controls.sql` and `V9__baan_json_preset_seed.sql` have been applied

## Breaking/Important Behavioral Differences

- admin auth is separate from customer auth
- branch/product availability is enforced by backend operations state
- branch add-on pricing/sellability is enforced by backend branch override state
- admin order actions are gated by backend-computed valid transitions, including `READY`
- checkout now includes fulfillment mode and can create rider jobs
- payment records can be provider-backed and include gateway payment actions
- payroll data is computed from attendance + OT approvals instead of being implicit
- branch creation can copy all or selected menu items from another branch through backend workflow rules

## Development Rules Going Forward

- do not add backend-heavy logic back into Next.js routes
- do not change schema outside versioned SQL
- regenerate BAAN preset SQL through `scripts/generate-baan-seed.js` instead of hand-editing local/demo seed rows
- update AGENTS and docs whenever schema/API/feature behavior changes
