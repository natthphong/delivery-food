# BaanFoodie — Comprehensive Architecture and Behavior Manual

> Generated for the delivery-food monorepo. Aligns with `AGENT_PATTERN.md`, `AGENT_SETUP.md`, and the BAAN prompt generation pattern. All times are expressed in Asia/Bangkok (UTC+7) unless explicitly noted.

---

## 1. Overview

### 1.1 Product summary
- **Product name:** BaanFoodie.
- **Stack:** Next.js 15 (pages router) + TypeScript + Tailwind CSS.
- **Client state:** Redux Toolkit slices under `src/store/` with memoized selectors and token persistence via `src/utils/tokenStorage.ts`.
- **Authentication:** Firebase Authentication (client) providing ID tokens; backend exchanges ID token for internal JWT access + refresh tokens using helpers in `src/utils/jwt.ts`.
- **Backend runtime:** Next.js API routes (serverless-friendly) under `src/pages/api/` with shared helpers in `src/utils/` and repository layer in `src/repository/` that talks to Supabase Postgres (`getSupabase`).
- **Primary vertical:** Food delivery ordering, branch menus, cart management, cash/cardless payments, and SlipOK slip verification.

### 1.2 Monorepo high-level modules
- **UI shell (`src/components/Layout.tsx` + `src/components/Navbar.tsx`):** Provides responsive layout with navigation, locale switcher, and optional floating cart button.
- **Authentication experience (`src/pages/login.tsx` + `src/components/auth/*`):** Tabbed login/signup, phone OTP, Google login, email/password forms, OTP modal, social buttons.
- **Account center (`src/pages/account/index.tsx` + `src/components/account/*`):** Displays profile card, verification prompts, and update flows.
- **Search and branch detail (`src/pages/search.tsx`, `src/pages/branches/[id].tsx`, `src/components/branch/*`, `src/components/search/*`):** Search UI, branch listing, branch-specific menu grid, add-to-cart modal.
- **Checkout & payment (`src/pages/checkout/index.tsx`, `src/pages/payment/[txnId].tsx`, `src/components/cart/*`, `src/components/checkout/*`, `src/components/payment/*`):** Map confirmation, cart drawer, payment method selection, slip upload.
- **Order tracking (`src/pages/index.tsx`, `src/pages/payment/[txnId].tsx`, `src/components/order/*`):** Basic order status view, map preview, notifications.

### 1.3 Authentication model
1. **Client obtains Firebase credential:** Using Firebase Web SDK (`src/utils/firebaseClient.ts`) for email/password, Google popup, or phone/OTP.
2. **`/api/login` or `/api/signup`:** ID token posted; backend verifies via `verifyFirebaseIdToken` (JWKS), upserts `tbl_user` record, issues access token (`signAccessToken`) and refresh token (`mintRefreshToken`).
3. **Token storage:** Client dispatches `authSlice.setTokens`, persists to localStorage through `tokenStorage.ts`. Redux store rehydrated by `RequireAuth` component.
4. **Authenticated API requests:** `src/utils/apiClient.tsx` axios instance adds `Authorization: Bearer <accessToken>`, handles refresh via `/api/refresh-token` with single-flight protection.
5. **Refresh flow:** If access token invalid/expired, interceptor requests new tokens with stored refresh token. `/api/refresh-token` rotates refresh token using in-memory registry in `jwt.ts`.

### 1.4 Authorization boundaries
- **Public routes:** `/login`, `/api/signup`, `/api/login`, `/api/refresh-token`, `/api/hello`, `/api/search`, `/api/qr/generate` (mock), `/api/payment/slipok` (slip webhook), `/web-hook-line` page.
- **Protected API routes:** Most `/api/user/*`, `/api/order/*`, `/api/transaction/*`, `/api/payment/index`, `/api/card/*`, `/api/v1/account/update`, etc. They use `withAuth` from `src/utils/authMiddleware.ts` to assert JWT and populate `req.auth`.
- **Client guard:** `_app.tsx` wraps all pages with `RequireAuth`, except allowlist of `publicPaths`.

### 1.5 Database & migrations
- **Database:** Supabase Postgres (SQL migrations under `sql/migrations/`).
- **Available migrations:** Only `V9_txn_slip_stamping.sql` is present in-repo; references to V1–V8 and V10 exist in docs but not committed. Documented behavior is inferred from repository contracts and types. Missing migrations should be sourced from upstream artifacts.
- **Migration `V9_txn_slip_stamping.sql`:** Adds `trans_ref`, `trans_date`, `trans_timestamp` columns to `tbl_transaction` with unique index on `(trans_ref, trans_date)` when `trans_ref` is not null, and supporting index on `trans_date`.

### 1.6 Deployment & runtime assumptions
- **Runtime target:** Vercel-like serverless for API routes; `export const config = { runtime: "nodejs" }` ensures Node runtime.
- **Environment:** `.env.local` for client and server envs; Supabase URL & service role key required; Firebase client config stored in `NEXT_PUBLIC_FIREBASE_*` envs.
- **Timezone handling:** All responses convert timestamps using `toBangkokIso` before returning to clients. Database stores UTC; repository layer normalizes to Asia/Bangkok strings.

### 1.7 Logging & observability
- **Logger helper:** `src/utils/logger.ts` exposes `logInfo`, `logWarn`, `logError` with redaction of tokens.
- **Request IDs:** `/api/login` and `/api/signup` issue `x-req-id` for tracing.
- **Notifications:** Frontend uses `notificationsSlice` and `NotificationCenter` to surface events to users.

### 1.8 External integrations
- **Firebase REST & JWKS:** `firebaseRest.ts` handles password signup + verify email; `firebaseVerify.ts` validates tokens.
- **Supabase PostgREST:** Repositories issue typed queries through supabase-js.
- **SlipOK verification:** `/api/payment/slipok` interacts with SlipOK API (via env-provided URL/token) to validate bank transfer slips.
- **Longdo Map:** Checkout and order pages integrate map coordinates for delivery location and branch route display (`components/order/LocationMap.tsx`, `components/checkout/MapConfirm.tsx`).

### 1.9 Business capabilities snapshot
- **Account & profile:** Manage verified email/phone status, trigger verification emails.
- **Cart:** Branch-specific grouping, add-ons, branch availability checks, persisted to user card JSON column.
- **Transactions:** Create deposit/payment transactions, update statuses, maintain history arrays trimmed to 50 entries.
- **Orders:** Create orders tied to transactions, track status transitions, compute display statuses for UI.
- **Search:** Geospatial-friendly sorting using Haversine distance when coordinates provided.
- **System configuration:** Key/value pairs loaded at runtime to configure features (e.g., payment toggles, external tokens).

---
## 2. Database Schema Documentation

> Source of truth is Supabase Postgres. Only migration `V9_txn_slip_stamping.sql` is committed; all other schemas are inferred from repository usage and TypeScript types. Fields marked *(inferred)* are deduced from query patterns.

### 2.1 `tbl_user`

**Columns**

- `id` — SERIAL, PK, not null.
- `firebase_uid` — VARCHAR(128), UNIQUE, not null.
- `email` — VARCHAR(320), nullable.
- `phone` — VARCHAR(64), nullable.
- `provider` — VARCHAR(64), nullable.
- `is_email_verified` — BOOLEAN, default FALSE.
- `is_phone_verified` — BOOLEAN, default FALSE.
- `created_at` — TIMESTAMPTZ, default NOW().
- `updated_at` — TIMESTAMPTZ, default NOW().
- `last_login` — TIMESTAMPTZ, nullable.
- `card` — JSONB, default NULL (cart snapshot; branch imagery is resolved at read-time, not stored in JSON).
- `balance` — NUMERIC(10,2), default 0.00.
- `txn_history` — INT[], default '{}'.
- `order_history` — INT[], default '{}'.

**Keys/Indexes**

- `PK(id)`.
- `UNIQUE(firebase_uid)`.
- `idx_tbl_user_firebase_uid` on (`firebase_uid`).

**Used By**

- `/api/login`, `/api/signup`, `/api/refresh-token`, `/api/user/me`, `/api/card/*`, `/api/payment`, `/api/order/*`.
- Repository helpers in `src/repository/user.ts` and cart utilities.

**Notes**

- Cart JSON is server-managed and must omit deprecated `branchImage`; frontend hydrates branch media via joins.
- History arrays are trimmed server-side to keep payloads light.

