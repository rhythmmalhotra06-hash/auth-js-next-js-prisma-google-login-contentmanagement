# Vishen "Major Videos" → Media Sources sync + Studio surfacing

## Context

Vishen logs his films in a **"Major Videos"** table (`tblSrtPXAeiGeLUwW`) in his own content
base (`appvBtCYdaSrD1y11`) — the exact gap Gareth flagged: that media never reaches the
Creative Services pipeline, so nothing gets produced from it. We want three things:

1. **Sync** — new films Vishen logs there automatically create rows in the existing
   **📺 Media Sources** inbox (`tblBQhM2Blqa7uNZX`, Creative Services base `appFEFygXo2pRc8AR`)
   that already drives clip suggestion → ticket creation.
2. **Surface in the Studio** — these (his media + the clips generated from them) are the most
   important items to Vishen, so they get **pinned to the top** of his Studio (`/studio`).
3. **Add from the Studio** — Vishen can add a new media source directly from the Studio, which
   creates the Media Source **and** writes a row back into his Major Videos base.

This reuses the app's existing auto-discover pattern (`/api/media/discover` → dedupe →
`createMediaSource()`, run by the hourly GitHub Actions cron `media-auto-discover.yml`).

## Decisions (confirmed) & assumptions to confirm

**Confirmed with Rhythm:**
- **Trigger:** sync a Major Videos row only when it has a **Final URL or Draft URL** (skip
  filmed-but-no-link rows). **No backfill** — only rows created after go-live.
- **Content "type"** (Podcast by Vishen / Youtube Long / Masterclass / Vishen on Stage / etc.):
  captured into the **existing "Guest / Show"** text field (no new structured field). For now
  it's **informational only** — it does not auto-pick Event/Asset Type.
- **Studio top section:** show **both** Vishen's synced media **and** the clip suggestions
  generated from each.
- **Add from Studio:** creates **both** a 📺 Media Source **and** a row back in Major Videos.

**Assumptions worth a glance (call out if wrong):**
- "Vishen studio" = the **`/studio`** founder cockpit (not the `/vishen` clips workbench). The
  add-media entry and pinned section go on `/studio`, reusing components from `/vishen`.
- We add **one internal field** "Source Record ID" (`singleLineText`) to 📺 Media Sources —
  this is *not* a user input, it's provenance/dedupe (see §1). It's the only reliable way to
  (a) avoid duplicates across the sync + write-back loop and (b) mark a row as "Vishen media"
  for the Studio filter. Alternative is URL-only dedupe, which breaks when a Draft URL is later
  replaced by a Final URL.

## Prerequisites (blockers)

The app uses **one** Airtable PAT (`AIRTABLE_TOKEN`/`AIRTABLE_API_KEY`, `lib/airtable/rest.ts:56`).
- **Read** access to `appvBtCYdaSrD1y11` is required for the sync.
- **Write** access to `appvBtCYdaSrD1y11` is required for the "add from Studio → write back to
  Major Videos" flow.
Grant both on the token (Airtable builder hub) before this works in prod.

---

## Implementation

### 1. New provenance field on 📺 Media Sources
Add `singleLineText` **"Source Record ID"** to `tblBQhM2Blqa7uNZX`. Stores the originating Major
Videos record id. Used as the dedupe key (sync + write-back never double-create) and as the
"this is Vishen media" marker for the Studio. Aligns with CLAUDE.md §8 (always store
`airtable_id` for provenance).

### 2. `lib/airtable/field-map.ts`
- `BASES`: add `vishenContent: 'appvBtCYdaSrD1y11'`.
- New `MAJOR_VIDEOS` export: baseId `vishenContent`, tableId `tblSrtPXAeiGeLUwW`, fields —
  `name: fldLy51h0yvJy7OP9`, `finalUrl: fldxHwImLHdsDWfuL`, `draftUrl: fldsqShd2qV1K1sae`,
  `select: fldoMVNmdmVEPz1Uc` (the content-type multi-select, for write-back).
- `MEDIA_SOURCES.fields`: add `sourceRecordId` (id from step 1).

### 3. `lib/media/repository.ts`
- `MediaSource` interface + `mapSource()`: add `sourceRecordId`.
- `CreateMediaSourceInput` + `createMediaSource()`: accept optional `sourceRecordId` (write to
  `MF.sourceRecordId`). `guestShow` + `downloadUrl` already supported.
- Add `existingSourceRecordIds(): Promise<AirtableResult<Set<string>>>` — mirrors
  `existingSourceUrls()` (`repository.ts:173`) but collects the new field.

### 4. `lib/media/major-videos.ts` (new)
- `recentMajorVideos(cutoffISO)`: `listAll(MAJOR_VIDEOS.baseId, …)` with
  `filterByFormula = AND(IS_AFTER(CREATED_TIME(), DATETIME_PARSE('<cutoff>')), OR({Final URL}!='', {Draft URL}!=''))`,
  mapping records to `{ id, name, finalUrl, draftUrl, type }` (type = first Select value name).
- `createMajorVideo({ title, url, type })`: `createRecord(MAJOR_VIDEOS.baseId, …)` setting Name,
  Final URL, and Select. Returns the new recId — used by the write-back add flow (§7).
