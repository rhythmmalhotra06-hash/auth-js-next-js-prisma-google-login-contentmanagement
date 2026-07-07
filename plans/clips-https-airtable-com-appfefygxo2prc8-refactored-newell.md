# AI clip/media suggestions → approve in the portal → push only approved to Vishen's base

## Context

Two Airtable bases are in play:

- **Creative Services** (`appFEFygXo2pRc8AR`) — content production. The portal already generates
  AI output into the app's own **📺 Media Sources** (`tblBQhM2Blqa7uNZX`) and **🎬 Clip Suggestions**
  (`tblquXg7eesUZwvSH`) tables.
- **Vishen's content base** (`appvBtCYdaSrD1y11`) — his **Major Videos** (`tblSrtPXAeiGeLUwW`) and
  **Clips** (`tblgGCaDK7W22UvSG`).

You stood up **Airtable native two-way sync** with **Vishen's base as the source**, creating mirror
tables in Creative Services — **Major Videos (Sync)** `tblV6nCO0Y0VigADH`, **Clips (Sync)**
`tblRXoSfDBFnpYk7G`, **Vishen Video (Sync)** `tbljOa2uodfeKTfWF`.

**Decision (your call):** **no AI record is written to Vishen's base until it is approved.** Pending
AI suggestions stay in the portal (the app's own tables), which are **not** synced to Vishen. Only on
approval does the portal create the row in Vishen's source table — and native sync then carries it
into the "(Sync)" mirrors and Vishen's media views. So the "(Sync)" tables contain **only approved,
human-vetted** content by construction, and Vishen's base never sees unvetted AI noise. Every pushed
row is tagged **"AI Suggested"** so its origin is obvious.

This fits how the code already works: clips are generated into the app's Clip Suggestions table
(status `Proposed`), and `mirrorClipsToVishenBase` / `createMajorVideo` already write to Vishen's
source tables. The change is to **move the Vishen write from generation time to approval time**, add
the tag, and drop the now-redundant scripts.

## Recommended approach

### Step 1 — Airtable config (you, in Airtable; no code)

On **both** Vishen source tables — Major Videos `tblSrtPXAeiGeLUwW` and Clips `tblgGCaDK7W22UvSG`:

1. Add **`AI Suggested`** (checkbox) — the provenance tag.
2. Include `AI Suggested` as a **synced field** in the Major Videos (Sync) / Clips (Sync) sync config
   so the tag shows in the "(Sync)" tables (read-only there is fine — the portal sets it).

No approval/pending field is needed on Vishen's side: the gate lives in the portal, and only approved
rows are ever created there. No filtered view is required either, for the same reason.

> **Implementation prerequisite:** confirm the exact **source** table IDs feeding each mirror. The
> field-map's `MAJOR_VIDEOS`/`VISHEN_CLIPS` point to `tblSrtPXAeiGeLUwW` / `tblgGCaDK7W22UvSG`, but the
> Clips (Sync) mirror is richer than the field-map comments (6 status options + Rating/Feedback/
> Assignee), so verify the sync source in Airtable → Sync settings and repoint the field-map if it
> changed. Verify the new `AI Suggested` field IDs via the Airtable API (per CLAUDE.md's "never trust
> inferred field names" rule).

### Step 2 — Field map (`lib/airtable/field-map.ts`)

Add `aiSuggested` (the new checkbox field ID) to both `MAJOR_VIDEOS` and `VISHEN_CLIPS`.

### Step 3 — Stop pushing to Vishen at generation time

Today `app/api/media/[id]/suggest/route.ts` calls `mirrorClipsToVishenBase` right after clips are
generated, so every *proposed* clip lands in Vishen's base immediately. **Remove that generation-time
call** (and the corresponding generation-time `createMajorVideo`, if any). Generation should only
populate the app's own Media Sources / Clip Suggestions tables (status `Proposed`) — the portal's
review surface. Nothing reaches Vishen yet.

### Step 4 — Push to Vishen only on approval (tagged AI Suggested)

The approval path is `convertClipsToTickets` / the approve action in `app/media/actions.ts`, which
already flips a Clip Suggestion to `Approved`. Extend it so, on approval, the portal:

1. Ensures the parent media source has a **Major Video** in Vishen's base — reuse `createMajorVideo`
   (set `AI Suggested = true`) when the media source has no linked `sourceRecordId` yet; otherwise use
   the existing linked Major Video. Store the recId back on the Media Source (`sourceRecordId`).
2. Creates the approved clip as a **Clip** row in Vishen's base via `mirrorClipsToVishenBase`, linked
   to that Major Video, with **`AI Suggested = true`** and status `Todo` (ready for production). Stamp
   the correlation ids both ways as the function already does (`App Clip ID` ↔ `Vishen Clip ID`).

Native two-way sync then surfaces the new rows in Clips (Sync) `tblRXoSfDBFnpYk7G` and Major Videos
(Sync) `tblV6nCO0Y0VigADH`, and in Vishen's media. Dismissing/rejecting a suggestion in the portal
simply never triggers the push (no Vishen row is ever created).

> Approval happens in the **portal** (the gate). After a row exists in Vishen's base, the team can
> still edit it from the "(Sync)" tables via the existing two-way sync — but the pending→approved
> decision is portal-only, as you specified.

### Step 5 — Retire the superseded automations

Your native two-way sync replaces the five record-mirroring scripts in `docs/airtable-automations/`
(Major Videos↔Media Sources, Clips↔Clip Suggestions, reconcile-deletes). Running both would
double-write and risk loops. **Delete those five scripts + the README setup.** Keep the app's outbound
writes to Vishen's source base (governed by `VISHEN_SYNC_ENABLED`, left **on**) — that is now the only
portal→Vishen mechanism, and it only fires on approval. Update the header comments in
`lib/media/vishen-sync.ts` and the memory note that described the automations as the "single sync engine."

## Critical files

- `lib/airtable/field-map.ts` — add `aiSuggested` to `MAJOR_VIDEOS` & `VISHEN_CLIPS`; verify/repoint
  source table IDs.
- `app/api/media/[id]/suggest/route.ts` — remove the generation-time Vishen mirror call.
- `app/media/actions.ts` — on approval, create the Major Video (if needed) + approved Clip in Vishen's
  base, tagged AI Suggested.
- `lib/media/vishen-sync.ts` — `mirrorClipsToVishenBase` sets `AI Suggested = true`; update header docs.
- `lib/media/major-videos.ts` — `createMajorVideo` accepts/sets the `AI Suggested` tag.
- `docs/airtable-automations/` — remove the superseded scripts + README.

## Verification (end-to-end, against live Airtable)

1. Generate clips for a media source in the portal (`/media/[id]` → "Suggest clips").
2. Confirm via the Airtable API that **no** new rows appeared in Vishen's Clips/Major Videos source
   tables (nothing pushed pre-approval), while the app's Clip Suggestions show status `Proposed`.
3. Approve one clip in the portal.
4. Confirm a Major Video (if newly created) + the approved Clip now exist in Vishen's **source** tables
   with `AI Suggested = true`, and that they propagate to Clips (Sync) `tblRXoSfDBFnpYk7G` / Major Videos
   (Sync) `tblV6nCO0Y0VigADH`.
5. Dismiss another suggestion → confirm nothing is ever written to Vishen's base for it.
6. `npm run lint` + `npm run build` clean.

## Open items to confirm during implementation

- Exact source table IDs feeding each "(Sync)" mirror (Step 1 prerequisite) and the new field IDs.
- For a media source that has no linked Major Video (pure YouTube auto-discovery), confirm creating a
  Major Video on first clip approval is desired (the plan assumes yes).
- Whether approving a **media source** on its own (independent of any clip) should also push a Major
  Video, or whether the Major Video is only ever created as a side effect of approving a clip.
