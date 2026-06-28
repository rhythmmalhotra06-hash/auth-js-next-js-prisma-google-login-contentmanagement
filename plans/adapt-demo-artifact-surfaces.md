# Adapt demo-artifact surfaces + world-class configurable tables

## Context
The artifact `dba2cda6` ("Mindvalley Content Portal — Product Demo") is the full-vision clickable
prototype (mirror of `context/mockups/demo.html`). The live React app was built from it, and the
**design language is already at full parity** — every relevant demo class already exists in
[app/globals.css](../app/globals.css) (`.cover-stats`, `.insight`, `.metric-big`, `.spark`/`.sl`/
`.sa`/`.sc`, `.appr`, `.lockbar`, `.future-tag`, `.toolbar`, `.dotgrid`), and the data model already
declares `approvals: ApprovalRow[]`.

So the artifact adaptations are **render-only** (wire demo markup to JSX against existing CSS/types,
honest empty states where data isn't wired — no fabrication). The one genuinely new build is the
**reusable sortable/configurable table** (§5), requested so every list view supports sort-by-any-field
and show/hide columns.

**Design bar (per the front-end design skill):** these are UIs, scanned and operated, not read.
Honor the existing token system (precedence: project system > our choices). Encode state in form
(pills/chips/severity), make interactive controls *look* interactive, keep semantic color (good/warn/
critical) distinct from the `#572280` accent, and give sparklines real care (area fill + faint grid +
emphasized endpoint — the demo's `sparkline()` already does this). No flourish for its own sake;
density and the mandated layout are sacred.

---

## 5. Reusable sortable + configurable tables (the new core)

**Goal:** wherever we show a list/grid, the user can **sort by any field** and **show/hide fields**.

**Hard constraint — CLAUDE.md §7:** the first five columns of every list view must be identical and
first: **Title · Priority · Assigned · Ticket status · Priority status.** Therefore:
- Those five are **locked**: always visible, always first, never hideable.
- Sorting reorders **rows only**, never columns — the mandated header order is preserved under any sort.
- Show/hide applies to **additional** columns. This is a real UX win: fields currently crammed into
  the Title cell's `.t-meta` line (event type, asset type, due date, risk) and detail-only fields
  (requester, official calendar, type of request) can be **promoted to real, sortable columns** on demand.

### 5a. Abstraction — `useTableView` hook + small presentational pieces
New `components/ui/table/`:
- **`useTableView({ columns, storageKey, defaultSort })`** → `{ visible, sort, sortedRows, toggleColumn,
  setSort, reset }`. Owns sort state (tri-state: none → asc → desc → none) and column visibility.
  **Persists per-view to `localStorage`** keyed by `storageKey` (e.g. `tableview:manager-queue`) so a
  user's layout survives reloads; SSR-safe (hydrate defaults, read storage after mount to avoid mismatch).
- **`SortableTh`** — a `<th>` rendered as a `<button>` when `column.sortable`. Shows a chevron:
  35% opacity and revealed on `:hover`/`:focus-visible` when inactive; full-opacity brand chevron
  up(asc)/down(desc) when active; 120ms transition. Sets `aria-sort="ascending|descending|none"`.
  Numeric columns carry `font-variant-numeric: tabular-nums`.
- **`ColumnsMenu`** — a `.btn` trigger ("Columns" + a count badge when any are hidden) opening an
  anchored popover (`role="menu"`, Esc + click-outside to close, focus trapped). One checkbox row per
  column; **locked columns render checked + disabled** with a small lock glyph and "required"
  microcopy; a "Reset to default" text button at the bottom. On narrow screens it becomes a
  full-width bottom sheet.

**Column model** (per table): `{ key, label, sortable?, sortAccessor?, render(row), defaultVisible?,
  locked?, numeric? }`. Status columns sort by **lifecycle order**, not alphabetically — reuse the
  existing `orderIdx` used by the funnel so "In Progress" sorts logically; due date sorts as a date;
  priority sorts by numeric score; risk by level rank (high > watch > none).

### 5b. Apply across list views
- **`QueueTable`** ([components/tickets/QueueTable.tsx](../components/tickets/QueueTable.tsx)) — primary
  surface (manager/editor/stakeholder). Locked 5 + toggleable: Event type, Asset type, Due date,
  Risk, Requester, Type of request. Default sort = priority score desc (today's behavior).
- **Recently shipped** tables on [app/performance/page.tsx](../app/performance/page.tsx) and
  [app/studio/page.tsx](../app/studio/page.tsx) — Title + Made by, sortable.
- **Media inbox** ([app/media/page.tsx](../app/media/page.tsx)) and **ClipBoard table view**
  ([components/vishen/ClipBoard.tsx](../components/vishen/ClipBoard.tsx)) — sort the underlying list
  (clip grid keeps card layout; its sort control reorders the cards; column-visibility is table-only).

### 5c. Motion discipline (avoids the "AI-generated" tell)
The existing row stagger (`fadeIn`, 30ms) plays on **initial mount only**. Do **not** re-animate rows
on every sort/filter — re-staggering on each click reads as janky/over-animated. Sort/filter updates
swap rows instantly; reduced-motion already respected via tokens.

---

## 1. Cover / hero — add the stat row
[app/page.tsx](../app/page.tsx) already renders the hero (`#cover`, eyebrow, `.cover-h1`, sub, CTA,
`.dotgrid`, `.cv` stagger). Add the missing `.cover-stats` row between sub and CTA (`cv cv4`, bump CTA/
dev-login to `cv5`/`cv6`): three `.cover-stat` tiles — `4+ → 1` / "Airtable bases & Jira, unified",
`8` / "lifecycle stages, one queue", `Unlimited` / "external reviewers, no paid seat" (verbatim from
demo). **Skip** `.cover-roles` (demo-only role preview; prod uses real auth).

## 2. Performance — Sparkline + "What's working" insight cards
New `components/ui/Sparkline.tsx` (JSX/SVG port of demo `sparkline()` — gradient area + faint grid +
emphasized end dot; `.spark/.sa/.sl/.sc`) and `components/ui/InsightCard.tsx` (`.insight`/`.insight.warn`,
tone `good|warn`). In [app/performance/page.tsx](../app/performance/page.tsx) `PerformanceInsights`:
a **"What's working"** section under the future banner — real computed signals where derivable, else
one honest `warn` card ("No performance signal connected yet — CTR/ROAS/views arrive once a tracking
source is wired"). Per-row `Sparkline` on Recently shipped **only** when perf data exists.

## 3. Ticket detail — approval rows + decision-lock bar
`ApprovalRow { id, approver, state, feedback, decidedAt, createdAt }` already on
[lib/tickets/data.ts](../lib/tickets/data.ts) (`ticket.approvals`, currently `[]`). New
`components/tickets/ApprovalRows.tsx` renders each `.appr` block (approver · state badge · optional
`feedback` note; `.appr.locked` amber for pending lock) with a `.lockbar` summary above (locked:
"Publishing is locked until {pending approvers} approve" + `.future-tag` "Decision lock"; open:
`.lockbar.open` "All approvals cleared — ready to publish"). Render as a **"Review & approval"** card in
the right rail of [app/tickets/[id]/page.tsx](../app/tickets/[id]/page.tsx), above Lifecycle; empty
state when none.

## 4. Queue filters — search box + legend
In [components/tickets/QueueTable.tsx](../components/tickets/QueueTable.tsx): add `<input
placeholder="Search tickets…">` at the front of the `.filters`/`.toolbar` row (case-insensitive title
match, client-side, composing with the existing select logic and the new sort/visibility), and a small
legend footer under the table (tier key + `.badge b-gold` "needs attention"). Final toolbar reads:
`[ search ] [ filters… ] [ Columns ▾ ] ……… [ N results ]`, wrapping gracefully on mobile.

## State mapping (demo → live `ApprovalRow.state`)
`approved → approved`, `pending → pending`, `changes → changes` (carries `feedback`). Badge tones:
approved=success, pending=neutral, changes/locked=warning.

## Critical files
- Edit: [app/page.tsx](../app/page.tsx), [app/performance/page.tsx](../app/performance/page.tsx),
  [app/studio/page.tsx](../app/studio/page.tsx), [app/tickets/[id]/page.tsx](../app/tickets/[id]/page.tsx),
  [components/tickets/QueueTable.tsx](../components/tickets/QueueTable.tsx),
  [components/vishen/ClipBoard.tsx](../components/vishen/ClipBoard.tsx),
  [app/media/page.tsx](../app/media/page.tsx)
- New: `components/ui/table/useTableView.ts`, `components/ui/table/SortableTh.tsx`,
  `components/ui/table/ColumnsMenu.tsx`, `components/ui/Sparkline.tsx`, `components/ui/InsightCard.tsx`,
  `components/tickets/ApprovalRows.tsx`
- Reuse: existing [app/globals.css](../app/globals.css) classes + `orderIdx` lifecycle ordering,
  `ApprovalRow`, [components/ui/Icon.tsx](../components/ui/Icon.tsx) (chevron/lock icons — add if missing),
  [components/ui/Badge.tsx](../components/ui/Badge.tsx)
- New CSS (only what tokens don't cover): sort-chevron states on `table.list th button`, `ColumnsMenu`
  popover — authored with existing variables (`--brand`, `--border`, `--bg-subtle`, radii, shadows,
  `--ease`). Keep `td` density at 11px 10px; tabular-nums on numeric columns.
- Demo reference markup: `context/mockups/demo.html` (`renderCover`, `sparkline`, `INSIGHTS`, `.appr`,
  `.lockbar`, `.toolbar`).

## Deferred (noted, not in this build)
Drag-grip + rank-number columns / drag-to-reorder queue — a real interactive feature (§5 of the spec),
distinct from sorting; sorting reorders the view, drag persists `queue_rank`.

**Asset library — revisit (Rhythm building in Airtable).** Don't design/wire the Asset library surface
yet; Rhythm is creating the canonical version-stacked library in Airtable. Once that base/table is
settled, model the app's Asset library against it (raw/final version stacking per CLAUDE.md §10) rather
than inventing a structure here. Nav entry (`#/assets` "Asset library") stays as a placeholder.

## Verification
- `npm run dev`:
  - `/manager` → click any header to sort (chevron + `aria-sort` flip asc/desc/none); open **Columns**,
    toggle Event type / Due date / Risk on and off, confirm the locked 5 can't be hidden and stay first;
    reload → sort + column choices persist; **search** filters live; legend renders; rows do **not**
    re-animate on sort. Repeat density check (unchanged) and dark mode.
  - `/` (signed out) → hero 3-stat row, stagger intact, mobile (`max-width:820px`) holds.
  - `/performance` → "What's working" cards; honest empty state when no metric source; sparkline only
    on rows with perf data.
  - `/tickets/[id]` → "Review & approval" card empty today; seed a fake `approvals` row locally to
    confirm `.appr`/`.appr.locked`/`.lockbar` states + badges.
  - Keyboard: Tab to a sort header and Enter/Space sorts; Columns menu opens, arrow/Tab through
    checkboxes, Esc closes; visible focus ring throughout.
- `npm run lint` and `npm run build` clean.
