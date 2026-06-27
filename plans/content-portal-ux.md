# Content Portal — World-Class UI/UX Foundation & Vishen Cockpit

## Context

The ContentManagement portal has the **brand identity right** (`#572280` purple, `#F5B000`
gold accent, Inter, 8/12px radii, dark mode — all in `context/mockups/`) but the
**engineering is thin**: colors are hardcoded as `bg-[#572280]` across components, the app
ships Geist (not Inter), and there is no token layer, no shared primitives, and no component
variants. Meanwhile the sibling **vendor portal**
(`/Users/rhythmmalhotra/Documents/GithubDev/auth-js-next-js-prisma-google-login-vendorportal`)
is a production-grade, token-driven design system that is *already Airtable-direct* — exactly
the backend shape we pivoted to in `plans/airtable-direct-pivot.md`.

The opportunity: **vendor portal's engineering rigor + ContentManagement's brand = a
world-class product.** And the one surface that makes the whole content engine *visible* —
the gap Vishen/Vision has lived with — is the media→clip→ticket→published→CTR/ROAS loop from
`plans/vishen-media-clip-pipeline.md`. That becomes Vishen's **Content Engine cockpit**.

**Decisions locked with the user (2026-06-27):**
1. **Build the design-system foundation FIRST**, before any specific surface.
2. **Port the vendor portal's structure, keep our brand** — lift its token architecture and
   `mv-*`/`of-*` component recipes wholesale, re-skinned to `#572280`/gold/Inter/8-12px radii.
3. **Vishen gets a Content Engine cockpit + clip approval** — he's an active node, not just an
   observer.
4. **Mockups first, then React** — nail the visual for new/changed surfaces (esp. the cockpit),
   then build React on the token system.

---

## Reference sources (study, then adapt)

| What to lift | From | Notes |
|---|---|---|
| Token architecture (`:root`/`.dark`, semantic tokens, radius/motion/spacing scales) | vendor portal `app/globals.css`, `DESIGN_SYSTEM.md` (649 lines) | **The master reference.** Re-skin values to our brand. |
| Component recipes (`mv-btn`, `mv-input`, `mv-badge`, `of-status`, `of-metric`, `of-topbar`, `of-table`, `of-split`, `of-toolbar`, `of-formshell`, `of-empty`, `of-callout`) | vendor portal `app/of.css` (~600 lines) | Adapt class names → our component layer. |
| Rich table (sort / multi-filter / group / table↔card toggle / column picker / right-drawer detail) | vendor portal `components/vendors/VendorDataTable.tsx`, `VendorDetailPanel.tsx` | Generalize into our shared `Table` + `DetailDrawer`. |
| JWT-from-Airtable auth (no Prisma), repository pattern w/ rate-limit + 429 backoff | vendor portal `lib/auth.ts`, `lib/repositories/*` | Confirms our Airtable-direct backend shape. |
| Brand tokens + all role mockups | this repo `context/mockups/*.html`, `context/mockups/README.md` | The agreed visual identity + the 5-column mandate. |
| Token-integration process (one decision at a time, force light+dark, WCAG AA) | this repo `skills/design-system/SKILL.md` | Use this skill to drive the token mapping work. |

---

## The plan

### Phase A — Design-system foundation (do first; nothing else lands without it)

Goal: replace hardcoded `#572280` and Geist with a real token layer, ported from the vendor
portal and re-skinned to our brand. Tailwind v4 CSS-first (already in use — good alignment).

