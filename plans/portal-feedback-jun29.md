# Portal Feedback Round 1 (Jun 29) → PRD + Development Plan


## Context

The Jun 29 "Social Clips Strat/process" meeting (Gareth, Monique, Glenn, Rhythm; Titus/KJ
context) walked the live clip pipeline and portal end-to-end. The throughline: the system is
"already really great" but needs a feedback round before the team can stop living in
"5 Airtables + WhatsApp" and adopt it. Vision must see **requests + approvals** in one place;
the team owns the **middle**; editors must get **cut-ready** work.

This plan does two things:
1. **Capture the feedback as a PRD** using the `/prd` skill conventions
   ([skills/prd/SKILL.md](skills/prd/SKILL.md)) — a new **epic E9** with child feature PRDs,
   slotted into the existing `content-production-management` product tree (E1–E8 already exist).
2. **Implement the development changes** across the existing app.

### Decisions locked with the user
- **PRD routing:** new epic **E9 · Portal Feedback / Usability Round 1 (Jun 29)** with child
  features; cross-links into existing E3/E4/E5/E8 rather than duplicating them.
- **Primary goal (Problem/Vision):** *team can start using it for real* — breadth of unblocking.
- **Primary users (Users):** all three equally — Vision (founder), editors/designers, requesters/managers.
- **Success bar (Success Criteria):** one real **end-to-end cycle** (intake → prioritize → assign
  → produce → approve → deliver) through the portal on real Vision content, no base/WhatsApp fallback.
- **Notifications channel:** Slack DM (bot token already in repo, used by slack-scan).
- **DNA storage:** app-native editor per asset type (Prisma `Dna` model exists; do NOT depend on the
  messy Airtable DNA base).
- **Visibility:** default "my requests" + Team and Campaign toggles (not fully open).

### Detailed decisions resolved (Jun 29 Q&A) — authoritative copy lives in each E9 feature PRD
- **E9.1:** dedicated "Download link" ticket field (separate from `sourceLinks`); transcript slice best-effort (exact when caption timing exists, else paragraph window + "approx — verify" flag).
- **E9.2:** Decline takes an optional note (not required), sets Filming Status → `Cancelled`.
- **E9.3:** "My team" lets the user **pick one** of their teams; Managers/Admins also get an **All** scope on the requests view.
- **E9.4:** trigger = **asset link attached** (not a status); notify **requester (DM)** + **assignee on assignment (DM)** + post to a **new `#content-ready` channel**; dedupe via a `notifiedAt` ticket field. *(Dep: create the channel + set `SLACK_CONTENT_READY_CHANNEL_ID`.)*
- **E9.5:** revenue from the Event Type **"Average revenue"** field (`fld9G6n7iKtYlUZ0o`, confirmed) → **high/med/low** buckets → 0–1; campaign proximity is a **separate weighted term** (`w_campaign`), additive to due-date.
- **E9.6:** single preferred editor only (zero/multiple → manager); **always assign + `To Do`**, capacity not checked; fire assignee DM.
- **E9.7:** DNA only (clip-type rules stay in `/settings/clip-rules`); editable by **admins (all) + team leads (only asset types they lead)**.
- **E9.8 (multi-asset):** **DEFERRED** to a separate later effort — not part of this round.

### Already built (polish, not net-new) — confirmed via code exploration
- Vision single view: `/studio` (sign-off hero, pulse, launches, main videos, shipped) + `/studio/sign-off`, `/studio/ranking`.
- Asset Type ↔ Event Type many-to-many linking + intake filter ([components/intake/IntakeForm.tsx](components/intake/IntakeForm.tsx)).
- Admin-editable capacity & priority scoring config (commit de5fcaa; [app/settings/scoring/page.tsx](app/settings/scoring/page.tsx)).
- Clip pipeline: Opus 4.8, editable Clip Rules in Airtable, YouTube auto-discover, checkbox→ticket convert.

---

## Part 1 — PRD work (run via `/prd` conventions)

Create the epic + features under the existing product, update the parent + index. Use `created/updated: 2026-06-29`.

**New files** (paths follow SKILL.md §2.1 nesting under the product slug):
- `prd/content-production-management/portal-feedback-round-1.md` — **epic E9** (template §8.2: Purpose, User Stories, Workflows, Boundaries, Dependencies, Success Criteria, Features).
- `prd/content-production-management/portal-feedback-round-1/<feature>.md` — one **feature** PRD per cluster (template §8.3: Purpose, Behavior, Rules & Logic, Data, Failure Modes, Acceptance Criteria, Open Questions).

**Feature children (E9.1–E9.8) and the existing epic each extends:**
| Feature | Slug | Extends |
|---|---|---|
| E9.1 Cut-ready editor brief (download link + verbatim transcript) | `cut-ready-editor-brief` | E8 |
| E9.2 Shoot approvals in Studio | `studio-shoot-approvals` | E5 |
| E9.3 Team + campaign visibility toggle | `team-campaign-visibility` | E5 |
| E9.4 Slack "asset ready" notifications | `asset-ready-notifications` | E5 |
| E9.5 Scoring: revenue + campaign-calendar inputs | `revenue-campaign-scoring` | E4 |
| E9.6 Auto-assignment by preferred editor | `auto-assign-preferred-editor` | E4 |
| E9.7 DNA + rules editor per asset type | `asset-type-dna-editor` | E2/E3 |
| E9.8 Multi-asset campaign requests | `multi-asset-requests` | E3 |

