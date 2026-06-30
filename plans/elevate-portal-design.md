# Elevate the Content Portal design

## Context

We ran the `/design-system` skill's analysis flow against this app. The finding is the
**opposite of a typical "elevate the design" request**: the token layer is already
excellent. [app/globals.css](../app/globals.css) is a mature, mockup-derived system —
brand purple `#572280` / gold `#F5B000`, Inter + Bricolage Grotesque, 8/12px radii,
full light/dark, a complete motion vocabulary (`#atmo`, `#cover`, stagger reveals,
sparkline draw, capacity/funnel bars), and a `.st-*` studio layer. ~80% of the
premium devices in `context/mockups/` are already ported.

The real problem is **how surfaces consume that system**. Three styling methods coexist
with no rule, so newer surfaces feel "off" next to the polished older ones:

- **Global CSS classes** (`.card .pad`, `.btn`, `.kpi`, `table.list`) — ~40%, high fidelity.
- **Tailwind token utilities** (`bg-brand`, `text-text-muted`) — ~50%, but leaks arbitrary values.
- **Inline `style={{}}`** — ~10%, ~134 instances of untracked spacing/typography.

Concrete debt — counts refreshed against the whole tree (2026-06-30):

- **18 hardcoded brand/gold hexes** across 7 files:
  [ClipEngineForm.tsx](../components/clipping/ClipEngineForm.tsx) (6),
  [StrategyView.tsx](../components/clipping/StrategyView.tsx) (5),
  [ClipApprovalModal.tsx](../components/clipping/ClipApprovalModal.tsx) (2),
  [access-denied/page.tsx](../app/access-denied/page.tsx) (2),
  [StrategyDetail.tsx](../components/media/StrategyDetail.tsx) (1),
  [MediaDetailClient.tsx](../components/media/MediaDetailClient.tsx) (1),
  [DevLogin.tsx](../components/auth/DevLogin.tsx) (1).
- **130 arbitrary `[..px]` Tailwind values** (`text-[13px]`, `text-[32px]`, etc.) — far
  larger than the initial sample; concentrated in `components/ui/*` and the settings/media surfaces.
- **Inline `style={{}}` — top offenders:** [stakeholder/[id]/page.tsx](../app/stakeholder/[id]/page.tsx) (19),
  [ShootsBoard.tsx](../components/shoots/ShootsBoard.tsx) (12), [shoots/[id]/page.tsx](../app/shoots/[id]/page.tsx) (12),
  [media/page.tsx](../app/media/page.tsx) (12), [QueueTable.tsx](../components/tickets/QueueTable.tsx) (11),
  [tickets/[id]/page.tsx](../app/tickets/[id]/page.tsx) (11), [AssetTypeEditor.tsx](../components/settings/AssetTypeEditor.tsx) (10),
  [ShellChrome.tsx](../components/ui/ShellChrome.tsx) (9), [loading.tsx](../app/loading.tsx) (8),
  [intake/page.tsx](../app/intake/page.tsx) (8), [performance/page.tsx](../app/performance/page.tsx) (7),
  [editor/page.tsx](../app/editor/page.tsx) (7) — plus several `components/ui/*` primitives
  ([InsightCard](../components/ui/InsightCard.tsx), [FunnelCapacity](../components/ui/FunnelCapacity.tsx),
  [Skeletons](../components/ui/Skeletons.tsx)) carrying inline styles at the source.
- Inconsistent focus/responsive coverage (~40% of new components use `sm:/md:/lg:`).

**Already-built primitives to reuse (do not recreate):**
[components/ui/Field.tsx](../components/ui/Field.tsx) already exports token-based
`Input` / `Select` / `Textarea` / `Field` **with the brand focus ring** — Phase 1d is
*adoption across surfaces that still use raw `<input>/<select>`*, not creation.
[InsightCard.tsx](../components/ui/InsightCard.tsx) and
[FunnelCapacity.tsx](../components/ui/FunnelCapacity.tsx) already componentize two Phase-2
devices. A `cn()` helper exists at `@/lib/cn`.

**Full surface inventory in scope** (31 routes; bigger than the initial four groups):
- **Studio/Founder:** `/studio`, `/studio/{launches,launches/[event],ranking,shipped,sign-off}`, `/vishen`, `/`(landing)
- **Workflow:** `/tickets`, `/tickets/[id]`, `/intake`, `/intake/creative`, `/editor`, `/manager`
- **Media/Engine:** `/media`, `/media/[id]`, `/media/new`, `/content-engine`, `/content-engine/{new,[id]}`, `/performance`
- **Shoots:** `/shoots`, `/shoots/[id]`, `/shoots/new`
- **Stakeholder:** `/stakeholder`, `/stakeholder/[id]`
- **Settings:** `/settings/{asset-types,clip-rules,scoring,team}`
- **System:** `/access-denied`

