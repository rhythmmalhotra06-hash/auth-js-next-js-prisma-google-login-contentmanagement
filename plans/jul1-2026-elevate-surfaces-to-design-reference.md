# Elevate Content Studio surfaces to the reworked design reference

## Context

`Content Studio.dc.html` (with `README.md`) is a **reworked, high-fidelity visual system** that
Claude Design produced to unify the app's surfaces — one cohesive shell with consistent hierarchy,
spacing, copy, KPIs, tables, and chips. The live app already implements every surface and every
FIXED product rule (5-column table, two status axes, tier chips, intake chain, dark mode) against
the repo's real `--mv-*` tokens. So this is an **elevation pass, not a rebuild**: bring each existing
surface up to the reference's layout/hierarchy/copy, sourcing the repo's tokens and `components/ui/*`
primitives (the reference's placeholder hex/`--brand` values are NOT to be copied — `README.md`
"Design tokens — mapping" is already satisfied by `app/globals.css`).

**Decisions locked with the user:**
- Scope = **all app surfaces** (the 6 reference surfaces + `/media`, `/social`, `/performance`, `/settings/*`).
- **Skip the Asset Library** surface — the canonical library lives in Airtable (prior decision). The reference's "Asset library" card grid is NOT built; `/media` still gets a polish pass.
- **Studio** = polish + apply reference visual language, **keep existing sections** (media→clips, launches, shipped).
- **Nav** = keep the app's grouped, role-scoped nav; apply the reference's brand-lockup / footer / spacing polish.
- **Ask before removing or adding any section** (user instruction) — see "Confirm-first" tags below.

## Constraints (the README FIXED list — do not violate)

1. Six surfaces + shared shell, unchanged in flow.
2. Mandated 5-column header, identical order on every list view: **Title · Priority · Assigned · Ticket status · Priority status**. Views may only *append* columns after the five.
3. Two status axes stay visually distinct (`TicketStatusBadge` vs `PrioStatusBadge`) — never merged.
4. Intake conditional chain: Event → filters Asset → auto-fills team lead / preferred editor / dimensions / category as locked read-only lookups. No Priority/Assignee on the form.
5. Event-tier color coding (`.tier high/mid/soc/low`) keeps meaning on rows and chips.
6. Restraint: no gradients-as-decoration, no glows, no emoji in product chrome, purple = brand/active/links, gold = attention only (one attention element per screen).

## Working rules for every surface