**Pre-seed the epic E9 PRD from the locked decisions** (so it opens at high resolution):
- *Purpose:* close the gap between "great demo" and "daily-driver" so the merged Creative Services team
  abandons the Airtable+WhatsApp patchwork — the Jun 29 feedback round.
- *User Stories:* Vision approves shoots/clips in one view (propose-only); editor pulls a ticket and cuts
  with no follow-up questions; Glenn/Rama see team/campaign requests and get pinged when an asset is ready.
- *Boundaries:* phase-1 manual-assisted prioritization stays (CLAUDE.md §5); auto-assign only the
  unambiguous single-preferred-editor case; notifications best-effort, never block writes; DNA app-native only.
- *Dependencies:* cron/IAP access (F1), transcription engine direction (F2), portal naming sign-off (F3).
- *Success Criteria:* one real end-to-end cycle on real Vision content with no WhatsApp/base fallback.
- *Features:* E9.1–E9.8 above.

Leave genuinely-open items as `[UNRESOLVED] <what's missing>` per the skill (e.g. exact "asset ready"
trigger status in E9.4; revenue→tier mapping in E9.5). Update `prd/index.md` and the product's `children:`.

---

## Part 2 — Development workstreams

### A — Editor enablement (E9.1, E9.8, clip prompt)
**A1. Download link (Dropbox) distinct from viewing link.** Add `downloadUrl` to `📺 Media Sources` and a
download field on the ticket ([lib/airtable/field-map.ts](lib/airtable/field-map.ts)); optional input in
[components/media/MediaLinkForm.tsx](components/media/MediaLinkForm.tsx) → [app/media/actions.ts](app/media/actions.ts)
`submitMediaLink`; carry into the ticket on convert and show on [app/tickets/[id]/page.tsx](app/tickets/[id]/page.tsx).

**A2. Verbatim transcript excerpt in the editor brief.** Source transcript already stored on the Media Source.
Add `sliceTranscriptByRange` to [lib/clipping/transcript.ts](lib/clipping/transcript.ts); in `convertClipsToTickets`
([app/media/actions.ts](app/media/actions.ts)) slice to the clip's `timestampStart`–`timestampEnd` and append a
`Verbatim:` block to the brief composed via [app/intake/actions.ts](app/intake/actions.ts).

**A3. Clip prompt/skill quality pass (mostly content).** Per-clip-type rules already supported
([lib/clipping/config.ts](lib/clipping/config.ts), `🧠 Clip Rules`). Confirm `/settings/clip-rules` CRUD is reachable
in nav for admins ([lib/clip-rules/repository.ts](lib/clip-rules/repository.ts)); Gareth's team edits rules there.

### B — Vision / Founder studio (E9.2)
**B1. Surface shoot approvals in `/studio`.** Add a "Shoots awaiting your sign-off" section to
[app/studio/page.tsx](app/studio/page.tsx) fed by Filming Status = `New Requests - Needs Vishen's Review`; add
`approveShoot`/`declineShoot` in [app/studio/actions.ts](app/studio/actions.ts) flipping Filming Status
(`fldfz4B7S765leTIT`) + approval checkbox (`fldhqZbEmxjEK703f`); extend `loadStudio()`
([lib/studio/data.ts](lib/studio/data.ts)) reusing [lib/shoots/repository.ts](lib/shoots/repository.ts).
**B2.** Polish studio landing links/counts to sign-off + ranking (copy/nav only).

### C — Taxonomy, DNA & scoring (E9.7, E9.5, E9.6, dimensions)
**C1. App-native DNA + rules editor per asset type.** Build `/settings/asset-types` (admin-only via
[lib/admin/access.ts](lib/admin/access.ts), nav in [lib/roles.ts](lib/roles.ts)): edit DNA `requirements` +
`feedbackStandards` (Postgres `Dna` + link `AssetType.dnaId`), view team lead / preferred editor / dimensions.
New `app/settings/asset-types/page.tsx`, `components/settings/AssetTypeEditor.tsx` (mirror
[components/settings/ScoringConfigEditor.tsx](components/settings/ScoringConfigEditor.tsx)), `lib/asset-types/` repo.

**C2. Dimensions auto-suggest in intake.** Fetch dimensions in `getIntakeReferenceData()`
([lib/intake/data.ts](lib/intake/data.ts)); add an auto-filled-but-editable dimensions field to
[components/intake/IntakeForm.tsx](components/intake/IntakeForm.tsx) from the chosen asset type.

**C3. Scoring: revenue + campaign-calendar.** In [lib/tickets/scoring.ts](lib/tickets/scoring.ts): use per-event-type
`tierNorm` as the revenue proxy (label it "revenue tier" in the scoring admin UI) and factor a linked
`OfficialCalendar`'s `startDate`/`endDate` into urgency (not just `dueDate`); populate calendar dates where score is
computed in [lib/tickets/data.ts](lib/tickets/data.ts).

