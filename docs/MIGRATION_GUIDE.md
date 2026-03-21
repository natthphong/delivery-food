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
- rider delivery workflows

### Frontend

Added and expanded:

- dedicated admin route space under `/admin/*`
- separate admin token/session handling
- improved customer checkout for pickup vs rider delivery
- richer payment detail rendering from backend `paymentAction`
- responsive customer and admin surfaces

### Database

Extended with:

- roles, permissions, and staff accounts
- employee assignments
- attendance and OT
- payroll settings, periods, and entries
- branch stock movements
- payment providers and webhook events
- fulfillment mode and rider delivery tables/fields

## Upgrade Steps For Local Environments

1. update frontend env from `.env.example`
2. update backend env from `go_backend/.env.example`
3. add admin credentials and Omise keys where needed
4. run:

```bash
npm run backend:migrate
```

5. restart backend and frontend

## Breaking/Important Behavioral Differences

- admin auth is separate from customer auth
- branch/product availability is enforced by backend operations state
- checkout now includes fulfillment mode and can create rider jobs
- payment records can be provider-backed and include gateway payment actions
- payroll data is computed from attendance + OT approvals instead of being implicit

## Development Rules Going Forward

- do not add backend-heavy logic back into Next.js routes
- do not change schema outside versioned SQL
- update AGENTS and docs whenever schema/API/feature behavior changes
