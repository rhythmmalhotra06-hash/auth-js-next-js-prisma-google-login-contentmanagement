---
prd: 'plans/elevate-portal-design.md'
feature: 'Design system elevation — cohesion + premium devices'
started: 2026-06-30
status: completed
completed: 2026-06-30
current_step: 8
total_steps: 8
---

> **Deviation (Phase 0):** the plan proposed overriding `--text-xs/sm/base`. Avoided — those
> defaults are used 200+ times and overriding would shrink text app-wide. Instead added only
> `--text-2xs: 11px` (+ `--font-display`, `--color-gold-bright` utilities). Bulk of the "130 px"
> debt was radii (`rounded-[8/12/16px]`) which already had `rounded-sm/md/lg` utilities.

# Build Log: Design system elevation

## Approved Plan

Source: `plans/elevate-portal-design.md`. Standalone Next.js repo (not the monorepo the
`/build` skill assumes) — placement adapted to `app/` + `components/`, verification via
`npm run build` / `npm run lint`. Standard going forward: Tailwind token utilities + the
existing `components/ui/*` primitives. Cohesion first (Phase 0–1), then net-new devices (Phase 2).

## Progress

- [x] Step 1: Phase 0 — token foundation (type scale + color utils + style rule in CLAUDE.md)
- [x] Step 2: Phase 1a — eliminate 18 hardcoded brand/gold hexes (7 files)
- [x] Step 3: Phase 1b — replace arbitrary `[..px]` with utilities (radii + text sizes)
- [x] Step 4: Phase 1c — drained convertible inline styles (AssetTypeEditor); deferred the
      ~70 in unlayered class-based pages (per decision: needs an `@layer components` refactor first)
- [x] Step 5: Phase 1d — token + focus unification: all Tailwind default-palette (`neutral/green/
      amber/red/bg-white`, ~47 in clipping + 37 elsewhere) mapped to brand tokens; input consts aligned
- [x] Step 6: Phase 1e — table scroll-shadow affordance on `.tscroll` (major breakpoints already in globals)
- [x] Step 7: Phase 2 — `.kpi.attention` gradient (applied to Vishen "Clips awaiting you"), gradient
      brand mark, `.callout`(+purple) and `.phase2` dashed classes, InsightCard de-inlined
- [x] Step 8: Verify — `npm run build` ✓ + `npm run lint` ✓ clean; debt re-check: 0 hexes / 0 default-palette

## Deferred follow-ups
- `@layer components` refactor to wrap the ported global CSS so Tailwind utilities can override it,
  then drain the remaining ~70 inline styles in class-based pages (stakeholder/[id], shoots, tickets, studio).
- demo-six **best-performer** AI proposal feeding intake (needs the untracked `demo-six.html` direction confirmed).
- Manual light/dark visual walkthrough of every surface.
