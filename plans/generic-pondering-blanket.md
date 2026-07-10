# Redesign the `/media` clip engine — on-system polish (whole feature)

## Context

The deployed `/media` page (the "Clip engine": long-form media inbox → AI clip
strategy → convert to production tickets) is the redesign target. Following the
`context/mockups/README.md` rule, we rebuild the mockups' intent **in the real
Next.js codebase using existing primitives**, not by shipping the HTML.

The **inbox** (`app/media/page.tsx`) is already mostly on-system. The **detail
surface** (`MediaHero`, `MediaDetailClient`, `StrategyDetail`), the **submit
form** (`MediaLinkForm`), and the **convert modal** (`ClipApprovalModal`) have
drifted to raw Tailwind (`rounded-xl`, `ring-1`, `shadow-sm`, `rounded-[6px]`,
hand-rolled buttons, `bg-gold/15`, inline hex). That violates the three
DESIGN_SYSTEM.md non-negotiables (reuse a primitive; tokens not raw values; no
inline color/type/spacing styles).

**Goal:** every media surface composes the ported classes / `components/ui`
primitives, matches `app/manager` / `app/performance` / `app/studio`, and works
in light + dark — with **no change to the data layer or server actions**.

**Direction:** faithful on-system polish — keep the current page structure and
interactions (inbox list, generate card, collapsible clip cards, card/grid
toggle, collapsible strategy). Only the markup/styling is rebuilt onto tokens.

## Do NOT touch (reuse as-is)

- Data layer: `lib/media/repository.ts` (`MediaSource`, `ClipSuggestion`),
  `lib/clipping/schema.ts` (`Strategy`, `ReelsClip`), `lib/clipping/clip-types.ts`.
- Server actions / routes: `app/media/actions.ts` (`submitMediaLink`,
  `convertClipsToTickets`, `dismissClip`, `archiveMediaSource`,
  `convertCheckedClips`), `app/vishen/actions.ts` (`approveClip`/`dismissClip`),
  `/api/media/[id]/suggest`, `lib/media/ticket-links.ts`.
- No new dependencies, no schema/migration changes.

## Files to change

### 1. `app/media/page.tsx` (inbox — light polish)
- Keep the `.submit-cta` hero, `KpiGrid`, `.mrow` list, `.sec-head`, `.empty`.
- Remove inline raw hex / typography styles on the CTA `<h3>`/`<p>` (`color:'#fff'`,
  `fontSize`); rely on `.submit-cta` (it already sets white text) — add token-based
  classes to `app/globals.css`'s `.submit-cta` block if the child text isn't styled.
- Keep 3 KPIs (Inbox / Clips suggested `tone="alert"` / New). Optionally add a 4th
  KPI "Approved · ready" (clips `Approved` w/o ticket) only if cheaply derivable
  from `listMediaSources` counts without an extra Airtable round-trip; otherwise skip.

### 2. `components/media/MediaHero.tsx`
- Replace the `<section className="rounded-md bg-surface p-6 shadow-sm ring-1 …">`
  with `.card .pad`.
- Delete local `StatusBadge` + `Chip`; use the `Badge` primitive
  (`components/ui/Badge.tsx`) with a status→tone map (mirror the inbox
  `STATUS_TONE`), and the ported `.chip` class for platform/audience.
- Replace hand-sized `h1 text-xl` with a real heading (`<h1>` auto-applies the
  display font); lead with an `.eyebrow` if useful.
- Replace the "Watch original ↗" anchor with `.btn` (or `<Button variant="secondary">`)
  + `Icon name="ext"`.

### 3. `components/media/MediaDetailClient.tsx` (main effort)
Rebuild markup onto ported classes; keep all state/handlers/interactions intact.
- Cards (generate / re-run / strategy) → `.card .pad` with a `.sec-head`
  (`<h3>` + `.hint`) header instead of `text-sm font-semibold` + raw ring.
- Collapsible chevrons `›` → `Icon name="chevron"` (rotate with a token class).
- View toggle → `.segmented` ported class (replaces the bespoke
  `rounded-[6px] bg-brand` toggle).
