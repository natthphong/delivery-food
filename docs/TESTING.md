# Testing

## Frontend

### Commands

```bash
npm test
npm run build
```

### Test Layout

- `tests/*.test.ts`: Node runner tests for storage and utility behavior
- `src/**/__tests__/*.test.ts?(x)`: Jest tests for components, services, and selectors

### Covered Areas

- token and cart persistence
- response envelope unwrapping
- cart selectors
- payment method picker interaction
- cart drawer selection-to-checkout draft behavior

## Backend

### Command

```bash
cd go_backend
go test ./...
```

### Covered Areas

- JWT signing and parsing
- refresh token hashing helpers
- auth middleware
- handler parsing helpers
- shared service helpers
- LINE profile claim normalization
- cart add-on signature generation

## Full Verification

Use the repo-level command:

```bash
npm run verify
```

This runs:

- frontend production build
- frontend tests
- backend tests

## Notes

- The frontend test harness combines Node’s built-in test runner and Jest.
- `scripts/run-tests.js` compiles Node-runner tests into `.test-dist` before execution.
- If API contract types change, update frontend types and rerun both build and tests.
