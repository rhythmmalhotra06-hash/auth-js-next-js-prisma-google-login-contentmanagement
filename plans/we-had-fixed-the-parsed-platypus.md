# Titus meeting follow-ups (2026-09-08) — DNA wiring, ticket fields, intake gating

## Context

From the Titus / Rhythm sync on 2026-09-08 plus Rhythm's notes. Nine asks, one of which
turned out to be a much bigger bug than reported. Everything below was verified against live
Airtable and the code, not inferred.

### The headline finding

Titus reported *"DNA exists already for Masterclass Trailer but the output was there is none."*
It is not one asset type — **the DNA review has never had any DNA at all.**

| Airtable field on 🛎️ Creative Asset Type | Mapped in app? | Populated |
|---|---|---|
| `DNA / Requirements` `fldogRGYGUJq6rHIX` | ✅ read by `getDnaReviewConfig` | **0 of 118** |
| `Feedback Standards` `fldhlP1atHGC6diSS` | ✅ read | **0 of 118** |
| `DNA` `fldK5PcSa9cw8tSj4` | ❌ | **72** |
| `Video/Virality DNA` `fldJ6iykUqJWL4loZ` | ❌ | populated |
| `Process DNA` `fldMLua28x8DVMbQd` (url) | ❌ | 0 — Titus will fill |
| `DNA link` `fldN8Nrq7q480lWjx` (url) | ❌ | 0 |