- Clip cards: container → `.card` (or `.clip` when in grid view; keep the
  collapsible header). Virality pill → `.badge.b-gold` / `.chip` (drop `bg-gold/15`);
  Approved/Dismissed → `Badge tone="success"|"neutral"`; timestamp/format line →
  `.t-meta`. Keep dismissed-row dimming via a token class.
- Body actions: keep `<ClipActions>`; "Convert to ticket →" and the run button →
  `.btn` / `.btn.primary` (drop hand-rolled `bg-brand px-4 py-2`). "Ticket created"
  → `Badge tone="success"`.
- `controls` block: clip-type select + web-search checkbox + transcript textarea →
  compose `Field`/`Select`/`Textarea` (`components/ui/Field.tsx`) or bare inputs
  (globals.css already styles them); error surfaces → `.banner`/`.callout` tokens.
- Respect ≤1 gold element per screen: the virality pill is the gold accent — do
  not also gold the run button.

### 4. `components/media/StrategyDetail.tsx`
- Align the local `Section` wrapper and rows to `.card`/`.field-row`/`.vstack` and
  text tokens; remove any raw hex / arbitrary sizes. Keep it read-only.

### 5. `app/media/[id]/page.tsx`
- Back link `← All clips` → `.st-back` (used by studio) or `<Button variant="ghost">`
  + `Icon name="arrow"`; error box → `.banner`.

### 6. `app/media/new/page.tsx` + `components/media/MediaLinkForm.tsx`
- Wrap fields in `Field` + `Input`/`Select`; submit → `Button`. Keep the
  `submitMediaLink` server-action call and `router.push('/media/${id}')` unchanged.

### 7. `components/media/ClipApprovalModal.tsx` (shared — also used by `/manager`)
- Compose `.modal`/`.scrim` ported classes (or `DetailDrawer`) + `Field`/`Select`
  + `Button` in place of raw utilities. **Note:** `components/clips/ApprovedClipsPanel`
  renders this same modal on `/manager`; the restyle intentionally improves both —
  smoke-test `/manager` after.

## Reference primitives (already exist — compose these)
`components/ui/{Badge,Button,Kpi,Icon,Field,Sparkline,InsightCard}.tsx`;
ported classes in `app/globals.css`: `.card`/`.pad`, `.sec-head`/`.eyebrow`/`.hint`,
`.btn`(+`.primary`/`.ghost`/`.sm`), `.badge`(+`.b-*`), `.chip`, `.segmented`,
`.clip`/`.clipgrid`, `.mrow`, `.t-meta`, `.banner`, `.callout`, `.modal`/`.scrim`,
`.empty`, `.st-back`. Layout conventions from `app/manager/page.tsx`,
`app/performance/page.tsx`, `components/tickets/QueueTable.tsx`.

## Verification
1. `npm run lint` and `npm run build` clean.
2. `npm run dev`; drive with the Playwright dev-login harness (per project
   conventions). Visit and eyeball against the mockups in **both light and dark**
   (topbar theme toggle):
   - `/media` — submit CTA, KPIs, inbox rows, empty state.
   - `/media/[id]` with clips — hero, clip cards (expand a clip), card↔grid toggle,
     Approve/Dismiss, "Convert to ticket →" → modal → submit, "Ticket created".
   - `/media/[id]` with no clips — generate card, clip-type select, web-search
     toggle, transcript textarea, run button (start a generate).
   - `/media/new` — submit a link, confirm redirect to the new source.
   - `/manager` — confirm the shared `ClipApprovalModal` still renders/works.
3. Grep the changed files for regressions: no raw hex (`#`), no arbitrary Tailwind
   (`rounded-[`, `text-[`, `bg-gold/`), no inline `style` for color/type/spacing
   (dynamic-only exceptions allowed).
4. Confirm no data-layer/server-action files changed (`git diff --stat` scoped to
   `app/media`, `components/media`, `components/clips`, `app/globals.css` only).
