# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Architecture direction — HYBRID (decided 2026-06-25; read first)

**Decision: HYBRID.** Build the workflow surfaces now in this standalone repo (they're valid under either architecture), and migrate the *nouns* to brain nodes + an app manifest later. Reference for that migration: the **BlinkWork monorepo** at `github.com/mindvalley-ai/BlinkWork` (INTERNAL, accessible via `gh`) — apps-framework manifest format, brain-node API, and `packages/ui` (shadcn/CVA).

The two architectures the hybrid bridges (see `context/productization.md`):

1. **Standalone** (what §1–§11 below + `schema.sql` describe): Next.js + Postgres mirror of Airtable, app-built auth. **E1 was already built this way** (full Prisma schema deployed to Kessel managed Postgres). Faster, isolated. We build the workflow here now.
2. **Blinkwork app** (`context/productization.md`, supersedes the standalone *architecture* eventually): manifested, multi-tenant app on the **shared brain**. The brain becomes system of record for the *nouns* (Asset, Person, Event, Channel, Metric, Insight, Rule…); only *workflow state* (tickets, queue_rank, ticket_status/prio_status, approvals) stays app-owned permanently. Airtable becomes a **connector**, not source of truth. Auth = platform identity/permissions. All API over MCP, secrets server-side. Intelligence layer nearly free. Reusable by other entities. This is the migration target, not the immediate build.

**What stays valid in both:** the workflow decisions (event→asset chain, two status axes, queue model, raw/final, 5-column header), the prioritization algorithm, and all UI mockups (`context/mockups/`).

**Implication for E1:** under the Blinkwork model, the reference nouns (`employees`, `event_types`, `asset_types`, `assets`, `performance`) move to brain nodes; the ticket/queue/approval tables E1 built remain app state. E1 is not wasted, but its reference tables may be reframed.

Related new context:
- `context/intelligence-layer.md` — 5 propose-only AI capabilities (performance insight, brief generation, learning prioritization, DNA feedback, conversational layer). Build order 1→2→3→4, 5 emergent. Always propose→human-approves.
- `context/mockups/` — HTML mockups of all role surfaces + portal. **Visual target, not production code** — rebuild as React using Blinkwork's `@mindvalley-ai-advanced/ui` (shadcn/CVA), do not restyle the HTML. Brand: primary `#572280` (purple), accent `#F5B000` (gold, attention only), Inter, 8/12px radii, dark mode.

---

## Development commands

```bash
npm run dev        # start dev server (Turbopack)
npm run build      # production build
npm run lint       # ESLint

npx prisma generate                    # regenerate client after schema changes
npx prisma migrate dev --name <name>   # create and apply a migration
npx prisma db push                     # push schema without a migration file (prototyping only)
npx prisma studio                      # browse the database
```

No test runner is configured yet.

Copy `.env.example` → `.env` and fill in `DATABASE_URL`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, and `AUTH_SECRET` before running.

---

## Styling rules (design system)

**Before building or changing any UI, read [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)** — the
canonical rulebook (brand, typography, tokens, primitives, mandated rules). The summary below
is the short form; `DESIGN_SYSTEM.md` is authoritative and `app/globals.css` holds exact values.

**Keep it living:** whenever the user gives design feedback (a rule, preference, correction, or
"from now on…"), fold it into `DESIGN_SYSTEM.md` in the same turn and mirror it to memory — design
decisions must not live only in chat.

The design system lives in `app/globals.css` (brand tokens `--mv-*`, Tailwind v4
`@theme inline` utilities, and the ported component classes from `context/mockups/`).
When styling any surface, in this order of preference:

1. **Reuse a `components/ui/*` primitive** — `Button`, `Badge`, `Kpi`, `MetricCard`,
   `Field`/`Input`/`Select`/`Textarea`, `Icon`, `SearchableSelect`, `TierBadge`, `Sparkline`,
   `InsightCard`, `FunnelCapacity`. Don't re-implement field/input/card markup.
2. **Else use Tailwind token utilities** — `bg-brand`, `text-text-muted`, `border-border-default`,
   `bg-surface`, `rounded-sm` (8px) / `rounded-md` (12px) / `rounded-lg` (16px) / `rounded-xs` (4px),
   `text-2xs` (11px) plus the default `text-xs/sm/lg`, `font-display`. These map to the brand tokens.
3. **Or use the ported global classes** (`.card .pad`, `.btn`, `.kpi`, `table.list`) where they fit.

**Never:** raw hex colors (`#572280` → `bg-brand`/`text-brand`); arbitrary Tailwind sizes
(`rounded-[8px]` → `rounded-sm`, `text-[11px]` → `text-2xs`); inline `style={{}}` for
spacing/typography/color (use utilities or a component). Inline `style` is acceptable only
for genuinely dynamic values (computed widths, `--i` animation indices).

---

## Deployment — Kessel CLI

This project deploys via the **Kessel CLI** (Mindvalley's Vercel-like platform, sits in front of Cloud Run). Do **not** use gcloud/Vercel — there's no GCP Console access. Next.js is auto-detected, so **do not add a Dockerfile** unless auto-detection genuinely can't handle a custom build.

```bash
kessel login --api-url https://kesselrun-be-jdtcvngavq-as.a.run.app
kessel init --name content-management --database   # link repo + provision managed Postgres
kessel deploy                                       # build + deploy + stream logs
kessel open                                         # open deployed URL
kessel runtime-logs --since 30m                     # live runtime logs
kessel rollback                                     # re-deploy a previous successful build
```

**Critical behaviours (do not violate):**
- **Never modify env vars or config outside `kessel` commands.** The platform manages all infrastructure; direct changes are overwritten on the next deploy.
- **`DATABASE_URL` is auto-injected at runtime** when the project has `--database`. Do **not** set it manually for the deployed app (it's only set in local `.env` for dev).
- **`NEXT_PUBLIC_*` vars are baked in at build time**, not runtime — set them with `kessel env set` *before* `kessel deploy`.
- **Auto-deploy is on by default** — any push to the configured branch triggers a deploy.

Operational notes:
- **Database:** Kessel-managed Postgres (`kessel init --database`). `kessel db` shows connection info; `kessel db query "..."` runs ad-hoc SQL; `kessel db migrate <file.sql>` runs raw-SQL migrations (recorded in history). Since this app uses Prisma, run Prisma migrations against the managed DB rather than hand-writing SQL for `db migrate`.
- **Env / secrets:** `kessel env secret KEY=VALUE` for secrets (e.g. `AIRTABLE_TOKEN`, `AUTH_SECRET`, OAuth keys), `kessel env set KEY=VALUE` for plain vars, `kessel env pull` for a local `.env` (secrets commented out). `kessel send -f .env` shares an env file zero-knowledge over Slack/email.
- **Access:** default private (@mindvalley.com Google accounts only); `kessel init --access public` for public.
- **Previews:** `kessel preview` deploys the current branch's open PR without touching production.
- **Resources** (memory/CPU/scaling) are web-UI only (Settings → Resources), not CLI.

---

## Architecture

### Current state vs. target state

The repo is a **starting template** with Auth.js wired up. The full target schema lives in `schema.sql` — that is what needs to be built out. `prisma/schema.prisma` currently only contains the four Auth.js tables (`User`, `Account`, `Session`, `VerificationToken`). As features are built, models from `schema.sql` must be added to `prisma/schema.prisma` and migrated.

### Prisma setup (non-standard)

Two things differ from a default Prisma setup:

1. **Generated client location:** output is `app/generated/prisma/`. All imports must use `@/app/generated/prisma/client`, not `@prisma/client`.
2. **Edge-light runtime:** uses `PrismaPg` adapter from `@prisma/adapter-pg`. The client is instantiated in `lib/prisma.ts` via this adapter. All database code must remain edge-compatible — no Node.js-only Prisma features.

### Auth

Auth.js v5 (beta). Configuration in `lib/auth.ts`. Route handler at `app/api/[...nextauth]/route.ts`. Root `middleware.ts` re-exports `auth` directly, which protects routes.

Currently uses GitHub OAuth. Per the product spec below, this will need to map to Blinkwork's SSO and link authenticated users to the `employees` table rather than the generic `users` table.

Auth forms (`SignIn`, `SignOut` in `components/auth-components.tsx`) use **Server Actions** (`"use server"`), not client-side API calls.

### Skills and PRD

- `skills/` — slash command skills (`/prd`, `/build-feature`, `/sprint`, etc.)
- `prd/` — Product Requirements Documents. `prd/content-production-management.md` is the active product PRD (resolution 3/8); use `/prd resume` to continue discovery.

---

## Mindvalley Content Production & Management System — Build Spec

> A Blinkwork tool for the merged Creative Services team. Replaces fragmented
> Jira + multiple Airtable bases with one full-lifecycle system: intake →
> prioritization → production → approval → publish → performance.

---

## 1. Goal & context

The Social/Ads/Content teams merged. Vision (the primary stakeholder) cannot
see what is being produced, by whom, or how it performs. Work is spread across
Jira and 4+ Airtable bases (VSSLs, masterclasses, social media, etc.). This
tool consolidates everything into one system, surfaced inside **Blinkwork**.

**This repo is the application layer.** Airtable remains the ops layer the
team maintains by hand (taxonomy, Brain links, asset/event types). The app's
own system of record is **Postgres**, mirrored from Airtable.

---

## 2. Architecture

```
Airtable (ops layer — team maintains taxonomy, Brain, asset/event types)
        │  REFERENCE DATA: one-way  Airtable -> Postgres (webhook + periodic reconcile)
        │  TRANSACTIONAL DATA: two-way (app primary; push tickets/assets back)
        ▼
Postgres (app system of record — no API rate limits, real queries)
        ▼
Next.js app (this repo) ── embedded as a Blinkwork tool
        ├─ Editors/designers: queue, pull next, update ticket status
        ├─ Managers: prioritization board, reorder, assign, approve
        └─ Stakeholders/agencies: read-only status + performance
```

**Why Postgres mirror, not direct Airtable:** Airtable's API is capped at
~5 req/sec with monthly limits; tables already exceed 10,000 records. The app
needs sub-second queries and full-lifecycle state Airtable can't model cleanly.

### Stack
- **Next.js (App Router) + TypeScript + React**
- **Postgres** (schema in `schema.sql`)
- **Prisma** (or Drizzle) ORM
- **Airtable sync service**: a worker that (a) consumes Airtable webhooks for
  reference tables, (b) runs a periodic full reconcile, (c) pushes ticket/asset
  writes back to Airtable. Respect the rate limit: batch ≤10 records/request,
  back off on 429.
- Auth: integrate with Blinkwork's existing auth/SSO; map users to `employees`.

---

## 3. Data model

See `schema.sql`. Key principles baked in:

- **Two taxonomy building blocks: Event Type and Asset Type.** Production Type
  is a subcategory of Event Type — do NOT make it a primary axis.
- **Teams own Asset Types, not Event Types** (a Masterclass can have ad assets
  AND social assets). team_lead + preferred_editor live on the asset type.
- **Person fields link to `employees`, never raw users.** Contractors/freelancers
  are employees with `employment_type` set; retire with `active=false`.
- **Brain is the source of truth** for Programs/Quests/Pathways/Events/Talent.
  event_types.brain_program_id links out. [VERIFY Brain table names before sync.]
- **Two status axes, never merged:** `prio_status` (manager, external-facing)
  and `ticket_status` (editor/designer, internal).
- **Asset category is digital | print** (print = physical). All video = digital.

---

## 4. Intake form (conditional logic)

Order matters — this was settled after several reversals:

1. User selects **Event Type** first.
2. **Asset Type** list is filtered to those linked to the chosen Event Type.
3. **Team Lead** and **Preferred Editor** auto-fill as read-only lookups from
   the asset type (NOT user inputs).
4. **Dimensions** auto-suggest from the asset type; required.
5. Remaining fields: **Title** (not "Summary"), **Creative Brief**, **CTA**,
   **Positioning**, **Audience** (cold/warm), **Due Date**.
6. Do NOT include Priority or Assignee on the form — handled by backend.

Two form variants exist in Titus's Video Base (Ads Creative, Pathway Organic).
For Pathway/organic, Event Type = "Social Media Promotion" (broader category),
not "Pathway" literally — but a "Pathway" event type also exists for direct
pathway requests. [VERIFY both against live base appDZnMnJGehbSOo5.]

---

## 5. Prioritization

- Score = function of **urgency × complexity**. Missing tags → inaccurate
  scores, so enforce required taxonomy at intake.
- Output: a ranked **queue**. Editors pull the next item; no SLA tracking.
- **Phase 1 is manual-assisted**: managers see all tickets with an algorithmic
  ranking and spend ~5 min/day confirming order + handling reassignments
  (capacity, staff leave). Auto-assignment covers only the ~20–30% of cases
  that are unambiguous (e.g. a business unit that always routes to one person).

---

## 6. Lifecycle states

```
Requested → Prioritized → Assigned → In Production → In Review
          → Approved → Published → Performance Tracked
```
Every transition writes a `ticket_events` row (actor, from, to, note).

---

## 7. The three role-based UIs

**Editor/Designer** — personal queue (next-up first), pull item, update
`ticket_status`, attach raw/final assets, link distribution URL.

**Manager** — prioritization board (drag-to-reorder `queue_rank`), assign/
reassign, set `prio_status`, approve, capacity overview.

**Stakeholder/Agency** — read-only: pre-prod → post-prod status in one place,
output location, distribution link, performance. Solves Vision's "who edited
this / how did it perform" gap.

**Mandated standard:** the first five columns of every list view must be
identical: **Title, Priority, Assigned, Ticket Status, Priority Status.**

---

## 8. Sync rules (critical)

| Data | Direction | Trigger |
|------|-----------|---------|
| employees, dimensions, event_types, asset_types, dna | Airtable → PG | webhook + nightly reconcile |
| tickets, assets, approvals, shoots | PG ↔ Airtable | on write, batched |

- Always store `airtable_id` for provenance; reconcile is upsert-on-airtable_id.
- On push, batch ≤10 records, honor 429 with exponential backoff.
- Reference data is read-only in the app (edit in Airtable).

---

## 9. Known base/table IDs

- Creative Services / Prio base: `appFEFygXo2pRc8AR`
  - Prio/Requests table: `tblhrRl8GzsDMv0DD`
  - Creative Asset Type: `tblLbcgob2Bxevugy`
  - Event Type: `tblzTFTZ2ttEvi2j1`
- Titus Video Base: `appDZnMnJGehbSOo5`
- Ads Creative Library: `appWYOr2p4RKHf2LR`
- Mindvalley Brain: source of truth for People/Programs/Events/Talent
  — **table names TBD, confirm before configuring syncs.**

---

## 10. Reference patterns (borrow, don't reinvent)

Each pillar has a market tool that solved it at scale. Study the pattern; the
build/borrow call is below. Do NOT add these as dependencies — they're design
references.

| Pillar | Study | Pattern to copy | Call |
|--------|-------|-----------------|------|
| Intake | Wrike, Adobe Workfront | Dynamic request forms; route by project type; reject incomplete requests at submit | Build |
| Taxonomy | Acquia DAM, Aprimo | Configurable metadata + controlled vocabularies; schema depth = the moat | Build |
| Prioritization | Workfront, monday.com | Request queue kills drive-by asks; rank-based pickup, no SLAs | Build |
| DNA / brief | Uplifted, Storyteq | Generate brief from winning assets; link requirements→production | Phase 2 |
| Asset library | Air | Version stacking (raw/final); upload links; AI search | Borrow |
| Approvals | Ziflow, Frame.io | Conditional + parallel routing; decision locks; FREE external reviewers; frame-accurate comments | Borrow |
| Performance | Uplifted (Performance DAM) | Link each asset to live ROAS/CTR/CPA — the gap every DAM leaves open | Build (our edge) |

Specific patterns to implement:

- **Free external reviewers (from Ziflow).** Stakeholders/agencies (Vision, ad
  agencies) must review WITHOUT a paid seat. This is the core reason we're not
  paying per-seat in Airtable — the stakeholder UI is read/comment-only and
  unlimited. Do not gate it behind editor licensing.
- **Version stacking (from Air).** raw vs final assets stack under one logical
  asset with version history, not as scattered files. Models the `assets` table.
- **Decision locks (from Ziflow).** An approval stage can block the next state
  transition (e.g. legal/brand must approve before Published). Enforce in the
  `approvals` → `ticket_events` transition logic.
- **Frame-accurate comments (from Frame.io).** For video tickets, comments
  anchor to a timecode. Store timecode on the comment record (Phase 2 for video).
- **Performance loop (from Uplifted).** The differentiator: Clarisights,
  Amplitude, and Ahrefs are already connected at Mindvalley. Wire the
  `performance` table to pull live ad metrics keyed to published assets, so the
  stakeholder view answers "who edited this AND how did it perform" in one place.

**Rollout model (from Air's 5-day playbook):** migrate assets → stand up
standardized intake → run one real review cycle → invite external collaborators
→ confirm the full loop (intake → production → review → approval → delivery)
end-to-end. Ship Phase 1 this way before adding automation depth.

**Process principle (industry consensus):** define the workflow before building,
never fit the workflow to a tool's defaults. The three meetings already did this
— treat the settled decisions in sections 3–6 as fixed, not as suggestions.

---

## 11. First tasks for Claude Code

1. Scaffold Next.js + TypeScript + Prisma; load `schema.sql`.
2. Build the Airtable sync worker (reference pull first, read-only).
3. **Reconcile every `[VERIFY]` field** in `schema.sql` against the live bases
   via the Airtable API — do not trust inferred field names/enums.
4. Build the intake form with the conditional Event→Asset→lookup chain.
5. Build the three role views with the mandated 5-column header.
6. Implement the priority scoring function + drag-to-reorder queue.
7. Wire two-way push for tickets/assets last, after reads are stable.

> Build first, validate against live data — never theorize from schema alone.
