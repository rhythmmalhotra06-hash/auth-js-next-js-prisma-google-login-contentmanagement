# Two-way sync: Vishen's base ⇆ portal (Media Sources + Clips)

> Supersedes the earlier "mirror generated clips" increment and extends the shipped one-way
> Major Videos → Media Sources sync ([plans/vishen-major-videos-sync.md](vishen-major-videos-sync.md)).

## Context

We want one logical dataset with the portal as its front end. Vishen works in his content base
(**Major Videos** `tblSrtPXAeiGeLUwW` + **Clips** `tblgGCaDK7W22UvSG`, base `appvBtCYdaSrD1y11`);
the team works in the portal, which is backed by the Creative Services base (**📺 Media Sources**
`tblBQhM2Blqa7uNZX` + **🎬 Clip Suggestions** `tblquXg7eesUZwvSH`). Today the sync is one-way
(new Major Videos rows → Media Sources). We want both tables kept consistent **two-way**, with
**field updates** and **clips flowing both directions**, **near-instant**.

**Confirmed decisions:** keep both tables and mirror them · two-way · sync field updates + clips
both ways (NOT deletes) · near-instant · **inbound (Vishen→portal) handled by Airtable
Automations** (Airtable→Airtable, sidesteps the IAP gate), **outbound (portal→Vishen) by app code**
(instant REST writes).

**Topology:**
- **Outbound** — portal mutates Media Sources / Clip Suggestions → app mirrors to Vishen's base via REST (instant).
- **Inbound** — Vishen edits/creates in his base → Airtable Automation script upserts into Media Sources / Clip Suggestions via the Airtable API (instant).
- Only Vishen's base carries automations, so an outbound write never echoes back into a loop; every write is **diff-guarded** (write a field only if its value actually changed), which fully breaks ping-pong.

## Correlation keys (the backbone)
Each side stores its counterpart's record id for O(1) upsert in both directions:
- Media Sources `Source Record ID` (`fldaSr62jen1C1wgI`, exists) = Major Video recId.
- **New** `App Clip ID` (singleLineText) on Vishen **Clips** = Clip Suggestion recId.
- **New** `Vishen Clip ID` (singleLineText) on **Clip Suggestions** = Vishen Clips recId.

## Field mapping (shared fields only — diff-guarded, last-write-wins)

**Major Videos ⇆ Media Sources:** `Name ⇆ Title` · `Final URL (else Draft) ⇆ Source URL`
(Dropbox/non-YouTube link also → `Download URL`) · `Select (type) ⇆ Guest/Show`.
*Not synced* (different meaning / app-only): Status (Vishen Todo/In-progress/Done vs MS
New/Transcribing/…), Strategy JSON, transcript, ticket taxonomy, submittedVia, audience, Filmed,
Assignee, Notes.

**Vishen Clips ⇆ Clip Suggestions:** `Name ⇆ Name/hookLine` · `Notes ⇆ composed brief`
(hook / rationale / caption / range) · parent link via correlation (`Clips.Source`=MajorVideo ⇆
`ClipSuggestion.mediaSource`=MediaSource resolved through `Source Record ID`) · **Status map**:
Proposed⇆Todo, Approved⇆In progress, Dismissed→(stays Todo in Vishen), Vishen Done→app Approved.
*Not synced:* Vishen `Type` (duration) vs app `format` (treatment) — no clean map; `Draft` url (no app field).

## Implementation

### A. Airtable schema (2 new fields)
- Vishen **Clips** `tblgGCaDK7W22UvSG`: add **"App Clip ID"** (singleLineText, hide in views).
- **Clip Suggestions** `tblquXg7eesUZwvSH`: add **"Vishen Clip ID"** (singleLineText).

### B. `lib/airtable/field-map.ts`
- Add `VISHEN_CLIPS` export (baseId `vishenContent`, tableId `tblgGCaDK7W22UvSG`, fields:
  `name fldgUxxaSXsYeplFe`, `source fldAyfIU17piBfHZQ`→MajorVideos, `status fldrBTX1eD26lPZx1`,
  `notes fldD5qTTkth62Fuyy`, `appClipId <new>`; `status_ {todo:'Todo', inProgress:'In progress', done:'Done'}`).
- Add `vishenClipId` to `CLIP_SUGGESTIONS.fields`.

### C. App outbound (portal → Vishen base), instant + diff-guarded — `lib/media/major-videos.ts`
- `pushMediaSourceToMajorVideo(ms)`: if `ms.sourceRecordId`, read that Major Video, write only
  changed shared fields (Name/URL/type). Called at the end of `updateMediaSource` /
  `createMediaSource` (repository.ts) when `sourceRecordId` is set.
