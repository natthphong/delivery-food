# BAAN_FOODIE_PROMPT_GENERATE_PATTERN.md

A field-tested pattern for writing **clean, copy-paste Codex prompts** that generate end-to-end features for the BAAN / Foodie project. Use this when you ask Codex to implement new features, patches, or refactors. It encodes our conventions so the agent **doesn’t guess**.

---

## 0) Golden Rules

* **Standard API envelope**

  ```ts
  type ApiOk<T> = { code: "OK"; message: "success"; body: T };
  type ApiErr = { code: "ERROR" | string; message: string };
  ```
* **HTTP policy**

    * `401/403` → auth/permission
    * `405` → wrong method (no state mutation)
    * `500` → config/server faults only
    * **All business outcomes** (validation, expired, mismatches, etc.) → **200** with a `code`
* **Time zones**: All timestamps returned by BE must be converted to **Asia/Bangkok** before sending to FE. Expiry checks compare **UTC** values safely.
* **DB**: Supabase Postgres. Prefer direct table ops via `@supabase/supabase-js`. For multi-step consistency, use **SQL (triggers/functions)** instead of app transactions when possible.
* **No raw errors** to clients. Map to `ApiErr` codes and friendly messages.
* **i18n**: Use our i18n util & constants. Human statuses must exist for EN/TH.
* **Naming**: keep files in `src/pages/api/...`, `src/repository/...`, `src/types/...`, `src/utils/...`, `src/store/...`, `src/components/...`.
* **FE state**: Redux slices with memoized selectors (Reselect) to avoid unnecessary re-renders.

---

## 1) Repo/Folder Pattern

```
sql/migrations/                      # SQL versioned migrations
src/
  pages/api/                         # API routes (Next.js)
  repository/                        # DB access (supabase-js)
  types/                             # Shared TS types (DTO/DB rows)
  utils/                             # logger, time, auth, apiClient, i18n
  store/                             # Redux slices (auth, config, cart)
  components/                        # UI components
  pages/                             # Next pages (checkout, payment, account, etc.)
constants/                           # maps (status EN/TH, etc.)
```

---

## 2) Standard Sections for Any Prompt

When you ask Codex to implement something, keep these sections (rename task titles as needed). This format produces deterministic, high-quality output.

### 2.1 “Full Feature” Prompt Template

````
Here’s a clean, copy-paste **Codex prompt**. Use it verbatim.

---

# 🔧 <FEATURE TITLE>

**READ FIRST:** Follow our conventions in `AGENT_SETUP.md` and `AGENT_PATTERN.md` (naming, folders, API shape, logging, error handling, i18n, caching). Keep the standard API envelope:

```ts
type ApiOk<T> = { code: "OK"; message: "success"; body: T };
type ApiErr = { code: "ERROR" | string; message: string };
````

**HTTP policy**

* 401/403 for auth, 405 for method mismatch (no state mutation), 500 for config/server faults.
* All business outcomes must be HTTP 200 with a `code`.

## 0) CONTEXT & CONSTRAINTS

* DB: Supabase Postgres via @supabase/supabase-js (no rpc() unless stated).
* All timestamps returned to FE must be Asia/Bangkok (use `toBangkokIso`).
* Env vars: <LIST>.

## 1) DB MIGRATIONS

* File(s): `sql/migrations/VX_<name>.sql`
* What to create/alter (idempotent), indexes, constraints, triggers.
* For history trimming prefer triggers:

    * `trim_int_array(arr,max_len)`
    * AFTER INSERT triggers to append & trim (`txn_history` 50, `order_history` 100).

## 2) BACKEND — REPOSITORIES & TYPES

* Create/update files in `src/repository/` with typed functions only returning plain objects.
* Shared types in `src/types/<domain>.ts`.

## 3) BACKEND — API ROUTES

* Place under `src/pages/api/...`
* All routes must:

    * Validate auth via middleware.
    * `Cache-Control: no-store`.
    * Return `ApiOk/ApiErr` with codes. No raw errors.
* Define request/response shapes.

## 4) FRONTEND

* State: extend slices, add memoized selectors (Reselect).
* Components with props & event handlers; modern UI (Tailwind), no blocking UX.
* i18n keys for labels, TH/EN maps for statuses.
* If maps/consts added: file them in `constants/`.

## 5) VALIDATIONS & BUSINESS RULES

* List all constraints & explicit error codes for each failure case.

## 6) FILES TO CREATE / UPDATE

* Bullet list with exact relative paths.

## 7) API SHAPES (SAMPLES)

* Include JSON example requests/responses.

## 8) ERROR CODES

* Enumerate codes used in this feature and their meanings.

## 9) ACCEPTANCE CRITERIA

* Bullet list, user-visible outcomes.

## 10) TEST PLAN

* Manual steps to verify, including edge cases.

---

**Implement exactly as above, commit in focused PRs (DB → repos → APIs → FE). Keep code typed/clean, follow `AGENT_PATTERN.md`.**

```

### 2.2 “Patch Set” Prompt Template

For targeted fixes (e.g., SlipOK changes, a new details endpoint), use:

