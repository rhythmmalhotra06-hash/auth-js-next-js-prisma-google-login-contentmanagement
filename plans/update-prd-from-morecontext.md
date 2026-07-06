# Plan — Update the PRD from `Context/MoreContext`

> **Status:** Reviewed and approved. Ready to execute. (No scope change since approval — re-confirming.)

## Context

`Context/MoreContext/CLAUDE.md` is a new context layer (dated **26 Jun 2026, post Films × Vishen meeting**) that the team treats as the current source of truth for the build. It carries decisions the active PRD (`prd/content-production-management.md`, last updated 2026-06-26, resolution 5/8) does **not** yet reflect. Its §12 ("Using this file to update the PRD") explicitly maps its sections to PRD sections — this update executes that mapping.

The accompanying `Context/MoreContext/diagrams/` holds four PNGs (request lifecycle, data spine, to-be state, propose-commit handoff); MoreContext also embeds the same diagrams as PRD-ready Mermaid.

**Decisions locked with the user for this update:**
1. **Keep the HYBRID / Postgres-system-of-record framing.** MoreContext argues for a full pivot to "Blinkwork app on the shared brain, Brain = system of record." We do **not** adopt that as the current architecture (it would diverge from the deployed Postgres build and root `CLAUDE.md`). Instead we record Vishen's ratification of Blinkwork-on-Brain as the **forward/migration direction**, and absorb only the workflow, taxonomy, prioritization, and AI content — all of which are valid under the hybrid model. Where MoreContext describes a mechanism in Brain/Airtable terms (e.g. "staging twin field"), translate it to the Postgres model (a staging column / `*_ai_draft` field).
2. **Scope = main PRD + revise existing epics + add new AI epics.**

The outcome: the PRD reflects the post-Vishen reality — AI pulled into Phase 1, six-capability intelligence layer, propose-commit safety rule, strategic-value prioritization input, Asset-Library-per-dimension, metrics-by-lookup, and a clean owners/RACI list — without flipping the architecture out from under the code that already exists.

---

## What changed that the PRD must absorb (from MoreContext)

| Area | New in MoreContext | PRD treatment under hybrid |
|---|---|---|
| Roadmap sequencing | **AI moved into Phase 1**; intelligence layer went 5 → **6** capabilities (content engine added as the only *originating* one) | Update phasing + Boundaries; brief generation leaves Phase-2-deferred list |
| AI safety | **Propose-commit handoff** (read Brain/record → propose to staging → human commits; downstream automation only fires off *live* fields) | Add as a first-class principle + capability; staging = Postgres `*_ai_draft` column |
| Prioritization | **Strategic-value input**, Vishen-controlled, added to `urgency × complexity` | 4th scoring input in capability #2 + E4 |
| Taxonomy | **Social = film** unification; new **Video / Build-Process-Document / Social-Media-Clips** category cuts | Event/Asset-Type additions noted in intake + reference-sync |
| Produce stage | **Asset Library auto-creates one row per required dimension** (trigger = a ticket status, TBD) | Add to lifecycle capability + E5; trigger status is an open item |
| Measure stage | Metrics are **looked up** from an external **Content & Comms** base via a shared matching key, never hand-entered | Reframe E7; the key is the single P3 unlock |
| Governance | Open-items-with-owners table (§9); People/RACI (§10) | Add RACI section; replace ad-hoc Open Questions with owner-tagged list |
| Direction | Vishen ratified Blinkwork-app/AI-first ("high-octane / 50×") on 26 Jun | Record as ratified migration target; architecture stays hybrid |

Note a divergence to reconcile: `Context/intelligence-layer.md` lists **five** capabilities with different numbering; **MoreContext (six) is newer and authoritative** — the PRD follows MoreContext and notes the older file is superseded on capability count.

---

## Files to change

### 1. `prd/content-production-management.md` (main PRD — primary edit)

- **Frontmatter:** bump `updated: 2026-06-26`; raise `resolution` (adds the AI-roadmap + governance content). Keep `status: discovery`.
- **Vision / architecture notes:** keep the hybrid Postgres framing. Add a short note that Vishen ratified (26 Jun) the Blinkwork-app-on-Brain *direction* as the migration target — consistent with the existing HYBRID open-question, not a replacement of it.
- **Core Capabilities:**
  - #2 Prioritization Queue — add **strategic-value** (Vishen-controlled) as a scoring input alongside urgency × complexity × event-type weight × asset-type complexity.
  - #3 Lifecycle — add **Asset Library auto-creates one row per required dimension** (driven off Asset Type; trigger ticket-status TBD).
  - Add a capability **"Intelligence layer (propose-only)"** summarizing the six capabilities + the **propose-commit handoff** rule verbatim (read → propose to staging → human commits; automation fires only off live fields). Include the §6 capability/phase table and the §7 plug-in table.
  - Note the **Social = film** unification + new category cuts as taxonomy additions handled via Event/Asset Type.