- `syncMajorVideos()`: fetch candidates + `existingSourceRecordIds()`; for each id not seen,
  pick canonical URL (Final→Draft), derive platform (reuse `parseVideoId`, `lib/media/youtube.ts:15`:
  YouTube → "YouTube", else "Other"; Dropbox/file link → also set `downloadUrl`), and call
  `createMediaSource({ title, url, downloadUrl?, platform, guestShow: type, submittedVia: 'Airtable', sourceRecordId: id })`.
  Return `{ scanned, added, failed }`.

### 5. `app/api/media/sync-major-videos/route.ts` (new)
Copy `app/api/media/discover/route.ts` verbatim in shape: `runtime='nodejs'`, the
`x-discover-secret` gate, `POST` + `GET = POST`. Cutoff from `process.env.MAJOR_VIDEOS_SYNC_AFTER`
(ISO date; default to a constant go-live date so it never backfills). Calls `syncMajorVideos()`.

### 6. `.github/workflows/media-auto-discover.yml`
Add one line to the existing hourly job: `call /api/media/sync-major-videos`.

### 7. Add-from-Studio (creates both) — `app/media/actions.ts` + Studio UI
- Relax `submitMediaLink`: the `YT_RE`-only guard (`actions.ts:35-40`) rejects Dropbox/Vimeo.
  Accept any non-empty URL; derive platform from it (YouTube → YouTube else Other) instead of
  hardcoding `'YouTube'` at `actions.ts:48`. Add optional `type` to `SubmitMediaInput`
  (written to `guestShow`) and a `writeBack?: boolean` flag.
- When `writeBack` is set (the Studio entry point), first call `createMajorVideo()` (§4) to
  insert into Vishen's base, then `createMediaSource({ …, submittedVia: 'Portal', sourceRecordId: <new Major Videos id> })`.
  Carrying the recId means the next sync run sees the Major Videos row as already-mirrored and
  skips it (no duplicate).
- UI: add an add-media entry to `/studio` (a Studio-styled variant of
  `components/vishen/NewMediaCard.tsx`) with URL + Title + a **type** dropdown (the 6 Major
  Videos options) → calls `submitMediaLink({ …, type, writeBack: true })`.

### 8. Studio top section — `app/studio/page.tsx` + `lib/studio/data.ts`
- `getVishenMedia()` (`lib/studio/data.ts:200`): replace the brittle `"vishen"` substring with
  `m.sourceRecordId != null` (keep the substring as a fallback for pre-existing rows).
- In `loadStudio()`, also load clip suggestions for the top Vishen media (their
  `clipSuggestionIds` are already on each `MediaSource` → `getClipsByIds()`), so the section can
  show media **with** their clips.
- `app/studio/page.tsx`: move the "Main Videos → clip ideas" block (currently #4, lines 49-55)
  to the **top** (above/just under `SignOffHero`), render media each with its clips nested
  (extend `components/studio/ClipsList.tsx` or a new `VishenMediaCard`), and place the
  add-media entry from §7 at the head of this section.

### 9. Env
- `MAJOR_VIDEOS_SYNC_AFTER` (plain var, go-live date) — `kessel env set` before `kessel deploy`.
- Confirm PAT read+write on `appvBtCYdaSrD1y11` (Prerequisites).

## Critical files
- `lib/airtable/field-map.ts` — `BASES`, new `MAJOR_VIDEOS`, `MEDIA_SOURCES.fields.sourceRecordId`
- `lib/media/repository.ts` — `createMediaSource` (+ `sourceRecordId`), new `existingSourceRecordIds()`
- `lib/media/major-videos.ts` *(new)* — fetch / sync / create-back
- `app/api/media/sync-major-videos/route.ts` *(new)* — cron route (pattern: `app/api/media/discover/route.ts`)
- `.github/workflows/media-auto-discover.yml` — one extra `call`
- `app/media/actions.ts` — relax URL guard, derive platform, `type` + `writeBack`
- `app/studio/page.tsx` + `lib/studio/data.ts` (`getVishenMedia`, `loadStudio`) — pin top section + clips
- `components/studio/ClipsList.tsx` (+ a Studio add-media card adapted from `components/vishen/NewMediaCard.tsx`)
- Reuse: `parseVideoId` (`lib/media/youtube.ts:15`), `listAll`/`createRecord` (`lib/airtable/rest.ts`), `getClipsByIds` (`lib/media/repository.ts:276`)

## Verification (end-to-end)
1. **Token:** one-off `listRecords(appvBtCYdaSrD1y11, tblSrtPXAeiGeLUwW)` returns rows (not 401).
2. **Sync:** locally set `MAJOR_VIDEOS_SYNC_AFTER` to yesterday, add a new Major Videos row with
   a Final URL + a Select type, `curl -X POST localhost:3000/api/media/sync-major-videos` →
   `{ added: 1 }`; confirm a 📺 Media Source appears (Status New, Submitted Via Airtable,
   Guest/Show = the type, Source Record ID set). Re-run → `{ added: 0 }` (dedupe holds).
3. **Filters:** a URL-less row, and a row created before the cutoff, are not mirrored.
4. **Studio top:** `/studio` shows the Vishen media + clips pinned at the top.
5. **Add-from-Studio (both):** use the Studio add-media entry with a Dropbox URL + type →
   confirm a new Major Videos row appears in Vishen's base AND a Media Source is created carrying
   that recId; the next sync run does **not** duplicate it.
6. Deploy: `kessel env set MAJOR_VIDEOS_SYNC_AFTER=<go-live>`, `kessel deploy`; the hourly Action
   picks up the new `call`.
