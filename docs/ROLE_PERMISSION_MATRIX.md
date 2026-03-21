# Role Permission Matrix

## Roles

- `employee`
- `manager_branch`
- `manager`
- `owner`
- `rider`

## High-Level Access

### `employee`

- self attendance
- self payroll visibility where allowed
- self OT requests

### `rider`

- employee self-service
- rider queue read
- rider claim/update on scoped jobs

### `manager_branch`

- dashboard read
- employee read
- attendance read/manage
- payroll read
- OT review
- branch and stock management
- order management
- rider queue read
- payment read
- no branch-creation workflow

### `manager`

- manager_branch capabilities across broader scope
- branch creation and branch menu-copy workflow

### `owner`

- full management access
- employee manage
- payroll manage
- payments manage
- settings manage
- branch creation and branch menu-copy workflow

## Source Of Truth

The canonical permission seeds live in:

- `sql/V5__operations_preset_data.sql`

The backend enforces permissions from JWT/admin claims, not from frontend UI visibility.

Additional service-level rules:

- frontend navigation hides unavailable actions for convenience only
- backend validates branch scope before reads/writes
- backend validates order status transitions and returns only allowed next actions to the admin UI