**C4. Auto-assignment by preferred editor.** In `createTicket` ([app/intake/actions.ts](app/intake/actions.ts)) and
`convertClipsToTickets`: if the asset type has **exactly one** preferred editor, set assignee + `To Do`; else leave
unassigned for the manager. Reuse `getEligibleAssignees` ([lib/tickets/data.ts](lib/tickets/data.ts)). Conservative
(single preferred editor only) per the manual-assisted principle.

### D — Visibility & notifications (E9.3, E9.4)
**D1. Team + campaign visibility toggle.** Add `My requests | My team | Campaign ▾` to
[app/stakeholder/page.tsx](app/stakeholder/page.tsx) + `getRequestsForScope(employee, scope)` in
[lib/tickets/data.ts](lib/tickets/data.ts) (team via `Employee.team`; campaign via `officialCalendarId`). Reuse the
5-column [components/tickets/QueueTable.tsx](components/tickets/QueueTable.tsx).
**D2. Campaign calendar column + filter.** Add "Campaign / Calendar" as optional column + dropdown filter in
[components/tickets/QueueTable.tsx](components/tickets/QueueTable.tsx) (reuse existing optional-column machinery);
map calendar name through in [lib/tickets/data.ts](lib/tickets/data.ts).
**D3. Slack "asset ready" DM.** New `lib/notify/slack.ts` `notifyRequesterAssetReady(ticket)` using `SLACK_BOT_TOKEN`;
resolve requester Slack user by email; fire from the ticket status-transition write path (editor drop-asset-link /
`In Review`/`Done`). Best-effort (catch + log; never block the write). *(Open: confirm exact trigger status — `[UNRESOLVED]` in E9.4.)*

### E — Multi-asset campaign requests (E9.8) — DEFERRED (not this round)
> Deferred to a separate later effort per the Jun 29 decision. Kept for continuity; do not build in this round.

Extend [components/intake/IntakeForm.tsx](components/intake/IntakeForm.tsx) to add multiple asset rows under one
request (asset type + dimensions + due date) linked to one `OfficialCalendar`; `createTicket`
([app/intake/actions.ts](app/intake/actions.ts)) fans out into N tickets sharing campaign + brief, each scored and
auto-assigned (C4) independently. Largest UI change — sequence after A–D.

### F — Infra / external dependencies
**F1.** Auto-crawl cron (`/api/media/discover`) built; needs Kessel scheduled job + Google OIDC (app is IAP-gated —
memory `deployed-app-behind-iap`). Work with MLE; no app code change.
**F2.** Transcription engine: keep provider interface swappable (Supadata + youtubei.js today,
[lib/clipping/transcript.ts](lib/clipping/transcript.ts)); add a Mindvalley engine ahead of Supadata when tech provides one.
**F3.** Portal naming (Vision dislikes "creatives"; working name "Content Studio") — confirm name before label sweep.
**F4.** External agency access (`Agency / External` role exists, gated to `/stakeholder`) — allow intake submit +
scope visibility via D1; access-policy decision.

---

## Suggested sequencing
1. **Phase 1 (unblock the live cycle):** PRD E9 skeleton, then A1, A2, B1, C4, D2.
2. **Phase 2 (team adoption):** D1, D3, C2, C3.
3. **Phase 3 (depth):** C1 (DNA editor), E (multi-asset), A3, B2.
4. **Parallel / external:** F1–F4.

## Verification
- **PRD:** `prd/index.md` shows E9 + 8 children; product `children:` updated; epic opens at high resolution with only
  the noted `[UNRESOLVED]` gaps. (`/prd list` / `/prd status` reflect it.)
- **A1/A2:** Submit a media link with a download URL → generate clips → convert one → open the ticket as editor and
  confirm the brief shows the download link **and** a verbatim transcript excerpt for the clip's range.
- **B1:** As Executive/CEO (or admin dev-login) at `/studio`, a "Needs Vishen's Review" shoot appears; Approve flips
  Airtable Filming Status to "Approved by Vishen" and clears it from the pending section.
- **C4:** Intake for an asset type with one preferred editor → ticket lands pre-assigned in that editor's `/editor`
  queue; multiple/zero preferred editors → stays unassigned in `/manager`.
- **C3:** A ticket linked to a near-deadline `OfficialCalendar` scores higher than an identical ticket with no campaign link.
- **D1/D2:** On `/stakeholder`, My team / Campaign toggles change the row set; the Campaign column + filter work.
- **D3:** Moving a ticket to the "ready" status sends the requester a Slack DM; failures are logged, not blocking.
- **C1:** Edit DNA for an asset type in `/settings/asset-types`, reload, confirm persistence in `Dna` + `AssetType.dnaId`.
- **End-to-end (the ship bar):** run one real Vision item intake → prioritize → assign → produce → approve → deliver
  fully in-portal, no WhatsApp/base fallback.
- Run `npm run lint` and `npm run build` after each workstream; `kessel preview` to validate against live Airtable data.
