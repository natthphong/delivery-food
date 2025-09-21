

## 0) What this app is

* A **Next.js** 15 + **TypeScript** app styled with **Tailwind**, using **Firebase Auth** (Email/Password, Google, Phone/OTP).
* Server issues our own **JWT access token** + **refresh token**; user data is in **Postgres** (`tbl_user`).
* **Protected routes** are enforced client-side via `RequireAuth` and tokens are persisted in **Redux + localStorage**.
* Inspiration: delivery food apps (Grab/Foodpanda/Gojek) — we ship a clean Login/Signup page and an Account page.

---

## 1) Project layout

```
.
├── app/                             # App router assets (favicon, fonts, layout)
├── env_example                      # Example env file(s)
├── public/                          # Static assets
├── sql/
│   └── V1_tbl_users.sql             # Migration to create user table
├── src/
│   ├── components/
│   │   ├── Layout.tsx               # Page shell
│   │   ├── Navbar.tsx               # Top nav
│   │   ├── RequireAuth.tsx          # Client-side route guard (+ hydration from localStorage)
│   │   ├── i18n/
│   │   │   └── LocaleSwitcher.tsx   # EN/TH toggle (writes ?lang= and localStorage)
│   │   ├── account/
│   │   │   ├── ProfileCard.tsx      # Account overview (provider/email/phone rows)
│   │   │   └── VerifyUpdateCard.tsx # Email/phone verification + updates
│   │   └── search/
│   │       ├── BranchCard.tsx
│   │       ├── BranchList.tsx
│   │       └── SearchBar.tsx
│   ├── config/
│   │   └── index.json               # EN/TH translation dictionary
│   ├── constants/
│   │   └── i18nKeys.ts              # Centralised i18n key exports
│   ├── pages/
│   │   ├── _app.tsx                 # Wrap all pages; gate every route except /login
│   │   ├── api/
│   │   │   ├── login.ts             # POST /api/login (verify Firebase ID token → upsert → JWTs)
│   │   │   ├── refresh-token.ts     # POST /api/refresh-token (rotate refresh + new access)
│   │   │   ├── signup.ts            # POST /api/signup (password/phone/google)
│   │   │   ├── hello.ts             # Sample (unused)
│   │   │   └── user/
│   │   │       ├── me.ts            # GET /api/user/me (protected)
│   │   │       └── send-verify-email.ts # POST /api/user/send-verify-email
│   │   ├── account.tsx              # Account details page (email/phone, verify actions)
│   │   ├── index.tsx                # Example protected page
│   │   ├── leave.tsx                # Example protected page
│   │   ├── login.tsx                # Combined Login/Signup with tabs
│   │   └── render.tsx               # Example protected page
│   ├── repository/
│   │   └── user.ts                 # DB access for tbl_user (upsert & return record)
│   ├── store/
│   │   ├── authSlice.ts             # Redux slice: access/refresh tokens
│   │   └── index.ts                 # Store setup + typed hooks
│   ├── utils/
│   │   ├── apiClient.tsx            # Axios instance + refresh-once interceptor
│   │   ├── authMiddleware.ts        # withAuth() for protected API routes (JWT verify)
│   │   ├── supabaseServer.ts        # Supabase server client (https) for repositories
│   │   ├── externalApiClient.tsx    # (optional) other APIs
│   │   ├── firebaseClient.ts        # Firebase Web SDK (client-side)
│   │   ├── firebaseRest.ts          # Identity Toolkit REST helper (server-side)
│   │   ├── firebaseVerify.ts        # Verify Firebase ID token via JWKS (no Admin SDK)
│   │   ├── i18n.ts                  # Locale resolution + translation helper/hook
│   │   ├── jwt.ts                   # sign/verify JWT, in-memory refresh tokens (demo)
│   │   ├── logger.ts                # Safe console logger with redaction
│   │   └── tokenStorage.ts          # Save/load/clear tokens in localStorage
│   └── styles/
│       └── globals.css
├── next.config.ts                   # No invalid top-level "rules"
├── tailwind.config.js
├── tsconfig.json                    # Path aliases (@/ @utils etc) + moduleResolution
└── package.json
```

