# Mobile Optimization — Content Portal

## Context

The portal was designed desktop-first. The user wants every route audited and mobile-optimized
for a **375px floor (iPhone SE)** and **390–430px common range**, preserving the existing design
language and desktop layout — **fix, don't rebuild**, UI/CSS layer only, no backend/data/logic
changes. Verify with Playwright screenshots at 375px and 390px after changes.

## What the audit found (code-grounded)

The app is **already substantially mobile-aware**, so the work is surgical, not a rewrite:

- **Shell** (`components/ui/ShellChrome.tsx` + `app/globals.css`): sidebar collapses to a slide-in
  drawer at ≤820px with a working hamburger (`.menu-btn`); `.main{min-width:0}` prevents flex
  overflow; `.content` padding reduces on mobile.
- **Stacking breakpoints already exist** in `globals.css`: `.detail` (900px), `.side`/`.topbar`/
  `.content` (820px), `.datarow` (760px), `.form-grid`/`.grid2` (680px), `.factgrid` (560px).
- **Modals, drawer, and forms do NOT overflow**: `ClipApprovalModal`/`SocialBoard` modal use
  `w-full max-w-lg`; `.modal` is `width:100%;max-width:520px`; `DetailDrawer` is `w-full max-w-[480px]`;
  intake/shoot forms are `max-w-2xl` — all are *maximums* paired with `w-full`, so they shrink to
  the viewport. (The raw audit flagged these as overflow bugs; that was wrong.)
- **Tables** (`table.list`, `min-width:760px`, dynamic widths up to ~1440px) are wrapped in
  `.tscroll` (overflow-x:auto + edge scroll-shadows). Horizontal scroll is the *intended* pattern
  per `DESIGN_SYSTEM.md`, and the mandated 5-column header means we can't drop columns.

### Genuine gaps (confirmed in code)

1. **Topbar crowds/overflows at 375px** (`.topbar`, `globals.css:300`). A single non-wrapping flex
   row with gap:14px holds: hamburger, title+subtitle, spacer, actions, theme button, "New request"
   (icon+text), role-label pill (`.rsw-name`), avatar. At 375px this is too much and can push page
   width. **Highest-impact fix.**
2. **Mobile drawer has no backdrop / no tap-outside-to-close** (`ShellChrome.tsx:33`, `.side.show`).
   It only closes on nav-link click; tapping the content behind it does nothing, and there's no dim
   scrim. No Escape handler.
3. **Sub-44px tap targets on mobile**: `.icobtn` is 36×36 (theme/menu), `.btn.sm` ~28px tall
   ("New request"), nav rows. Below the 44×44 guideline on touch.
4. **Studio pipeline funnel** (`.st-funnel`, `globals.css:948`) is `grid-auto-flow:column` with
   4–5 lanes forced into one row via `minmax(0,1fr)` — shrinks to ~75px/lane at 375px, unreadable
   (no overflow, but cramped).
5. **Stragglers to catch empirically** — a few inline `width:` values and filter rows
   (`.st-launchfilter`, `globals.css:938`, no wrap) that a live 375px render will surface.

## Approach

**Concentrate fixes in the shared shell + `globals.css`** (fixes ~all 35 routes at once), then
patch the handful of page-specific offenders. Use the **existing** breakpoint convention (custom
`@media (max-width: …)` in `globals.css`, matching 820/760/680/560) — do **not** introduce a new
system. Reuse existing tokens/utilities per `DESIGN_SYSTEM.md`; no raw hex, no arbitrary sizes.

### Phase A — Baseline render (before any edit)
Boot the app (`npm run dev`, dev-login), drive Playwright/Chromium at 375px and 390px across every
route, capture baseline screenshots, and log **actual** horizontal-overflow / cramping per page.
This grounds the page-specific list below and catches stragglers (item 5) empirically rather than
from code theory.

### Phase B — Fixes

**Global shell (`ShellChrome.tsx` + `globals.css`) — affects every page:**
- **Topbar declutter at ≤560px** (new `@media` block): hide the role-label pill text (`.rsw-name`),
  hide the topbar subtitle span, reduce gap to ~8px, and let `.tb-title b` truncate with ellipsis
  (`overflow:hidden;text-overflow:ellipsis;white-space:nowrap` — `.tb-title` already has min-width:0).
  Keep the "New request" button as **icon-only** on small screens (hide its text, keep the `+`).
- **Drawer backdrop**: render a scrim `<div>` when `menu` is open (≤820px only) that closes the
  drawer on tap; add an Escape-key handler; keep the existing slide animation. Backdrop uses the
  existing `.scrim`-style dim (or a Tailwind `bg-black/30`), z-index between content (30) and side (90).
