# AGENT_PATTERN.md

> Visual & interaction rules for FoodieGo (delivery-app vibe).  
> Follow this guide when creating UI, colors, spacing, and states to keep the app consistent.

---

## Brand & Color

We lean into **fresh-dining** colors:
- **Primary**: Emerald (Tailwind `emerald` palette)
    - Use for accents, focus rings, subtle backgrounds.
- **Secondary**: Amber/Orange (Tailwind `amber` palette)
    - Use for promotional tags, highlights, warnings.
- **Neutrals**: Slate/Stone (`slate` palette)
    - Use for text, borders, surfaces.

**Examples (Tailwind classes)**
- Text: `text-slate-900`, `text-slate-600`, `text-slate-500`
- Borders: `border-slate-200`
- Surfaces: `bg-white`, `bg-slate-50`, `bg-emerald-50/60`
- Focus ring: `focus:ring-emerald-100 focus:border-emerald-400`
- Accent chips: `bg-emerald-100 text-emerald-800`, warnings: `bg-amber-100 text-amber-800`
- Alerts: success `bg-emerald-50 border-emerald-200 text-emerald-700`, error `bg-rose-50 border-rose-200 text-rose-700`

Avoid hardcoding hex unless necessary; prefer Tailwind tokens for consistency.

---

## Radii, Shadows, Spacing

- **Radii**: default `rounded-xl`, large containers `rounded-2xl`–`rounded-3xl`
- **Shadows**: `shadow-sm` for cards; avoid heavy shadows
- **Spacing**: 4/8 px scale via Tailwind (`p-2`, `p-4`, `p-6`, `gap-4`, `gap-6`)

---

## Typography

- Headings: bold, tight tracking
    - H1: `text-4xl font-extrabold`
    - H2: `text-lg font-semibold`
- Body: `text-slate-700/600`
- Microcopy: `text-xs text-slate-500`

---

## Components

### Card
- Container: `bg-white border border-slate-200 rounded-2xl shadow-sm`
- Inner padding: `p-4 md:p-6`

### Buttons
- **Primary (brand)**: for key actions
    - `bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-4 py-2`
- **Secondary (surface)**: for neutral actions
    - `bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 rounded-xl px-4 py-2`
- **Ghost**: text-only, small emphasis
    - `hover:bg-slate-50 rounded-lg px-3 py-1.5`

**States**
- Add `active:scale-[0.99]` for press feedback
- Disabled: `disabled:opacity-60 disabled:cursor-not-allowed`

### Inputs
- `rounded-xl border border-slate-200 px-3 py-2`
- Focus: `focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400`
- Include labels (even visually minimal): `<label class="text-xs text-slate-500">`

### Tabs (Segmented)
- Container: `flex bg-slate-100 rounded-2xl p-1`
- Segment button:
    - Active: `bg-white shadow-sm border-slate-200`
    - Inactive: `bg-transparent hover:bg-white/60 border-transparent`
- Use `aria-pressed` on buttons

### Chips
- Verified: `inline-flex rounded-full px-2 py-0.5 text-xs bg-emerald-100 text-emerald-800`
- Unverified: `bg-amber-100 text-amber-800`

### Alerts
- Success: `bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-3`
- Error: `bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3`

---

## Interaction & Motion

- Subtle only. Use:
    - `hover:bg-*`, `active:scale-[0.99]`
    - Avoid large/constant animations
- For loading:
    - simple spinner: `<span class="animate-spin h-4 w-4 rounded-full border-2 border-slate-300 border-t-transparent" />`

---

## Accessibility

- Always label inputs with `<label for="...">`.
- Provide visible focus states (`focus:ring-*`).
- Use `aria-pressed` for toggle/tab buttons.
- Ensure contrast: dark text on light backgrounds.
- Button text should be verbs (“Sign in”, “Create account”, “Confirm”).

---

## Layout

- Typical page container: `max-w-4xl mx-auto px-4`
- Vertical rhythm: header → card → footer microcopy
- Use responsive grids: `grid md:grid-cols-2 gap-4`

---

## Icons

- Prefer **inline SVG** for common logos (e.g., Google “G”).
- Avoid pulling new icon libraries unless necessary. If you must, prefer lightweight packages.

---

## Code Style & File Boundaries

- Components: functional React + TypeScript
- Keep business logic out of components; UI only
- Shared helpers in `src/utils/*`
- Keep imports via path aliases (`@utils/*`, `@components/*`, etc.)
- Name components by role (e.g., `RequireAuth`, `AuthBootstrap`, `AccountCard`)

---

## Patterns

- **i18n first**: import `{ useI18n }` and `I18N_KEYS`, then render copy via `t(I18N_KEYS.YOUR_KEY)`. Never hardcode user-visible strings.
- **Container vs presentational**: pages (`pages/*.tsx`) own data fetching, effects, and handlers; UI lives in `src/components/**` with typed props.
- **Props over global state**: keep presentational components stateless. Pass callbacks/data down instead of re-fetching inside.
- **Debounced inputs**: keep the raw input value in local state, then `useEffect` + `setTimeout(…, 300)` to push the debounced value into router/query params before fetching.
- **Pagination containers**: compute `totalPages` in the container, clamp page bounds there, and pass `{ page, size, total }` into toolbar/grid components; they should only render controls.
- **Testing**: for RTL/Jest snapshots that depend on copy, call `setLocale("th")`/`setLocale("en")` from `utils/i18n` before rendering to stabilise expectations.

```tsx
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";

const EmptyState = () => {
    const { t } = useI18n();
    return <p className="text-sm text-slate-500">{t(I18N_KEYS.SEARCH_EMPTY)}</p>;
};
```

---

## Don’ts

- Don’t mix different color palettes per page.
- Don’t use heavy shadows or gradients on every element.
- Don’t remove focus styles.
- Don’t hardcode JWTs or secrets in components.

---

## Example Snippets

**Input**
```tsx
<label htmlFor="email" className="text-xs text-slate-500">Email address</label>
<input id="email" type="email" className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400" />
