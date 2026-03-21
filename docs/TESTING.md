# Testing

## Frontend

### Commands

```bash
npm test
npm run build
```

### Test layout

- `tests/*.test.ts`: Node-runner utility and storage tests
- `src/**/__tests__/*.test.ts?(x)`: Jest component and selector tests

### Current frontend coverage

- customer token, cart, config, and admin-session storage
- cart selectors
- cart drawer checkout-draft flow
- cart null-add-on normalization and defensive rendering
- navbar admin-entry visibility
- payment method picker selection
- payment detail expired/retry flow
- role-aware admin navigation rendering
- admin sidebar scroll-region rendering
- admin locale switch persistence
- admin order detail null-item regression coverage
- admin employee validation error rendering
- admin branch creation with menu-copy flow
- admin branch product add-on edit flow
- login/signup auth screen layout without customer nav
- LINE callback minimal-layout regression coverage
- SSR-safe locale initialization and runtime locale hydration
- shared UI error mapping and account profile conflict feedback
- BAAN JSON preset generator category/add-on inference
- response envelope unwrapping

## Backend

### Command

```bash
cd go_backend
go test ./...
```

### Current backend coverage

- JWT signing and refresh token helpers
- customer/admin auth middleware behavior
- handler parsing helpers
- shared service helpers
- LINE profile normalization
- cart add-on/signature helpers
- payroll calculation logic
- Omise checkout mapping and webhook normalization
- payment expiry normalization
- notification service email/LINE fan-out
- admin order transition helpers
- validation error response shaping
- branch menu-copy selection helpers
- manager_branch branch-scope enforcement for branch operations

## Recommended verification flow

```bash
npm run build
npm test
npm run backend:test
```

Or run the combined command:

```bash
npm run verify
```

## Notes

- the frontend test harness runs Node tests first, then Jest
- Go tests are pure unit tests and do not require a running server
- if you change API types or session storage, rerun both `npm test` and `npm run build`
- if you change backend DTOs or payment/operations logic, rerun `go test ./...`
- if you change admin workflows or preset data, also rerun `npm run backend:migrate` against a local dev database before manual QA so new versioned SQL is applied
- if you change pages under `src/pages`, keep test files outside routable page folders so Next.js does not treat them as pages during build
