---
title: 'Mindvalley Content Production & Management System'
slug: 'content-production-management'
scope: product
status: discovery
parent: null
children:
  - content-production-management/foundation-data-layer.md
  - content-production-management/reference-sync.md
  - content-production-management/intake.md
  - content-production-management/prioritization-queue.md
  - content-production-management/lifecycle-views-approvals.md
  - content-production-management/two-way-sync.md
  - content-production-management/performance-loop.md
  - content-production-management/content-clipping-engine.md
  - content-production-management/portal-feedback-round-1.md
created: 2026-06-25
updated: 2026-06-29
resolution: 5/8
imported-from: "CLAUDE.md"
---

# Mindvalley Content Production & Management System

## Problem

The Social/Ads/Content teams at Mindvalley have merged into one Creative Services team. The primary stakeholder (Vision) cannot see what is being produced, by whom, or how it performs. Work is fragmented across Jira and 4+ Airtable bases (VSSLs, masterclasses, social media, etc.), making it impossible to get a unified view of the content lifecycle.

The concrete pain: there is no single place that answers "who edited this asset, where does it live, and how did it perform?" — the three questions every stakeholder and manager needs answered daily.

> **Imported note:** This tool is a Blinkwork tool for the merged Creative Services team. Airtable remains the ops layer the team maintains by hand (taxonomy, Brain links, asset/event types). The app's own system of record is Postgres, mirrored from Airtable.

## Vision

One full-lifecycle system — intake → prioritization → production → approval → publish → performance — surfaced inside Blinkwork. Replaces the fragmented Jira + 4+ Airtable bases with a single source of truth.

The differentiator: every asset is linked to its live performance metrics (ROAS, CTR, views) from Clarisights/Amplitude/Ahrefs. No other internal tool answers "who edited this AND how did it perform" in one place.

> **Imported note (architecture):**
> ```
> Airtable (ops layer) → Postgres (app system of record) → Next.js app (this repo)
> ```
> Postgres mirror rationale: Airtable API capped at ~5 req/sec, tables already exceed 10,000 records. App needs sub-second queries and full-lifecycle state Airtable can't model cleanly.

Success is measured against end-to-end throughput (the north-star) and manager efficiency — see the Success Criteria section.

## Users

**Editor/Designer** — manages a personal queue of assigned tickets. Pulls the next item, updates ticket_status, attaches raw/final assets, links the distribution URL. Context: they work in Blinkwork daily; they care about knowing exactly what to work on next, in what order, without ambiguity.

**Manager** — owns the prioritization board. Drags to reorder queue_rank, assigns/reassigns tickets, sets prio_status, approves work, monitors team capacity. Context: spends ~5 min/day confirming algorithmic ranking + handling exceptions (capacity, staff leave).

**Stakeholder/Agency (read-only)** — Vision and external ad agencies. Views pre-prod → post-prod status, output location, distribution link, and performance metrics. Context: they do NOT have paid seats; access must be free and unlimited. This solves Vision's core frustration of not knowing "who edited this / how did it perform."

[UNRESOLVED] Who is explicitly NOT a target user? Are there other internal roles (e.g. finance, legal, HR) who might request access but should be kept out? What's the access control model for Blinkwork SSO mapping to these three roles?

## Core Capabilities

**1. Intake Form (conditional logic)**
User selects Event Type → Asset Type list filters to those linked to the chosen Event Type → Team Lead and Preferred Editor auto-fill as read-only lookups → Dimensions auto-suggest → remaining fields: Title, Creative Brief, CTA, Positioning, Audience (cold/warm), Due Date. Priority and Assignee are NOT on the form — handled by backend.

Two form variants exist (Ads Creative, Pathway Organic) in Titus's Video Base. [VERIFY both against live base appDZnMnJGehbSOo5.]

**2. Prioritization Queue**
Score = urgency × complexity. Missing tags → inaccurate scores, so taxonomy is enforced at intake. Output is a ranked queue; editors pull the next item, no SLA tracking. Phase 1 is manual-assisted: managers see algorithmic ranking and spend ~5 min/day confirming order + handling reassignments. Auto-assignment covers only the ~20–30% of unambiguous cases.

**3. Lifecycle State Machine**
```
Requested → Prioritized → Assigned → In Production → In Review
          → Approved → Published → Performance Tracked
```
Every transition writes a ticket_events row (actor, from_state, to_state, note).

**4. Three Role-Based Views**
- Editor/Designer: personal queue (next-up first), pull item, update ticket_status, attach assets, link distribution URL
- Manager: prioritization board (drag-to-reorder queue_rank), assign/reassign, set prio_status, approve, capacity overview
- Stakeholder/Agency: read-only — pre-prod → post-prod status, output location, distribution link, performance

