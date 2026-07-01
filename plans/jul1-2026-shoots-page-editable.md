# Make the `/shoots` page fully editable + wire it to Airtable

## Context

The `/shoots` page today is a **read-mostly viewer**. The queue board
(`components/shoots/ShootsBoard.tsx`) lists shoots, and the detail page
(`app/shoots/[id]/page.tsx`) renders every field as static text — there is no way
to edit a shoot from the app. All writes so far happen only through the intake form
(`/shoots/new`) or in Airtable directly.

Rhythm's feedback: opening a shoot should let him work it end-to-end from the app —
edit the brief/format/location/production-support, set the manual priority stars,
update filming status, add filming date / raw files / platforms, **link an existing
Prio ticket**, and **raise a new Prio ticket** via the Airtable-backed checkbox
(gated so it can only be ticked once Asset Library **and** Event Type are linked).
He also wants the "To Film in Studio Time" element removed from the board.

The 📺 Shoots table (`appFEFygXo2pRc8AR` / `tblcZ8OIxfgnlUowC`) already has every
field we need — several just aren't mapped or surfaced yet. This is almost entirely
a **surface + wire-up** job, no new Airtable schema.

**Decisions confirmed with Rhythm:**
- Raise-ticket = surface the existing **`New Prio Ticket`** checkbox; ticking it
  relies on the **existing Airtable automation** to create the Prio ticket (no
  app-side `createTicket`). Gate: enabled only when Asset Library + Event Type linked.
- Priority stars = **10** (match Airtable rating `max: 10`).
- Filming status = editable dropdown; new shoots keep the **auto `Created`**
  timestamp + default status (no new "Created" enum value).
- New editable fields go on the **detail page only** — `/shoots/new` stays as-is.

## New Airtable fields to map (all already exist in the table)

Add to the `SHOOTS` block in [lib/airtable/field-map.ts](../lib/airtable/field-map.ts):

```
fields.priorityRanking: 'fldNNkk3toYNOgzor'  // "Priority Ranking (Manual)" (rating, star, max 10)
fields.rawFiles:        'fld3EaYUxVfpKyZCM'  // "Raw Files" (url)
fields.platforms:       'fldzADgA2zZfdrXZy'  // "Platfom" (multipleSelects) — note the live typo
fields.newPrioTicket:   'fldNvoj7UUYkHeLov'  // "New Prio Ticket" (checkbox → Airtable automation)
links.assetLibrary:     'fldLHCrWOWexguMaw'  // "📚 Asset Library (WIP)" (multipleRecordLinks)
```

Live select options (already fetched, write plain name strings):
- **Filming Status** (`SHOOT_STATUS` — already correct in constants).
- **Format** / **Filming Location** — already in `SHOOT_FORMATS` / `SHOOT_LOCATIONS`.
- **Platforms** (new): `Youtube, Facebook, Instagram, Twitter, LinkedIn, TikTok`.

## Changes

### 1. `lib/shoots/constants.ts`
- Extend `ShootRow` with: `priorityRanking: number | null`, `rawFiles: string | null`,
  `platforms: string[]`, `newPrioTicket: boolean`, `assetLibraryIds: string[]`,
  `eventTypeIds: string[]`.
- Add `export const SHOOT_PLATFORMS = ['Youtube','Facebook','Instagram','Twitter','LinkedIn','TikTok']`.
- Remove `isToFilmInStudioTime` / `STUDIO_TIME_SINCE` usage from the board (below); the
  predicate can be deleted since it becomes unused.

### 2. `lib/shoots/repository.ts`
- In `mapShoot`, read the five new fields (`priorityRanking` via a numeric coerce,
  `rawFiles` via `str`, `platforms` via a `selectNames` array helper, `newPrioTicket`
  boolean, `assetLibraryIds`/`eventTypeIds` via `linkedIds`).
- Add the new field ids + `SL.eventTypes` + `SL.assetLibrary` to `LIST_FIELDS` so the
  detail fetch (and board, if we surface stars there) has them. `getShoot` needs the
  full set.
- `updateShoot` already exists (generic field-id patch) — reused by the new actions.

### 3. `app/shoots/actions.ts` — new server actions (`'use server'`)
Mirror the existing `createShootAction` + studio `approveShoot`/`setPriorityRank`
patterns (`app/studio/actions.ts:98-136`). All revalidate `/shoots` and `/shoots/[id]`.
- `updateShootAction(id, patch)` — typed patch → Airtable field-ids via `SHOOTS.fields`
  (brief/notes, format, filmingLocation, filmingDate, productionSupport, filmingStatus,
  rawFiles, platforms, eventTypeIds). Validates date + enum membership.
- `setShootRank(id, rank)` — 0–10 → `fields.priorityRanking` (optimistic star widget).
- `linkShootTicket(id, ticketId)` — append `ticketId` to `links.postProductionTicket`.
- `raiseNewPrioTicket(id)` — set `fields.newPrioTicket = true`. Guard: refuse unless the
  shoot already has `assetLibraryIds.length && eventTypeIds.length` (server-side mirror
  of the UI gate). The Airtable automation does the actual ticket creation.