`lib/dna-review/config.ts:33-40` builds its baseline from only the first two, so every review
has run on the literal placeholder *"No DNA requirements or feedback standards have been
written for this asset type yet."* The stale note at
[lib/airtable/field-map.ts:252-255](lib/airtable/field-map.ts#L252-L255) predicted this
("DNA is deferred from v1… Revisit when DNA integration is designed") and was never revisited.

### The second finding: "feedback link" already exists, mislabelled

Titus: *"the folder link is normally not there because when it's review it's going on Dropbox
Replay, then we have it in the feedback link."* Verified on the live TAM Masterclass Trailer
ticket (`rec2ZVPlVTOfINW0c`, status Review):

- `fldRQRCJXQ6U4SKLq` — the column the app calls `assetFolderLink` and **labels "Asset Folder
  Link"** — is live-named **"Feedback Link"** and contains
  `https://replay.dropbox.com/share/ifvAvAvOJCV3Zofk`.
- `fldaOh1PVfKxz5FNR` — app `workingFiles`, labelled **"Working Files"** — is live-named
  **"Final Output Folder Link"**, and is empty until after approval.

The app's two labels are inverted from reality. This also explains the parked Replay work: the
231 tickets whose "video URL" resolves to `replay.dropbox.com` are simply **tickets in review**.

### The third finding: why Titus is read-only

[lib/airtable/field-map.ts:246](lib/airtable/field-map.ts#L246) maps `teamLeads` to
`fldwO5GJ7OUoeJHfL`, which is live-named **"Sub Lead"**. The real `Team Lead` field is
`fld0cS6VU1olTKkMM`, unmapped — and it links to a **second** employees table
(`tblC0gR8ZVw4WzOwx`, "EMPLOYEES") whose record ids are disjoint from the `👬 Employees`
table the app mirrors. On Masterclass Trailer: Team Lead = Titus, Sub Lead = Jia Wen Liu. So
"team lead" means "sub lead" everywhere, and Titus (role `Manager`, not `Admin`) fails the
`canEdit` check on every asset type.

---

## Phase 1 — DNA actually reaches the review

**Decision: upstream default, portal override.** Precedence lives in code, so the two
interfaces cannot silently diverge. `DNA` is a *synced-source* field (the table carries
`Sync Source` `fldoAFVIeCt2IXoS3`), therefore **read-only in this base** — the portal can never
write back into it, which is why a literal two-way sync isn't available.

1. **Map the fields** — [lib/airtable/field-map.ts](lib/airtable/field-map.ts) `ASSET_TYPES.fields`:
   `dna`, `viralityDna`, `dnaLink`, `processDnaUrl`, `processDnaSummary` (`fldOX3USnD6o8QMp4`),
   `processDnaTitle` (`fldAbr42P5qg1RKnt`). Comment them **READ-ONLY (synced source)** — writing
   one fails the whole ticket push, exactly as the deleted-field incident at
   [field-map.ts:64-77](lib/airtable/field-map.ts#L64-L77) documents.
2. **Schema** — add `dnaUpstream`, `viralityDna`, `dnaLink`, `processDnaUrl`, `processDnaSummary`
   (all `String?`) to `AssetType`. Author in `prisma/schema.prisma`, generate with
   `prisma migrate diff`, apply with `kessel db migrate` — never `prisma migrate deploy`
   (`[[kessel-db-access-reality]]`).
3. **Sync** — carry them in `mapAssetType` ([lib/airtable/sync.ts:130-145](lib/airtable/sync.ts#L130-L145))
   and the upsert scalars (`sync.ts:234-243`).
4. **Precedence** — in `getDnaReviewConfig` ([lib/dna-review/config.ts:29](lib/dna-review/config.ts#L29)):
   baseline = portal override (`dnaRequirements` / `feedbackStandards`) when non-empty, else
   upstream (`dnaUpstream` + `viralityDna`), plus `processDnaSummary` when present. Keep the
   existing placeholder only when both are empty. Note the 60s cache (`config.ts:15`) is never
   invalidated by a sync — acceptable, but say so in a comment.
5. **One-time backfill** so Airtable shows the same text the review uses: copy `DNA` →
   `DNA / Requirements` for the 72, via the existing writable-field path. Skip any row where
   `DNA Updated By` is already set. Run it as a script, dry-run first.

**Also fix the rule source we're ignoring:** the base has `tbloYIZcaC4ipPZAe`
**"Video/Virality DNA"** — 56 rows matching Masterclass Trailer, each with `Rule`, `Notes`
(structured `Do This ✅` / `Don't ❌`), `Priority Level` (🔴 Must Follow / 🟠 Strong Preference),
`Component`, and Yes/No reference images. It joins to asset types by **name text**
(`fldRbfY1EUXoS8XFh` is singleLineText matching `AssetType.fullName`), not by record link.
That is the richest DNA we have; ingesting it is a follow-up, not Phase 1 — but map the table id
now so it isn't rediscovered later.

## Phase 2 — show the DNA on the ticket

Titus: *"is there a way where they can actually see the editing DNA in the ticket itself?"*

- **Blocker first:** `TicketDetail` exposes only `assetType` (the name), not `assetTypeId`. Add
  it to the select + return in [lib/tickets/data.postgres.ts:351-448](lib/tickets/data.postgres.ts#L351-L448)
  and the Airtable mirror (`data.airtable.ts:357`). Don't use `dnaReview.assetTypeId` — it only
  exists once a review has run.
- New read-only **"Editing DNA"** `.card.pad` in the right `.stack` of
  [app/tickets/[id]/page.tsx](app/tickets/[id]/page.tsx), immediately **above** the "DNA review"
  card (before line 126) — the standard, then the check against it. Render with
  [components/ui/BriefText.tsx](components/ui/BriefText.tsx) (pre-wrap, linkified, auto-collapses
  past 700 chars — right for a 5k-char blob); it's already used on this page at `:71`. Copy the
  uppercase section-label style from `:127`. Link `Process DNA` when set.

## Phase 3 — the delivery-link relabel and the notification bug

- **Relabel to match Airtable** in [components/tickets/AssetPanel.tsx:79-80](components/tickets/AssetPanel.tsx#L79-L80):
  `assetFolderLink` → **"Feedback link (review)"**, `workingFiles` → **"Final output folder"**.
  Same in [app/stakeholder/[id]/page.tsx](app/stakeholder/[id]/page.tsx)'s `FILE_META`. Keep the
  Postgres column names (renaming them is migration churn for no gain) and add a comment naming
  the live Airtable field.
- **Fix the false "asset ready" alert.** [app/tickets/[id]/actions.ts:315](app/tickets/[id]/actions.ts#L315)
  treats `assetFolderLink` as the delivery signal for any non-ads ticket, and
  [AssetPanel.tsx:38](components/tickets/AssetPanel.tsx#L38) never passes `isAds`, so it is always
  `false`. Result: pasting a **Dropbox Replay review** link DMs the requester and posts to
  `#content-ready` *before* approval. Titus's workflow description is the proof. Fix: only
  `delivery: true` fields notify — drop the `assetFolderLink` special case. (`isAds` itself is
  already flagged STALE at `lib/tickets/data.postgres.ts:389` and always returns false.)

## Phase 4 — ticket-page field changes

In [app/tickets/[id]/page.tsx](app/tickets/[id]/page.tsx):

- **Remove** `Team` (:76), `Service level` (:77), `Team lead` (:78) — Titus: *"we don't have a
  service level and a team at all, it's all just one… we don't need the team lead here."*
- **Add** `Event type` and `Asset type` as labelled fields — the data is already on the object
  and only used as a subtitle (`:56`) and bare meta string (`:65`).
- Mirror both edits in [app/stakeholder/[id]/page.tsx:50-56](app/stakeholder/[id]/page.tsx#L50-L56)
  (that page already labels event/asset type; just drop the three rows).

Keep the *columns* — `teamServiceLevel` still derives `isAds`. **Leave the intake form alone:**
Team/Service Level is still required there (`app/intake/actions.ts:37`) against a live Airtable
single-select whose options we can't create (`[[team-service-level-options]]`). Removing it from
intake needs Titus's explicit confirmation.

## Phase 5 — find a Done ticket (searchable, not in the grids)

**Decision: make it searchable.** Grid filters stay as they are — the Airtable path warns there
are ~9k Done rows and to never scan them.

Root cause of Titus's "why can't I find the ticket": `QueueTable`'s "Search tickets…" box is
**purely client-side** over rows the server already filtered
([QueueTable.tsx:165-173](components/tickets/QueueTable.tsx#L165-L173)), and
`ACTIVE_STATUSES_EXCLUDED = ['Done', "Won't Do", 'Published']`
([data.postgres.ts:53](lib/tickets/data.postgres.ts#L53), mirrored as a `filterByFormula` at
`data.airtable.ts:74`). There is no server-side ticket lookup anywhere in the repo.

- New bounded, status-agnostic `searchTickets(query)` in `lib/tickets/data.{postgres,airtable}.ts`
  behind the `lib/tickets/data.ts` dispatcher. Postgres:
  `title: { contains: q, mode: 'insensitive' }`, `take: 25`, no status filter. Airtable:
  `SEARCH(LOWER(q), LOWER({title}))` with `maxRecords: 25` — bounded, never a full scan.
- Wire it into the existing `qsearch` input as a **fallback**: when the client filter returns
  nothing (or few) and the query is ≥3 chars, show a "Also found N delivered/archived tickets"
  group linking to `/tickets/<id>`. Detail pages already load any status
  (`getTicketDetail` accepts uuid or recId).

## Phase 6 — intake: only offer asset types you may raise

**Decision: allow if EITHER the signed-in user or the selected "Requested By" is a stakeholder.**

- `Stakeholder` = `fldeIpc5s5znc3jJn` → `tblC0gR8ZVw4WzOwx` ("EMPLOYEES"), fields `Name`
  `fldYQS2fz0FExZp03`, **`Work Email` `fldpgstGVKnyxbZ88`**, `Department`. Coverage: **74 of 74
  active video asset types populated (zero gaps)**; the 44 empty rows are all non-video.
- **The record ids are unusable as a join key** — they are from a table the app has never
  mirrored, disjoint from `👬 Employees`. `empMap` in
  [sync.ts:277](lib/airtable/sync.ts#L277) would resolve them to nothing and the `.filter()`
  would drop every edge **silently**. Join on **work email** instead, and store
  `stakeholderEmails String[]` directly on `AssetType` — no third employee table to mirror.
- Sync: fetch `tblC0gR8ZVw4WzOwx` once to build `recId → email`, map to emails in
  `mapAssetType`, and add a `linkEdges` counter (`sync.ts:203-208`) so a `?dryRun=true` run
  proves the edges landed.
- Surface it on `AssetTypeOption` ([lib/intake/data.ts:16-25](lib/intake/data.ts#L16-L25)) and in
  **both** producers — `lib/airtable/reference-live.ts:55-61` and
  `lib/reference/intake.postgres.ts:45-57`.
- Client predicate next to [IntakeForm.tsx:99](components/intake/IntakeForm.tsx#L99), modelled on
  the video predicate already in `components/shoots/ShootForm.tsx:54-58`. **Fail open:** apply it
  only when the asset type is video *and* has a non-empty stakeholder list — otherwise a blank
  field hides the row from everyone, the same trap as `[[category-drives-isvideo]]`.
- **Server-side guard in `createTicket`** — [app/intake/actions.ts:34-47](app/intake/actions.ts#L34-L47)
  validates presence only and never checks entitlement (or even that the asset type belongs to
  the event type), so a client-only filter is bypassable. Mirror the check, following
  `app/settings/asset-types/actions.ts:25-31`.
- **Escape hatch, required:** neither `rhythm@` nor `titus@` is a stakeholder on any asset type,
  so a strict filter shows them nothing. Admin / Manager / founder bypass, per
  `lib/dna-review/access.ts:31`.
- `REFERENCE_BACKEND=postgres`, so Titus's remaining Stakeholder edits appear only after a
  reference sync. There *is* an hourly cron — `.github/workflows/reference-sync.yml` — so worst
  case is 1h, plus `/admin/sync` for immediacy. (This corrects `[[sync-cron-is-throttled]]`,
  which is about the *ticket* sync, not reference.)

## Phase 7 — let Titus edit all asset types

**Decision: grant Manager/Approver now; the Sub Lead mismapping is a separate job.**

- [app/settings/asset-types/actions.ts:26](app/settings/asset-types/actions.ts#L26) — replace
  `let allowed = access.isAdmin;` with `getDnaAccessForAssetType(assetTypeId).canGovern`, which
  already grants Admin / Manager / Approver / founder / lead. This also removes a live
  inconsistency: Titus can already approve learned DNA *rules* (`app/settings/dna-actions.ts:12-16`
  uses `canGovern`) but not edit DNA *text*.
- `app/settings/asset-types/page.tsx` — pass server-computed `canEditAll={isManager}`;
  [AssetTypeEditor.tsx:172](components/settings/AssetTypeEditor.tsx#L172) →
  `canEdit={isAdmin || canEditAll || teamLeadOfThis}`; soften the `:113` read-only banner.
- **No new role.** "Creative Manager" is a job title, not an app role — Titus already holds
  Airtable role `Manager`. Adding it to `ROLES` would need a matching Airtable option plus every
  `hasRole(…, 'Manager')` call site updated.

---

## Files

| File | Phase |
|---|---|
[lib/airtable/field-map.ts](lib/airtable/field-map.ts) | 1, 6 — map DNA + Stakeholder fields
[lib/airtable/sync.ts](lib/airtable/sync.ts) | 1, 6 — `mapAssetType`, scalars, email resolve, `linkEdges`
[prisma/schema.prisma](prisma/schema.prisma) | 1, 6 — DNA columns + `stakeholderEmails`
[lib/dna-review/config.ts](lib/dna-review/config.ts) | 1 — baseline precedence
[lib/tickets/data.postgres.ts](lib/tickets/data.postgres.ts) + `data.airtable.ts` + `data.ts` | 2, 5 — expose `assetTypeId`, add `searchTickets`
[app/tickets/[id]/page.tsx](app/tickets/[id]/page.tsx) | 2, 4 — DNA card, field add/remove
[app/stakeholder/[id]/page.tsx](app/stakeholder/[id]/page.tsx) | 3, 4 — relabel, field removal
[components/tickets/AssetPanel.tsx](components/tickets/AssetPanel.tsx) | 3 — relabel
[app/tickets/[id]/actions.ts](app/tickets/[id]/actions.ts) | 3 — notify fix
[components/tickets/QueueTable.tsx](components/tickets/QueueTable.tsx) | 5 — server-search fallback
[lib/intake/data.ts](lib/intake/data.ts), `lib/airtable/reference-live.ts`, `lib/reference/intake.postgres.ts` | 6
[components/intake/IntakeForm.tsx](components/intake/IntakeForm.tsx), [app/intake/actions.ts](app/intake/actions.ts) | 6
[app/settings/asset-types/actions.ts](app/settings/asset-types/actions.ts), `page.tsx`, [components/settings/AssetTypeEditor.tsx](components/settings/AssetTypeEditor.tsx) | 7

**Order:** 1 → 2 (2 depends on 1's fields and on `assetTypeId`); 3, 4, 7 are independent and
small — land them first for quick wins; 5 and 6 are self-contained. One migration total
(Phases 1 + 6 combined) to avoid two `kessel db migrate` runs.

## Verification

- `npm run build` (the real typecheck gate) + `npm run lint` after each phase.
- **Phase 1 is the one to prove with data, not eyeballs.** After the sync, confirm
  `select count(*) from asset_types where coalesce(dna_upstream,'') <> ''` is 72, then re-run the
  DNA review on the Masterclass Trailer ticket and check the findings stop saying "no DNA
  requirements". Run `POST /api/sync/reference?dryRun=true` first and read the `linkEdges`
  counter — a zero there is the silent-drop failure mode.
- **Phase 6:** dry-run the sync and assert `stakeholderEmails` is non-empty for the 74 video
  asset types. Then, using the Playwright dev-login harness against the local mirror
  (`AIRTABLE_PUSH_ENABLED=false`, so writes are safe), open `/intake/creative` as
  `titus@mindvalley.com` and confirm (a) the video list narrows, (b) non-video asset types are
  still all offered, (c) an admin still sees everything, and (d) posting a disallowed
  `assetTypeId` directly to `createTicket` is rejected.
- **Phase 5:** search a known Done ticket by title and confirm it surfaces; confirm the Airtable
  path issues one bounded query, not a scan.
- **Phase 3:** paste a Replay link into the feedback field on a ticket that is *not* Done and
  confirm **no** Slack DM and **no** `#content-ready` post.
- **Phase 7:** sign in as Titus (role `Manager`, not Admin) and confirm every asset type is
  editable and the "you don't lead this asset type" banner is gone.
- Both themes and the 560px breakpoint for Phases 2–4 (`DESIGN_SYSTEM.md` §9).

## Risks / notes

- **Two employees tables** (`tbllP5vRon54L7Ccf` "👬 Employees" mirrored by the app;
  `tblC0gR8ZVw4WzOwx` "EMPLOYEES" holding Stakeholder + real Team Lead) with disjoint record
  ids. Every cross-reference must go through work email. This is the single biggest trap here.
- **Synced-source fields are read-only.** Never write `DNA`, `Video/Virality DNA`,
  `Process DNA` or `DNA link` back to Airtable.
- **Removing Service level from display only.** `teamServiceLevel` still feeds `isAds`; deleting
  the column would break the ratio-link gating.

## Deliberately not in this plan

- **Sub Lead → Team Lead remapping** (your call). Blast radius: `sync.ts:288`,
  `asset-types/repository.ts:104`, `access.ts:20`, `data.postgres.ts:396`, `auto-assign.ts`.
- **Ingesting the `Video/Virality DNA` rules table** (56 rules/asset type with Do/Don't notes and
  reference images) — the best DNA in the base, but a feature in its own right.
- **Removing Team/Service Level from intake** — needs Titus's confirmation.
- **Dropbox folder restructure by asset type** — Titus is mid-reorganisation of `3.1 video
  content`; `[[asset-library-from-airtable]]` says don't build the app-side library yet.
- **The tail of the call** — Titus was mid-sentence on CTA / due dates / official calendar /
  speakers when the line dropped. Worth asking him what he wanted there.

---
---

# APPENDIX (parked) — Dropbox Replay support for visual DNA review + free transcripts

**Status: CLOSED — not buildable (2026-09-10).** The gating probe below was run with our own
`DROPBOX_APP_KEY` / `DROPBOX_APP_SECRET` once they landed. `/2/reel/get_with_shared_link` returned
**400 `required scope 'private:files.content.read'`** — not the 200 this appendix hoped for, and not
the 401/403 it predicted for the failure case either, but the same verdict: the `private:` prefix
marks a **first-party-only** scope. It is not listed in the App Console Permissions tab, so no
credential we are able to hold will open it. That is this plan's own "stop and just correct the
message" branch.

The messages are already correct — `VIDEO_SOURCE_FAILURE_MESSAGE['replay-only']`
(`lib/dna-review/video-source.ts:301`) and `RENDER_ERROR_MESSAGE.unsupported_dropbox_replay`
(`lib/dna-review/frames.ts:54`) both tell the user to share the file itself, and the code offers the
paste box — so **nothing is left to build here.** Everything below is kept only as a record of what
was traced. Do not re-open it on the theory that better scopes exist.

Original rationale, for context: Phase 3 above explains *why* 231 tickets carry Replay links — the
Feedback Link field holds the Replay review link while a ticket is in review, and the output folder
only exists after approval. That makes the 5% slice permanent, and paste-a-link the answer to it.

## Gating probe — run first, before any code

`/2/reel/*` uses Dropbox **app auth**. The Replay web app uses its own first-party key
(`xmh41stq9e08247`), read from their bundle while tracing. **Do not ship that key** — our own
credentials or nothing.

```bash
curl -s -X POST https://api.dropboxapi.com/2/reel/get_with_shared_link \
  -u "$DROPBOX_APP_KEY:$DROPBOX_APP_SECRET" -H 'Content-Type: application/json' \
  -d '{"entity_id":"","entity_type":{".tag":"shared_video"},
       "share_token":"14O4FGQvNPyE9bGs","video_version_id":"","only_max_resolution":false}'
```

**200** → build. **401/403** → first-party only; stop and just correct the message. Unauthenticated
returns `400 Invalid authorization value`, so auth is the only missing piece. No OAuth flow,
redirect URI or refresh token needed for this — that's a separate, later step for folder listing.

## What was verified (2026-09-08)

`/2/reel/*` appears in **no** public Dropbox spec (checked every `.stone` file in
`dropbox/dropbox-api-spec`). Traced calls, all working unauthenticated in-browser:

- `get_with_shared_link` `{entity_id:'', entity_type:{'.tag':'shared_video'}, share_token, video_version_id:'', only_max_resolution:false}`
  → `downloads_enabled`, `file_name`, `file_extension`, `file_size_bytes`, real Dropbox `file_id`,
  `requires_password`, `is_audio_only`, `media_type`, `poster_url`
- `list_version_summaries_for_video` `{video_identifier:{'.tag':'share_token', share_token}, common:{}}`
  → `version_num`, `version_duration_precise`, `upload_timestamp`, `video_version_id`
- `get_proxy_urls` `{video_version_id, resolutions:[], only_retrieve_status:false, share_token}`
  → per-resolution URLs (`res_360_p`…`res_1080_p`); the page's own menu offers *Download
  Original* plus 1080/720/480/360
- `get_transcription` `{video_version_id, common:{share_token}}` → **timestamped transcript**,
  `transcription_state: 'ready'`
- Playback is HLS (`previews.dropboxusercontent.com/p/hls_master_playlist/…`) — **ffmpeg reads
  m3u8 natively**
- Folders reuse the *same* endpoint with `entity_type: shared_folder` + `entity_id: pid_rf:…`

Link shapes across 197 Replay tickets in the local mirror: **118 single-video** (`/share/<token>`,
unambiguous latest version), **49 folder** (`/share-folder/<token>`, many videos — one held 15
projects in 3 subfolders), 29 also carry a `/scl/fi/` link the shipped resolver already handles.

## Layers

**A — render-service** ([render-service/server.mjs](render-service/server.mjs)): drop
`replay.dropbox.com` from `UNSUPPORTED_HOSTS`; classify `replay-video` / `replay-folder`; one
`reelRpc()` helper carrying a prominent ⚠️ UNDOCUMENTED comment and Basic app auth (**not** the
folder path's user token). Single video → metadata, newest version, then bytes via proxy ≤720p
(frames downscale to 1024px and Cloud Run `/tmp` is RAM-backed, so smaller is strictly better) →
else HLS straight to ffmpeg → else `file_id` via the documented `files/get_temporary_link`.
Folder → enumerate depth ≤2 and return a structured 422 `replay_folder_choice` with
`{name, shareToken, videoVersionId, durationSec, versionNum, folder}`; `/extract-frames` gains
an optional `replayVideoVersionId`. New codes: `replay_unconfigured`, `replay_unauthorized`
(**the tripwire if Dropbox closes the door — log it loudly**), `replay_password_required`,
`replay_no_video`, `replay_audio_only`, `replay_folder_choice`.

**B — transcript**: fetch only when `transcription_state === 'ready'`; cap total characters;
return as `transcript` on `/extract-frames`; extend `ExtractFramesResult`; inject as one text
block (`[m:ss] line`) before the frames in `runVisualDnaReview`; extend `VISUAL_SYSTEM_PROMPT`
to state that **spoken words are not on-screen text** (a claim about a caption or CTA card must
still come from a frame). Add `usedTranscript Boolean @default(false)` to `DnaReview` —
`prisma migrate diff` → `kessel db migrate`.

**C — app**: `classifyVideoUrl` gains `replay-video` / `replay-folder`, both `ATTEMPTABLE`, scored
between `direct-file` (90) and `dropbox-folder` (60); drop the now-false `replay-only` reason.
Panel gains a `'choose-video'` state beside `'needs-link'`, rendering `choices` in a `Select`
plus a *Review this one* `Button`, reusing the existing primitives. No save-back — a Replay link
has no shareable direct-file form.

## Verification

Curl each endpoint against confirmed-live single-video tokens `0NfFn1QckzCCIGQN`,
`14O4FGQvNPyE9bGs`, `1AqL4GrWGqEQgiYa`, and folder `ezBicHC1RKmwgryp`. `0hY28rdyvnSoBA2I` is
**dead** (400s in a real browser too) — the natural negative test. `ffprobe -i <hls_master_playlist>`
to see whether HLS can become the primary path. **Non-negotiable regression:** a real `/scl/fi/`
link must still yield 60 frames from that 64.6s video — content-type stays a **denylist**, since
that path answers `application/binary`, not `video/*`.
