# Plan: PRD + Build Status Report (shareable Artifact)

## Context

`/status` is a UI command and can't be invoked programmatically, so the real ask
is: **produce a single shareable report covering the whole PRD and the current
build status** of the Mindvalley Content Production & Management portal.

The user wants it as a **shareable Artifact** (hosted web page on claude.ai, like
the existing portal demo artifact), with a **layered** structure: an exec summary
for stakeholders/leadership up top, and a detailed technical appendix for the eng
team below.

Source material gathered (all read-only this session):
- PRD: `prd/content-production-management.md` (status `discovery`, resolution 5/8)
- Build spec: `CLAUDE.md` §1–§11 (HYBRID architecture decision)
- Context docs: `context/productization.md`, `context/intelligence-layer.md`,
  `context/prioritization-algorithm.md`, `context/mockups/`
- Actual code: `app/` routes, `components/`, `lib/`, `prisma/schema.prisma`
  (30 models, 8 migrations), git log (latest `dfbb8fb`), 13 plans in `plans/`

**Reconciled fact (important for accuracy):** the app is **Postgres-backed today**
(Prisma + PrismaPg adapter, 8 applied migrations). The "Airtable-direct pivot"
described in `plans/airtable-direct-pivot.md` is a **proposed** plan, NOT the
current architecture. The report must present current-state vs proposed clearly.

## Deliverable

A self-contained HTML Artifact: `Mindvalley Content Portal — PRD & Build Status`.
Source HTML written to the scratchpad dir, then published via the Artifact tool.

### Structure (layered)

1. **Header** — title, date (2026-06-28), one-line mission, status pills
   (architecture: HYBRID / Postgres today; phase: Phase 1 build).
2. **Exec summary** (stakeholder layer)
   - The problem (Vision's "who edited this AND how did it perform" gap)
   - What the portal is (intake → prioritization → production → approval →
     publish → performance, surfaced in Blinkwork)
   - **What's live now** vs **what's coming** — at-a-glance status board
   - The differentiator (performance loop) and the intelligence layer (propose-only)
3. **PRD digest** (condensed but complete)
   - Three roles + surfaces; the mandated 5-column header
   - Five core capabilities (intake conditional chain, prioritization,
     lifecycle state machine, role views, Airtable sync)
   - Prioritization algorithm (urgency × complexity, weights, manual override)
   - Phase 1 epics E1–E6, Phase 2 E7 (performance loop)
   - Architecture: HYBRID decision + productization (brain nodes) target
   - Open questions / unresolved decisions + owners (Moniek, brain table names, etc.)
4. **Build status** (technical appendix)
   - Status legend: ✅ shipped / ⏳ in-flight / 📋 proposed / ❌ not built
   - Feature matrix mapped to PRD capabilities, with file paths
   - Data model: 30 Prisma models, 8 migrations (reference / transactional /
     clipping / auth groups)
   - lib modules inventory (scoring, intake, airtable sync, blinklife, media,
     metrics)
   - Gated / partial: Airtable two-way push (`AIRTABLE_PUSH_ENABLED=false`),
     no webhook receiver, performance data source unwired, DNA feedback, cron
   - Roadmap: the 13 plans in `plans/` with status (shipped / in-flight /
     proposed / superseded), incl. the airtable-direct pivot decision point
   - Recent ship trajectory from git log
5. **Open decisions & next steps** — the priority sequence + risk/decision points.

### Design

- Load the **artifact-design skill first** (required before writing the page) to
  calibrate effort.
- Brand-aligned to the portal: primary `#572280` (purple), accent `#F5B000`
  (gold, used sparingly for attention), Inter, 8/12px radii. Light + dark friendly.
- Self-contained: inline CSS, no external assets (strict CSP). Status board and
  feature matrix as responsive tables inside `overflow-x:auto` wrappers.
- Favicon: 📊 (or 🟣). Stable across redeploys.

## Critical files (read-only inputs; nothing in the repo is modified)

- `prd/content-production-management.md`, `CLAUDE.md`
- `prisma/schema.prisma`, `prisma/migrations/`
- `app/**`, `components/**`, `lib/**`
- `plans/*.md` (13 files)

## Verification

- Open the published Artifact URL; confirm: exec summary renders, both layers
  present, status legend correct, tables scroll horizontally on narrow widths,
  dark mode legible, no broken/external asset requests (CSP).
- Spot-check accuracy: "Postgres today, Airtable-direct proposed" stated
  correctly; gated features (push disabled) flagged; 5-column header noted.
- Return the shareable link to the user.

## Notes

- No repo code is changed. The only outputs are the scratchpad HTML file and the
  published Artifact.
- If the user later wants the markdown source committed too, that's a trivial
  follow-up (write `plans/portal-status-report.md` from the same content).