Mandated standard: first five columns of every list view = **Title, Priority, Assigned, Ticket Status, Priority Status.**

**5. Airtable Sync**
Reference data (employees, dimensions, event_types, asset_types, dna): one-way Airtable → Postgres via webhook + nightly reconcile. Transactional data (tickets, assets, approvals, shoots): two-way, app is primary, push back to Airtable. Batch ≤10 records/request, exponential backoff on 429.

[UNRESOLVED] Step-by-step flows for each capability need validation against live Airtable data. Several field names and enums are marked [VERIFY] in schema.sql and must be reconciled before first sync.

## Boundaries

**In scope (Phase 1):**
- Intake form with conditional Event→Asset→lookup chain
- Prioritization queue with drag-to-reorder
- Three role views with mandated 5-column header
- Airtable sync (reference data read-only first, then two-way for transactional)
- Free external reviewer access (no paid seat required)
- Version stacking for assets (raw vs final under one logical asset)
- Decision locks: approval stage blocks next state transition

**Explicitly deferred to Phase 2:**
- DNA/brief generation (generate brief from winning assets)
- Frame-accurate video comments (timecode-anchored)
- Full automation depth (beyond ~20–30% auto-assignment)

**Borrowed, not built:**
- Asset library UI patterns (Air)
- Approval routing UI (Ziflow/Frame.io patterns)

**Phase 1 scope fence (do NOT over-build) — from decision-log + context/README:**
- No predictive capacity modeling.
- No auto-rebalancing of tickets across editors.
- No SLA timers — the queue model replaces SLAs by design.
- Auto-assignment covers only the ~20–30% unambiguous cases (e.g. a business unit that always routes to one person, or a `preferred_editor` set on the asset_type). Everything else lands in a manager triage view.

These are Phase 2 candidates *only if* the manual-assisted queue proves insufficient after a real week of use.

> **Sync conflict handling (resolved by the system-of-record rule):** Postgres is primary for transactional data (tickets/assets/approvals/shoots) — the app wins on those, pushing changes back to Airtable. Airtable is primary for reference data (employees/dimensions/event_types/asset_types/dna) — those are read-only in the app and reconcile is upsert-on-`airtable_id`. Failed pushes honor 429 with exponential backoff and retry; provenance via `airtable_id` makes reconcile idempotent.

## Success Criteria

**North-star metric: End-to-end throughput.** The system succeeds if real work flows through the entire lifecycle inside the tool — not in Jira, Slack, or hand-kept Airtable.

- **Ship gate (Phase 1 "done"):** ≥1 real content request completes the Phase 1 lifecycle — Requested → Prioritized → Assigned → In Production → In Review → Approved → **Published** — entirely in-tool, with every transition recorded as a `ticket_events` row and no step tracked outside the system. This mirrors the Air 5-day rollout: prove the loop end-to-end before adding automation depth. (Performance Tracked is the final state but is deferred to Phase 2 with the Performance Loop epic — see Epics E7.)
- **30-day target:** ≥10 tickets reach Published in-tool. [UNRESOLVED] The exact number (10 is a proposed placeholder) should be set against the team's real weekly request volume.

**Committed operational criterion: Manager efficiency.**

