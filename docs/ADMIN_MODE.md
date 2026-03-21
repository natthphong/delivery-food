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

## Security Notes

- frontend menus are role-aware, but only for UX
- Go middleware/services remain authoritative for permission checks
- do not expose bootstrap credentials in frontend code
