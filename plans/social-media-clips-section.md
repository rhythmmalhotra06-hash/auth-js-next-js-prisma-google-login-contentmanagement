# Plan — Social Media Clips Section (marketing-facing clip engine)

> **Plan location:** on approval, this is saved to the repo at `plans/social-media-clips-section.md` (project convention — plans live in-repo, version-controlled with the code).
>
> **Build method:** implement directly, matching this repo's patterns. Do **not** use the `/build-feature` skill — it targets the BlinkWork monorepo (`apps/api` NestJS domains, `packages/shared` Zod DTOs, `pnpm turbo`) and a resolved `prd/` feature PRD, neither of which applies to this standalone Next.js App-Router app.

## Context

Glenn (Marketing division) asked for the social board in the content portal to be the
**single entry point** for clips: paste a media link → AI generates clip suggestions →
they land as `Proposal` records → a human checks a box → a ticket is raised. Today the
social workflow is split (Glenn hand-types a clip idea and clicks "raise ticket"; the
clip engine generates suggestions but isn't wired to ticketing).

We already have this exact engine for the **Creatives** team at `/media` ("Clips"). This
plan stands up a **parallel "Social Media" section** for the **Marketing division**, backed by a
**different Airtable base** (Content & Comms `app9YRZOVeE65fJPA`, table `📣 Social`
`tblCcrdkHzOakOGnm`) so each team keeps its own source of truth, while everything still
flows into Prio tickets.

**Audience split (decided):** Clips (`/media`) is for editors/designers/managers/approvers/
Vishen/execs/admins. Social Media (`/social`) is for the **Marketing division** (+ admins).
A recent change made Marketing see Clips — **that is reverted here**; Marketing gets Social instead.

**Settled decisions:**
1. **Reuse the live `📣 Social` table** — write `Proposal` rows directly (no parallel staging table). Schema verified live; all brief field IDs match.
2. **Propose-only** — the portal never raises tickets. A human sets Asset Type + checks `Raise Request (Creative)`; an **Airtable scripting automation** fans out the Prio ticket(s).
3. **Marketing → Social only.**

## Verified live schema (Content & Comms `app9YRZOVeE65fJPA`)

**`📣 Social` `tblCcrdkHzOakOGnm`** — write target. Field IDs confirmed:
`Title fldBDHsk0YiLMiCqX` · `Notes/Brief fldJc3ZNwn42yMW35` · `Status fld8F8Z05DIzh5BJM`
· `💿 Social Format fldo8ICzfKnVyLcTG` · `🛎️ Content Type fld8uZNn5D7jzPc3Z`
· `✍️ Social Media Captions fldCpBMCWeGwmyYpx` · `► Transcript fldyonJXP12e5Sbv8`
· `Asset Type fldWJgCJ10WnRe62U` (link) · `Raise Request (Creative) fldrNumf2EpoRetuf` (checkbox)
· `Creative Request flddCgrgYAcBMFcs9` (link → Prio) · `Source fld7YXXp8jZ7hoWXG` (singleSelect)
· mirror lookups: `Ticket Status fldUGnlpLFdtiJ7L1`, `Prio. Status fld64iay3SwDuZ3hY`,
`Assigned Creative fld14fMuJKBy3q75v`, `🔗 Asset Link fldul5ssC2XaZ8FRL`.

- **`Status` options (confirmed):** `1: Proposal` → `2: Approved` → `2A. Ticket Raised`; `13: Reject` for the feedback loop.
- **`Source` options:** only `📣 MV Content & Comms` exists → **add a "🤖 Clip Engine" option** to tag engine origin.

**`🎯 Prio: Creatives Requests (New)` `tblojUG9wmfTru9Wc`** — ticket target (same base):
`Name fldcLqx95hRTklFFq` · `Creatives Ticket Notes fldcyhu1RbiQkijhp` · `🛎️ Asset Type fldN8xTDWr9wnAPzd`
· `🧩 Event Type fldmgva6SQHXPAMUr` · `🔗 Asset Link fldWiQd06dYvjzugW` · `Team/Service Level fldHWXRcyhKshGaS2`
(default option `Social Media Video`) · `Prio. Status fld7kNhgIYw5tk0au` (new tickets → `New Request`)
· reciprocal link back `📣 Social fldaBYvP6gkirDDw8`.

Lookups: Creative Asset Type `tbllRbb2EN4eFyNcF`, Event Type `tbllaHs9MyTFNzsNU`.

> Re-verify these IDs at build start (`get_table_schema`) — Glenn is mid-cleanup on this base.

## Reuse (do not rebuild)

- **Clip engine** — `lib/clipping/generate.ts` (Anthropic `claude-opus-4-8`, structured output via `STRATEGY_SCHEMA`), `lib/clipping/schema.ts` (`ReelsClip` shape: hookLine/timestamps/format/viralityScore/caption/rationale), `lib/clipping/anthropic.ts`, `lib/clipping/prompt.ts`, `lib/clipping/transcript.ts` (YouTube transcript, Node runtime). Engine is base-agnostic — returns a `Strategy`; we just persist the result elsewhere.
- **Airtable write layer** — `lib/airtable/rest.ts` (`createRecords` batches ≤10 + 5 req/s queue + 429 backoff, `updateRecord`, `listAll`, `AirtableResult` discriminated union). Token from `AIRTABLE_TOKEN`.
- **Repository pattern** — clone the shape of `lib/media/repository.ts` (interface → mapper → list/create/update).
- **UI primitives** — `components/ui/*` (Button, Badge, Kpi, Field/Select, Icon, SearchableSelect, AppShell). Suggestion-card UX mirrors `components/vishen/ClipBoard.tsx` + `components/vishen/ClipActions.tsx`. Link form mirrors `components/media/MediaLinkForm.tsx`.
- **Propose→commit pattern** — the brief's flow mirrors the existing checkbox-driven convert; we implement the commit half as an Airtable automation (the `docs/airtable-automations/*.js` scripts are the template).

## Changes

### 1. Airtable field-map (`lib/airtable/field-map.ts`)
- Add `BASES.contentComms = 'app9YRZOVeE65fJPA'`.
- Add a `SOCIAL` block (baseId `contentComms`, tableId `tblCcrdkHzOakOGnm`) with the verified field IDs above + a `status_` map (`proposal: '1: Proposal'`, `approved: '2: Approved'`, `ticketRaised: '2A. Ticket Raised'`, `reject: '13: Reject'`) and `source_.clipEngine`.
- Add a `SOCIAL_PRIO` block (tableId `tblojUG9wmfTru9Wc`) for any portal reads of ticket state (mirror lookups already cover most display needs).

### 2. New `lib/social/` module
- `lib/social/repository.ts` — `SocialSuggestion` interface + `mapSuggestion`; `createSocialSuggestions(sourceUrl, clips[])` (batch-writes `Proposal` rows: Title=hookLine, Notes/Brief=rationale+source link, Captions, Transcript segment, Social Format, Source=🤖 Clip Engine, Raise Request unchecked, Creative Request empty); `listSocialSuggestions()` (filter Source=Clip Engine, group by source link); `getSocialSuggestion`; `updateSocialSuggestion(id, {status, assetTypeId?})` for approve/reject + set Asset Type.
- `lib/social/guard.ts` — `requireSocialAccess()` mirroring `lib/studio/guard.ts`: allow `isAdmin || isMarketingDivision(division)` (plus managers/approvers/execs may open via link for oversight); else `redirect(homeRouteForRoles(roles))`.

### 3. Access / nav (`lib/roles.ts`)
- **Revert Marketing→Clips:** remove `|| marketing` from the `/media` gate in `navForRoles` (currently line ~135) and drop the Marketing branch from the `/media` case in `canSeeNav`. Keep `isMarketingDivision` (still used below). Clips reverts to `mgr || ed || exec || isAdmin`.
- **Add Social nav:** in `navForRoles`, `if (marketing || isAdmin) items.push({ href: '/social', label: 'Social Media', icon: 'share2'/'film', group: 'Library & media' })`.
- **Add `canSeeNav` case** for `'/social'` → `isMarketingDivision(division)` (admins already short-circuit).
- (No `AdminAccess`/`AppShell` change — `division` is already threaded through from the earlier work.)

### 4. Social section UI + actions
- `app/social/page.tsx` — board: "Generate clip suggestions" CTA + list of Proposal cards grouped by source media, each showing hook/format/virality/caption, Approve / Reject controls, an Asset Type `SearchableSelect`, and the read-only mirror fields (Ticket Status, Prio Status, Assigned Creative, Asset Link) once a ticket exists. Calls `requireSocialAccess()`.
- `app/social/new/page.tsx` + `components/social/SocialLinkForm.tsx` — paste media link + title; submit → generate.
- `app/social/actions.ts` — `approveSocialSuggestion` / `rejectSocialSuggestion` (status → `2: Approved` / `13: Reject`), `setSocialAssetType` (sets Asset Type link). **No ticket creation here** (automation owns it). `revalidatePath('/social')`.
- `app/api/social/suggest/route.ts` (Node runtime) — mirror `app/api/media/[id]/suggest/route.ts`: fetch transcript → `generateStrategy()` → `createSocialSuggestions()`. (API route, not server action, because transcript fetch needs the Node runtime.)
- `components/social/*` — `SocialBoard`, `SocialSuggestionCard`, `SocialActions` (adapt the `vishen/ClipBoard` + `ClipActions` markup using `components/ui/*`).

### 5. Airtable schema touches (via Airtable MCP at build, or hand to Glenn)
- Add `Source` single-select option **"🤖 Clip Engine"** on `📣 Social` (`fld7YXXp8jZ7hoWXG`).
- Add a single-line text field **"Clip Source URL"** on `📣 Social` for grouping/provenance + regeneration (one tiny field — needed because reuse of the single table has no parent "media source" row to group children by). Add its ID to the `SOCIAL` block.

### 6. Airtable automation (deliverable script + setup doc)
- `docs/airtable-automations/social-proposals-to-prio.js` — clone the structure of `docs/airtable-automations/clip-suggestions-to-vishen-clips.js`, but **intra-base** (native `base.getTable(...).createRecordsAsync`, no PAT needed):
  - **Trigger:** record created/updated on `📣 Social`.
  - **Gate:** `Status === '2: Approved'` AND `Asset Type` set AND `Raise Request (Creative)` checked AND `Creative Request` empty (idempotent — skip if already raised).
  - **Action:** for **each** linked Asset Type, create one Prio ticket (`tblojUG9wmfTru9Wc`): Name/Title, brief → `Creatives Ticket Notes`, `🛎️ Asset Type`, `🧩 Event Type`, `Team/Service Level` default `Social Media Video`, `🔗 Asset Link`; set reciprocal `📣 Social` link on the ticket; write the new ticket id back into `Creative Request` on the Social row; flip `Status` → `2A. Ticket Raised`. **Preserve the checkbox.** Multiple asset types → multiple tickets.
  - Update `docs/airtable-automations/README.md` with setup steps + the idempotency/loop-avoidance notes.

### 7. Dev-login (test affordance)
- `app/dev-login-action.ts` — set `devDivision: 'Marketing'` for a dev login option so the Social surface is testable locally (`getAdminAccess` already reads `devDivision`).

## Out of scope
- Building the clip engine (reused as-is). Social-tuned clip rules can come later via a `clipType`.
- The prompt-improvement loop logic itself — but rejected suggestions are **retained** (`13: Reject`, not deleted) so it can be built next.
- Auto-assignment beyond the automation's optional preferred-editor pre-fill.
- Any cross-base hop — Social + Prio are the same base, so a native Airtable automation suffices (no Make.com).

## Verification (end-to-end)
1. `npm run lint` + `npx tsc --noEmit`.
2. Dev-login as a Marketing user (devDivision=Marketing): confirm sidebar shows **Social Media** and **not** Clips; confirm a non-marketing role still sees Clips and not Social.
3. On `/social/new`, paste a real YouTube link → confirm N suggestion cards render **and** N `1: Proposal` rows appear in `📣 Social` (verify via Airtable MCP `list_records_for_table`), Source = 🤖 Clip Engine, Raise Request unchecked, Creative Request empty.
4. Reject one card → row flips to `13: Reject` and is retained (not deleted).
5. Approve another, set an Asset Type, check `Raise Request (Creative)` in Airtable → automation creates exactly one Prio ticket per asset type in `tblojUG9wmfTru9Wc`, each linked back to the Social row; `Creative Request` populated; `Status` → `2A. Ticket Raised`; checkbox preserved. Two asset types → exactly two tickets.
6. Confirm the card's mirror fields (Ticket Status / Prio Status / Assigned Creative / Asset Link) now populate without opening Airtable.
7. End-to-end validation with Khairul on a real media link before rollout.
8. Deploy via `kessel deploy`; `AIRTABLE_TOKEN` must have read/write on `app9YRZOVeE65fJPA`.

## Key files
- Edit: `lib/roles.ts`, `lib/airtable/field-map.ts`, `app/dev-login-action.ts`, `docs/airtable-automations/README.md`
- New: `lib/social/{repository,guard}.ts`, `app/social/{page,new/page,actions}.tsx`, `app/api/social/suggest/route.ts`, `components/social/{SocialBoard,SocialSuggestionCard,SocialActions,SocialLinkForm}.tsx`, `docs/airtable-automations/social-proposals-to-prio.js`
- Reuse unchanged: `lib/clipping/*`, `lib/airtable/rest.ts`, `lib/admin/access.ts`, `components/ui/*`