* **Account & Search containers**: `pages/account.tsx` and `pages/search.tsx` orchestrate data fetching/state, then render the presentational components in `src/components/account/*` and `src/components/search/*`.
* **Locale switcher**: the navbar mounts `components/i18n/LocaleSwitcher`, which toggles between EN/TH and persists the choice.

### Localization quickstart

* Translations live in `src/config/index.json` and are typed via `src/constants/i18nKeys.ts`. Only keys declared in that file can be passed to `t(...)`.
* Locale resolution order: query string `?lang=th|en` (and persisted to `localStorage.locale`), then existing `localStorage` value, then `navigator.language` (Thai → `th`, everything else → `en`). Server default is `en`.
* Use the helper from `src/utils/i18n.ts`:

  ```tsx
  import { useI18n } from "@/utils/i18n";
  import { I18N_KEYS } from "@/constants/i18nKeys";

  const Component = () => {
      const { t } = useI18n();
      return <span>{t(I18N_KEYS.COMMON_LOADING)}</span>;
  };
  ```

* Adding a string: update both `index.json` and `i18nKeys.ts`, then replace hard-coded copy with `t(I18N_KEYS.YOUR_KEY)`.
* To verify the switcher: load any page, append `?lang=th` or `?lang=en`, or toggle using the navbar control. The selection is persisted across navigations.

---

## 2) Environment variables

Create `.env.local` at repo root (copy from `env_example` if present):

### Supabase (HTTPS client)

```
NEXT_PUBLIC_DELIVERY_NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_DELIVERY_SUPABASE_SERVICE_ROLE_KEY=replace_with_project_service_role_key
```

> These envs are used server-side via `supabaseServer.ts`. Configure them for both **Preview** and **Production** deployments.

### JWT

```
JWT_SECRET=replace_with_long_random_value
JWT_EXPIRES_IN=900                # seconds (15m)
REFRESH_TOKEN_EXPIRES_IN=604800   # seconds (7d)
```

### Firebase (client config)

```
NEXT_PUBLIC_FIREBASE_API_KEY=REPLACE_ME
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=REPLACE_ME.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=REPLACE_ME
```

> Phone Auth on Firebase **free** plan requires **test numbers** (Authentication → Phone → “Phone numbers for testing”). Otherwise you’ll see `auth/billing-not-enabled`.

---

## 3) Database schema (expected)

`sql/V1_tbl_users.sql` should create:

```sql
CREATE TABLE IF NOT EXISTS tbl_user (
  id SERIAL PRIMARY KEY,
  firebase_uid TEXT UNIQUE NOT NULL,
  email TEXT,
  phone TEXT,
  provider TEXT,
  is_email_verified BOOLEAN NOT NULL DEFAULT false,
  is_phone_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tbl_user_uid ON tbl_user(firebase_uid);
```

---

## 4) Auth model (how it works)

### Providers

* **Email/Password** (Firebase)
* **Google** (Popup)
* **Phone/OTP** (signInWithPhoneNumber)

### Server-issued tokens

* **Access token** (JWT, short-lived) — sent in `Authorization: Bearer <access>`.
* **Refresh token** (opaque random) — rotated server-side **in-memory** (demo).

  > For production, persist refresh tokens in a DB table; this repo keeps it simple.

### Token persistence

* Tokens stored in **Redux** *and* in **localStorage** (`auth_tokens_v1`).
* `RequireAuth` **hydrates** Redux from localStorage **before** deciding to redirect; prevents post-login loop.

### Flow: Login/Signup (overview)

```
[Client UI] -> Firebase sign-in -> get idToken
            -> POST /api/login (or /api/signup)
Server: verify idToken via JWKS -> upsert tbl_user -> issue {access, refresh}
Client: save tokens to Redux + localStorage -> router.replace("/")
```

### Refresh logic (client)

* Axios interceptor: on 400/401 from protected API, call `/api/refresh-token` once, save tokens, retry request, otherwise redirect `/login`.

---

## 5) API contracts

### `POST /api/login`

**Body**

```json
{ "idToken": "FIREBASE_ID_TOKEN" }
```

**Response 200**