```

Here’s a clean, copy-paste **Codex prompt**. Use it verbatim.

---

# 🔧 PATCH SET — <short title>

**Envelope & HTTP policy**: same as project standard.

## A) <Patch 1 title>

* Context & behavior changes
* Drop-in diffs (describe exactly what to replace)
* New/updated repo functions
* Return codes (200 business-only; 405 method; 500 config/server)

## B) <Patch 2 title>

* API route(s), shapes, joins, computed fields (e.g., displayStatus)
* Timezone conversion rules

## C) <Optional small UI change>

## Acceptance Criteria

## Files to Create/Update

## Test Plan

---

````

---

## 3) Cross-Cutting Conventions

### 3.1 Time/Expiry Utilities

**Compare UTC safely** (string may be space-separated):
```ts
export function isExpiredUTC(ts: string | null | undefined): boolean {
  if (!ts) return false;
  let s = String(ts).trim();
  if (s.includes(" ") && !s.includes("T")) s = s.replace(" ", "T");
  s = s.replace(/(\.\d{3})\d+$/, "$1");
  if (!/Z$|[+\-]\d{2}:?\d{2}$/.test(s)) s = `${s}Z`;
  const parsed = Date.parse(s);
  return Number.isFinite(parsed) ? Date.now() >= parsed : false;
}
````

**Convert to Bangkok before sending to FE**:

```ts
// toBangkokIso("2025-09-24T07:50:13.134Z") -> "2025-09-24T14:50:13.134+07:00"
```

### 3.2 Error Code Policy

Use clear, stable codes. Examples we use:

* `INVALID_METHOD`, `INVALID_SLIP`, `SLIP_AMOUNT_MISMATCH`, `RECEIVER_MISMATCH`, `TXN_EXPIRED`, `TXN_REF_ALREADY`,
* `CONFIG_MISSING`, `INTERNAL_ERROR`,
* domain-specific: `MULTI_BRANCH_NOT_ALLOWED`, `INSUFFICIENT_BALANCE`, `ORDER_CREATION_FAILED`, `TXN_CREATION_FAILED`.

> Business outcomes are **HTTP 200** with `code`. Only token/auth (401/403), wrong method (405), or server/config faults (500) use those HTTP codes.

### 3.3 i18n + Status Humanization

* Keep **display statuses** in `constants/status.ts`:

```ts
export const TXN_STATUS_HUMAN = {
  en: { pending: "Pending", accepted: "Accepted", rejected: "Rejected", expired: "Expired" },
  th: { pending: "รอดำเนินการ", accepted: "สำเร็จ", rejected: "ปฏิเสธ", expired: "หมดอายุ" }
} as const;

export const ORDER_STATUS_HUMAN = {
  en: { PENDING: "Pending", PREPARE: "Preparing", DELIVERY: "On the way", COMPLETED: "Completed", REJECTED: "Rejected", EXPIRED: "Expired" },
  th: { PENDING: "รอชำระ/รอรับออเดอร์", PREPARE: "กำลังทำอาหาร", DELIVERY: "กำลังจัดส่ง", COMPLETED: "สำเร็จ", REJECTED: "ปฏิเสธ", EXPIRED: "หมดอายุ" }
} as const;
```

* Compute `displayStatus` on server where it needs txn join (e.g., Order PENDING + pending/expired txn → EXPIRED).

### 3.4 Redux Selectors (memoize)

Avoid warnings like:

> “Selector returned a different result when called with the same parameters.”

* Use **Reselect**:

```ts
import { createSelector } from "@reduxjs/toolkit";

const selectCard = (s: RootState) => s.auth.user?.card ?? [];
export const selectCardMemo = createSelector([selectCard], card => card);
```

* Components use `useSelector(selectCardMemo)`.

---

## 4) Payment / Transaction Patterns

### 4.1 SlipOK Integration (QR slip verification)

* Env:

  ```
  NEXT_PUBLIC_ENV_SLIP_OK=LOCAL | PROD
  NEXT_PUBLIC_SLIP_OK_VERIFY_URL=...
  NEXT_PUBLIC_SLIP_OK_TOKEN=...
  ```
* LOCAL → bypass network; accept if file present; synthesize `trans_ref` (uuid), `trans_date` (UTC yyyymmdd), `trans_timestamp` (ISO UTC).
* PROD → `POST` multipart to SlipOK with `x-authorization`, fields: `amount`, `files`.
* On **failure**: return `200` + code; **do not** auto-reject txn.
* On **success**: stamp meta, `txn.status=accepted`, promote linked orders **PENDING → PREPARE**, adjust balance if deposit.
* **Receiver safety**: last-4 check against `tbl_company.payment_id`.

### 4.2 Transactions/Orders Join

* Unify `/api/order/details`:

    * Filters: `txnId`, `ids`, or last N (50) for the current user.
    * Join: branch summary, txn summary.
    * Compute `displayStatus` with txn-aware logic.
    * All timestamps → Bangkok.

---

## 5) Maps/Location (No Google key)