**Decisions taken with the user:** elevate via **cohesion first, then net-new polish**;
the standard going forward is **Tailwind token utilities + small `components/ui/` React
components** (aligns with the eventual BlinkWork `packages/ui` migration); **all surface
groups** are in scope.

Intended outcome: every surface reads as one cohesive, premium product, and the few
remaining mockup devices that raise the bar are pulled in.

---

## Phase 0 — Token foundation (do first; everything else depends on it)

The reason people reach for `text-[13px]` is that the body scale (13/14px, plus
11.5/12.5/13.5px half-steps from the mockups) doesn't exist as Tailwind utilities — only
Tailwind's defaults (xs=12 / sm=14 / base=16) do. Fix the foundation so the right thing
is the easy thing.

1. In the `@theme inline` block of [app/globals.css](../app/globals.css#L148), add a
   **type scale** matching the mockup rhythm so `text-*` utilities cover real usage:
   `--text-2xs: 11px`, `--text-xs: 11.5px`, `--text-sm: 12.5px`, `--text-base: 13px`,
   `--text-md: 13.5px`, `--text-lg: 16px`, plus the display steps (21/24/29px) used by KPIs
   and drill heroes. Keep names few and semantic; verify against the sizes the audit found.
2. Confirm spacing — the mockups are on a loose 8px-ish grid but use odd paddings
   (13/14/17/18px). Decide whether to snap to Tailwind's spacing scale or add a couple of
   custom `--spacing-*` steps. Recommend snapping to the nearest Tailwind step to reduce
   token count; document the mapping.
3. Add the **missing semantic color utilities** the net-new devices need (Phase 2):
   `--color-gold-bright`, and ensure `brand-strong`, `gold-content`, the `tier-*` and
   `due-*` tints are reachable as utilities (most are; fill gaps).
4. Write a short **"how to style" rule** into [CLAUDE.md](../CLAUDE.md) (or a new
   `components/ui/README.md`): "Use `components/ui/*` components first; else Tailwind token
   utilities; never inline styles or raw hex; never arbitrary `[..px]` — add a token instead."

---

## Phase 1 — Cohesion pass (converge on Tailwind utilities + `components/ui/`)

Goal: zero hardcoded hexes, zero arbitrary pixel values, near-zero inline styles. Reuse
the existing component library rather than inventing new patterns. Existing reusable
components to lean on: [Button.tsx](../components/ui/Button.tsx), [Badge.tsx](../components/ui/Badge.tsx),
[Kpi.tsx](../components/ui/Kpi.tsx), [MetricCard.tsx](../components/ui/MetricCard.tsx),
[Icon.tsx](../components/ui/Icon.tsx), [SearchableSelect.tsx](../components/ui/SearchableSelect.tsx),
[TierBadge.tsx](../components/ui/TierBadge.tsx), [Sparkline.tsx](../components/ui/Sparkline.tsx).

Work the surface groups in priority order (Studio/Founder → Workflow → Media/Engine →
Shoots → Stakeholder → Settings); the pattern is identical in each:

**1a. Eliminate hardcoded brand/gold hexes (18, across 7 files).** Replace `#572280`/`#F5B000`
literals and `bg-[#572280]` arbitrary utilities with token utilities (`bg-brand`,
`text-brand`, `border-brand`, `accent-brand`, `bg-gold`). Files:
[ClipEngineForm.tsx](../components/clipping/ClipEngineForm.tsx) (const + template + `accent-[#572280]`),
[StrategyView.tsx](../components/clipping/StrategyView.tsx),
[ClipApprovalModal.tsx](../components/clipping/ClipApprovalModal.tsx),
[access-denied/page.tsx](../app/access-denied/page.tsx),
[StrategyDetail.tsx](../components/media/StrategyDetail.tsx),
[MediaDetailClient.tsx](../components/media/MediaDetailClient.tsx),
[DevLogin.tsx](../components/auth/DevLogin.tsx).

**1b. Replace the 130 arbitrary pixel sizes** (`text-[13px]`, `text-[11px]`, `text-[32px]`, etc.)
with the Phase-0 type-scale utilities. Concentrated in `components/ui/*`
([Sidebar](../components/ui/Sidebar.tsx), [DetailDrawer](../components/ui/DetailDrawer.tsx),
[MetricCard](../components/ui/MetricCard.tsx)) and settings/media surfaces. Fix the shared
`components/ui/*` primitives first — the savings cascade to every consumer.

**1c. Drain inline `style={{}}`.** Convert to Tailwind utilities or the existing global
classes. Highest-density targets in order: [stakeholder/[id]/page.tsx](../app/stakeholder/[id]/page.tsx) (19),
[ShootsBoard.tsx](../components/shoots/ShootsBoard.tsx) (12), [shoots/[id]/page.tsx](../app/shoots/[id]/page.tsx) (12),
[media/page.tsx](../app/media/page.tsx) (12), [QueueTable.tsx](../components/tickets/QueueTable.tsx) (11),
[tickets/[id]/page.tsx](../app/tickets/[id]/page.tsx) (11), [AssetTypeEditor.tsx](../components/settings/AssetTypeEditor.tsx) (10),
[ShellChrome.tsx](../components/ui/ShellChrome.tsx) (9), [intake/page.tsx](../app/intake/page.tsx) (8),
[performance/page.tsx](../app/performance/page.tsx) (7), [editor/page.tsx](../app/editor/page.tsx) (7).
For ticket detail / intake field rows, **reuse the existing [components/ui/Field.tsx](../components/ui/Field.tsx)
`Field` component** rather than re-implementing field markup.

**1d. Adopt the existing form primitives + unify focus.** `Input`/`Select`/`Textarea` in
[components/ui/Field.tsx](../components/ui/Field.tsx) already apply the brand focus ring via
`focus-visible:shadow-[var(--mv-shadow-focus)]`. Forms in `components/settings/*`,
`components/clipping/*`, `components/shoots/*` still use raw `<input>/<select>` that rely on
border-color change only — **swap them to the existing primitives**. (Optional: also lean on
the global `:focus-visible` rules in [globals.css:264-269](../app/globals.css#L264-L269) for
non-component fields.) No new wrappers needed.

**1e. Close responsive gaps.** Add `sm:/md:/lg:` to the grid-heavy newer components that
currently rely solely on globals media queries (shoots board, media grid, performance,
stakeholder); add a horizontal-scroll affordance (fade edge or shadow) to `table.list` on
mobile in [QueueTable.tsx](../components/tickets/QueueTable.tsx).

---

## Phase 2 — Net-new premium devices (raise the bar above current)

Port the remaining ~20% of mockup devices into [app/globals.css](../app/globals.css) (or as
`components/ui/` components) and apply them selectively where they add signal — not everywhere.

1. **Gradient KPI "attention" state** — `vishen-cockpit.html` gold-to-surface gradient fill +
   gold border on the highest-priority KPI (e.g. "Clips awaiting you"). Add a variant to
   [Kpi.tsx](../components/ui/Kpi.tsx)/[MetricCard.tsx](../components/ui/MetricCard.tsx).
2. **Gradient brand mark** — 140deg `brand → brand-bright` on `.brand-mark`
   ([globals.css:276](../app/globals.css#L276)).
3. **Callout boxes** — `border-left: 3px gold` + tinted bg (`status-report.html`), with a
   `purple` variant. New `.callout` class or `components/ui/Callout.tsx`. Useful for intake
   guidance and stakeholder notes.
4. **Dashed Phase-2 callout** — `border: 1px dashed brand-border` + `brand-soft` for
   "coming in Phase 2" sections (`vishen-cockpit.html`). Replaces ad-hoc future banners.
5. **demo-six best-performer intelligence** — [InsightCard.tsx](../components/ui/InsightCard.tsx)
   already exists (port it off its inline styles while here). The net-new piece is the AI
   **best-performer** proposal (from `demo-six.html`) that surfaces the top-performing asset
   type and feeds it back into intake. (`demo-six.html` is untracked — confirm it's the
   intended newer direction before wiring the proposal.)
6. **Richer hero band** (optional) — `status-report.html`'s radial-gold + purple gradient
   header with gold bottom-border, for the stakeholder/status report surface.

Apply restraint: gold is attention-only (per CLAUDE.md — do **not** add the stat-tile row
to the landing page).

---

## Verification

- `npm run dev` and walk each priority surface in **both light and dark mode**: Studio
  (`/studio`, `/vishen`), Landing (`/`), Tickets (`/tickets/[id]`), Intake (`/intake`),
  Settings (`/settings/*`), Media, Stakeholder (`/stakeholder`), Queue. Confirm no visual
  regressions and that newer surfaces now match the polished baseline.
- Grep gates (should return ~0 after Phase 1): `#572280|#F5B000|#f5b000` in `app/` + `components/`;
  `\[[0-9]+px\]` arbitrary Tailwind sizes; `style={{` density on the targeted files.
- Keyboard-tab every form on the touched surfaces — confirm a visible brand focus ring on all inputs.
- Resize to mobile (≤680px and ≤820px): sidebar overlay, table scroll affordance, stacked grids.
- `npm run build` and `npm run lint` clean.
- Spot-check WCAG AA contrast on the formerly-hardcoded gold-on-gold
  ([MediaDetailClient.tsx:121](../components/media/MediaDetailClient.tsx#L121)) once tokenized.

## Out of scope

- No restyle of the mockup HTML (it stays the visual source of truth).
- No new fonts / dependencies (Inter + Bricolage already loaded).
- No move to `packages/ui` monorepo yet — but keep `components/ui/` shaped so that
  migration is a lift-and-shift later.