- Clips both ways — app→Vishen:
  - `mirrorClipsToVishenBase(majorVideoRecId, clips, appClipIds)` — batch-create Vishen Clips
    rows (`Source`=[majorVideoRecId], `Status`='Todo', Name, Notes, `App Clip ID`=appClipId), then
    write each new Vishen recId back onto its Clip Suggestion's `Vishen Clip ID`. Called from the
    suggest route success path (`app/api/media/[id]/suggest/route.ts`) when `source.sourceRecordId`
    is set. (`createClipSuggestions` must return created ids — extend its return to `{count, ids}`.)
  - `updateClipSuggestion` (repository.ts): when status changes, if the clip has a `Vishen Clip ID`,
    push the mapped Status to that Vishen Clips row (diff-guarded). Covers both approval paths
    (`app/vishen/actions.ts`, `app/media/actions.ts`) since both call it.
- Gate all outbound writes behind an env flag (`VISHEN_SYNC_ENABLED`) mirroring the
  `AIRTABLE_PUSH_ENABLED` pattern, and make them best-effort (never fail the user action).

### D. Airtable Automations (inbound, Vishen's base) — set up by Rhythm; scripts provided
Two automations, each trigger **"When a record is created or updated"**, action **"Run a script"**.
The plan ships the two scripts (`docs/airtable-automations/`), each: reads the changed record,
finds its counterpart in the Creative Services base via the correlation key (or creates it),
and writes only changed fields (diff-guarded). A PAT with read on `appvBtCYdaSrD1y11` + write on
`appFEFygXo2pRc8AR` is set as the automation's secret input.
1. **Major Videos → Media Sources:** upsert MS where `{Source Record ID}` = record id (create with
   `Source Record ID`, `Submitted Via`='Airtable', Status 'New' if new; else patch shared fields).
2. **Vishen Clips → Clip Suggestions:** **skip rows that already have `App Clip ID`** (app-originated —
   avoids re-creating). For Vishen's manually-added clips: resolve parent MS via the Major Video's MS,
   upsert a Clip Suggestion (Status from the map), and stamp `App Clip ID`/`Vishen Clip ID` both ways.

### E. Reconcile backstop
The shipped hourly `/api/media/sync-major-videos` stays as a low-frequency safety net (idempotent
upsert on `Source Record ID`) in case an automation is disabled/fails; the automation is primary
for near-instant. No change needed beyond noting it.

## Critical files
- `lib/airtable/field-map.ts` — `VISHEN_CLIPS`, `CLIP_SUGGESTIONS.vishenClipId`
- `lib/media/repository.ts` — `createClipSuggestions` ids, `updateClipSuggestion` status push, outbound hooks in create/update MediaSource
- `lib/media/major-videos.ts` — `pushMediaSourceToMajorVideo`, `mirrorClipsToVishenBase`
- `app/api/media/[id]/suggest/route.ts` — call clip mirror on success
- `docs/airtable-automations/major-videos-to-media-sources.js` + `vishen-clips-to-clip-suggestions.js` *(new)* — the two automation scripts + a README with trigger config & PAT setup
- Reuse: `createRecord`/`updateRecord`/`createRecords`/`listRecords` (`lib/airtable/rest.ts`), `parseVideoId`/`derivePlatform` (`lib/media`)

## Security note
The inbound automation scripts hold a PAT scoped to just these two bases; it's visible to base
collaborators of Vishen's base. Use a dedicated least-privilege PAT, not the broad app token.

## Verification (end-to-end)
1. **Inbound create:** add a Major Video (with URL) in Vishen's base → within seconds a Media
   Source appears (Source Record ID set). Add a row in his Clips table → a Clip Suggestion appears
   (Proposed), parent-linked to the right Media Source.
2. **Inbound update:** rename a Major Video / change its URL → the Media Source updates; no loop.
3. **Outbound update:** edit Title/URL on a Media Source in the portal → the Major Video updates.
4. **Clips app→Vishen:** `/media/[id]` → Suggest clips → Clip Suggestions created AND Vishen Clips
   rows appear (Source-linked, App Clip ID set). Approve in `/vishen` → Vishen row → In progress.
5. **No echo:** after each of the above, confirm the originating side isn't re-written in a loop.
6. `npx tsc --noEmit`, `npx eslint <touched>`, `npm run build` clean.

**Out of scope (per decisions):** delete/archive propagation; Status taxonomy sync on the
media level; conflict resolution beyond last-write-wins.