* Use **react-leaflet** + **OpenStreetMap** tiles.
* `MapConfirm` component for checkout: draggable user marker, fixed branch marker, Haversine distance, “Confirm my location” gating Pay button.
* On success → clear user’s cart **for that branch** via `/api/card/clear-by-branch`.

---

## 6) Example “Full Feature” Prompt (Ready to Paste)

> Replace `<PLACEHOLDERS>` and send to Codex as-is.

````
Here’s a clean, copy-paste **Codex prompt**. Use it verbatim.

---

# 🔧 PROJECT UPGRADE — <FEATURE NAME>

**READ FIRST:** Follow our conventions in `AGENT_SETUP.md` and `AGENT_PATTERN.md` (naming, folders, API shape, logging, error handling, i18n, caching). Keep the standard API envelope.

```ts
type ApiOk<T> = { code: "OK"; message: "success"; body: T };
type ApiErr = { code: "ERROR" | string; message: string };
````

**HTTP policy**

* 401/403 auth, 405 wrong method (no state mutation), 500 config/server faults.
* All business outcomes must be HTTP 200 with a `code`.

## 0) CONTEXT & CONSTRAINTS

* DB: Supabase Postgres via @supabase/supabase-js.
* Timestamps → Asia/Bangkok before returning.
* Env vars used: <LIST THEM>.

## 1) DB MIGRATIONS

* Create `sql/migrations/VX_<feature>.sql`:

    * <TABLES/ALTERS/INDEXES/TRIGGERS>

## 2) TYPES & REPOSITORIES

* `src/types/<domain>.ts`: define DTOs.
* `src/repository/<domain>.ts`: typed functions for CRUD.

## 3) API ROUTES

* Implement:

    * `src/pages/api/<...>.ts`
* All with `Cache-Control: no-store`, auth guard, envelope returns.

## 4) FRONTEND

* Update slices & selectors (memoized).
* Build components with Tailwind; add i18n keys & humanized maps.
* Wire flows and success/error handling (codes not HTTP errors).

## 5) VALIDATIONS & CODES

* List explicit checks and `code`s on failure/success.

## 6) FILES TO CREATE/UPDATE

* <LIST>

## 7) SAMPLE SHAPES

* Include example JSON requests/responses with fields.

## 8) ACCEPTANCE CRITERIA

* <BULLETS>

## 9) TEST PLAN

* <STEPS & EDGE CASES>

---

**Do all of the above, commit in focused PRs (migrations → repos → APIs → FE). Keep code typed/clean, follow `AGENT_PATTERN.md`.**

```

---

## 7) Example “Patch Set” Prompt (Ready to Paste)

```

Here’s a clean, copy-paste **Codex prompt**. Use it verbatim.

---

# 🔧 PATCH SET — <SHORT TITLE>

**Envelope & HTTP policy**: project standard.

## A) <Patch A>

* Context & behavior changes
* Drop-in code edits/replacements (be explicit)
* New repo helpers (paths & signatures)
* Return codes used

## B) <Patch B>

* API endpoint(s), request/response, joins/computed fields
* Timezone conversion

## C) Small UI tweak

* Component(s), props, location in layout

## Acceptance Criteria

* Bullet list of user-visible outcomes

## Files to Create/Update

* Exact relative paths

## Test Plan

* Step-by-step including edge cases

---

````

---

## 8) Env Var Cheatsheet

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_ENV_SLIP_OK` | `LOCAL` bypass or `PROD` call SlipOK |
| `NEXT_PUBLIC_SLIP_OK_VERIFY_URL` | SlipOK verify endpoint |
| `NEXT_PUBLIC_SLIP_OK_TOKEN` | SlipOK API token |

---

## 9) Definition of Done (DoD)

- All new/changed APIs return envelope, respect HTTP policy, and set `Cache-Control: no-store`.
- All timestamps in responses are converted to **Asia/Bangkok**.
- i18n keys + EN/TH human status maps present and used.
- Redux selectors for arrays/objects are memoized.
- DB objects have idempotent migrations; necessary indexes created.
- Test Plan steps pass (LOCAL and PROD slip simulation where applicable).

---

## 10) Common Snippets

**Slip meta stamping (server)**
```ts
await stampTxnSlipMeta({ txnId, transRef, transDate, transTimestamp });
// Unique index: (trans_ref, trans_date) WHERE trans_ref IS NOT NULL
````

**Receiver last-4 compare**

```ts
function last4Digits(s?: string|null){ return s ? s.replace(/\D+/g,"").slice(-4) || null : null; }
```

**Compute displayStatus on joined order**

```ts
const displayStatus =
  o.status === "PENDING"
    ? (txn?.status === "rejected" ? "REJECTED"
      : (txn?.status === "pending" && isExpiredUTC(txn.expired_at) ? "EXPIRED"
        : "PENDING"))
    : o.status;
```

---

### Use this guide to shape every Codex request.

If your task is **big**, use the **Full Feature** template; if it’s a **targeted fix**, use the **Patch Set** template. Keep it explicit, enumerate files, inputs/outputs, and acceptance criteria.