- **Boundaries / phasing:** move **brief generation** and **content engine** into **Phase 1**; keep DNA feedback, conversational brain, learning prioritization, performance loop in Phase 2/3. Keep the Phase-1 scope fence (no predictive capacity, no auto-rebalance, no SLA).
- **Success Criteria:** unchanged gates; add that the P3 learning capabilities are gated on the Content & Comms key.
- **Open Questions → owner-tagged:** fold in MoreContext §9 open-items (Content & Comms URL + matching key [Rhythm/Matt, gates P3]; Asset-Library trigger status [Rhythm]; strategic-value weighting [Vishen]; Brain table names [Garrett]; metrics-aggregation decision [Rhythm/Moniek]; DNA two-way sync [Matt]; Vishen prioritization sign-off). Keep existing [VERIFY]/migration items.
- **New "People / RACI" section** from MoreContext §10.
- **Embed Mermaid diagrams** (PRD-ready, from MoreContext §3/§4/§6/§7): request lifecycle, data spine, intelligence layer, propose-commit handoff. Reference the PNGs in `Context/MoreContext/diagrams/` as flat-image fallback.
- **Epics table:** add the four new AI epics (below) and re-note phases (E8 content engine = P1; brief gen = P1).

### 2. Existing child epics to revise (light, in-place)

- `intake.md` — note AI **brief generation** drafts into a staging field at intake (human approves); add Social=film / new category-cut taxonomy and the propose-commit note.
- `prioritization-queue.md` — add **strategic-value** input + Vishen sign-off dependency; cross-link the future **learning-prioritization** epic.
- `lifecycle-views-approvals.md` — add **Asset Library = one row per dimension**, auto-created on a (TBD) ticket status.
- `performance-loop.md` (E7) — reframe metrics as **looked up from Content & Comms** via a shared matching key (not hand-entered); name the key as the P3 unlock; add the propose-only **performance-insight** surface.
- `reference-sync.md` — note the new Event/Asset-Type category cuts to sync.
- (`two-way-sync.md` — no change needed beyond consistency.)

### 3. New child epic PRDs (thin, `discovery`, matching the existing epic template)

Create under `prd/content-production-management/`, each with the standard sections (Purpose filled; User Stories/Workflows/Boundaries/Success/Features = `[UNRESOLVED]`), `parent: content-production-management.md`, appropriate `phase:`:

- **E9 · Brief Generation** (P1, augments intake) — draft brief from top performers + asset-type DNA + Brain nodes → `*_ai_draft` staging → manager approves. Depends on E3, E7-insights.
- **E10 · DNA Feedback** (P2, augments produce) — first-pass asset-vs-DNA check → gap flags the editor acts on pre-review. Depends on E5 + multimodal pipeline.
- **E11 · Conversational Brain** (P2, read-only) — natural-language queries over records; no commit step. Forward-looking under hybrid (full value at Brain migration).
- **E12 · Learning Prioritization** (P3, augments prioritize) — propose weight adjustments from manual re-ranks / slips / cycle-time; propose-only. Depends on E4 + metrics flowing (E7).

> E8 (Content Clipping Engine) already exists and is resolved — it **is** capability #1 (content engine). No new epic needed for it; just reference it as the intelligence layer's originating capability.

### 4. `prd/index.md`

Add rows for E9–E12; update the main PRD's `Updated` date and resolution; recompute the totals line.

---

## Conventions to follow

- Match the existing PRD house style: frontmatter block, `> Part of [...]` breadcrumb, the fixed section set, `[UNRESOLVED]` for unfilled sections, owner names inline.
- Carry the **propose-commit rule verbatim** (MoreContext §7) — it is the core AI safety requirement.
- Keep all architecture language hybrid/Postgres; cite Brain only as the source of truth for *nouns it already owns* (Programs/Quests/Events/Talent links) and as the migration target — never as the current system of record for tickets/queue.

## Verification

Documentation-only change — no build/test impact. Verify by:
1. `prd/index.md` totals line recomputes correctly and every new/renamed doc link resolves (open each relative link).
2. Frontmatter `parent`/`children` references are bidirectionally consistent (main PRD `children` lists E9–E12; each new epic's `parent` points back).
3. Render the Mermaid blocks (GitHub preview / any Mermaid viewer) to confirm they parse.
4. Re-read the main PRD end-to-end to confirm no sentence asserts Brain (or Blinkwork app) as the *current* system of record — hybrid framing intact throughout.
5. Spot-check against MoreContext §12 mapping: every authoritative input section (§1–§10) is represented somewhere in the PRD set.
