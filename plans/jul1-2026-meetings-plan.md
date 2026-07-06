# Jul 1 2026 Meetings → Action Breakdown + Portal Build Plan

## Context

Two meetings on Jul 1, 2026 produced a large set of decisions and asks:
- **Vishen + Muley (Social Clips Strat/process)** — Vishen saw the portal live, endorsed
  it, and mandated: rebuild on "proper infrastructure" (Postgres, not Airtable — already the
  agreed HYBRID direction per CLAUDE.md), a **24-hour view-count capture** on every released
  video/clip ("celebration after 24 hours"), a clean **Vishen-vs-team review demarcation**
  (don't dump everything into his queue), the true-memory/DNA-as-notes-wiki direction, and
  a set of pure-ops changes (WhatsApp/Slack channel cleanup, ManyChat pruning).
- **API tools for Content Platform (Muley + Moniek)** — confirmed the Postgres/Kessel path,
  agreed **external-agency access** by removing IAP and gating on an approved-email allowlist
  (after a security pen-test), and flagged shared-service ownership of API keys + an admin.

This document has two parts: **(A)** a full action-item breakdown across all owners (tracking,
not code), and **(B)** the buildable implementation plan for the items that land in *this*
portal codebase. User decisions taken during planning:
- **24h capture:** single **long-text** "24h Data" field on **both** Clip Suggestions and
  Major Videos (Vishen's explicit spec — "not numerical, Claude will parse it"). Manual entry
  now; Hootsuite/YouTube auto-fill later.
- **Review demarcation:** **design now, mark pending** Titus's status meeting (who changes
  which status is being settled there) — do not build the routing until statuses are fixed.
- **External access:** **build the allowlist auth now**; the production IAP-removal cutover is
  **blocked on the security pen-test**.

---

## A. Full action-item breakdown (all owners)

### Portal / engineering (Rhythm — this repo)
| # | Item | Source | Status |
|---|------|--------|--------|
| P1 | 24-hour view-count long-text field on clips + major videos | Vishen | **Build now** (§B1) |
| P2 | Vishen-vs-team review demarcation (tickets + shoots) | Rhythm/Vishen | **Design now, build after Titus mtg** (§B2) |
| P3 | External-agency access via approved-email allowlist | Muley | **Build allowlist now; cutover after pen-test** (§B3) |
| P4 | Add IT Services as admin on all tools | Moniek/Muley | **Build now** (part of §B3) |
| P5 | "Ready to publish → went live" view for Social | Glen | Deferred → Friday mtg (Marisha/Ramya/Gareth) |
| P6 | Single-source clip collection view (all clips one place) | Rhythm/Ramya | Exists at `/vishen`; confirm it covers agency clips |
| P7 | Migrate nouns to Postgres / away from Airtable dependency | Vishen/Muley | Already the HYBRID plan; not triggered by this mtg |
| P8 | Security pen-test with security team | Muley | **Blocker for P3 cutover** — schedule |

### DNA / intelligence (Vishen builds core; portal integrates later)
- Replicate **Blink Life Recorder** to auto-build DNA from feedback recordings (Vishen: "I'll
  build that part"). Portal integrates via true-memory later — **not in scope now**.
- Store DNA/rules as a **notes wiki** (Google Open Knowledge Format), not Airtable rows.
  Confirms the existing "DNA feedback" intelligence-layer capability; keep DNA/rules out of a
  rigid schema. Portal speaks to **BlinkWork** (via Shafiu), powered by true-memory — phase 2/3.

### Ops / process (Gareth, Glen, Ramya)
- **WhatsApp:** collapse to **4 groups** — Operations (rename "MV Exhibition", remove cat
  emoji → camera), Long-form/Podcast/YouTube, Clips (✂️), Content Pipeline (agency raw-file
  drops: Safwan/Sabrina/Simplex). Gareth owns the audit; Rhythm assists.
- **Slack:** `content-studio-claude` channel created (Gareth) with `@Claude` tag test; rename
  once working. Mirror the WhatsApp structure so `@Claude` can act as a team member.
- **ManyChat pruning** (Gareth, ~30 min): remove dumb single-word triggers ("thank you");
  use unusual two-word keywords (e.g. "speak well"). Glen to grant ManyChat access.
- **Content-pipeline flow** (Gareth): filming done → share in **Operations** (Vishen gives
  lighting/sound/wardrobe feedback) → edited → share in **Content Pipeline** for external
  clippers. Gareth to be on-set as director where possible.
- **24h view-count fill** (Paul + team): actually check + record views at 24h per released
  video — the human process behind P1.

### Access / governance (Muley, Moniek)
- Make Kessel project **public** (removes IAP) so externals hit the Google-login gate — **only
  after pen-test** (P8). Keep second gate (approved-email allowlist) tight.
- Add **IT Services** as admin/backup owner on every tool Rhythm creates (P4).
- Shared-service ownership of the **Claude API key + Airtable PAT** (currently Rhythm's
  personal tokens) — Muley to help convert. Governance TBD; add IT Services meanwhile.
- Ground rules + inventory of what's being built and who owns each (Moniek) — org, not code.

---

## B. Portal implementation plan (buildable)

Clips and media are **Airtable-direct** (no Postgres mirror). New clip/media fields follow the
existing field-map → interface → mapper → UI pattern. Field IDs (`fld…`) must be created in
Airtable first (manual, by Rhythm), then wired here.

### B1 — 24-hour view-count capture (build now)

**Goal:** one long-text "24h Data" field on released clips and major videos, editable in the
portal, so the team records cross-platform 24h performance and Claude can later parse it.

**Airtable (manual, Rhythm):**
- Clip Suggestions (`tblquXg7eesUZwvSH`): add long-text field **"24h Data"** → note the `fld…`.
- Major Videos (Vishen base `tblSrtPXAeiGeLUwW`) **and/or** its mirror **Media Sources**
  (`tblBQhM2Blqa7uNZX`): add matching long-text **"24h Data"**. Prefer Media Sources (the
  portal already reads/writes it); add an Airtable automation to mirror to Major Videos if
  Vishen needs it in his base.

**Code — clips:**
- `lib/airtable/field-map.ts` — add `views24h: 'fld…'` to `CLIP_SUGGESTIONS.fields`.
- `lib/media/repository.ts` — add `views24h: string | null` to `ClipSuggestion` (line ~215),
  map it in `mapClip` (`str(f[CF.views24h])`, line ~232), add to any explicit read-field lists,
  and extend `updateClipSuggestion`'s patch to accept `views24h?: string` (write via `CF.views24h`).
- UI: show + edit in the clip detail/card surfaces — `components/vishen/ClipBoard.tsx` table
  (add a "24h" column) and the media detail drill `app/media/[id]`. Reuse `Field`/`Textarea`
  primitives per DESIGN_SYSTEM.md; no inline styles.

**Code — media/videos:** mirror the above on the Media Source interface + `MediaSource` type +
`mapMediaSource` + `updateMediaSource` in `lib/media/repository.ts`; render on the media detail
page.

**Defer:** Hootsuite/YouTube auto-fill (blocked on Glenn per memory `performance-loop-data-source`).
Field is manual-entry now.

### B2 — Vishen-vs-team review demarcation (design now, build after Titus mtg)

**Problem (Vishen):** "we don't want to put everything marked as Review into Vishen's queue" —
need an explicit rule for which items escalate to Vishen vs stay with the team (Gareth), and the
same for shoots (Vishen vs Nadir/Gareth).

**Current mechanics (confirmed):**
- Tickets have two gates: `prio_status = "To be reviewed by Vishen"` (founder gate, surfaced on
  `/studio` sign-off) and `ticket_status = "Review"` (team content review, `/studio/sign-off`).
  Actions in `app/studio/actions.ts`; constants in `lib/tickets/constants.ts`.
- Shoots: single gate `status = "New Requests - Needs Vishen's Review"` (`lib/shoots/constants.ts`).
- Clips: `status` Proposed → Approved → Dismissed (Vishen approves in his mirrored Clips table).

**Proposed design (do not implement until statuses are fixed tomorrow):**
- Add a **routing flag** deciding escalation, most cleanly at the **asset-type** level
  ("Requires Vishen Review" boolean on Asset Type — reference data, edited in Airtable) with a
  per-ticket override. Items in `ticket_status = "Review"` whose asset type requires it get
  `prio_status = "To be reviewed by Vishen"`; others route to the team review queue only.
- Split `/studio` sign-off into "Awaiting Vishen" vs "Team review" using that flag so Vishen's
  view shows only his items (the transcript's core ask).
- Shoots: mirror with a "Vishen review vs team review" split on the shoot record.

**Blocked on:** tomorrow's status meeting settling who changes which status. Revisit exact field
names/enums after that; the flag mechanism above is the recommended shape.

### B3 — External-agency access via approved-email allowlist (build now; cutover after pen-test)

**Goal:** approved non-`@mindvalley.com` emails (agencies/freelancers) can sign in and land on
the read-only `/stakeholder` surface as `Agency / External`. The `Agency / External` role,
role routing, and stakeholder surface **already exist** — the only hard blocker is the
hardcoded domain gate.

**Code:**
- `lib/auth.config.ts` (lines 12–14, 66–70): replace the `ALLOWED_DOMAINS.includes(domain)`
  check in `signIn` with: allow if domain ∈ `ALLOWED_DOMAINS` **OR** email ∈ an approved
  external-email set. Keep the check edge-safe (no DB imports in the edge config) — read the
  external allowlist from an env var (`ALLOWED_EXTERNAL_EMAILS`, comma-separated) for the edge
  gate, and enforce the authoritative check in the Node layer (below).
- Authoritative gate: the existing second gate `getEmployeeForSession()` /
  `employee.repository.ts` already looks up email in the Employees table. Onboard approved
  externals as Employee records with `employmentType = 'contractor'` and
  `roles = ['Agency / External']` (source: the freelancer/creative Airtable list Rhythm
  maintains). Untagged emails already default to `Stakeholder` (read-only) per `lib/roles.ts`,
  so a non-approved email that slips the edge gate still sees nothing sensitive.
- `.env.example`: document `ALLOWED_EXTERNAL_EMAILS`.
- **P4 admin:** add IT Services email to `ADMIN_BOOTSTRAP_EMAILS` (currently only
  `rhythm@mindvalley.com`, `lib/admin/access.ts:8`) via the `ADMIN_BOOTSTRAP_EMAILS` env var.

**Optional (nice-to-have, not required):** an admin panel at `/settings/external-access` to
manage the approved list; for MVP, admins add externals through the existing `/settings/team`
Employees flow.

**Blocked on (production cutover only):** security pen-test (P8) before making the Kessel
project public / removing IAP. The auth code above can land and be tested behind IAP first.

---

## C. Airtable → true-memory migration (strategy + first steps)

> Added at Rhythm's request: "how do we migrate from Airtable to true memory and
> still keep Airtable for the Mindvalley workflow." This is the HYBRID direction in
> CLAUDE.md + `context/productization.md`, made concrete against what's already built.

> **Correction (Vishen, Jul 1):** the portal integrates with **BlinkWork**, *not*
> BlinkLife. BlinkLife is Vishen's personal instance; BlinkWork is the team platform,
> and **true memory powers both**. Integration is via Shafiu (Vishen: "I'm not involved
> in BlinkWork design yet, but Moniek knows"). ⚠️ The *current* `lib/blinklife/` push
> targets the **BlinkLife** MCP — so **retargeting the integration to BlinkWork** is
> itself a migration task, not just an add. Treat "true memory" as the engine and
> "BlinkWork" as the surface the portal binds to. Below, read "the brain" as BlinkWork.

### The reframe: it's a three-way split, not one migration

"Airtable → true memory" collapses three different data classes that must go to
three different homes. **Only the knowledge class actually moves to true memory.**

| Data class | Examples | Target home | Airtable's role |
|---|---|---|---|
| **Transactional workflow** | tickets, queue_rank, ticket/prio status, approvals, shoots | App-owned (Postgres now → BlinkWork app state later) | **Stays the team's editing surface** (Vishen: "let the team use Airtable right now") |
| **Reference nouns / taxonomy** | event types, asset types, people, channels, assets, metrics | Brain nodes (Phase 2/3) | Becomes a **connector** (source-in), not source of truth |
| **Knowledge / DNA / rules / insights** | "don't glorify Elon", "never say 'unlock'", "what worked" | **True memory** (notes-wiki, Open Knowledge Format) | **Migrates off Airtable rows** — this is the real move |

True memory does **not** replace the workflow DB. It is the intelligence layer the
portal *calls over MCP* — the 5 propose-only capabilities in `context/intelligence-layer.md`.

### What's already built (head start)

- **True-memory write path exists** — `lib/blinklife/` (client, map, push, outbox,
  idempotency refs). Already pushes: editor tasks (`create_task`), creative briefs →
  memory (`import_profile`), approval decisions (`capture_conversation`), and Vishen's
  weekly review page (`create_page`). Gated by `BLINKLIFE_ENABLED`; outbox drains via
  `scripts/push-blinklife.ts` / `POST /api/push/blinklife`.
- **DNA already has a clean home** — on Asset Type Airtable records
  (`dnaRequirements`, `feedbackStandards`) with a portal editor at `/settings/asset-types`
  (`lib/asset-types/repository.ts`). Not synced to Postgres (deferred).
- **Clip Rules** — separate Airtable table (`🧠 Clip Rules`) feeding the AI clip-gen
  system prompt (`lib/clipping/config.ts`, `/settings/clip-rules`).
- **Gaps:** the integration is **write-only** (portal never reads back from the brain);
  brand rules aren't stored anywhere yet; no brain-node/manifest scaffolding (still standalone).

### Migration sequence

1. **Keep workflow where it is (no migration).** Tickets/queue/statuses/approvals/shoots
   stay Airtable+Postgres. This *is* "keep Airtable for the MV workflow." Nothing to build.
2. **Add the READ path to true memory (the missing half).** Extend `lib/blinklife/client.ts`
   to call `search_notes` / `get_note` / `get_page` / `search`. This unlocks everything
   downstream — without it the brain is a write-only sink.
3. **Migrate DNA + brand rules into the brain.** Write DNA (requirements + feedback
   standards) and brand rules as **shared notes/pages** (Open Knowledge Format wiki,
   labeled e.g. `branding`, tagged by asset type) via the existing push infra. Airtable's
   DNA fields become a cached mirror/editing surface; the brain becomes source of truth for
   DNA. **Caveat to resolve:** briefs currently push via `import_profile` (personal memory);
   DNA/rules must be **org/group-scoped notes** (Vishen's "group skills, shared with the
   team"), not per-user — confirm the shared-scope note API before writing.
4. **Wire the intelligence layer to read rules at the right moments** — `/dna-review`
   (first-pass feedback against DNA), `/draft-brief` (brief grounded in rules + winners),
   and an intake-time rule check ("this names Elon Musk → check branding notes"). All
   propose-only per `intelligence-layer.md` guardrails.
5. **Brand-rule capture loop (Vishen-led).** Vishen builds the Blink Life Recorder that
   turns feedback recordings into `branding` notes automatically; the portal *consumes*
   them via step 2's read path. No portal build for the recorder itself.
6. **Later — nouns → brain nodes under the BlinkWork manifest.** Event types, asset types,
   people, assets, metrics become brain nodes; Airtable becomes a connector. Big Phase 2/3
   lift, gated on the BlinkWork monorepo's manifest format + brain-node API (`gh` reference).

### First concrete step (recommended)

Given the write path already exists, the highest-leverage first move is **steps 2 + 3
together**: add the BlinkLife read methods, then push DNA/rules as shared notes and read
them back — proving the round-trip on one asset type before the intelligence layer or any
noun migration. This is the smallest change that turns true-memory from a notification sink
into an actual knowledge layer, and it's the piece genuinely blocked on true memory (unlike
the workflow, which is fine on Airtable). Not scoped for build in this plan — flagged as the
next planning target once B1–B3 land.

---

## D. Postgres system-of-record + real-time Airtable sync (the biggest piece)

> Rhythm: "the biggest thing is the whole Postgres creation and how it will in real
> time also sync to Airtable, so for the Mindvalley team it is still a workable
> solution." This is the load-bearing decision — it's what lets the app be fast
> (Postgres) *without* taking Airtable away from the team.

**The principle:** Postgres becomes the app's system of record for the data the app
serves (fast queries, no 5 req/s cap, real lifecycle state). Airtable stays the team's
editing surface. The two are kept in step by a **bidirectional sync**, so an editor
working in Airtable and a manager working in the portal see the same truth within seconds.

**What already exists (don't rebuild):**
- One-way reference pull (Airtable → Postgres): `scripts/sync-reference.ts`,
  `lib/airtable/sync.ts` — two-pass upsert-on-`airtable_id` for employees, dimensions,
  event/asset types, shoots, calendar, authors.
- Outbound queue (Postgres → Airtable): `AirtableOutbox` Prisma model, gated by
  `AIRTABLE_PUSH_ENABLED` (drainer not yet live).
- **Echo suppression:** `Ticket.airtablePushedAt` timestamp already exists to stop an
  outbound write from bouncing back as an inbound change.

**What's missing for "real-time, both ways":**
1. **Inbound near-real-time** — today reference sync is a periodic script. Add Airtable
   **webhooks** (per CLAUDE.md §8) so team edits land in Postgres in seconds, with the
   periodic reconcile as a safety net (webhooks can drop).
2. **Outbound drainer live** — turn on the `AirtableOutbox` drainer (batch ≤10 records,
   429 exponential backoff per §8) so portal writes reach Airtable promptly.
3. **Loop-prevention hardening** — extend the `airtablePushedAt` echo-suppression pattern
   to every two-way entity (tickets, assets, approvals, shoots), and define
   **conflict/last-writer-wins** rules for a field edited on both sides in the same window.
4. **Sync health surface** — a small admin view (lag, last-reconcile, outbox depth, failed
   pushes) so "is Airtable in step?" is answerable, and drift is caught early.

**Sequencing:** reference tables are already synced one-way and safe. The real work is the
**two-way transactional loop for tickets** (then assets/approvals/shoots): webhook-in +
drainer-out + echo-suppression + reconcile. This is the piece to design carefully — it's
where a Mindvalley editor's Airtable edit and a portal action must not clobber each other.
This section is a **design target for a dedicated PRD/plan**, not scoped for build here.

---

## Next deliverables (post-approval, in order)

1. **Move this plan** into `ContentManagement/plans/` (per Rhythm's convention).
2. **True-memory clarification artifact** — a shareable page listing the open questions we
   must answer with Shafiu/Moniek before integrating BlinkWork (shared vs personal note
   scope, group-skills API, brain-node API + manifest format, how the portal authenticates
   to BlinkWork over MCP, where DNA/rules live, read + write surface). Deliverable = clarity
   on *what we don't yet know*, not an implementation.
3. **PRD (via the `/prd` skill)** for the **agents we're building now** — scoped to three:
   the **media→clip agent** (ingest source → propose clips), the **clip-editing agent**
   (approved idea → edited output), and the **DNA/Recorder + 24h-performance agent** (writes
   rules from feedback à la Blink Life Recorder + closes the 24h view-count feedback loop).
   *Excludes* the Slack `@Claude` agent for now.
4. **Postgres ↔ Airtable real-time sync** design/PRD (Part D) — the biggest technical piece.
5. Then the buildable B1–B3 items.

---

## Verification

- **B1:** `npm run dev`. Create/open a media source with clips. Confirm the "24h Data" field
  renders on the clip table (`/vishen`) and media detail (`/media/[id]`), that editing it saves
  (reload persists), and that the value round-trips to Airtable (check the record). Repeat for a
  Media Source. Run `npm run lint`.
- **B3:** With `ENABLE_DEV_LOGIN=true` locally, verify a `@mindvalley.com` employee still signs
  in and routes by role. Set `ALLOWED_EXTERNAL_EMAILS=test@agency.com`, add that email to the
  Employees list with role `Agency / External`, and confirm (a) it passes the `signIn` gate and
  (b) it lands on `/stakeholder` read-only with no editor/manager routes. Confirm a random
  non-listed external email is still rejected to `/access-denied`. Do **not** flip Kessel to
  public until the pen-test passes.
- **B2:** No build until statuses are settled; validate the design against tomorrow's meeting
  outcome, then plan field IDs/enums.
- No test runner configured; verification is manual + `npm run lint` + `npm run build`.