### 4. `app/shoots/[id]/page.tsx` — server shell → editable client editor
Keep it a server component: fetch `getShoot`, `getIntakeReferenceData` (employees +
event types), and `listActiveTickets(100)` (for the link-existing picker), then pass
into a new client component. Preserve the header (title, status/approval badges,
requester, back link) and the "Linked tickets" panel.

### 5. `components/shoots/ShootEditor.tsx` — NEW client component
The editable body. Reuse `components/ui` primitives (`SearchableSelect`, `Field`/
`inputCls` pattern from `ShootForm.tsx`, `Badge`, `Icon`) and the design-system tokens
(no raw hex / arbitrary sizes — per `DESIGN_SYSTEM.md`). Sections:
- **Brief** — editable textarea (`Notes/Brief`).
- **Details** — Format (select), Filming status (select, all 5 `SHOOT_STATUS`),
  Filming date (date), Filming location (select), Production support (textarea),
  Raw files (url input), Platforms (multi-select chips using `SHOOT_PLATFORMS`),
  Event Type (`SearchableSelect` from `data.eventTypes` — needed to satisfy the gate).
- **Priority** — 10-star widget (see #6) writing `setShootRank`.
- **Tickets** — "Link existing ticket" (`SearchableSelect` over active tickets →
  `linkShootTicket`) **and** the **Raise new Prio ticket** checkbox:
  - Disabled unless `assetLibraryIds.length && eventTypeIds.length`; when disabled show
    a hint ("Link an Asset Library entry and an Event Type first"). Asset Library links
    stay managed in Airtable (per the asset-library-from-Airtable decision) — the editor
    only reads/displays them for the gate.
  - On tick → `raiseNewPrioTicket`; show "Raised — Airtable is creating the ticket."
- A single **Save** for the text/select fields (one `updateShootAction` call); the star
  widget, link-ticket, and checkbox commit independently (optimistic), like the studio
  surfaces.

### 6. Star widget for shoots (10 stars)
`components/studio/StarRating.tsx` is hardcoded to 1–5 + `setPriorityRank(ticketId)`.
Add a `components/shoots/ShootStars.tsx` reusing the same `.st-starbtn`/`.st-starbtns`
classes but rendering `1..10` and calling `setShootRank(shootId, n)`. (Avoids touching
the ticket widget.)

### 7. `components/shoots/ShootsBoard.tsx` — remove "To Film in Studio Time"
- Drop the `studio` view pill (line ~165) and its explanatory subtitle (lines ~170-174).
- Default `view` to `'all'`; remove the `isToFilmInStudioTime` filter branch and the
  now-unused `STUDIO_TIME_SINCE` import/default. Keep **All shoots** + **Custom view**.
- (The `Studio Time - …` **filming-location** options are legitimate Airtable values and
  are NOT removed.)
- Optional: add a "Priority" (stars, read-only) column so ranking is visible in the list.

## Critical files
- [lib/airtable/field-map.ts](../lib/airtable/field-map.ts) — add 5 field/link ids.
- [lib/shoots/constants.ts](../lib/shoots/constants.ts) — `ShootRow` fields + `SHOOT_PLATFORMS`.
- [lib/shoots/repository.ts](../lib/shoots/repository.ts) — map new fields + `LIST_FIELDS`.
- [app/shoots/actions.ts](../app/shoots/actions.ts) — 4 new server actions.
- [app/shoots/[id]/page.tsx](../app/shoots/[id]/page.tsx) — fetch + pass to editor.
- **`components/shoots/ShootEditor.tsx`** (new), **`components/shoots/ShootStars.tsx`** (new).
- [components/shoots/ShootsBoard.tsx](../components/shoots/ShootsBoard.tsx) — remove studio-time view.

## Verification
1. `npm run dev` → open `/shoots`. Confirm the "To Film in Studio Time" pill + subtitle
   are gone and the board defaults to All shoots.
2. Open a shoot → edit brief/format/location/production-support/filming date/raw files/
   platforms + change filming status → **Save**. Confirm in Airtable
   (`tblcZ8OIxfgnlUowC`) the fields updated (verify via Airtable MCP `list_records_for_table`
   on that record).
3. Click the priority stars (1–10) → confirm `Priority Ranking (Manual)` updates in Airtable.
4. Link an existing ticket → confirm it appears under "Linked tickets" and the
   `Post-Production Ticket (AT)` link is set in Airtable.
5. On a shoot **without** Asset Library + Event Type links: confirm the "Raise new Prio
   ticket" checkbox is disabled with the hint. On one **with** both linked: tick it →
   confirm `New Prio Ticket` = checked in Airtable and (if the automation is live) a Prio
   ticket is created.
6. `npm run lint` clean.

## Open item
- The raise-ticket flow assumes an **Airtable automation on `New Prio Ticket`** already
  exists. If it doesn't fire, the checkbox will tick but no ticket appears — flag to
  Rhythm to confirm/create that automation (or fall back to app-side `createTicket`).