**Example row**

            { "name": "Fried Egg", "price": 15 }
          ]
        }
      ]
    }
  ],
  "txn_history": [981, 977, 955],
  "order_history": [441, 440],
  "created_at": "2024-01-05T19:12:00+07:00",
  "updated_at": "2024-01-20T09:45:12+07:00"
}
```

**Used by:** `/api/login`, `/api/signup`, `/api/refresh-token` (indirect), `/api/user/me`, `/api/user/send-verify-email`, `/api/card/*`, `/api/transaction/*` history updates, `/api/order/*` for history, `/api/payment/slipok` (balance adjustments), repository functions `user.ts`, `transaction.ts`, `order.ts`.

### 2.2 `tbl_company`

**Columns**

- `id` — SERIAL, PK.
- `name` — TEXT, not null.
- `description` — TEXT, nullable.
- `logo_url` — TEXT, nullable.
- `currency_code` — VARCHAR(3), default `'THB'`.
- `created_at` — TIMESTAMPTZ, default NOW().
- `updated_at` — TIMESTAMPTZ, default NOW().
- `payment_id` — VARCHAR(100), nullable. (Receiver last-4 verify for SlipOK.)
- `txn_method_id` — INT, nullable. (Ref → `tbl_transaction_method.id`.)

**Used By**

- Payment flows validate `payment_id` before generating PromptPay/SlipOK payloads.
- Repository `company.ts` fetches company metadata during `/api/payment` and `/api/qr/generate`.

**Relationships**

- Logical link from `txn_method_id` to `tbl_transaction_method.id` (not enforced by FK in V7 but observed in repository contract).

### 2.3 `tbl_category`

**Columns**

- `id` — SERIAL, PK.
- `company_id` — INT, not null, FK → `tbl_company(id)` ON DELETE CASCADE.
- `name` — TEXT, not null.
- `description` — TEXT, nullable.
- `image_url` — TEXT, nullable.
- `created_at` — TIMESTAMPTZ, default NOW().
- `updated_at` — TIMESTAMPTZ, default NOW().

**Indexes**

- `idx_category_company` on (`company_id`).

**Usage**

- `/api/search` joins categories to display chips.
- Branch detail pages render category sections using this table.

### 2.4 `tbl_product`

**Columns**

- `id` — SERIAL, PK.
- `company_id` — INT, not null, FK → `tbl_company(id)` ON DELETE CASCADE.
- `name` — TEXT, not null.
- `description` — TEXT, nullable.
- `image_url` — TEXT, nullable.
- `base_price` — NUMERIC(12,2), not null.
- `search_terms` — TEXT, nullable.
- `search_tsv` — TSVECTOR, nullable.
- `created_at` — TIMESTAMPTZ, default NOW().
- `updated_at` — TIMESTAMPTZ, default NOW().

**Indexes**

- `idx_product_company` on (`company_id`).
- `idx_product_tsv` GIN on (`search_tsv`).

**Notes**

- Migration comments mention optional `embedding VECTOR(384)` column when pgvector is enabled (disabled in current setup).

**Usage**

- Source of base menu data. Joined with `tbl_branch_product` for branch-specific pricing and availability.

### 2.5 `tbl_product_add_on`

**Columns**

- `id` — SERIAL, PK.
- `product_id` — INT, not null, FK → `tbl_product(id)` ON DELETE CASCADE.
- `name` — TEXT, not null.
- `price` — NUMERIC(12,2), not null default 0.
- `is_required` — BOOLEAN, not null default FALSE.
- `group_name` — TEXT, nullable.
- `created_at` — TIMESTAMPTZ, default NOW().
- `updated_at` — TIMESTAMPTZ, default NOW().

**Indexes**

- `idx_addon_product` on (`product_id`).

**Usage**

- Add-on metadata for branch menu builder; Add-to-cart modal uses `is_required` to block submission without required groups.

### 2.6 `tbl_product_category`

**Columns**

- `product_id` — INT, not null, FK → `tbl_product(id)` ON DELETE CASCADE.
- `category_id` — INT, not null, FK → `tbl_category(id)` ON DELETE CASCADE.

**Keys**

- PK (`product_id`, `category_id`).

**Usage**

- Many-to-many relationship powering category filters in `/api/search` and branch menu groupings.

### 2.7 `tbl_branch`

**Columns**

- `id` — SERIAL, PK.
- `company_id` — INT, not null, FK → `tbl_company(id)` ON DELETE CASCADE.
- `name` — TEXT, not null.
- `description` — TEXT, nullable.
- `image_url` — TEXT, nullable.
- `address_line` — TEXT, nullable.
- `lat` — DOUBLE PRECISION, nullable.
- `lng` — DOUBLE PRECISION, nullable.
- `open_hours` — JSONB, nullable (e.g., `{ "mon": [["09:00", "20:00"]], ... }`).
- `is_force_closed` — BOOLEAN, not null default FALSE.
- `created_at` — TIMESTAMPTZ, default NOW().
- `updated_at` — TIMESTAMPTZ, default NOW().

**Indexes**

- `idx_branch_company` on (`company_id`).
- Optional `idx_branch_name_trgm` trigram index on (`name`) when pg_trgm extension enabled.

**Notes**

- API layer computes `branchIsOpen` each request using `open_hours` + `is_force_closed`; frontend should not rely on cached state.

### 2.8 `tbl_branch_product`

**Columns**

- `id` — SERIAL, PK.
- `branch_id` — INT, not null, FK → `tbl_branch(id)` ON DELETE CASCADE.
- `product_id` — INT, not null, FK → `tbl_product(id)` ON DELETE CASCADE.
- `is_enabled` — BOOLEAN, not null default TRUE.
- `stock_qty` — INT, nullable.
- `price_override` — NUMERIC(12,2), nullable.
- `search_terms` — TEXT, nullable.
- `search_tsv` — TSVECTOR, nullable.
- `created_at` — TIMESTAMPTZ, default NOW().
- `updated_at` — TIMESTAMPTZ, default NOW().
- `recommend_menu` — BOOLEAN, default FALSE.

**Indexes**

- `idx_branch_product_branch` on (`branch_id`).
- `idx_branch_product_product` on (`product_id`).
- `idx_branch_product_tsv` GIN on (`search_tsv`).

**Constraints**

- `UNIQUE(branch_id, product_id)`.

**Usage**

- Primary linkage for branch menus, recommended lists, and cart validation.

### 2.9 `tbl_system_config`

**Columns**

- `config_name` — VARCHAR(50), PK.
- `config_value` — TEXT, nullable.
- `created_at` — TIMESTAMPTZ, default NOW().
- `updated_at` — TIMESTAMPTZ, default NOW().

**Seeds**

- `MAXIMUM_CARD` → `'100'`.
- `MAXIMUM_BRANCH_ORDER` → `'1'`.
- `MAX_QTY_PER_ITEM` → `'10'`.

**Usage**

- `/api/system/config` returns the config map; `/api/payment` enforces cart and branch limits using the seeded values.

### 2.10 `tbl_transaction_method`

**Columns**

- `id` — SERIAL, PK.
- `code` — VARCHAR(50), UNIQUE, not null (e.g., `QR_SLIP_VERIFY`, `USER_BALANCE`).
- `name` — VARCHAR(255), not null.
- `type` — VARCHAR(255), nullable (`qr`, `balance`, etc.).
- `details` — JSONB, nullable.
- `is_deleted` — CHAR(1), not null default `'N'`.
- `created_at` — TIMESTAMPTZ, default NOW().
- `updated_at` — TIMESTAMPTZ, default NOW().

**Notes**

- Simplified non-partitioned design since V8.

**Usage**

- `/api/payment` ensures method exists and is active; `/api/transaction/method` lists available methods.

### 2.11 `tbl_transaction`

**Columns**

- `id` — BIGSERIAL, PK.
- `company_id` — INT, not null.
- `user_id` — INT, not null.
- `txn_type` — VARCHAR(50), not null (`deposit` | `payment`).
- `txn_method_id` — INT, not null (FK → `tbl_transaction_method.id`).
- `reversal` — BOOLEAN, not null default FALSE.
- `amount` — NUMERIC(10,2), not null.
- `adjust_amount` — NUMERIC(10,2), default 0.
- `status` — VARCHAR(50), not null (`pending` | `accepted` | `rejected`).
- `expired_at` — TIMESTAMPTZ, nullable.
- `created_at` — TIMESTAMPTZ, default NOW().
- `updated_at` — TIMESTAMPTZ, default NOW().
- `trans_ref` — VARCHAR(255), nullable. (V9 slip reference.)
- `trans_date` — DATE, nullable. (V9.)
- `trans_timestamp` — TIMESTAMPTZ, nullable. (V9.)

**Indexes**

- `idx_txn_company_id` on (`company_id`).
- `idx_txn_company_method` on (`company_id`, `txn_method_id`).
- `idx_txn_company_status` on (`company_id`, `status`).
- `idx_txn_user_id` on (`user_id`).
- `ux_tbl_transaction_transref_transdate_notnull` unique partial on (`trans_ref`, `trans_date`) WHERE `trans_ref IS NOT NULL`.
- `ix_tbl_tbl_transaction_transdate` on (`trans_date`).

**Notes**

- SlipOK acceptance stamps reference metadata and sets `status='accepted'`.

**Usage**

- Created by `/api/payment`, updated by `/api/payment/slipok`, enumerated via `/api/transaction/*`.

### 2.12 `tbl_order`

**Columns**

- `id` — BIGSERIAL, PK.
- `branch_id` — INT, not null (FK → `tbl_branch.id`).
- `txn_id` — BIGINT, nullable (logical FK → `tbl_transaction.id`).
- `order_details` — JSONB, nullable (stores cart snapshot, `customerLocation`, `branchLocation`).
- `status` — VARCHAR(20), not null (`PENDING` | `PREPARE` | `DELIVERY` | `COMPLETED` | `REJECTED`).
- `created_at` — TIMESTAMPTZ, default NOW().
- `updated_at` — TIMESTAMPTZ, default NOW().

**Indexes**

- `idx_order_txn_status` on (`txn_id`, `status`).
- `idx_order_txn` on (`txn_id`).
- `idx_order_branch` on (`branch_id`).

**Notes**

- Frontend toggles route display when transaction accepted and order in active state.

**Usage**

- Created in `/api/payment`; read/mutated by `/api/order/*` endpoints and order tracking UI.

### 2.13 `tbl_transaction_method_company` *(inferred, not present)*
- Not found in repo, but references in flows imply a mapping between companies and methods. Documenting for completeness: might store `company_id`, `method_id`, `priority`, `is_default`.
- Absence means filtering by company is currently no-op (`listActiveMethods` ignores `companyId`).

### 2.14 `tbl_branch_operating_hour` *(inferred)*
- All open hours currently stored as JSON in `tbl_branch.open_hours`. If normalized table exists upstream, ensure migrations keep JSON in sync.

### 2.15 `tbl_product_add_on_group` *(inferred)*
- Add-on groups appear as `group_name` string. Consider migrating to normalized table if future enhancements require translations.

---
## 3. Backend API Documentation

> All APIs adhere to the envelope defined in the BAAN prompt pattern (`ApiOk` / `ApiErr`). Business errors return HTTP 200 with non-`OK` codes unless fatal; auth/method mismatches use HTTP 401/405. Unless noted, routes set `Cache-Control: no-store` or rely on implicit no-cache defaults.

> **OpenAPI reference:** the generated `swagger.json` (OpenAPI 3.0.3) in the repo root captures the schemas, query parameters, and request/response envelopes for every route under `src/pages/api/**`.

### 3.1 Authentication APIs

#### 3.1.1 `POST /api/login`
- **Purpose:** Exchange Firebase ID token for internal JWT pair and persist/update user profile.
- **Authentication:** Public; requires Firebase `idToken` in body.
- **Request body:**
  ```json
  { "idToken": "<firebase-id-token>" }
  ```
- **Validations:**
  - Rejects non-POST with `405 METHOD_NOT_ALLOWED`.
  - Ensures `idToken` is present; otherwise `400 BAD_REQUEST` with code `BAD_REQUEST`.
  - Verifies ID token via `verifyFirebaseIdToken` (JWKS). Requires `user_id`/`uid` claim; missing claim triggers `400 BAD_REQUEST` with `Invalid token`.
- **Processing:**
  1. Derives `firebaseUid`, `email`, `phone`, `provider`, `is_email_verified`, `is_phone_verified` from decoded token.
  2. Calls `upsertUser` to update `tbl_user` (update existing by `firebase_uid` or insert new).
  3. Fetches fresh record with `getUserByFirebaseUid` to ensure normalized JSON/time conversions.
  4. Generates `accessToken` via `signAccessToken({ uid, userId })` and `refreshToken` via `mintRefreshToken` (in-memory store).
  5. Logs request/response with `logInfo` and `x-req-id` header for tracing.
- **Response:**
  ```json
  {
    "code": "OK",
    "message": "Login success",
    "body": {
      "accessToken": "<jwt>",
      "refreshToken": "<jwt>",
      "user": { /* UserRecord serialized */ }
    }
  }
  ```
- **Error codes:** `BAD_REQUEST`, `LOGIN_FAILED` (generic catch-all 400).
- **Repositories touched:** `user.upsertUser`, `user.getUserByFirebaseUid` (writes/reads `tbl_user`).
- **Cache headers:** Not explicitly set; default private no-cache in Next.js API.

#### 3.1.2 `POST /api/signup`
- **Purpose:** Register user via Firebase providers (password, Google, phone) and mint JWT tokens.
- **Request schema:**
  - `provider` (`"password" | "google" | "phone"`).
  - For `password`: requires `email`, `password`, optional `sendVerifyEmail` boolean.
  - For other providers: requires `idToken` (already obtained client-side).
- **Validations:**
  - Non-POST => 405.
  - Missing `provider` => 400 `BAD_REQUEST`.
  - Unsupported provider => 400.
  - For password flow: missing email/password => 400.
  - For Google/phone: missing `idToken` => 400.
- **Processing:**
  1. For password flow, uses `signUpEmailPassword` to create Firebase user then optionally `sendVerifyEmail`.
  2. For other flows, uses provided `idToken`.
  3. Verifies token using `verifyFirebaseIdToken` and extracts identity metadata.
  4. Calls `upsertUser` followed by `getUserByFirebaseUid` to persist and reload `tbl_user`.
  5. Issues tokens via `signAccessToken` + `mintRefreshToken`.
- **Response:** Envelope identical to `/api/login`, message `"Signup success"`.
- **Error handling:** Logs `signup:exception`, returns `400 SIGNUP_FAILED` for fallback case.
- **Repositories:** `user.upsertUser`, `user.getUserByFirebaseUid` (write + read `tbl_user`).

#### 3.1.3 `POST /api/refresh-token`
- **Purpose:** Rotate refresh token and emit new access token.
- **Request:** `{ "refreshToken": "<refresh>" }`.
- **Validations:**
  - Method guard 405.
  - Missing refreshToken => `400 BAD_REQUEST`.
- **Processing:**
  - Calls `rotateRefreshToken` (ensures single-use; stores new token), obtains payload (uid/userId).
  - Signs new access token with `signAccessToken`.
- **Response:** `200 OK` with `{ accessToken, refreshToken }`.
- **Errors:** Invalid token -> `400 REFRESH_FAILED`.
- **Repositories:** None (JWT helper uses in-memory store only).

### 3.2 User profile APIs

#### 3.2.1 `GET /api/user/me`
- **Auth:** Requires Bearer access token. `withAuth` populates `req.auth.userId`.
- **Validations:** Method guard 405, missing `userId` -> `401 UNAUTHORIZED`.
- **Processing:** Fetches user via `getUserById` (reads `tbl_user`).
- **Response:**
  ```json
  {
    "code": "OK",
    "message": "success",
    "body": { "user": { /* sanitized fields */ } }
  }
  ```
- **Errors:** `NOT_FOUND` 404 when user absent, `INTERNAL_ERROR` 500 on repository errors.
- **Cache:** Not explicitly set; should remain private.

#### 3.2.2 `POST /api/user/send-verify-email`
- **Auth:** Public (requires valid Firebase `idToken`).
- **Validations:** Method guard 405, missing `idToken` -> `400 BAD_REQUEST`.
- **Processing:** Calls `sendVerifyEmail` from Firebase REST helper.
- **Response:** `200 OK` with `{ ok: true }`.
- **Errors:** Fallback `400 SEND_EMAIL_FAILED` on Firebase failure.

#### 3.2.3 `POST /api/v1/account/update`
- **Auth:** Protected using `withAuth`.
- **Request body:** Accepts partial contact update (email/phone flags). Implementation merges with existing user record.
- **Validations:**
  - Guards `POST` only; returns `405 METHOD_NOT_ALLOWED` for other verbs.
  - Rejects non-object payloads with `400 BAD_REQUEST`.
  - Normalizes email/phone values and ensures duplicates via `isEmailTaken`/`isPhoneTaken` trigger `409` responses.
- **Processing & DB:** Uses `user.updateUserContact`, `isEmailTaken`, `isPhoneTaken` to ensure uniqueness before updating `tbl_user`.
- **Response:** Returns updated `UserRecord` envelope.
- **Business rules:**
  - When email/phone duplicates exist, returns `409` with codes `DUPLICATE_EMAIL` or `DUPLICATE_PHONE`.
  - On success returns `OK`.
- **Error handling:** Wraps validation errors as `400 BAD_REQUEST`; unexpected errors return `500 INTERNAL_ERROR` and log via `logger`.

### 3.3 System configuration & utilities

#### 3.3.1 `GET /api/system/config`
- **Auth:** Protected (`withAuth`).
- **Response body:** `{ "config": Record<string, string> }` with env-style values.
- **Repositories:** `user.getSystemConfig` -> reads `tbl_system_config`.
- **Cache:** `Cache-Control: no-store` enforced explicitly.
- **Error handling:** Logs error and returns `500 ERROR` with empty config map.

#### 3.3.2 `GET /api/hello`
- **Purpose:** Sample route (unused). Returns simple JSON for health checks.
- **Method guard:** 200 for GET; 405 otherwise.

### 3.4 Search & branch APIs

#### 3.4.1 `GET /api/search`
- **Auth:** Public.
- **Query params:** `q` (search string), `categoryId`, `lat`, `lng`, `limit`.
- **Processing:**
  1. Validates and parses query numbers via helper `parseNumber`.
  2. Invokes `searchBranches({ query, categoryId, limit })` to gather branch/product matches.
  3. If geolocation provided, calculates `distance_m` using Haversine and sorts results by distance then match count.
  4. Fetches categories via `listAllCategories` for filter UI.
- **Response:** Branch list with sample products and distance in km, plus category list.
- **Cache:** Sets `Cache-Control: public, s-maxage=1, stale-while-revalidate=59` for CDN caching.
- **Error handling:** Logs error and responds `500 INTERNAL_ERROR` on failure.
- **DB tables touched:** `tbl_branch`, `tbl_branch_product`, `tbl_product`, `tbl_product_category`, `tbl_category` through repositories.

#### 3.4.2 `GET /api/branches/[id]/menu`
- **Auth:** Public (no auth middleware). Implementation loads branch details and menu items, performing branch open checks.
- **Request:** path param `id`, query includes pagination `page`, `size`.
- **Processing:**
  - `branchMenu.ts` service fetches branch, ensures not force closed, ensures open hours allow access (current time in Bangkok).
  - Loads branch menu with add-ons via `repository/branch.ts` functions.
  - Optionally filters by category or search terms.
- **Response:** Branch info + menu array with add-ons and `is_enabled`, `stock_qty` statuses.
- **Business errors:** `BRANCH_CLOSED`, `BRANCH_NOT_FOUND`, `PRODUCTS_NOT_FOUND` etc returned with 200 envelope codes.
- **DB:** `tbl_branch`, `tbl_branch_product`, `tbl_product`, `tbl_product_add_on`.

#### 3.4.3 `GET /api/branches/[id]/top-menu`
- **Auth:** Public.
- **Purpose:** Return recommended menu subset for hero section.
- **Processing:** Similar to menu endpoint but filters `recommend_menu = true` and limit.
- **Response:** Branch metadata plus `menu` array with `is_enabled`, `stock_qty`, and pricing.
- **Cache:** Sets short CDN cache (same as menu) for edge caching.

### 3.5 Cart APIs

- **Auth:** Uses `resolveAuth`; accepts Bearer access tokens or Firebase ID tokens (`Authorization` header or `x-id-token`). Missing credentials return `401 UNAUTHORIZED`.
- **Request body options:**
  - `{ card: CartBranchGroup[], replace: true }` to overwrite card.
- `{ add: { branchId, companyId, branchName, item|items|productList }, replace?: false }` to merge new items (API strips deprecated `branchImage`).
- **Validations:** Extensive structure checks for branch/product IDs, names, quantity (max from config), add-on price numbers.
- **Config dependency:** `getNumberConfig("max_cart_qty_per_item")` with fallback `DEFAULT_MAX_QTY_PER_ITEM = 10`.
- **Processing:**
  - Loads user by Firebase UID to ensure existence.
  - Sanitizes card input, merges with existing cart via `mergeCards`, deduplicating items by variant key (branch + product + add-ons).
  - Enforces quantity cap; increments existing items by new qty (clamped to config max).
  - Persists via `saveUserCard` -> updates `tbl_user.card` JSON.
- **Response:** `200 OK` with updated user card snapshot.
- **Business errors:**
  - `CARD_EMPTY` when sanitized payload results in empty array (200 with custom code).
  - `INVALID_PAYLOAD` for schema issues (400 BAD_REQUEST).
- **Side effects:** Maintains sanitized structure for UI and branch gating (branch ID stored as string).

#### 3.5.2 `POST /api/card/clear-by-branch`
- **Auth:** `withAuth` ensures `userId` numeric.
- **Request body:** `{ branchId: number | string }`.
- **Processing:**
  - Calls `clearCardByBranch(userId, branchId)` to filter out branch group from `tbl_user.card`.
  - Returns sanitized card array.
- **Errors:** `USER_NOT_FOUND` -> `404` with `NOT_FOUND`, invalid body -> `400 BAD_REQUEST`.

### 3.6 Transaction APIs

#### 3.6.1 `GET /api/transaction/method`
- **Auth:** Protected.
- **Processing:** Lists active transaction methods via `listActiveMethods(companyId)` (currently ignores company filtering but uses for future multi-tenant support).
- **Response:** Methods array with `id`, `code`, `name`, `type`, `details`.
- **DB:** Reads `tbl_transaction_method`.

- **Auth:** Protected.
- **Request body:** `{ companyId: number; branchId: number; txnType: 'payment' | 'deposit'; methodId: number; amount: number; expiresInSec?: number }` (branchId still required for validation even when depositing; service enforces branch-cart alignment).
- **Processing:**
  - Validates method type via `createTransaction` (ensures method exists and is allowed; `INVALID_METHOD`).
  - For `balance` method, sets status `accepted`; for `qr`, sets `pending` with `expired_at` TTL (default 900s).
  - Updates user `txn_history` via repository utility.
- **Response:** Newly created `TransactionRow` envelope.
- **Business errors:** `INVALID_METHOD`, `BRANCH_CLOSED`, `CART_BRANCH_MISMATCH`, `BALANCE_NOT_ENOUGH` (where applicable in service logic).

#### 3.6.3 `GET /api/transaction/[txnId]`
- **Auth:** Protected.
- **Processing:** Fetch single transaction by path parameter using `getTransactionById`.
- **Response:** `TransactionRow` or `NOT_FOUND` business code when absent.

#### 3.6.4 `GET /api/transaction/details`
- **Auth:** Protected.
- **Query:** `txnId` or `transactionId`.
- **Processing:** Joins transaction with associated order using repository functions; calculates display status combining order + transaction state.
- **Response:** Envelope containing `transaction`, `order`, `displayStatus`, `slipMeta` (if present).

#### 3.6.5 `GET /api/transaction/list`
- **Auth:** Protected.
- **Query params:** pagination `page`, `size`; optionally filter by `status`.
- **Processing:**
  - Uses `user.getUserById` to fetch `txn_history` array.
  - Paginates ID list, fetches transactions via `getTransactionsByIds`, sorts descending.
  - Returns metadata for pagination (total count from history array length).

### 3.7 Payment APIs

#### 3.7.1 `POST /api/payment/index`
- **Auth:** Protected.
- **Purpose:** Kick off payment session using branch cart snapshot.
- **Processing:**
  - Validates branch open, ensures cart items belong to branch, ensures transaction exists with `pending` status.
  - Returns payment methods plus slip upload instructions.
- **Side effects:** May update order or transaction status based on request body.

#### 3.7.2 `POST /api/payment/slipok`
- **Auth:** Webhook-style (public) but protected by token/secret in body.
- **Purpose:** Receive SlipOK webhook verifying bank slip.
- **Processing:**
  - Validates signature/headers (implementation checks token from env `NEXT_PUBLIC_SLIP_OK_TOKEN`).
  - Loads transaction by `txnId`, ensures status `pending`.
  - Calls SlipOK verify endpoint (when configured) or local mock depending on env.
  - On success, stamps `tbl_transaction` with `trans_ref`, `trans_date`, `trans_timestamp` via `stampTxnSlipMeta` and updates status to `accepted`.
  - Updates related order to `PREPARE`/`PENDING` as needed and adjust user balance.
  - Handles duplicate slip detection via unique index; if duplicate, returns business code `DUPLICATE_SLIP`.
- **Errors:** `INVALID_SIGNATURE`, `TRANSACTION_NOT_FOUND`, `RECEIVER_MISMATCH`, `AMOUNT_MISMATCH`, `EXPIRED`, `REJECTED`, `SLIP_INVALID` etc. All returned with HTTP 200 + code except fatal server errors (500).
- **Side effects:** May notify LINE webhook (`/web-hook-line`) or push notifications.

#### 3.7.3 `POST /api/qr/generate`
- **Auth:** Protected (requires valid JWT). Some flows may allow anonymous if `companyId` provided; confirm file.
- **Processing:**
  - Accepts `companyId`, `amount`, `txnId`.
  - Loads branch/company info via repositories to generate QR payload (PromptPay string or dynamic QR).
  - Returns base64 image or payload string for front-end to render.

#### 3.7.4 `GET /api/mock/qr`
- **Purpose:** Development helper returning placeholder QR metadata.
- **Response:** Static JSON.

### 3.8 Order APIs

#### 3.8.1 `GET /api/order/list`
- **Auth:** Protected.
- **Query:** Pagination `page`, `size` (defaults to history length if omitted).
- **Processing:**
  - Loads user via `getUserById` to access `order_history` array.
  - Fetches `tbl_order` rows via `getOrdersByIds`.
  - For each order, optionally joins transaction to compute `displayStatus` (e.g., if transaction expired but order still pending).
- **Response:**
  ```json
  {
    "code": "OK",
    "message": "success",
    "body": {
      "orders": [ { "id": 441, "status": "PREPARE", ... } ],
      "pagination": { "page": 1, "size": 10, "total": 42 }
    }
  }
  ```

#### 3.8.2 `GET /api/order/details`
- **Auth:** Protected.
- **Query:** `orderId`.
- **Processing:**
  - Fetch order via `getOrdersByIds` or `getOrderByTxnId` when bridging from payment page.
  - Attaches transaction details for slip status display.

#### 3.8.3 `GET /api/order/by-transaction`
- **Auth:** Protected.
- **Query:** `txnId`.
- **Processing:** Returns order associated with transaction (if any) using `getOrderByTxnId`.

### 3.9 Payment integration helpers

#### 3.9.1 `POST /api/login-line`
- **Purpose:** LINE Login integration for mobile/web clients that authenticate via LINE profile information.
- **Request:** `{ profile: { userId: string; email?: string } }` (token verification placeholder currently commented out).
- **Processing:** Upserts user with `firebaseUid = profile.userId`, optional email, provider `line`; issues access/refresh tokens identical to `/api/login`.
- **Errors:** Missing profile → `400 BAD_REQUEST`; unexpected error logs and responds with `402 LOGIN_FAILED` (legacy status).

### 3.10 Misc APIs

- No additional API routes beyond those documented above; `/api/transaction/details` already covered in Section 3.6.4.

---
## 4. Repository Layer Documentation

> Repositories wrap Supabase interactions, normalize rows, and enforce timezone conversions. All functions obtain a client via `getSupabase()` (no session), catch Supabase errors, and throw typed `Error` objects for API routes to translate.

### 4.1 `src/repository/user.ts`
- **Purpose:** CRUD operations for `tbl_user` plus card persistence and system config.
- **Key exports:**
  - `USER_SELECT`: column projection string reused for selects.
  - `mapUser(row)`: converts raw row into `UserRecord` with sanitized booleans, numbers, timezone conversion via `toBangkokIso`.
  - `isEmailTaken(email, excludeUserId?)` / `isPhoneTaken`: query `tbl_user` to enforce uniqueness; optional `neq("id", exclude)`.
  - `upsertUser({ firebaseUid, email, phone, provider, isEmailVerified, isPhoneVerified })`: update `last_login`, fallback to insert. Uses `.maybeSingle()` to detect existing row.
  - `getUserById`, `getUserByFirebaseUid`: select with optional column override.
  - `updateUserContact(uid, patch)`: merges partial payload; if no existing row, inserts new. Handles optional `email`, `phone`, `is_*_verified` flags.
  - `getUserCard(uid)`, `saveUserCard(uid, card)`: fetch and update card JSON.
  - `clearCardByBranch(userId, branchId)`: loads full record, filters branch group by branchId string, updates card.
  - `adjustBalance(userId, delta)`: reads current balance, adds delta, clamps to ≥0, persists.
  - `getSystemConfig()`: returns key-value map from `tbl_system_config`.
- **Internal helpers:** `normalizeCard`, `normalizeNumberArray`, `hasOwnProperty`, `mapUser`.
- **Error handling:** On Supabase error, throw new `Error(error.message || <fallback>)` to be caught by API routes. Some functions throw sentinel strings (e.g., `USER_NOT_FOUND`) consumed by API.
- **Consumers:** Authentication APIs, account update API, cart endpoints, transaction/order history updaters, `/api/system/config`.

### 4.2 `src/repository/transaction.ts`
- **Purpose:** Manage transaction methods and rows in `tbl_transaction`.
- **Key exports:**
  - `mapTransactionRow(row)`: ensures numeric conversions, timezone conversion for `created_at`, `updated_at`, `expired_at`, `trans_timestamp`.
  - `listActiveMethods(companyId)`: filters `tbl_transaction_method` for `type` in `['qr', 'balance']` and `is_deleted = 'N'`; returns sorted list.
  - `createTransaction(input)`: fetches method to validate type; inserts row with status/expiry derived from method type; updates user transaction history using `updateTxnHistory` and `appendIdWithTrim` helper (limit 50).
  - `updateTxnStatus(txnId, status)`: updates `status` and `updated_at` timestamp.
  - `stampTxnSlipMeta({ txnId, transRef, transDate, transTimestamp })`: sanitizes string/Date inputs, converts to ISO/date strings, updates row. Supports 8-digit `YYYYMMDD` format.
  - `getTransactionById`, `getTransactionsByIds`: fetch single or multiple transactions, deduplicating IDs.
  - `getMethodById(methodId)`: alias to `fetchMethodById` (internal) for API reuse.
- **Constants:** `SUPPORTED_METHOD_TYPES = ['qr', 'balance']`, `TXN_HISTORY_LIMIT = 50`.
- **Supporting functions:** `parseNumber`, `mapMethod`, `fetchMethodById`, `updateTxnHistory`.
- **Consumers:** Transaction API suite, payment slip webhook, order flows linking to transactions.

### 4.3 `src/repository/order.ts`
- **Purpose:** Manage `tbl_order` rows, maintain user order history, and join transactions for UI.
- **Key exports:**
  - `createOrder({ userId, branchId, txnId, details, status? })`: inserts row with JSON `order_details`, updates user order history (limit 100).
  - `getUserOrders(userId, { limit, offset })`: selects orders containing `userId` inside JSON, sorted by `created_at` desc.
  - `getUserOrderWithTxn(userId)`: fetches orders and associated transactions via `getTransactionsByIds`.
  - `getOrdersByIds(orderIds)`, `getOrdersByTxnIds(txnIds)`, `getOrderByTxnId(txnId)`: utilities for targeted lookups.
  - `mapOrderRow`: exported alias for mapping function.
- **Internal helpers:** `normalizeOrderDetails` (ensures structure with branch/product/delivery defaults), `appendIdWithTrim` reuse for history, `mapOrder` to convert to `OrderRow` with timezone normalization.
- **Consumers:** Order API endpoints, payment flows (to update statuses), dashboards.

### 4.4 `src/repository/branch.ts`
- **Purpose:** Provide branch metadata, menu details, search functionality.
- **Key exports:**
  - `getBranchById(branchId)`: selects branch info, returning sanitized `BranchRow` with booleans.
  - `loadAddOns(productIds)`: fetches add-ons for product list (internal helper).
  - `searchBranches({ query, categoryId, limit })`: complex query joining `tbl_branch_product` with `tbl_product` and `tbl_branch`, optionally filtering by category (via `tbl_product_category`). Aggregates matches per branch, counts occurrences, returns up to `limit` branches with product samples and metadata.
  - `getBranchMenu(branchId, options)`: (implementation deeper in file) loads branch product associations, merges add-ons, formats price strings, sorts/paginates.
  - `getBranchTopMenu(branchId, limit)`: selects recommended items using `recommend_menu` flag.
  - `getBranchProductsByIds(branchId, productIds)`: fetch subset for cart validation.
  - `validateBranchOpen(branch, currentTime)`: ensures branch not `is_force_closed` and open hours include current Bangkok time (helper used by service).
- **Utilities:** Query builder uses Supabase foreign table selectors (`product:tbl_product!inner(...)`) and `query.or` with `foreignTable` parameter to push search filter into join.
- **Consumers:** `/api/branches/[id]/menu`, `/api/branches/[id]/top-menu`, `/api/search`, `branchMenu` service, cart validation flows.

### 4.5 `src/repository/categories.ts`
- **Purpose:** Simplified access to `tbl_category`.
- **Exports:**
  - `listAllCategories()`: selects `id` and `name` (and `image_url` when available); falls back to `id, name` if Supabase error occurs. Returns sorted list for search filters.
- **Consumers:** `/api/search`, branch filter UI.

### 4.6 `src/repository/company.ts`
- **Purpose:** Fetch `tbl_company` row with payment metadata.
- **Exports:** `getCompanyById(companyId)` returning `CompanyRow` sanitized to numbers/strings.
- **Consumers:** QR generation API, slip verification (receiver last4 match), branch/payment services.

### 4.7 `src/repository/config.ts`
- **Purpose:** Provide system configuration (numbers/strings) stored in config table.
- **Exports:**
  - `getConfigValue(name)`: fetch single config value from `tbl_system_config`, returning `string | null`.
  - `getNumberConfig(name, fallback)`: parse numeric config; fallback to default on missing or invalid values.
- **Consumers:** `card/save` (max qty), payment services (e.g., slip TTL), map toggles.

---
## 5. Frontend Page Documentation

> Pages under `src/pages/` act as container components. They orchestrate data fetching (via axios API client), dispatch Redux actions, and render presentational components from `src/components/`.

### 5.1 `_app.tsx`
- Wraps every page with Redux `<Provider>` using configured store.
- Defines `PUBLIC_ROUTES = ['/login', '/web-hook-line']`; other routes render inside `<RequireAuth>` to enforce token hydration and redirect to `/login` if unauthenticated.
- Imports global styles (`globals.css`) and Leaflet CSS for map components.

### 5.2 `/login` (`src/pages/login.tsx`)
- **Purpose:** Combined login/signup hub with tab switcher.
- **Data flow:**
  - Firebase auth flows (email/password, Google popup, phone OTP) issue ID token.
  - Posts to `/api/login` or `/api/signup` using `axios` from `@utils/apiClient`.
  - On success, dispatches `setTokens`, `setUser`, persists to localStorage via `saveTokens`, `saveUser`, and redirects to `/`.
- **State:** Local `tab` state toggles between login and signup; track `message`, `lastError`, `submitting`, OTP confirm reference.
- **Components rendered:** `Layout`, `AuthTabs`, `EmailPasswordForm`, `PhoneAuthSection`, `SocialButtons`, OTP modal via `PhoneAuthSection` callbacks.
- **i18n:** All copy retrieved via `useI18n` and `I18N_KEYS` (e.g., `AUTH_TAGLINE`, `AUTH_LOGIN_FAILED`).
- **Event handlers:**
  - `onLoginEmail`, `onSignupEmail`, `onLoginGoogle`, `onSignupGoogle`, `handlePhoneSend`, `handlePhoneConfirm`, `onLoginLine`.
  - Each handles spinner states and error messaging.
- **Redux usage:** Access to dispatch only; no selectors.

### 5.3 `/` (`src/pages/index.tsx`)
- **Purpose:** Authenticated landing page. Typically shows recent orders or quick actions.
- **Behavior:** Fetches user summary, order history via axios; renders layout with components such as `NotificationCenter`, `FloatingCartButton`.
- **State/Selectors:** Uses `useSelector` for auth user; may dispatch to refresh data.
- **Navigation:** Provides links to `/search`, `/account`, `/checkout`.

### 5.4 `/account` (`src/pages/account/index.tsx`)
- **Purpose:** Account dashboard for profile info, verification, transaction and order history.
- **Data fetching:**
  - On mount, calls `/api/user/me` to hydrate `me` state and update Redux store.
  - Uses `/api/user/send-verify-email` to trigger verification emails.
  - Posts to `/api/v1/account/update` for email/phone updates.
  - Fetches transactions via `/api/transaction/list` (populate `txnDetails`).
  - Fetches orders via `/api/order/list` when switching to orders tab.
- **Components:**
  - `Layout` wrapper.
  - `ProfileCard` for identity summary (provider, balances, verification chips).
  - `VerifyUpdateCard` for form interactions (email update, phone OTP flows).
  - Tabbed sections for transactions and orders using inline controls.
- **State management:** Multiple `useState` hooks for forms, OTP, message banners; `useMemo` for sorted lists.
- **Event handlers:** `fetchMe`, `updateAccount`, `handleSendVerifyEmail`, `handleSendOtp`, `handleConfirmOtp`, `handleLogout`.
- **i18n:** Strings resolved via `useI18n`, keys such as `ACCOUNT_DUPLICATE_EMAIL`, `ACCOUNT_SEND_VERIFY_SUCCESS`.
- **Redux:** Uses `useSelector` to read `auth.user`; dispatches `setUser` to keep store in sync.

### 5.5 `/search` (`src/pages/search.tsx`)
- **Purpose:** Branch discovery page with search bar, filters, and result cards.
- **Data fetching:**
  - On mount and query change, calls `/api/search` with `q`, `categoryId`, `lat`, `lng`, `limit`.
  - Handles geolocation (optional) to sort by proximity; integrates with `MapConfirm` to choose location.
- **Components:** `Layout`, `SearchBar`, `BranchList`, `BranchCard`, `FloatingLanguageToggle` (if present), `FloatingCartButton`.
- **State:** `useState` for `query`, `category`, `isLoading`; `useEffect` to debounce input; `useMemo` for derived results.
- **Redux:** Access to auth tokens implicitly via axios interceptors; no direct selectors.
- **i18n:** Keys like `SEARCH_PLACEHOLDER`, `SEARCH_EMPTY`, `SEARCH_CATEGORY_ALL`.

### 5.6 `/branches/[id]` (`src/pages/branches/[id].tsx`)
- **Purpose:** Branch menu page showing branch details and entire menu grid.
- **Data fetching:**
  - `getServerSideProps`/client fetch hitting `/api/branches/{id}/menu` for menu and `/api/branches/{id}/top-menu` for recommended items.
  - Additional fetch for branch meta (address, open hours) when needed.
- **Components:**
  - `Layout` wrapper.
  - `BranchHeader` (image, rating, open hours).
  - `BranchMenuToolbar` (search within menu, category filters).
  - `BranchMenuGrid` to display `BranchProductCard` entries.
  - `AddToCartModal` triggered when selecting product to configure add-ons.
- **State:** Maintains `searchTerm`, `selectedCategory`, `page`, `modalState`; uses `useEffect` to refetch when filters change.
- **Redux:** `useSelector` for `auth.user` (balance) to display top-up CTA; `useDispatch` for cart actions.
- **i18n:** Keys for branch status, add-to-cart copy, closure warnings.

### 5.7 `/checkout` (`src/pages/checkout/index.tsx`)
- **Purpose:** Confirm delivery location, review cart grouped by branch, proceed to payment.
- **Data flow:**
  - Pulls cart from Redux store (`cartSlice`) or from `auth.user.card` fallback.
  - Validates branch open state via `/api/branches/{id}/menu` or dedicated branch availability endpoint.
  - Creates transaction via `/api/transaction/create` when clicking “Proceed to payment”.
- **Components:**
  - `Layout` wrapper.
  - `CartDrawer` for branch/product summary.
  - `MapConfirm` to confirm location (Longdo Map integration) and compute distance.
  - `FloatingCartButton` for quick access.
- **State:** `deliveryLocation`, `selectedBranch`, `isCreatingTxn`, `errorBanner`.
- **i18n:** Keys `CHECKOUT_TITLE`, `CHECKOUT_DELIVERY_REQUIRED`, `CHECKOUT_BRANCH_CLOSED`.

### 5.8 `/payment/[txnId]`
- **Purpose:** Payment status page for a specific transaction.
- **Data fetching:**
  - On mount, fetches `/api/transaction/details?txnId=...` to obtain transaction + order + display status.
  - Polling or SSE to refresh status until `accepted/rejected`.
  - Slip upload uses `/api/payment/slipok` when manual verification required.
- **Components:**
  - `Layout` wrapper.
  - `PaymentMethodPicker`, `DepositModal` (for top-up), `SlipUpload` components.
  - `Order/Preparing` statuses plus `LocationMap` for route preview.
- **State:** Tracks `txn`, `order`, `displayStatus`, `uploadingSlip`, `slipError`.
- **i18n:** Keys for payment statuses, slip instructions, success/failure toasts.

### 5.9 `/web-hook-line`
- **Purpose:** OAuth callback landing for LINE Login integration.
- **Behavior:** Parses query params, completes LINE token exchange via `/api/login-line`, stores tokens, redirects to `/` on success.
- **UI:** Minimal spinner/loader using `LoaderOverlay`.

### 5.10 `/branches/[id]?category=` (dynamic filter)
- Variation of branch page responding to query string `category` to prefilter menu; uses router query to set default filter.

### 5.11 `/checkout` error handling states
- Renders `AlertModal` when branch is closed or location missing.
- Uses `notificationsSlice` to push toasts for success (transaction created) or errors (branch mismatch, insufficient balance).

### 5.12 `/payment` slip verification flows
- Allows manual entry of slip metadata when automatic verification fails; interacts with `/api/payment/slipok` and updates UI accordingly.

---
## 6. Component Documentation

> Components live under `src/components/` and are largely presentational. They follow Tailwind conventions described in `AGENT_PATTERN.md` and expect props from container pages. Most components are functional React components with TypeScript props interfaces.

### 6.1 Layout & Navigation

#### Layout (`src/components/Layout.tsx`)
- **Props:** `{ children: React.ReactNode }`.
- **Purpose:** Application shell with navbar, notification center, floating language toggle, cart drawer, and deposit modal.
- **Behavior:**
  - Tracks `cartOpen` and `depositOpen` state via `useState`.
  - Registers window listener for `open-deposit-modal` custom event to show `DepositModal`.
  - Derives default branch/company IDs from last cart group using `useAppSelector` to prefill deposit form.
- **Styling:** Uses `min-h-screen bg-slate-50`, content padded with `px-4 py-8`. Follows brand colors.
- **Consumers:** All pages via `Layout` wrapper.

#### Navbar (`src/components/Navbar.tsx`)
- **Props:** None.
- **Purpose:** Top navigation with brand link, balance pill, and dropdown menu.
- **Behavior:**
  - Uses `useSelector` to access `auth.user` for balance display (formatted with `formatTHB`).
  - Maintains `open` state for dropdown; closes on outside click or ESC using document listeners.
  - Menu actions: open deposit modal (dispatches `open-deposit-modal`), navigate to account tabs.
- **Styling:** `border-b bg-white`, `rounded-xl` dropdown entries, focus rings `focus:ring-emerald-100`.
- **i18n:** `I18N_KEYS` for brand name and menu labels.

#### NotificationCenter (`src/components/notifications/NotificationCenter.tsx`)
- **Props:** None; reads notifications slice via hooks.
- **Purpose:** Render stacked toast notifications with auto-dismiss.
- **Behavior:** Maps `notifications` state to cards with icons/severity colors; attaches close button dispatching removal action.
- **Styling:** Each toast uses `rounded-2xl shadow-sm`, color-coded backgrounds (`bg-emerald-50`, `bg-rose-50`, etc.).

#### FloatingLanguageToggle (`src/components/common/FloatingLanguageToggle.tsx`)
- **Props:** None.
- **Purpose:** Floating switch for locale toggle between EN/TH.
- **Behavior:** Uses `useI18n` to detect current locale, toggles via `setLocale`. Persists to localStorage.
- **Styling:** Positioned bottom-right with `fixed`, `rounded-full`, `bg-white shadow-lg`.

### 6.2 Authentication components (`src/components/auth/`)

#### AuthTabs (`AuthTabs.tsx`)
- **Props:** `{ tab: 'login' | 'signup'; onChange(tab) }`.
- **Purpose:** Toggle between login and signup views.
- **Styling:** `flex bg-slate-100 rounded-2xl p-1`, active tab `bg-white shadow-sm` per pattern.
- **Accessibility:** Buttons with `aria-pressed` reflecting active state.

#### EmailPasswordForm (`EmailPasswordForm.tsx`)
- **Props:**
  - `mode: 'login' | 'signup'`.
  - `onSubmit({ email, password, sendVerifyEmail? })`.
  - `submitting: boolean`, `errorMessage?: string`, `onSwitchMode?`.
- **Purpose:** Collect email/password credentials and optional verify email toggle.
- **Behavior:**
  - Controlled inputs with `useState`.
  - Shows `send verify email` checkbox when mode = signup.
  - Calls `onSubmit` on form submit; disables button while `submitting`.
- **Styling:** Inputs `rounded-xl border border-slate-200`, button `bg-emerald-600 text-white`.

#### PhoneAuthSection (`PhoneAuthSection.tsx`)
- **Props:**
  - `mode: 'login' | 'signup'`.
  - `onSend(phone)`; `onConfirm(otp)`; `confirming`, `sending`, `error` states.
- **Purpose:** Phone number OTP flow with Recaptcha container.
- **Behavior:**
  - Renders input for phone number, send OTP button, OTP input, confirm button.
  - Accepts `recaptchaContainerId` prop for `makeRecaptcha` integration.
- **Styling:** Card style `rounded-2xl border border-slate-200 bg-white p-6`.

#### SocialButtons (`SocialButtons.tsx`)
- **Props:** `onGoogle`, `onLine`, `mode` (login/signup), `loading` flags.
- **Purpose:** Render Google and LINE buttons.
- **Styling:** Buttons `rounded-xl`, Google button uses inline SVG icon.
- **Behavior:** Calls provided callbacks; disabled while `loading`.

#### OtpModal (`OtpModal.tsx`)
- **Props:** `open`, `onClose`, `onConfirm(code)`, `loading`, `phoneNumber`.
- **Purpose:** Modal to input OTP digits when phone verifying.
- **Styling:** Uses `Modal` component, input fields with `text-center text-2xl`.
- **Accessibility:** Focus trap via `Modal`; confirm button labelled with `aria-label`.

### 6.3 Account components (`src/components/account/`)

#### ProfileCard (`ProfileCard.tsx`)
- **Props:**
  - `user: { email, phone, provider, is_email_verified, is_phone_verified }`.
  - `balance: number`, `onLogout()`, `onOpenDeposit()`.
- **Purpose:** Display identity details, provider, verification chips, balance quick action.
- **Behavior:** Shows email/phone rows with chips for verified/unverified; logout button calling `onLogout`.
- **Styling:** `rounded-3xl bg-white border border-slate-200 shadow-sm p-6`.
- **i18n:** Keys for row labels, button copy.

#### VerifyUpdateCard (`VerifyUpdateCard.tsx`)
- **Props:**
  - `email`, `phone`, `onUpdate(payload)`, `loadingStates`, `onSendEmail()`, `onSendOtp()`, `onConfirmOtp()`, `errorMessage`, `successMessage`.
- **Purpose:** Provide forms to update email and phone, trigger verification flows.
- **Behavior:**
  - Controlled inputs for new email/phone.
  - Buttons to request verification email and send OTP.
  - Displays status messages using success/error props.
- **Styling:** Sectioned card with `border-t` separators, uses `bg-emerald-50` for success alerts.

### 6.4 Branch components (`src/components/branch/`)

#### BranchHeader (`BranchHeader.tsx`)
- **Props:** Branch meta (`name`, `image`, `address`, `openHours`, `isOpen`, `distanceKm?`).
- **Purpose:** Hero section for branch page with cover image, open status badge, schedule.
- **Styling:** `rounded-3xl`, gradient overlay on hero image, status chip `bg-emerald-100` or `bg-rose-100` for closed.
- **Behavior:** Formats open hours by day; uses i18n for `OPEN_NOW`, `CLOSED` labels.

#### BranchMenuToolbar (`BranchMenuToolbar.tsx`)
- **Props:** `searchTerm`, `onSearchChange`, `categories`, `selectedCategory`, `onCategoryChange`, `sortOptions`.
- **Purpose:** Top toolbar for filtering menu items.
- **Behavior:** Debounced search input, category chips, optionally toggles recommended filter.
- **Styling:** `flex flex-wrap gap-3 bg-white rounded-2xl border p-4 shadow-sm`.

#### BranchMenuGrid (`BranchMenuGrid.tsx`)
- **Props:** `items: BranchMenuItem[]`, `onSelect(item)`, `loading`, `emptyMessage`.
- **Purpose:** Render grid of menu cards.
- **Styling:** `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` with card layout.

#### BranchProductCard (`BranchProductCard.tsx`)
- **Props:**
  - `product` (id, name, description, image_url, price string, is_enabled, stock_qty, add_ons).
  - `onAdd(product)` callback.
- **Purpose:** Display single product with CTA to add to cart.
- **Behavior:**
  - Shows price (with strikethrough if override) and add-on badges.
  - Disables button when `is_enabled` false or `stock_qty` 0.
- **Styling:** `bg-white border border-slate-200 rounded-2xl p-4 shadow-sm`, CTA `bg-emerald-600`.

#### AddToCartModal (`AddToCartModal.tsx`)
- **Props:** `open`, `product`, `onClose`, `onConfirm({ qty, selectedAddOns })`, `maxQty`.
- **Purpose:** Configure quantity and add-ons before adding to cart.
- **Behavior:**
  - Lists add-on groups with checkboxes/radios depending on `is_required`.
  - Validates required add-ons before confirming.
  - Uses `QuantityInput` for qty selection.
- **Styling:** Modal with `rounded-3xl`, `max-w-lg`, scrollable body.
- **Accessibility:** Focus trap inside modal, confirm button labelled.

### 6.5 Cart components (`src/components/cart/`)

#### FloatingCartButton (`FloatingCartButton.tsx`)
- **Props:** `{ onClick() }` optional; uses default to open drawer.
- **Purpose:** Floating CTA showing item count.
- **Behavior:** Reads cart summary from Redux (branch groups) to display badge.
- **Styling:** `fixed bottom-6 right-6 rounded-full bg-emerald-600 text-white shadow-lg px-5 py-3`.

#### CartDrawer (`CartDrawer.tsx`)
- **Props:** `{ open: boolean; onClose(): void }`.
- **Purpose:** Side drawer summarizing cart by branch/product, allow adjustments/removals.
- **Behavior:**
  - Uses `Transition` to slide in/out.
  - Lists branch groups with `QuantityInput` for each item.
  - Buttons to clear branch (calls `/api/card/clear-by-branch`) and proceed to checkout.
- **Styling:** `fixed` overlay with `bg-white` panel `rounded-l-3xl`, overlay `bg-slate-900/30`.
- **Accessibility:** Trap focus inside drawer while open; close button with `aria-label`.

### 6.6 Checkout component (`src/components/checkout/MapConfirm.tsx`)
- **Props:**
  - `value: { lat: number; lng: number } | null`.
  - `onChange(location)`.
  - `branchPosition?: { lat: number; lng: number }` for reference.
- **Purpose:** Map widget to select delivery location using Longdo Map/Leaflet.
- **Behavior:**
  - Renders interactive map with draggable marker; on drag end triggers `onChange`.
  - Shows distance between branch and selected point.
- **Styling:** Container `rounded-2xl overflow-hidden border` with height `h-80`.
- **Accessibility:** Provides fallback instructions for keyboard navigation (jump to address search field).

### 6.7 Payment components (`src/components/payment/`)

#### MethodPicker (`MethodPicker.tsx`)
- **Props:** `methods`, `selectedId`, `onSelect(id)`, `disabled`, `loading`.
- **Purpose:** List available transaction methods with icons/descriptions.
- **Behavior:** Highlights selected method, disables unavailable ones (balance insufficient, offline).
- **Styling:** List of cards `rounded-2xl border` toggled with `bg-emerald-50` when active.

#### DepositModal (`DepositModal.tsx`)
- **Props:** `{ open, onClose, defaultBranchId, defaultCompanyId }`.
- **Purpose:** Allow user to initiate balance top-up.
- **Behavior:**
  - Form collects amount, selects branch/company context, chooses method (QR vs slip).
  - Submits to `/api/transaction/create` with `txnType = 'deposit'`.
  - Displays generated QR via `/api/qr/generate`.
- **Styling:** Modal `rounded-3xl`, header accent `text-emerald-600`.
- **Accessibility:** Close button with `aria-label`, focus trap.

#### SlipUpload (`SlipUpload.tsx`)
- **Props:** `{ onUpload(file, meta), uploading, onRemove, slips }`.
- **Purpose:** Upload proof of payment for SlipOK verification.
- **Behavior:**
  - Accepts image files, previews thumbnails, collects optional metadata (transfer date/time).
  - Calls callback to send to `/api/payment/slipok`.
- **Styling:** Drag-and-drop area `border-dashed border-emerald-300 rounded-2xl`.

### 6.8 Order components (`src/components/order/`)

#### Preparing (`Preparing.tsx`)
- **Props:** `order`, `displayStatus`, `onCancel?`.
- **Purpose:** Show timeline while order is being prepared/delivered.
- **Behavior:**
  - Renders steps with icons (ordered, preparing, delivering, completed) using `status` to highlight.
  - Provides cancel button when status allows.
- **Styling:** `grid gap-4 bg-white rounded-2xl p-6 shadow-sm`.

#### LocationMap (`LocationMap.tsx`)
- **Props:** `branch`, `delivery`, `onRetry?`.
- **Purpose:** Map view showing branch and delivery markers.
- **Behavior:** Renders map using Leaflet with two markers; draws polyline when coordinates available.
- **Styling:** `rounded-2xl overflow-hidden border`, height `h-72`.

### 6.9 Search components (`src/components/search/`)

#### SearchBar (`SearchBar.tsx`)
- **Props:** `value`, `onChange`, `onSubmit`, `isLoading`, `suggestions`, `categories`, `selectedCategory`, `onCategoryChange`.
- **Purpose:** Input field with category dropdown and location filter toggle.
- **Behavior:** Debounces `onChange`, shows loading spinner while fetching.
- **Styling:** `rounded-3xl bg-white border border-slate-200 p-4 shadow-sm`, input `rounded-2xl`.

#### BranchList (`BranchList.tsx`)
- **Props:** `branches`, `onSelect(branchId)`, `loading`, `emptyMessage`.
- **Purpose:** Render list of branch cards with distance and open status.
- **Behavior:** Sorts branches by `distance_km` if available; toggles skeletons while loading.
- **Styling:** `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`.

#### BranchCard (`BranchCard.tsx`)
- **Props:** Branch summary (id, name, image, address, is_open, distance_km, products_sample).
- **Purpose:** Present branch info and sample menu items.
- **Behavior:** Clicking card triggers `onSelect`; displays product chips and open badge.
- **Styling:** `bg-white rounded-2xl border border-slate-200 shadow-sm p-4`.

### 6.10 Common components (`src/components/common/`)

#### Modal (`Modal.tsx`)
- **Props:** `{ open, onClose, title?, children, footer?, size? }`.
- **Purpose:** Generic modal with overlay and focus trap.
- **Behavior:** Closes on overlay click or ESC, optional `footer` slot.
- **Styling:** `fixed inset-0 flex items-center justify-center bg-slate-900/40`, panel `rounded-3xl bg-white p-6 shadow-xl`.

#### AlertModal (`AlertModal.tsx`)
- **Props:** `open`, `onClose`, `title`, `description`, `confirmLabel`, `onConfirm`, `variant`.
- **Purpose:** Confirm/alert dialog used for destructive actions (clear cart, branch closed).
- **Styling:** Variant-based classes (success `bg-emerald-50`, danger `bg-rose-50`).

#### QuantityInput (`QuantityInput.tsx`)
- **Props:** `{ value, min, max, onChange }`.
- **Purpose:** Stepper control for adjusting quantity.
- **Behavior:** Buttons `-`/`+` adjust within bounds; disables at min/max.
- **Styling:** `inline-flex items-center gap-2 rounded-xl border px-3 py-2 bg-white`, buttons `bg-emerald-50`.

#### LoaderOverlay (`LoaderOverlay.tsx`)
- **Props:** `message?`, `visible`.
- **Purpose:** Full-screen overlay spinner for blocking states.
- **Styling:** `fixed inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center` with `animate-spin` indicator.

### 6.11 RequireAuth (`src/components/RequireAuth.tsx`)
- **Props:** `{ children }`.
- **Purpose:** Client-side guard to hydrate tokens from localStorage before rendering protected pages.
- **Behavior:**
  - On mount, loads tokens via `loadTokens`, `loadUser`; dispatches to store.
  - While loading, shows skeleton or spinner.
  - Redirects to `/login` if tokens missing.
- **Styling:** Minimal; centers loader with `flex min-h-screen items-center justify-center`.

### 6.12 i18n LocaleSwitcher (`src/components/i18n/LocaleSwitcher.tsx`)
- **Props:** None.
- **Purpose:** Inline locale toggle used in nav or settings.
- **Behavior:** Buttons for EN/TH; updates router query and localStorage.
- **Styling:** `inline-flex gap-2 rounded-xl bg-slate-100 p-1`, active button `bg-white shadow-sm`.

### 6.13 Payment extras

#### BalanceDropdown (`src/components/layout/BalanceDropdown.tsx`)
- **Props:** `balance`, `onTopUp`, `onViewTransactions`.
- **Purpose:** Quick actions for balance accessible from navbar or layout.
- **Behavior:** Shows formatted THB, dropdown transitions.
- **Styling:** Aligns with brand: `bg-white border-slate-200 rounded-2xl`.

---
## 7. Redux Store Documentation

### 7.1 Store setup (`src/store/index.ts`)
- Combines reducers: `auth`, `notifications`, `config`.
- Exports typed hooks `useAppDispatch`, `useAppSelector` and `RootState` type.
- Configured via `configureStore` (Redux Toolkit) with default middleware.

### 7.2 `authSlice`
- **State shape:** `{ accessToken: string | null; refreshToken: string | null; user: UserRecord | null }`.
- **Initial state:** all null.
- **Reducers:**
  - `setTokens({ accessToken, refreshToken })` updates tokens.
  - `setUser(user | null)` normalizes `card` to array using `EMPTY_ARRAY` fallback before storing.
  - `logout()` clears tokens and user.
- **Selectors:** Provided in `src/store/selectors.ts` (see below).
- **Usage:** Login/signup flows dispatch `setTokens` and `setUser`; logout actions clear local storage and state.

### 7.3 `notificationsSlice`
- **State shape:** `{ items: Notice[] }` where `Notice` includes `id`, `title?`, `message`, `kind`, `ts`.
- **Reducers:**
  - `pushNotice(payload)` generates unique ID if missing, pushes to array.
  - `removeNotice(id)` filters out matching notice.
  - `clearNotices()` empties list.
- **Usage:** `@utils/notify.ts` dispatches `pushNotice`; `NotificationCenter` consumes `items` and calls `removeNotice`.

### 7.4 `configSlice`
- **State shape:** `{ values: Record<string, string> }`.
- **Reducers:**
  - `setConfig(values)` replace entire map.
  - `mergeConfig(values)` shallow merges into existing map.
  - `clearConfig()` empties map.
- **Usage:** `/api/system/config` response stored to enable feature toggles client-side.

### 7.5 Store constants (`src/store/constants.ts`)
- Defines `EMPTY_ARRAY` and `EMPTY_OBJECT` as frozen references to maintain referential stability across selectors.
- Used in `authSlice` and selectors to avoid new array/object allocations.

### 7.6 Memoized selectors (`src/store/selectors.ts`)
- `selectUser(state)`: returns `auth.user`.
- `selectUserCard`: memoized; returns `user.card` or `[]` (reusing `EMPTY_ARRAY`).
- `selectUserCardItems`: flatten product lists from branch groups.
- `selectCartCount`: uses `totalItemCount(groups)` util to count items.
- `selectUserCardMeta`: returns card object (for branch metadata) or `EMPTY_OBJECT`.
- All selectors rely on Reselect to prevent unnecessary re-renders when card structure unchanged.

### 7.7 Typed hooks & usage patterns
- Components use `useAppSelector(selectUser)` etc. to read state.
- `useAppDispatch` ensures correct dispatch type; actions imported from slices.
- Persistence handled outside store via `tokenStorage`; hydration occurs in `RequireAuth`.

---
## 8. Utilities Documentation

### 8.1 HTTP clients
- **`apiClient.tsx`:** Axios instance with interceptors that inject `Authorization` from Redux state. Handles 401/400 by refreshing token once via `/api/refresh-token`; uses queue to avoid concurrent refreshes. On refresh failure, dispatches `logout` and redirects to `/login`.
- **`externalApiClient.tsx`:** Secondary Axios client for third-party APIs (SlipOK, LINE). Configured with base URL from env; no auth interceptors by default.

### 8.2 Authentication helpers
- **`firebaseClient.ts`:** Initializes Firebase Web SDK with environment credentials, exports `auth`, providers, and `makeRecaptcha` helper to set up invisible Recaptcha container for phone auth.
- **`firebaseVerify.ts`:** Verifies Firebase ID tokens server-side without Admin SDK. Fetches JWKS, caches keys, uses `jose` to validate signature and decode payload. Throws on expiration or invalid audience.
- **`firebaseRest.ts`:** Wraps Firebase Identity Toolkit REST endpoints for email/password signup and sending verification email. Handles REST errors and surfaces meaningful messages.
- **`jwt.ts`:** Signs/verifies custom JWT access tokens using `jsonwebtoken`. Maintains in-memory map of refresh tokens with expiry; `signAccessToken`, `verifyAccessToken`, `mintRefreshToken`, `rotateRefreshToken` exported.
- **`authMiddleware.ts`:** Provides `resolveAuth(req)` (tries Bearer access token then Firebase ID token) and `withAuth(handler)` HOC returning 401 when auth missing. Populates `(req as any).auth` with `{ uid, userId, tokenType }`.

### 8.3 Supabase integration
- **`supabaseServer.ts`:** Creates singleton Supabase client using service role key (non-persisted session). Throws descriptive error when env missing.

### 8.4 Logging & notification helpers
- **`logger.ts`:** Safe logging functions (`logInfo`, `logWarn`, `logError`) that redact secrets and attach metadata.
- **`notify.ts`:** Simple wrapper around `store.dispatch(pushNotice)` to show toasts; exports convenience functions by severity.

### 8.5 Time & date utilities
- **`time.ts`:** `toBangkokIso(value)` converting `Date|string|null` to ISO string in Asia/Bangkok timezone using `dayjs` or native offset. Ensures all responses align with timezone policy.
- **`datetime.ts`:** Format helpers for UI (e.g., `formatInBangkok`, `formatTimeRange`, `isWithinOpenHours`).

### 8.6 Currency & cart helpers
- **`currency.ts`:** `formatTHB(amount)` for THB currency display with `Intl.NumberFormat`. Supports fallback when `Intl` unavailable.
- **`cart.ts`:** Contains cart-related utilities like `totalItemCount(groups)`, `mergeCartItems`, `branchMatchesCart`, `validateCartItem` used for branch gating and summary calculations.

### 8.7 Geo utilities
- **`geo.ts`:** Haversine distance calculations and helper to clamp coordinates. Used in search results and checkout map to compute distance.

### 8.8 History utilities
- **`history.ts`:** Provides `appendIdWithTrim(historyArray, id, max)` to append ID and enforce max length (used by transactions/orders).

### 8.9 Token storage
- **`tokenStorage.ts`:** Client-side persistence for tokens and user record. Exports `saveTokens`, `loadTokens`, `clearTokens`, `saveUser`, `loadUser`, `clearUser`. Uses `localStorage` guards for SSR.

### 8.10 Payment helpers
- **`qrRenderer.ts`:** Generates PromptPay QR payloads or base64 images for deposit/transaction flow.
- **`lineVerify.ts`:** Validates LINE login tokens (signature verification, nonce matching) when handling `/api/login-line`.

### 8.11 API wrappers for slip verification
- **`externalApiClient.tsx` + `lineVerify.ts` + `qrRenderer.ts`** orchestrate SlipOK calls and QR generation.

### 8.12 Misc utilities
- **`geo.ts` & `cart.ts`** support branch open checks and cart validation to prevent cross-branch ordering.
- **`__tests__` folder** contains Jest tests for utils (token storage, etc.) to ensure deterministic behavior.

---
## 9. Constants & i18n

### 9.1 i18n keys (`src/constants/i18nKeys.ts`)
- Central registry of translation keys exported as `I18N_KEYS` object.
- Categories include:
  - `BRAND_*` for brand name/tagline.
  - `AUTH_*` for login/signup copy (errors, CTA labels).
  - `ACCOUNT_*` for profile, verification messages, duplicate email/phone errors.
  - `SEARCH_*`, `BRANCH_*`, `CART_*`, `CHECKOUT_*`, `PAYMENT_*`, `ORDER_*` for domain-specific text.
  - `NOTIFY_*` for toast messages.
- Keys strongly typed to prevent typos; `useI18n` only accepts keys from this file.

### 9.2 Translation dictionary (`src/config/index.json`)
- JSON object with `en` and `th` locales.
- Provides translations for every key defined in `i18nKeys.ts`.
- Example snippet:
  ```json
  {
    "en": {
      "BRAND_NAME": "BaanFoodie",
      "AUTH_LOGIN": "Sign in",
      "ACCOUNT_DUPLICATE_EMAIL": "That email is already linked to another account."
    },
    "th": {
      "BRAND_NAME": "บ้านฟู้ดดี้",
      "AUTH_LOGIN": "เข้าสู่ระบบ",
      "ACCOUNT_DUPLICATE_EMAIL": "อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว"
    }
  }
  ```
- Additional keys cover map instructions, slip upload guidance, branch closure warnings, etc.

### 9.3 Status constants
- **`statusMaps.ts`:** Maps transaction/order statuses to human-readable labels and badge styles. Provides `humanTxnStatus`, `humanTxnType`, `chipClassForTxnStatus` (used in account page).
- **`status.ts`:** Contains `deriveDisplayStatus(order, txn)` logic merging order + transaction states, plus `STATUS_I18N_KEY` mapping to i18n keys for statuses (e.g., `STATUS_I18N_KEY.PENDING = I18N_KEYS.ORDER_STATUS_PENDING`).
- **Usage:** Payment and order components rely on these to present consistent statuses across languages.

### 9.4 Error code constants
- Spread across components and APIs (e.g., `BRANCH_CLOSED`, `CUSTOMER_LOCATION_REQUIRED`, `INVALID_METHOD`). Documented in Section 11 with mapping to user-facing messages via i18n keys.

### 9.5 Feature flags
- Keys returned by `/api/system/config` (e.g., `PAYMENT_SLIP_REQUIRED`, `MAP_PROVIDER`, `SLIPOK_ENV`). Stored in `configSlice.values` and used by components to toggle features.

---
## 10. Flows & Scenarios

### 10.1 User signup/login flow
1. **User interacts with `/login`:** selects login or signup tab; enters credentials or chooses social/phone.
2. **Firebase authentication:**
   - Email/password uses `signInWithEmailAndPassword` (login) or `signUpEmailPassword` (signup) via Firebase REST.
   - Google login uses `signInWithPopup` + Google provider.
   - Phone login uses `signInWithPhoneNumber` with Recaptcha → OTP confirmation.
3. **Backend exchange:**
   - Client posts `idToken` (and provider info) to `/api/login` or `/api/signup`.
   - API verifies token via `verifyFirebaseIdToken` and upserts `tbl_user` record.
   - JWT access/refresh tokens minted using `jwt.ts` and returned alongside normalized `UserRecord`.
4. **Client persistence:**
   - Redux `setTokens`/`setUser` dispatched; tokens saved via `tokenStorage.saveTokens`, user via `saveUser`.
   - `RequireAuth` ensures tokens loaded on future visits; interceptors attach access token to API calls.
5. **Refresh cycle:**
   - When API returns 401/400 due to expired token, axios interceptor triggers `/api/refresh-token`, rotates refresh, updates store.
   - On repeated failure, user logged out and redirected to `/login`.

### 10.2 Add to cart → checkout → order creation → payment
1. **Branch browsing:**
   - User opens `/branches/{id}`; `BranchMenuGrid` renders items with add-ons and `AddToCartModal`.
   - `AddToCartModal` collects quantity and required add-ons; on confirm, page dispatches to `api/card/save` with sanitized payload.
   - `api/card/save` merges cart data within `tbl_user.card` (JSON) ensuring per-branch grouping and quantity cap.
2. **Cart review:**
   - `FloatingCartButton` opens `CartDrawer` showing aggregated items; user can adjust quantity or remove items.
   - Clearing branch triggers `/api/card/clear-by-branch` to update server state.
3. **Checkout:**
   - `/checkout` loads cart from Redux/store; ensures branch open (calls branch repository) and prompts for delivery location via `MapConfirm`.
   - Validates location present (`CUSTOMER_LOCATION_REQUIRED`) and branch open (`BRANCH_CLOSED` / `BRANCH_FORCE_CLOSED`).
   - On proceed, creates transaction via `/api/transaction/create` (type `payment`, method `qr` or `balance`).
4. **Order creation:**
   - After transaction creation, `/api/order/list` or dedicated order creation API stores order with `PENDING` status referencing transaction ID. Order details include cart snapshot and delivery coordinates.
   - `order.ts` updates user `order_history` to include new order ID.
5. **Payment:**
   - `/payment/{txnId}` loads transaction details; if method `qr`, displays QR code via `/api/qr/generate`.
   - User uploads slip via `SlipUpload` triggering `/api/payment/slipok` for verification.
   - On acceptance, API updates transaction status to `accepted`, stamps slip metadata, updates order status to `PREPARE`, and notifies user.
   - If method `balance`, transaction accepted immediately; order moves to `PREPARE` without slip.

### 10.3 SlipOK verification scenario
1. **Webhook entry:** SlipOK calls `/api/payment/slipok` with transaction reference data and slip image metadata.
2. **Validation:**
   - API verifies token/signature, loads transaction (pending), ensures amount matches and not expired.
   - Optionally verifies receiver last four digits against `tbl_company.payment_id`.
3. **Slip verification:**
   - If configured `NEXT_PUBLIC_ENV_SLIP_OK = 'PROD'`, hits SlipOK API via `externalApiClient` and `lineVerify` for JSON response; otherwise uses local stub.
   - On success, calls `stampTxnSlipMeta` to store `trans_ref`, `trans_date`, `trans_timestamp` (unique index prevents duplicates).
   - Updates transaction status to `accepted`, triggers order status change to `PREPARE`, dispatches notifications.
   - On failure, sets status to `rejected` and returns error code (e.g., `SLIP_INVALID`).
4. **Client updates:** `/payment/{txnId}` polls `/api/transaction/details` to refresh `displayStatus`, showing slip verification outcome.

### 10.4 Cart branch-open check (latest change)
1. **Context:** Branch closure should prevent checkout with outdated cart items.
2. **Implementation:**
   - `branchMenu` service and `api/card/save` both validate branch `is_force_closed` and open hours using `validateBranchOpen` helper.
   - Before transaction creation, service ensures selected branch matches cart items; mismatches result in `CART_BRANCH_MISMATCH` code returned to client.
   - Checkout page shows alert referencing i18n key `CHECKOUT_BRANCH_CLOSED` and prompts user to adjust cart.

### 10.5 Longdo Map integration
1. **Components:** `MapConfirm` (checkout) and `LocationMap` (order status) rely on Leaflet, styled per brand.
2. **Flow:**
   - Checkout: user drags marker to desired location; component calculates distance to branch using `geo.ts`. Stores location in checkout state and attaches to order details.
   - Order tracking: once order includes delivery coordinates, `LocationMap` renders branch + delivery markers and optional polyline to visualize route.
3. **i18n:** Map instructions use keys such as `CHECKOUT_MAP_INSTRUCTION`, `ORDER_MAP_BRANCH_LABEL`, `ORDER_MAP_CUSTOMER_LABEL`.

### 10.6 Balance top-up flow
1. User opens deposit modal (via navbar or event).
2. Modal collects amount and method; submits to `/api/transaction/create` with `txnType = 'deposit'`.
3. Server returns transaction row; modal calls `/api/qr/generate` to show QR code.
4. After payment, SlipOK webhook or manual verification updates transaction; account page reflects new balance after `/api/transaction/list` refresh.

---
## 11. Error Handling & Codes

| Code | HTTP status | Used by | Meaning / Client action |
| --- | --- | --- | --- |
| `METHOD_NOT_ALLOWED` | 405 | All API routes | Wrong HTTP method; adjust client request. |
| `BAD_REQUEST` | 400 | `/api/login`, `/api/signup`, `/api/user/send-verify-email`, `/api/v1/account/update`, `/api/card/save`, etc. | Input validation failed (missing fields, invalid payload). Show inline form error. |
| `LOGIN_FAILED` | 400 | `/api/login` | Unexpected login failure (Firebase verification error). Prompt to retry. |
| `SIGNUP_FAILED` | 400 | `/api/signup` | Generic signup failure. |
| `REFRESH_FAILED` | 400 | `/api/refresh-token` | Refresh token invalid/expired → logout user. |
| `UNAUTHORIZED` | 401 | `withAuth`-protected routes | Access token missing or invalid. Redirect to `/login`. |
| `NOT_FOUND` | 404 | `/api/user/me`, `/api/transaction/[txnId]`, `/api/order/*` | Resource not found (user, transaction, order). Show empty state. |
| `INTERNAL_ERROR` | 500 | `/api/user/me`, `/api/system/config`, `/api/search`, `/api/v1/account/update` fallback | Server failure; display generic error and retry option. |
| `SEND_EMAIL_FAILED` | 400 | `/api/user/send-verify-email` | Firebase email send failure; advise user to try later. |
| `DUPLICATE_EMAIL` | 409 | `/api/v1/account/update` | Email already taken; highlight email field. |
| `DUPLICATE_PHONE` | 409 | `/api/v1/account/update` | Phone already taken. |
| `CARD_EMPTY` | 200 | `/api/card/save` | After sanitization, card empty; front-end should show message and keep drawer open. |
| `INVALID_PAYLOAD` | 400 | `/api/card/save` | Sanitization failed; check payload structure. |
| `USER_NOT_FOUND` | 404 | `/api/card/clear-by-branch` | Card owner missing; likely stale session. |
| `INVALID_METHOD` | 200 | `/api/transaction/create` | Method ID not supported (e.g., deleted). Display modal to choose another method. |
| `BALANCE_NOT_ENOUGH` | 200 | `/api/transaction/create` (balance type) | Insufficient balance; prompt deposit modal. |
| `CART_BRANCH_MISMATCH` | 200 | `/api/transaction/create`, checkout service | Cart contains items from different branch than requested; ask user to adjust cart. |
| `BRANCH_CLOSED` | 200 | `/api/branches/[id]/menu`, checkout validation | Branch closed at selected time. |
| `BRANCH_FORCE_CLOSED` | 200 | Same as above | Force-closed branch; show closure notice. |
| `CUSTOMER_LOCATION_REQUIRED` | 200 | Checkout service | Delivery location missing. |
| `TRANSACTION_NOT_FOUND` | 200 | `/api/payment/slipok`, `/api/order/by-transaction` | Webhook referencing missing txn. |
| `DUPLICATE_SLIP` | 200 | `/api/payment/slipok` | Unique constraint violation (same slip already processed). |
| `SLIP_INVALID` | 200 | `/api/payment/slipok` | Slip verification failed. |
| `AMOUNT_MISMATCH` | 200 | `/api/payment/slipok` | Slip amount differs from transaction amount. |
| `RECEIVER_MISMATCH` | 200 | `/api/payment/slipok` | Receiver account mismatch. |
| `EXPIRED` | 200 | `/api/payment/slipok`, `/api/transaction/details` | Transaction expired (QR TTL). |
| `REJECTED` | 200 | `/api/payment/slipok` | Slip rejected by provider; order stays pending or moves to rejection. |
| `INVALID_SIGNATURE` | 401 | `/api/payment/slipok` | Webhook auth failure; log security incident. |
| `HELLO_WORLD` | 200 | `/api/hello` | Example success response. |

> Note: Business errors return HTTP 200 when validation relates to user actions (branch closed, insufficient balance). Frontend must inspect `code` field and show appropriate messaging using i18n keys.

---
## 12. Acceptance Criteria Matrix

| Feature | Acceptance criteria | Related APIs | Frontend components/pages | DB tables |
| --- | --- | --- | --- | --- |
| **Authentication** | 1. User can log in with email/password (valid credentials) and receives JWT tokens. 2. Login failure shows localized error. 3. Refresh token automatically renews access token without user action. | `/api/login`, `/api/signup`, `/api/refresh-token`, `/api/user/me` | `/login`, `AuthTabs`, `EmailPasswordForm`, `RequireAuth` | `tbl_user` |
| **Account management** | 1. Profile page displays email/phone/provider with accurate verification status. 2. Updating email/phone enforces uniqueness and resets verification flags. 3. Sending verification email shows success toast. | `/api/user/me`, `/api/v1/account/update`, `/api/user/send-verify-email` | `/account`, `ProfileCard`, `VerifyUpdateCard` | `tbl_user` |
| **Cart** | 1. Adding item from branch saves to server card with correct quantity and add-ons. 2. Duplicate adds increment quantity up to configured max. 3. Clearing branch removes only that branch group. | `/api/card/save`, `/api/card/clear-by-branch` | `BranchProductCard`, `AddToCartModal`, `CartDrawer`, `FloatingCartButton` | `tbl_user.card` (JSON) |
| **Checkout** | 1. Checkout requires delivery location; missing location returns `CUSTOMER_LOCATION_REQUIRED`. 2. Branch closure or mismatch returns `BRANCH_CLOSED`/`CART_BRANCH_MISMATCH` preventing transaction creation. 3. Proceeding generates transaction and order references. | `/api/transaction/create`, `/api/branches/[id]/menu`, `/api/order/list` | `/checkout`, `MapConfirm`, `AlertModal` | `tbl_transaction`, `tbl_order`, `tbl_branch` |
| **Payment** | 1. Payment page shows transaction details and available methods. 2. Uploading slip triggers verification; statuses update in UI. 3. Duplicate slip gracefully handled with `DUPLICATE_SLIP`. | `/api/transaction/details`, `/api/payment/index`, `/api/payment/slipok`, `/api/qr/generate` | `/payment/[txnId]`, `SlipUpload`, `MethodPicker`, `DepositModal` | `tbl_transaction`, `tbl_company` |
| **Order tracking** | 1. Account orders tab lists orders sorted by latest. 2. Display status merges order+transaction states via `deriveDisplayStatus`. 3. Map shows branch vs customer positions when coordinates present. | `/api/order/list`, `/api/order/details`, `/api/order/by-transaction` | `/account` (orders tab), `Preparing`, `LocationMap` | `tbl_order`, `tbl_transaction` |
| **Search** | 1. Search results respect query + category filter. 2. Distance sorting when lat/lng provided. 3. Category list displayed with localized names. | `/api/search` | `/search`, `SearchBar`, `BranchList`, `BranchCard` | `tbl_branch`, `tbl_branch_product`, `tbl_product`, `tbl_category` |
| **Slip verification** | 1. Valid slip transitions transaction to `accepted` and updates order to `PREPARE`. 2. Amount mismatch surfaces `AMOUNT_MISMATCH`. 3. Receiver mismatch flagged with `RECEIVER_MISMATCH`. | `/api/payment/slipok` | `/payment/[txnId]`, admin monitors logs | `tbl_transaction`, `tbl_order`, `tbl_company` |
| **Balance top-up** | 1. Deposit modal pre-fills branch/company from latest cart. 2. Creating deposit transaction returns QR data. 3. After slip verification, account balance increases and `txn_history` includes transaction ID. | `/api/transaction/create`, `/api/qr/generate`, `/api/payment/slipok`, `/api/transaction/list` | `Layout` (DepositModal), `/account` transactions tab | `tbl_transaction`, `tbl_user` |

---
## 13. Test Plan

### 13.1 Manual end-to-end scenarios
1. **Signup (email/password):**
   - Open `/login`, switch to Signup tab.
   - Enter new email + password, toggle “Send verification email”.
   - Expect `/api/signup` → 200 `OK`, Redux tokens set, redirect to `/`.
   - Visit `/account` to confirm `is_email_verified = false` until verification.
2. **Google login:**
   - Use Google popup; verify `/api/login` returns user with `provider = google.com` and `is_email_verified = true`.
   - Refresh page to ensure `RequireAuth` hydrates tokens.
3. **Phone OTP:**
   - Trigger OTP, submit code, ensure `/api/signup` with provider `phone` returns `is_phone_verified = true`.
4. **Add to cart & checkout:**
   - Navigate to branch, add item with add-ons.
   - Open cart drawer, adjust quantity, ensure server updates persist after reload (cards loaded from `tbl_user.card`).
   - Proceed to checkout, set location, create transaction, confirm payment page loads with QR code.
5. **Slip upload:**
   - Upload slip via payment page; observe `/api/payment/slipok` status changes. Confirm transaction status transitions to `accepted` and order to `PREPARE`.
6. **Balance top-up:**
   - Open deposit modal, create deposit transaction, verify QR generation. After manual slip verification, confirm balance increments and transaction listed under account transactions.
7. **Account updates:**
   - Update email to new value, ensure verification flag resets; attempt duplicate email to see `DUPLICATE_EMAIL` toast.
   - Link phone with OTP; ensure `is_phone_verified` toggles true.
8. **Search & geolocation:**
   - Search with query and category filter; supply lat/lng via devtools to ensure distance sorting works.

### 13.2 API integration tests (suggested)
- Mock Supabase using `@supabase/supabase-js` client spy or use local test DB.
- Test `/api/login`:
  - Success path with mocked `verifyFirebaseIdToken`, `upsertUser` returning stub user.
  - Missing `idToken` returns `400 BAD_REQUEST`.
- Test `/api/card/save` sanitization (invalid payload, merging with existing card, max qty enforcement).
- Test `/api/transaction/create` for `INVALID_METHOD` and `balance` path.
- Test `/api/payment/slipok` duplicate slip scenario using simulated unique constraint error.

### 13.3 Unit tests
- **Utils:**
  - `tokenStorage` save/load/clear with localStorage mock.
  - `appendIdWithTrim` ensures dedupe and max length for txn/order history.
  - `toBangkokIso` handles null, string, Date inputs.
- **Redux slices:**
  - `authSlice.setUser` normalizes card array.
  - `notificationsSlice.pushNotice` generates ID.
- **Components:**
  - `RequireAuth` renders loader until tokens loaded then renders children.
  - `AddToCartModal` enforces required add-ons (simulate confirm without selections -> blocked).
  - `BranchMenuToolbar` triggers `onSearchChange` after debounce (use fake timers).

### 13.4 Smoke tests / monitoring
- Add health check hitting `/api/hello` returning `HELLO_WORLD` to monitor uptime.
- Monitor SlipOK webhook logs for repeated `INVALID_SIGNATURE` to catch misconfigurations.
- Track Supabase query latency for heavy endpoints (`searchBranches`).

### 13.5 Performance considerations
- Ensure `searchBranches` limit is tuned (default 20) to avoid large payloads.
- Cart drawer operations maintain reselect memoization; inspect React DevTools for rerender counts.
- Payment polling interval should balance timeliness with server load; default 5–10 seconds recommended.

---
