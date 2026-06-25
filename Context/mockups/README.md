# UI mockups — reference for the build

Four static HTML mockups of the portal. These are a **visual target**, not
production code — Claude Code should rebuild them as real Next.js/React
components using Blinkwork's design system. The point is to lock layout,
information hierarchy, and how the settled decisions surface in the UI.

Open any file in a browser to view.

## Views

### 1. `manager-view.html` — prioritization queue
The densest screen. The daily ~5-min triage job.
- The mandated five-column header: Title · Priority · Assigned · Ticket status · Priority status (identical across ALL views).
- Two status axes kept visually distinct: ticket status (editor-set, internal) vs priority status (manager-set, external).
- Event tiers color-coded (high / mid / lower) so queue logic is legible.
- Priority score + due-date chip = the urgency × complexity output made visible.
- Unassigned high-priority rows highlighted with inline "Assign" action.
- Grip handles = drag to override rank (manual queue_rank beats the algorithmic score).

### 2. `editor-view.html` — pull next from queue
Focused on one item at a time, no SLA timers (queue model).
- "Next up" card surfaces the single highest-priority assigned item.
- Brief & Video/Design DNA and linked source material one tap away.
- Ticket-status dropdown is editor-owned; priority status is read-only here.
- Upload final asset (raw vs final lives on the assets table).

### 5. `asset-library.html` — version-stacked DAM
The asset-management pillar (Air pattern). Also a panel in `portal.html`.
- Version stacking: each card = one logical asset with vN history (raw → final
  under one record), not scattered files. Maps to the `assets` table.
- Taxonomy filters: event type / asset type / dimension / stage — the
  configurable-metadata depth from Acquia/Aprimo, mapped to schema link fields.
- Raw vs final explicit; source/shoot cards show "feeds N tickets"
  (shoots → shoot_tickets relationship).
- Per-asset performance (CTR/ROAS + channel) on published finals, keyed to
  Clarisights/Amplitude — the Performance-DAM gap (Uplifted) the big DAMs leave open.

### 3. `stakeholder-view.html` — status & performance (read-only)
Closes Vision's "who edited this AND how did it perform" gap.
- Every asset shows stage, edited-by, distribution link to channel, live CTR/ROAS.
- Metrics keyed to each published asset, pulled from Clarisights / Amplitude.
- Read-only with comment access only — the free-external-reviewer pattern
  (Ziflow). Unlimited stakeholders/agencies, no paid seat. This is WHY we
  don't pay per-seat in Airtable.

### 4. `intake-form.html` — new creative request
The entry point; the conditional chain everything flows from.
- Event type FIRST → filters Asset type → auto-fills team lead, preferred
  editor, dimensions, category as LOCKED lookups (not inputs).
- Then: Title, Creative brief, CTA, Positioning, Audience (cold/warm), Due date.
- NO Priority or Assignee fields — handled by backend on submit (score → rank →
  route to asset-type team lead).

## Notes for the build
- Colors here are placeholders mapped to event tiers; replace with Blinkwork
  tokens. Keep tier color-coding — it carries meaning.
- Buttons here are static/demo. In the real build: Submit → server action that
  scores and routes; Assign/Auto-rank → the scoring & suggestion engine.
- The five-column header is a hard requirement, not a style choice.

## Brand tokens (Blinkwork)

Retuned from the Blinkwork logo, not the marketing overview page. The marketing
site uses bright violet `#7a12d4` + gradients/glows; the product UI deliberately
does NOT — it follows the shadcn/CVA restraint in `packages/ui`.

- Primary / brand: `#572280` (logo purple) — brand mark, active nav, primary
  buttons, links, person avatars, "on track" / brand-tinted states.
- Accent: `#F5B000` (logo gold) — reserved for ATTENTION only (needs-attention
  rows, unassigned counts, the gold spark on the brand mark). Used sparingly.
- Neutrals shifted slightly cool (purple-tinted) so they sit under the purple.
- Font: Inter. Radii 8/12px. Flat surfaces, 0.5px borders. Dark mode included.

These are placeholder hex values mapped to the brand for the visual spec. In the
real build, Claude Code should use the actual tokens from `@mindvalley-ai-advanced/ui`
and build screens from its shadcn-style components (CVA variants, `cn()` merge,
`forwardRef`), per the repo guardrails — NOT restyle this HTML.