- Managers spend ≤5 min/day confirming queue order (the explicit Hackathon claim — the algorithm gets the order ~80% right so managers only adjust the edges).
- Queue-override rate (manual `queue_rank` changes vs. the algorithm's `priority_score` order) trends down week-over-week as trust in the urgency×complexity scoring grows. A flat-high override rate signals the weights need tuning. [UNRESOLVED] How the ≤5 min/day is instrumented — session time in the prioritization board vs. self-report — is undecided.

**Tracked, but NOT gated** (kept visible so they aren't lost, but not Phase 1 acceptance gates):

- *Adoption / displacement* — % of new content requests originating in the intake form vs. Jira/Slack/ad-hoc.
- *Performance-loop coverage* — % of published assets with ≥1 linked performance metric (ROAS/CTR/views) within ~14 days. This is the "how did it perform" half of Vision's original question; deliberately not gated for Phase 1 but worth watching, since an empty `performance` table means the differentiator never landed.
- *Stakeholder engagement* — Vision/agencies are weekly-active in the read-only view, and "who edited this / what's the status" pings to the team drop (baseline before launch).

## Open Questions

**Architecture fork — DECIDED: HYBRID (2026-06-25).** Build the workflow surfaces (intake, queue, role views — valid under either architecture) now in this standalone repo; migrate the *nouns* to brain nodes + an app manifest later, referencing the BlinkWork monorepo (`github.com/mindvalley-ai/BlinkWork`, INTERNAL, accessible via `gh`). Only workflow state (tickets/queue/approvals) stays app-owned permanently. The standalone Postgres model (E1) holds for now and is reframed — not discarded — at migration. `context/productization.md` is the migration target spec.

Still open under the hybrid:
- **Intelligence layer** (`context/intelligence-layer.md`): 5 propose-only capabilities — a likely new epic (E8), build order 1→2 first. Largely free under the Blinkwork-app fork, more work under standalone.
- **UI mockups** (`context/mockups/`): the agreed visual target for E3/E5 surfaces — rebuild in `@mindvalley-ai-advanced/ui` (shadcn/CVA), do not restyle the HTML.

**Decisions explicitly NOT yet settled (from decision-log — do not guess):**

- **Event-tier ranking** for the urgency score — the exact ordering (notes suggest Mastery / Summit / MBU high > Academy > States lower; Social/Pathway depends on campaign window). Owner: **Moniek**.
- **Performance-metrics home** — whether metrics live on the Prio table or the Asset Library. Currently modeled library-side in `schema.sql`; **CONFIRM** with team.
- **Brain table names + the stable key to link on** (Programs/Quests/Pathways/Events/Talent). Owner: **team**. Blocks `event_types.brain_program_id` sync.
- **Status enum values** — `prio_status`, `ticket_status`, and `shoots.status`. Resolved by running `context/export-airtable-schema.js` against the live bases.

**Blinkwork embedding contract (the human must provide — from context/README):**

- Auth/SSO model: how the app receives a verified identity and maps it to `employees`; iframe vs. module embedding; shared component library; deploy pipeline; whether Postgres is shared infra or fresh.

**[VERIFY] fields to reconcile against live Airtable before first sync** (run the schema export, then update `schema.sql`):

- `employees.team` / `employees.division` values · single-vs-multi link relationships · select-option values throughout.
- Two form variants (Ads Creative, Pathway Organic) and the "Social Media Promotion" vs literal "Pathway" event-type distinction — against `appDZnMnJGehbSOo5`.

**Migration:**

- Jira export CSV + Jira→taxonomy field mapping (owner: Matthew Wong for post-Jun-24 tickets; historical backfill: Matt).

## Epics

Phase 1 is six epics (E1–E6). E7 (Performance Loop) is deferred to Phase 2. Each has a child PRD under `content-production-management/`.

| # | Epic | Purpose | Depends on | Phase |
|---|------|---------|-----------|-------|
| E1 | [Foundation & Data Layer](content-production-management/foundation-data-layer.md) | Translate `schema.sql` → Prisma, migrate, and scaffold auth mapped to `employees`. | — | 1 |
| E2 | [Reference Sync (inbound)](content-production-management/reference-sync.md) | One-way Airtable→Postgres for employees/dimensions/event_types/asset_types/dna; run the schema export and reconcile every `[VERIFY]`. | E1 | 1 |
| E3 | [Intake](content-production-management/intake.md) | The conditional Event→Asset→lookup intake form with enforced required taxonomy. | E1, E2 | 1 |
| E4 | [Prioritization & Queue](content-production-management/prioritization-queue.md) | `urgency×complexity` scoring per the algorithm spec, drag-to-reorder `queue_rank`, and ~20–30% auto-assignment. | E3 | 1 |
| E5 | [Lifecycle, Views & Approvals](content-production-management/lifecycle-views-approvals.md) | State machine + `ticket_events` audit, the three role views (5-column header), approvals/decision-locks, asset version-stacking, distribution link. | E3 (E4 parallel) | 1 |
| E6 | [Two-Way Sync (outbound)](content-production-management/two-way-sync.md) | Push tickets/assets back to Airtable — batched ≤10, 429 backoff. Built last, after reads are stable. | E5 | 1 |
| E7 | [Performance Loop](content-production-management/performance-loop.md) | Wire `performance` to published assets + the stakeholder performance view. The differentiator. | E5 | **2** |
| E8 | [AI Content Clipping Engine](content-production-management/content-clipping-engine.md) | Long-form transcript → 10-section viral strategy via Claude; clips become proposed tickets. | E3 | 1 |
| E9 | [Portal Feedback / Usability Round 1](content-production-management/portal-feedback-round-1.md) | Jun 29 feedback round: cut-ready editor briefs, shoot approvals in Studio, team/campaign visibility, Slack notifications, revenue/campaign scoring, auto-assign, DNA editor, multi-asset requests. | E3, E4, E5, E8 | 1 |

**Dependency order (Phase 1):** E1 → E2 → E3 → {E4 ∥ E5} → E6. E7 follows in Phase 2. E8 and E9 extend the Phase-1 surfaces.
