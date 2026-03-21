# Employee Payroll

## Employee Model

Each employee can store:

- employee code
- full name and contact info
- employment type
- compensation type
- hourly wage or monthly salary
- OT eligibility and multiplier
- payroll visibility
- branch assignments
- role assignments
- optional staff login

## Attendance Flow

- employee clocks in against a branch
- employee clocks out
- managers can correct sessions with an audit note
- open sessions are prevented from duplicating per employee

## OT Flow

- eligible employees submit OT requests
- branch/company reviewers approve or reject
- approved OT minutes are used by payroll generation

## Payroll Logic

### Part-time / hourly

- regular pay = hourly wage * attendance minutes
- OT pay = hourly wage * OT multiplier * approved OT minutes

### Full-time / salary

- regular pay uses salary prorated to payroll period length
- OT pay derives an hourly base from monthly salary and payroll settings

### Shared rules

- OT minutes are rounded using payroll settings
- adjustments can be injected during payroll period generation
- generated entries are stored in `payroll_entries`

## Operational Use

- use `/admin/employees` for employee records
- use `/admin/attendance` for live attendance and corrections
- use `/admin/payroll` for settings, periods, OT, and generated payroll