- **Tap targets on mobile** (`@media (max-width:820px)`): bump `.icobtn` and topbar `.btn.sm` to a
  ≥44px min hit area (min-height/min-width, keep visual size via padding), and give `.nav` rows
  comfortable touch height. Desktop sizing unchanged.

**Page/section-specific:**
- **Studio funnel** (`.st-funnel`): at ≤680px switch `grid-auto-flow` to a stacked column (rows) or
  make the lane strip horizontally scrollable in a `.tscroll`-style wrapper, so lanes stay legible.
  Files: `app/globals.css`, verify against `components/studio/PipelineFunnel.tsx`.
- **Filter/toolbar rows** that don't wrap (`.st-launchfilter` and any surfaced in Phase A): add
  `flex-wrap:wrap`.
- **Login `/` + `/access-denied`** (public, outside AppShell): confirm the `#cover`/sign-in card
  centers and fits 375px; fix any fixed width found in Phase A.
- **Any inline `width:` / cramped grid** surfaced by the baseline render (e.g. `app/performance`,
  `app/media` label cells) — convert to responsive/max-width only where it causes overflow.

**Tables (decided — designer's call):**
- **`QueueTable` → stacked card view below 560px.** This is the shared component behind ~10 of the
  highest-traffic routes (`/editor`, `/manager`, `/tickets`, `/stakeholder`, `/studio/ranking`,
  `/studio/launches`, `/studio/launches/[event]`, `/studio/shipped`, `/performance`'s shipped table).
  Fixing it once lifts every one. Below 560px each row renders as a card: **Title** as the heading,
  then the four mandated fields (**Priority, Assigned, Ticket Status, Priority Status**) as
  label/value rows, reusing the existing `TierBadge`/`TicketStatusBadge`/`PrioStatusBadge` chips —
  no new data, no logic change, tap target = whole card. Desktop table markup untouched (the card
  layout is a `≤560px` presentation of the same rows).
- **Keep horizontal-scroll (`.tscroll`) for the denser secondary grids** — `ShootsBoard`,
  `ContentReviewQueue`, and the `scoring`/`social`/`vishen` tables. These are spreadsheet-like with
  many editable columns where a card reflow *would* be a rebuild; the design system already endorses
  scroll-in-container here. Just ensure they scroll inside their box and never push page width.

**Explicitly NOT changing:**
- Any desktop layout, spacing, or the ≥820px experience.
- Backend, data fetching, server actions, or any committed/live fields.

### Phase C — Verify
Re-render with Playwright at **375px and 390px**, capture after-screenshots for every page touched
(all routes, since shell fixes are global), and hand them back for review. Run `npm run lint`.
Fold any new responsive rule into `DESIGN_SYSTEM.md` (per repo convention) in the same pass.

## Route inventory (all surfaces audited)

Auth/public: `/`, `/access-denied`.
Role surfaces: `/editor`, `/manager`, `/tickets`, `/tickets/[id]`, `/stakeholder`, `/stakeholder/[id]`.
Intake: `/intake`, `/intake/creative`.
Shoots: `/shoots`, `/shoots/new`, `/shoots/[id]`.
Studio: `/studio`, `/studio/ranking`, `/studio/launches`, `/studio/launches/[event]`,
  `/studio/sign-off`, `/studio/shipped`, `/studio/shoots`, `/studio/shoots/[id]`.
Media/clips: `/media`, `/media/new`, `/media/[id]`, `/vishen`.
Social: `/social`, `/social/new`.
Performance: `/performance`.
Settings (admin): `/settings/team`, `/settings/asset-types`, `/settings/clip-rules`, `/settings/scoring`.
(Plus `/content-engine*` → redirects, no UI.)

All authenticated routes render through `AppShell` → `ShellChrome`, so the shell fixes above cover
every one of them; page-specific work is only the funnel, filter rows, login, and any Phase-A straggler.

## Critical files
- `components/ui/ShellChrome.tsx` — topbar declutter, drawer backdrop + Escape, mobile tap targets.
- `app/globals.css` — new `@media (max-width:560px)`/`(max-width:680px)` rules for topbar, funnel,
  `.icobtn`/`.btn.sm` sizing, filter-row wrap; reuse existing breakpoint ladder.
- `components/tickets/QueueTable.tsx` — add the ≤560px stacked-card presentation of existing rows.
- `components/studio/PipelineFunnel.tsx` — verify markup supports the funnel stack/scroll.
- `app/page.tsx`, `app/access-denied/page.tsx` — public pages, confirm fit.
- `DESIGN_SYSTEM.md` — record the mobile rules added.

## Verification
- Baseline + after Playwright screenshots at 375px and 390px for every route (Phase A / C).
- Manual check per page: no horizontal page scroll; body text ≥14px; tap targets ≥44px on mobile;
  drawer opens/closes via hamburger, backdrop tap, and Escape; tables scroll within `.tscroll` only.
- `npm run lint` clean.