- **Load the `artifact-design` skill before starting UI work** (per project memory) and honor `DESIGN_SYSTEM.md`.
- Reuse `components/ui/*` and the ported `globals.css` classes first; use token utilities, never raw hex or arbitrary sizes; inline `style` only for genuinely dynamic values (`--i`, computed widths).
- Verify **light AND dark** for each surface before moving on.
- If any design feedback surfaces, fold it into `DESIGN_SYSTEM.md` + memory in the same turn.
- **Confirm-first** any item tagged ⚠ below (it adds/removes a section or introduces data we don't yet have).

---

## Phase 0 — Shared groundwork

**`app/globals.css`** — add the few reference primitives the design system is missing:
- **Row-level tier accent** for queue rows: a `tr.tier-high/mid/soc/low` (or a `--row-accent` var) rendering `box-shadow: inset 3px 0 0 <tier-ink>`. Today `QueueTable` only marks unassigned rows with `.attn`; the reference wants a tier-colored 3px left rule on every row.
- **`.assign-pill`** — the inline gold-outline "Assign" button for unassigned manager rows (compose from existing `.btn.sm.gold`/`b-gold` if it fits; only add if needed).
- **Cockpit "Live & performing"** solid-brand summary card + **channel dot** helper, if not expressible with existing classes.
- Reuse as-is (already present, confirmed in `globals.css`): `.grip`, `.score`, `.due.soon/mid/far`, `.tier.*`, `.kpi(.alert/.danger/.attention)`, `.badge` families, `.assetcard`, `.clip*`, `.autofill`, `.form-grid`, `.field-row`, `.lock`, `.st-*`.

**Shell polish — `components/ui/ShellChrome.tsx` + `.side/.brand/.nav/.side-foot` in `globals.css`:**
- Keep `groupNav()` grouping and role gating. Match the reference's brand lockup (purple rounded square + play glyph + gold spark — `.brand-mark::after` already does the spark), "Workspaces"-style group labels, count pips (`.nav .pip` exists — wire queue/my-queue/cockpit counts if cheap, else leave), and the "Synced from Airtable" footer (already present).
- `Sidebar.tsx` is **legacy/unused** (emoji nav, "Content Engine") — do not spend time on it; the live shell is `ShellChrome`. ⚠ Confirm before deleting it.

---

## Phase 1 — Manager (`/manager` + `components/tickets/QueueTable.tsx`)

Reference: 5 KPI cards, toolbar (search + filters + Auto-rank), table with **grip + rank #** columns then the 5 mandated columns, per-row tier left accent, warn-bg fill + inline **Assign** pill on unassigned rows, legend below.

- KPIs: keep the 4 current (`In queue`, `Unassigned` gold-alert, `Due ≤3d` danger, `In review`). ⚠ Reference adds a 5th **"Blocked"** — confirm before adding (needs a "blocked" signal we may not track).
- `QueueTable`: apply the per-row **tier accent** (Phase 0). Keep the existing filters/search/columns-menu/funnel-chips — richer than the reference toolbar; they stay. Map the reference's "Auto-rank" to the existing behavior or ⚠ confirm if a new action is wanted.
- ⚠ Reference **rank `#` column + drag grip** (manual `queueRank` override). `.grip` and `editableRank` already exist; wiring drag-to-reorder is a real feature add — confirm scope (visual grip only vs. functional reorder).
- ⚠ Inline **"Assign" pill** on unassigned rows — confirm (adds an inline assignment control to the table).
- Restyle only otherwise: `ApprovedClipsSection` and `FunnelCapacity` stay.

## Phase 2 — Editor (`/editor`)

Reference: hero "Next up" card (brand border, due chip, title, tier+meta, **3 fact tiles CTA/Positioning/Audience**, action row: View brief & DNA · Source material · ticket-status Select · Upload final), then mini "Up next" table with the 5 columns (priority read-only).

- Elevate the existing next-up `card` to the reference hero: add the 3 read-only fact tiles and the due chip; keep it linking to `/tickets/[id]`.
- ⚠ Inline **ticket-status Select** and **Upload final** directly on the hero card — confirm (today these live on the ticket detail page; adding them here is a new inline control). Default: keep "Open brief"/"Upload asset" links unless confirmed.
- Mini queue table: reuse `QueueTable` (already 5 columns; priority already read-only here). No structural change.

## Phase 3 — Stakeholder (`/stakeholder`)

Reference: 4 KPIs (Published / In production / Avg CTR / Avg ROAS), table = 5 mandated columns **+ Channel · CTR · ROAS**, read-only footer.

- Keep the existing scope switch (mine/team/campaign/all) — an app feature beyond the reference; retain it.
- KPIs: keep current (Open / In production / Delivered). ⚠ Reference's **Avg CTR / Avg ROAS** KPIs need performance data that is **not yet wired** (blocked on data source per memory) — confirm before adding; otherwise omit or scaffold as "—".
- ⚠ Appended **Channel · CTR · ROAS** columns: add as optional `QueueTable` columns rendering "—" until performance is wired, or defer — confirm.
- Add the read-only footer line ("Read-only · comment access only. Performance keyed from Clarisights / Amplitude").

## Phase 4 — Studio / Vishen cockpit (`/studio` + `components/studio/*`)

Polish + reference visual language, **keep all existing sections**.

- Header: apply the reference's **accent-line header** (3px gold left rule + brand overline + bold title) to the studio hero.
- Pipeline: `PipelineFunnel` already renders stage cards — restyle to the reference's top-accent-bar stage cards (In production=brand, Awaiting sign-off=gold, Ready to publish=blue). ⚠ Reference shows a 4th **"Published"** stage that was deliberately removed (recent commits) — do NOT re-add.
- ⚠ Add the reference's **"Live & performing"** solid-purple summary card (Total views / Avg engagement / Published + top performer) — needs performance/engagement data not yet wired; confirm before adding (scaffold with real counts + "—" for view metrics, or defer).
- "The full thread" table: the existing `/studio/launches` + review surfaces cover this; if elevating the on-page thread table, render **Priority as 5-star** (`StarRating` exists) and append **Channel (colored dot) · Live link**. ⚠ Confirm whether to add this table to the main `/studio` page vs. leaving it in sub-routes.
- Keep media→clips, awaiting-sign-off, launches, recently-shipped sections; ask before dropping any.

## Phase 5 — Intake (`/intake` + `/intake/creative` + `components/intake/IntakeForm.tsx`)

Reference: single centered ~600px card, ordered Event → Asset (filtered) → locked auto-fill block (team lead / preferred editor / dimensions / category) → Title → Creative brief → CTA + Positioning → Audience + Due date → backend-handles-priority note → Cancel / Submit.

- The chain + `.autofill` locked block + `.form-grid` already exist. Verify field order matches the reference exactly and the auto-fill block reads as locked (`.lock`).
- Keep the `/intake` two-path chooser (Creative vs Shoot) — an app feature; polish its cards to reference spacing. The reference only shows the creative form; the chooser is a superset, retain it.
- Add the "priority/assignee handled by backend" helper note if missing.

## Phase 6 — Consistency pass on extra surfaces (`/media`, `/social`, `/performance`, `/settings/*`)

Not in the reference, but in scope ("all app surfaces"). **Visual consistency only** — align headers (`.sec-head`/eyebrow), KPI grids, card/table styling, spacing, and dark-mode to the elevated language. No structural/section changes without ⚠ confirm. `/media` uses the existing `.clip`/`.mrow` card language already.

---

## Execution order

Phase 0 (groundwork) → 1 → 2 → 3 → 4 → 5 → 6. Do one surface at a time, verify light+dark, pause at each ⚠ to confirm before adding/removing a section or introducing unavailable data.

## Critical files

- Shell: `components/ui/ShellChrome.tsx`, `components/ui/AppShell.tsx`, `lib/roles.ts` (`groupNav`), `app/globals.css` (`.side/.brand/.nav`, table/tier/kpi classes).
- Manager: `app/manager/page.tsx`, `components/tickets/QueueTable.tsx`, `components/ui/Kpi.tsx`, `components/ui/FunnelCapacity.tsx`.
- Editor: `app/editor/page.tsx`.
- Stakeholder: `app/stakeholder/page.tsx`, `components/tickets/ScopeSwitch.tsx`.
- Studio: `app/studio/page.tsx`, `components/studio/PipelineFunnel.tsx`, `components/studio/*`.
- Intake: `app/intake/page.tsx`, `app/intake/creative/page.tsx`, `components/intake/IntakeForm.tsx`.
- Extra: `app/media/*`, `app/social/*`, `app/performance/*`, `app/settings/*`.

## Verification

- `npm run lint` and `npm run build` clean after each phase.
- Run `npm run dev` and visually check each elevated surface against the reference screenshots (`screenshots/`) in **both light and dark**, confirming: the 5-column header order is intact, the two status-badge families stay distinct, tier accents/chips carry, and no raw hex / arbitrary Tailwind sizes were introduced.
- Confirm no horizontal page scroll (wide tables scroll inside `.tscroll`).
- Spot-check role gating still routes correctly (manager/editor/stakeholder/studio guards unchanged).