1. **Author the token layer** in `app/globals.css`:
   - Port the vendor portal's `:root`/`.dark` structure and semantic token *names*
     (`--mv-bg`, `--mv-surface`, `--mv-text`, `--mv-text-muted`, `--mv-border`, `--mv-focus-ring`,
     brand rungs, support palette, status map).
   - Fill values from `context/mockups/` (already has full light **and** dark palettes):
     `--brand #572280` / dark `#b98fe0`, `--brand-strong #3f1860`, `--brand-soft #f1eaf7`,
     gold `#F5B000` (accent only), neutrals cool/purple-tinted, borders `rgba(40,20,60,.12)` 0.5px.
   - Radii **8px / 12px** (our brand — **not** the vendor portal's 128px pill), motion durations
     120/200/320ms, 4px spacing base.
   - Map every var through `@theme inline` so Tailwind utilities resolve to tokens.
   - Dark mode: single switch (vendor portal uses `[data-mv-theme="dark"]`); align to our
     `.dark` block. Every token gets a dark counterpart (enforced by the design-system skill).
2. **Switch the font** Geist → **Inter** in `app/layout.tsx` (and the `@theme` font var).
3. **Drive the mapping with `/design-system`** — one decision at a time, force light+dark for
   every color, check WCAG AA contrast (purple-on-white, gold-ink, status colors).

### Phase B — Shared component primitives (CVA on the token layer)

Goal: the recipes every surface reuses, so the 5-column mandate and status colors are enforced
once, not per-page. Introduce `class-variance-authority` (vendor portal pattern).

Create `components/ui/`:
- `Button` (primary/secondary/ghost/danger; 8px radius, one primary/screen)
- `Input` / `Select` / `Textarea` (shared `mv-input` recipe, 42px min, focus ring)
- `Badge` + `StatusBadge` — **canonical status-color map** keyed to the live Airtable enums from
  `plans/airtable-direct-pivot.md`: Ticket Status (Backlog…Done/Shipping) and Prio Status
  (New Request, To be reviewed by Vishen, In Queue, …). Dot + text, never color alone.
- `MetricCard` + `MetricGrid` (eyebrow + 32px value + trend pill green/amber/grey)
- `DataTable` (sort, multi-filter, group, table↔card toggle, column picker) — generalized from
  `VendorDataTable.tsx`, with the **mandated 5-column header baked in**:
  Title · Priority · Assigned · Ticket Status · Priority Status.
- `DetailDrawer` (480px right drawer, 320ms, Esc-dismiss, sticky header/footer) from
  `VendorDetailPanel.tsx`.
- `FormShell` (280px stepper rail + scroll content + sticky footer + progress) for intake.
- `EmptyState`, `Callout`, `Topbar`/`AppShell` (replace the current thin `AppNav.tsx`).

Refactor existing components (`TicketTable`, `IntakeForm`, `StatusUpdater`, `PrioStatusUpdater`,
`AssigneeUpdater`, `ReorderableQueue`, clipping/media components) to consume these primitives —
deleting hardcoded `#572280` and inline conditionals.

### Phase C — Mockups for new/changed surfaces (agree the visual before React)

Add to `context/mockups/`, on the re-skinned token vocabulary:

1. **`vishen-cockpit.html`** — the flagship. A single visible funnel for Vishen:
   - **Top KPI strip**: media in inbox · clips proposed (awaiting his nod) · in production ·
     published (30d) · avg CTR · avg ROAS.
   - **Funnel/pipeline band**: Media Sources → Clip Suggestions → Tickets → Published, each stage
     a column/lane with counts, so "what is my engine producing and how is it performing" reads
     at a glance.
   - **Clip approval inline** (his active role): clip cards with Hook Line, Virality Score (1–10),
     Format badge, Caption, with **Approve / Dismiss** actions that set Clip Suggestion `Status`
     (`Proposed`→`Approved`/`Dismissed`); approved clips show a "Convert to ticket" affordance.
   - **Published performance**: each published clip linked to its distribution URL + live
     CTR/ROAS (color-coded), closing the loop. Read/comment only beyond clip approval.
2. **`media-inbox.html`** + **`media-source-detail.html`** — refresh of the pipeline surfaces
   (`app/media/*`) on the token system: inbox list (Status, submitted-by, clip count), source
   detail with rendered strategy + clip cards + convert-to-ticket.
3. **Re-skin pass** of existing mockups (manager / editor / stakeholder / intake / library) to
   the finalized tokens so the whole portal is visually coherent — no layout changes, just
   tokenization (they already encode the right decisions).

### Phase D — React build, in sequence

Build order (mockup approved → React):
1. **App shell + Topbar** on tokens (role-aware nav; role-gating awaits Blinkwork SSO).
2. **Vishen cockpit** `app/vishen/page.tsx` (or `/cockpit`) — the flagship loop, wired to
   Airtable Media Sources / Clip Suggestions / Prio Requests via the repository pattern.
   Clip Approve/Dismiss writes `Status`; Convert-to-ticket reuses existing ticket-creation logic.
3. **Media pipeline** surfaces refactored onto primitives.
4. **Stakeholder view** (CTR/ROAS) onto primitives — the cockpit is its exec superset.
5. **Manager / editor / intake / library** onto the `DataTable`/`FormShell` primitives,
   enforcing the 5-column header and two status axes.

---

## Surface UX intent (what each audience must see)

- **Vishen (exec / CEO):** the engine as one funnel — in → proposed → producing → published →
  performing. One glance answers "who's making what, and is it working." Active only at the
  clip-approval gate.
- **Editors/designers:** "Next up" card (single highest-priority assigned item) + personal
  queue; edit *ticket status* only; brief/DNA, raw/final upload, distribution link. Prio status
  read-only.
- **Stakeholders/agencies:** read-only stage · edited-by · channel link · live CTR/ROAS.
  Free, unlimited, comment-only (Ziflow pattern).
- **Managers:** prioritization board, drag-to-reorder `queueRank` (overrides `SCORE`), assign,
  set prio status, approve, capacity.
- **Universal:** identical first 5 columns on every list view; two status axes kept visually
  distinct (prio = brand-colored, ticket = neutral); gold = attention only.

---

## Critical files

**Token foundation:** `app/globals.css`, `app/layout.tsx` (Inter), `postcss`/`@theme` config.
**New primitives:** `components/ui/{Button,Input,Select,Badge,StatusBadge,MetricCard,DataTable,DetailDrawer,FormShell,EmptyState,Callout,AppShell}.tsx`.
**Refactor:** `components/AppNav.tsx`, `components/TicketTable.tsx`, `components/IntakeForm.tsx`,
`components/{Status,PrioStatus,Assignee}Updater.tsx`, `components/ReorderableQueue.tsx`,
clipping/media components.
**New surface:** `app/vishen/page.tsx` (cockpit) + Airtable repository methods for Media Sources
/ Clip Suggestions (Status writes, convert-to-ticket).
**New mockups:** `context/mockups/{vishen-cockpit,media-inbox,media-source-detail}.html` + re-skin
of the existing five.
**Reference (read-only):** vendor portal `DESIGN_SYSTEM.md`, `app/globals.css`, `app/of.css`,
`components/vendors/VendorDataTable.tsx`, `VendorDetailPanel.tsx`, `lib/auth.ts`, `lib/repositories/*`.

---

## Verification

- **Tokens:** toggle dark mode — every surface flips with no hardcoded-color leaks
  (`grep` for `#572280` / `bg-\[#` in `components/` and `app/` should return ~0 after refactor).
  Run `/design-system` WCAG AA contrast checks on brand/gold/status colors.
- **Primitives:** `npm run build` + `npm run lint` clean; visual diff each refactored surface
  against its mockup.
- **5-column mandate:** every list view shows Title · Priority · Assigned · Ticket Status ·
  Priority Status as the first five columns (enforced by `DataTable`).
- **Vishen cockpit (end-to-end, live Airtable):** seed a Media Source → Suggest clips →
  cockpit shows proposed clips → Approve a clip (writes `Status=Approved` to Clip Suggestions) →
  Convert to ticket (creates Prio Requests row) → ticket appears in manager queue →
  published clip shows CTR/ROAS in the performance band. Confirm each Airtable write via the
  Airtable MCP / record revision history.
- **Free stakeholder access:** cockpit/stakeholder views are read-only (except Vishen's clip
  gate) and require no editor seat.

---

## Out of scope (note, don't build)

Blinkwork `@mindvalley-ai-advanced/ui` integration and brain-node migration (future per
CLAUDE.md HYBRID decision) — our token layer should *name* tokens compatibly to ease that later,
but we are not pulling the package now. Intelligence-layer AI surfaces (brief gen, performance
insights) are Phase 2; the cockpit just needs hooks/space for them.

---

## Addendum — gaps & decisions (2026-06-27, after Phase A + B.1 shipped)

**Shipped:** Phase A (token layer `app/globals.css` + Inter) and Phase B.1 core primitives
(`components/ui/`: `Button`, `Badge`+`TicketStatusBadge`/`PrioStatusBadge`, `Input/Select/Textarea/Field`,
`MetricCard`, `lib/cn.ts`). Build + tsc clean.

**Cockpit data layer already exists (from the #19 media pipeline) — the flagship is buildable now:**
`MEDIA_SOURCES` (`tbl…`) + `CLIP_SUGGESTIONS` (`tblquXg7eesUZwvSH`, fields: hookLine, viralityScore,
format, caption, status Proposed/Approved/Dismissed) are mapped in `field-map.ts`, and
`lib/media/repository.ts` exposes `listMediaSources/getMediaSource/listClipSuggestions/updateClipSuggestion/
createMediaSource`. So **clip Approve/Dismiss = `updateClipSuggestion(status)`** and
**convert-to-ticket = the Airtable `createTicket`**. No new backend.

**Gaps to close (added to scope):**
1. **Dark-mode toggle** — `.dark` tokens exist but are unreachable. Add a Topbar theme switch that sets
   `class="dark"` on `<html>` + persists to `localStorage` (and respects `prefers-color-scheme` first load).
2. **Retire the old content-engine** — the Postgres `lib/clipping` + `app/content-engine` system overlaps
   the new Airtable media pipeline (`lib/media`, `app/media`). **Decision: the cockpit + media-inbox
   supersede content-engine.** Park/redirect `app/content-engine` to `/media`; keep `lib/clipping`'s
   Anthropic strategy generator (reused by the media pipeline), drop the Postgres clip persistence path.
3. **Map CTR/ROAS perf fields** — add the existing Prio performance fields (ROAS `fldQ0E6tNbZwFQ8sT`,
   CTR `fldmEUPAkPRO7BRUb`, Views, Engagement, Revenue, Conversion) to `TICKETS` in `field-map.ts` so the
   cockpit performance band + stakeholder view can read them.
4. **Role-awareness (interim)** — no role exists on the Employee record. Until Blinkwork SSO, gate the
   cockpit/nav with an **email allowlist** (Vishen / managers) in a small `lib/roles.ts`; structure it so
   SSO roles drop in later.
5. **Stakeholder comments** — Ziflow-style read/comment-only has no Airtable home under "no new tables".
   Interim: comment = append to an existing Prio feedback/notes field (no threaded comments); revisit.
6. **WCAG AA pass** — run `/design-system` contrast checks on the authored tokens (brand-on-white,
   gold ink `#6b4e00`, each status soft/content pair); adjust any failing pair.

**The 26-file de-hardcode is the Phase B.2/D gate:** these files still use `#572280`/`bg-[#…]` and must move
to tokens/primitives — `app/{page,manager,tickets,media,content-engine}/*`, `components/AppNav`,
`components/tickets/*` (TicketTable, StatusUpdater, PrioStatusUpdater, AssigneeUpdater, EmployeePicker,
ReorderableQueue, ApprovalPanel, AssetPanel), `components/{clipping,media,intake}/*`. This refactor absorbs
the carryover follow-ups (StatusUpdater→`StatusBadge`, ApprovalPanel→status model, ReorderableQueue
drag-reorder, AppNav→`AppShell`, remove manager Sync/Recompute buttons, stakeholder show-Done, inactive-
employee filter).