```json
{
  "message": "Login success",
  "accessToken": "JWT",
  "refreshToken": "opaque",
  "user": {
    "id": 1,
    "email": "x@y.com",
    "phone": null,
    "provider": "google.com",
    "is_email_verified": true,
    "is_phone_verified": false
  }
}
```

### `POST /api/signup`

**Password mode**

```json
{ "provider": "password", "email": "x@y.com", "password": "pass", "sendVerifyEmail": true }
```

**Google/Phone mode**

```json
{ "provider": "google" | "phone", "idToken": "FIREBASE_ID_TOKEN" }
```

**Response 200** – same shape as `/api/login`.

### `POST /api/refresh-token`

```json
{ "refreshToken": "opaque" }
```

**Response 200**

```json
{ "accessToken": "JWT", "refreshToken": "ROTATED_OPAQUE" }
```

### `GET /api/user/me`  (protected)

**Headers**

```
Authorization: Bearer <accessToken>
```

**Response 200**

```json
{ "user": { "id": 1, "email": "...", "phone": "...", "provider": "...", "is_email_verified": true, "is_phone_verified": false } }
```

### `POST /api/user/send-verify-email`

**Body**

```json
{ "idToken": "FIREBASE_ID_TOKEN" }
```

**Response**

```json
{ "ok": true }
```

---

## 6) Client pages

### `/login` (combined Login/Signup)

* Tabs (`login`/`signup`)
* Email/Password form
* Continue with Google
* Phone OTP (send/confirm)
* **On success:** save tokens `{access,refresh}` to Redux + localStorage, `router.replace("/")`.

### `/account`

* Shows `email`, `phone`, `provider`, with “Verified / Not verified” chips.
* Actions:

    * **Resend verification email**: calls `/api/user/send-verify-email` with Firebase **idToken** (from current user).
    * **Change email**: uses `updateEmail` (Firebase) then hits `/api/login` again to restamp user & tokens.
    * **Link phone**: `linkWithPhoneNumber` → confirm OTP → `/api/login` to restamp.

### Guarding routes

* `_app.tsx` wraps **all** pages inside `RequireAuth` **except** `/login`.
* `RequireAuth`:

    1. Hydrates Redux from localStorage once.
    2. Persists Redux → localStorage on changes.
    3. Redirects to `/login` only after hydration if no token.

---

## 7) Path aliases (TypeScript)

`tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    ...
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@utils/*": ["src/utils/*"],
      "@store/*": ["src/store/*"],
      "@repository/*": ["src/repository/*"],
      "@components/*": ["src/components/*"],
      "@pages/*": ["src/pages/*"]
    }
  },
  "include": ["next-env.d.ts", "next.config.ts", "app/**/*.ts", "app/**/*.tsx", "src/**/*.ts", "src/**/*.tsx", ".next/types/**/*.ts"]
}
```

> If IDE (WebStorm) flags “Corresponding file is not included” or unresolved imports, either use project TS ≥ 5.3 with `"moduleResolution": "bundler"`, **or** switch to `"nodenext"` for compatibility.

---

## 8) Build & run

```bash
# install
npm i

# dev
npm run dev

# prod build
npm run build
npm start
```

---

## 9) Testing

### Manual test plan

1. `/login` → Signup (email/pw) → lands on `/` → **localStorage** has `auth_tokens_v1`.
2. Reload `/` → still logged in (hydration works).
3. Try Google login → `/` (ok).
4. Phone OTP with **Firebase test numbers** (free plan) → `/` (ok).
5. `/account`:

    * Resend verify email → success message.
    * Link phone with OTP → refreshed flags on page.
6. Interceptor: when access token expires (short TTL), a protected fetch should **refresh once** and retry.

### Unit tests (Jest)

* `tokenStorage` save/load/clear
* `authSlice` setTokens/logout
* `RequireAuth`:

    * Hydrates from localStorage and renders children when tokens exist
    * Redirects to `/login` when no tokens after hydration
* `/api/login`: 200 happy path; 400 when missing idToken (mock `firebaseVerify`, `user`, `jwt`)

See example spec files:

