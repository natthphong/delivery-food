# Admin Mode

## Purpose

Admin mode is a dedicated operational surface for owner and staff workflows. It is intentionally separate from customer navigation and customer auth.

## Auth Model

- route entry: `/admin/login`
- backend validates credentials
- bootstrap owner access comes from `ADMIN_USERNAME` / `ADMIN_PASSWORD`
- employees can also receive a `staff_accounts` login
- admin refresh tokens are stored separately from customer refresh tokens

## Session Shape

The admin session includes:

- actor type and label
- optional employee/staff IDs
- roles
- permissions
- branch scope

## Main Routes

- `/admin`
- `/admin/employees`
- `/admin/attendance`
- `/admin/payroll`
- `/admin/branches`
- `/admin/orders`
- `/admin/riders`
- `/admin/payments`

## UX Conventions

- grouped role-aware navigation with a Thai/English locale switch in the admin shell
- the desktop sidebar uses its own scroll region so long navigation sets stay usable on laptop-height screens
- modal-first create/edit flows for employees, branches, branch controls, stock, and order detail
- branch menu operations use focused product/add-on editors instead of one large in-page form
- inline field validation plus submit-level error summaries for operational forms
- backend-driven order actions via `allowedStatuses` instead of frontend-only transition guesses

## Operational Notes

- branch creation is limited to bootstrap admin, owner, and manager roles
- branch creation can optionally copy all or selected menu items from an existing branch
- branch-scoped users can manage only their own branch product/add-on overrides
- order detail should always render safely because backend and frontend normalize `items` to an array
- kitchen/staff can move orders into `READY` before pickup completion or rider handoff

## Security Notes

- frontend menus are role-aware, but only for UX
- Go middleware/services remain authoritative for permission checks
- do not expose bootstrap credentials in frontend code