```
src/utils/__tests__/tokenStorage.test.ts
src/store/__tests__/authSlice.test.ts
src/components/__tests__/RequireAuth.test.tsx
src/pages/api/__tests__/login.test.ts
```

`jest.config.ts` includes path mappers for `@/*` aliases.

---

## 10) Coding conventions

* **Controllers** (API routes): validate, orchestrate repositories & utils, and return DTOs. No DB logic here.
* **Repositories**: call Supabase tables; map/compose results server-side.
* **Utils**:

    * `firebaseVerify` uses JWKS validation via `jose` (no Admin SDK).
    * `jwt.ts`: keep demo in-memory refresh tokens; if production, switch to DB persistence.
    * `supabaseServer.ts`: creates the HTTPS Supabase client from env vars (no session persistence).
* **Logging**: `logger.ts` redacts secrets/JWTs.
* **UI**: Tailwind; rounded `2xl`, soft borders/shadows; accessible buttons/labels.

---

## 11) Troubleshooting

* **Redirected back to /login after login**
  Make sure login/signup code calls `dispatch(setTokens(...))` **and** `saveTokens(...)`, and uses `router.replace("/")`. Ensure `RequireAuth` hydrates from localStorage before redirecting.

* **`getaddrinfo ENOTFOUND base`**
  Supabase envs are placeholders. Set real `NEXT_PUBLIC_DELIVERY_NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_DELIVERY_SUPABASE_SERVICE_ROLE_KEY` values.

* **`Invalid next.config.ts options: Unrecognized key(s) 'rules'`**
  Remove top-level `rules`. Add loaders via `webpack(config) { config.module.rules.push(...); }`.

* **WebStorm “Cannot resolve symbol” / “Corresponding file is not included”**
  Use project TS ≥ 5.3 with `"moduleResolution": "bundler"`, or switch to `"nodenext"`. Ensure `include` covers `app/**` and `src/**`.

* **Phone OTP: `auth/billing-not-enabled`**
  Add test phone numbers in Firebase Console (Authentication → Phone → Testing numbers) or enable billing (Blaze).

* **Google popup returns 400 from /api/login**
  Usually Firebase client config mismatch. Verify `NEXT_PUBLIC_FIREBASE_*` and that Google Sign-in is enabled.

---

## 12) Extending the app (playbook for agents)

* **Add a protected API**: create `pages/api/<path>.ts`, wrap with `withAuth`, read `(req as any).auth.userId`, call repository, return JSON.
* **Add a DB access method**: implement in `src/repository/*`, accept typed params, return typed records. No process.env here.
* **Add a page requiring auth**: create `pages/<name>.tsx`. It’s **auto-guarded** by `_app.tsx` (except `/login`). Use `apiClient` for backend requests.
* **Public page** (no auth): either add to `_app.tsx` allowlist (`/login`), or handle per-page flag to skip guard.

---

## 13) Security notes (for future improvements)

* Store refresh tokens in DB with rotation, user agent & IP binding, and revoke list.
* Serve tokens via **HttpOnly, SameSite=strict** cookies from server (CSRF defense with anti-CSRF token).
* Add server rate-limits for `/api/login`, `/api/signup`, OTP actions.
* Sanitize/validate inputs (e.g., Zod).
* Add CORS/proxy rules if exposing external services.

---

## 14) Quick API examples

**Login with Google (client)**

```ts
const cred = await signInWithPopup(auth, googleProvider);
const idToken = await cred.user.getIdToken();
const r = await axios.post("/api/login", { idToken });
```

**Signup with password (client)**

```ts
const r = await axios.post("/api/signup", { provider: "password", email, password, sendVerifyEmail: true });
```

**Protected fetch**

```ts
const r = await axios.get("/api/user/me"); // Authorization added by interceptor
```

---

## 15) Contacts

* **DB owner**: `src/utils/supabaseServer.ts`
* **Auth owner**: `src/utils/firebaseVerify.ts`, `src/utils/jwt.ts`, `src/components/RequireAuth.tsx`
* **API surface**: `src/pages/api/*`

> If you’re an agent implementing a new feature, *stick to these boundaries*, reuse helpers, keep responses consistent with existing DTO shapes, and update this document if you change conventions.

---

