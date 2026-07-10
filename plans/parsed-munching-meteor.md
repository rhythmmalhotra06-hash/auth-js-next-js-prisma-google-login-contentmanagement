# Fix: clip-derived tickets not mirrored into Vishen's Clips table

## Context

Five clip-derived tickets (**10737–10741**, Creative Services Prio `tblhrRl8GzsDMv0DD`)
were created correctly, but the clips they came from never appeared in Vishen's
🎬 **Clips** table (`tblgGCaDK7W22UvSG` in `appvBtCYdaSrD1y11`), and only 10737 has a
**Clips (Sync)** link back on the ticket.

**Verified root cause (live data, 2026-07-10):**

1. The video (`youtu.be/PiRpG_b2NuI`) exists as **two duplicate Media Sources**:
   - `rec9J2ottcC62qZqU` (04:44) → `Source Record ID` `recvcznhXL66l2HM2`
   - `recqnHfdkJe2xGNCy` (07:31) → `Source Record ID` `recI54MWHHm8NysJc` ← the 5 tickets' clips
2. **Both `Source Record ID`s point to Major Videos that no longer exist** — a query of
   `tblSrtPXAeiGeLUwW` for both recIds returns 0 rows (they were deleted, likely during a
   manual de-dupe of Vishen's base).
3. On convert, [pushApprovedClipsToVishen](../app/media/actions.ts#L248) →
   [mirrorClipsToVishenBase](../lib/media/vishen-sync.ts#L65) tried to create Clips rows
   linked to the dead `recI54MWHHm8NysJc`. Airtable rejects a create with an invalid linked
   record, the error was **swallowed by the best-effort `try/catch`**
   ([actions.ts:290](../app/media/actions.ts#L290)), so `Vishen Clip ID` was never written back.
4. Confirmed: Vishen Clips has **no rows** whose `App Clip ID` matches any of the 5 clips.
   With no `vishenClipId`, the reconcile's Clips (Sync) step is a no-op
   ([ticket-links.ts:89](../lib/media/ticket-links.ts#L89)), so the tickets never link either.
   (10737 only *looks* linked because it shares a title with an older clip from the first
   duplicate source that was separately re-mirrored a day later.)

**The self-heal gap:** [pushApprovedClipsToVishen](../app/media/actions.ts#L267) only recreates
a Major Video when `sourceRecordId` is *empty*. A **dangling/dead** recId is treated as valid,
so it never repairs — every convert and every reconcile silently re-fails.

**Intake-dedupe gap:** [findMediaSourceByUrl](../lib/media/repository.ts#L216) (portal add)
dedupes on normalized URL and would have blocked a second source. But
[syncMajorVideos](../lib/media/major-videos.ts) dedupes only on `Source Record ID`, so a
Major Video row whose URL already has a Media Source spawns a duplicate source — the origin
of source #2 here.

Intended outcome: the mirror self-heals dead Major Video refs and stops failing silently; the
5 clips land in Vishen's Clips with the tickets linked; the duplicate source is retired; the
Major Videos sync stops creating URL-duplicates.

---

## Part 1 — Mirror self-heals a dead Major Video ref (durable)

**`lib/media/major-videos.ts`** — add a lightweight existence check:

```ts
/** True when the Major Video recId still exists in Vishen's base. */
export async function majorVideoExists(id: string): Promise<boolean> {
  const res = await getRecord<Raw>(V.baseId, V.tableId, id);
  return res.ok; // getRecord returns ok:false on 404/not-found
}
```
(import `getRecord` from `@/lib/airtable/rest`.)

**`app/media/actions.ts` → `pushApprovedClipsToVishen`** ([L267](../app/media/actions.ts#L267)):
change the guard from "create only when empty" to "create when empty **or dead**":

```ts
let majorVideoId = src.sourceRecordId;
if (!majorVideoId || !(await majorVideoExists(majorVideoId))) {
  const mv = await createMajorVideo({ title: src.title ?? src.sourceUrl ?? 'Untitled', url: src.sourceUrl, aiSuggested: true });
  if (!mv.ok) continue;
  majorVideoId = mv.data.id;
  await updateMediaSource(sourceId, { sourceRecordId: majorVideoId }); // overwrite the dead ref
}
```

## Part 2 — Stop swallowing the mirror failure (observability)

- `mirrorClipsToVishenBase` return value is currently ignored. In `pushApprovedClipsToVishen`,
  capture it and `console.error` on `!res.ok` (still best-effort — never fail the approval).
- The outer `try/catch` at [actions.ts:290](../app/media/actions.ts#L290) should log the caught
  error instead of `/* best-effort */` swallowing it, so a future misfire is visible in logs.

## Part 3 — Reconcile becomes the re-mirror safety net (auto-heals the 5 + future misfires)

Extend [reconcileClipTicketLinks](../lib/media/ticket-links.ts#L60) so it doesn't only *link*
but also *re-mirrors* approved-but-unmirrored clips. For each approved clip with `appTicketId`
set but **no `vishenClipId`**, group by media source and run the same self-healing mirror
(Part 1) before the Clips (Sync) link step. This runs every 5 min via the existing
`POST /api/media/link-tickets` GitHub Actions cron, so:
- the 5 clips heal on the next run with no manual step, and
- any future dead-ref misfire self-corrects within the cron window.

Factor the mirror-a-group logic out of `pushApprovedClipsToVishen` into a shared helper (e.g.
`lib/media/vishen-sync.ts: mirrorApprovedClips(clips, sources)`) so convert and reconcile call
the same path. Keep it idempotent (skip clips that already have `vishenClipId`).

## Part 4 — Repair the 5 now

With Parts 1+3 in place, the repair is just: **clear the dead `Source Record ID` on
`recqnHfdkJe2xGNCy`** (so the mirror recreates a valid Major Video) and **trigger the
reconcile** (`POST /api/media/link-tickets` with `SYNC_SECRET`, or run the mirror helper once
via a scratch script). Then confirm the 5 clips get `vishenClipId` and tickets 10738–10741 get
their Clips (Sync) link. (Part 1's dead-ref detection means clearing the field is optional, but
clearing it is the fast, explicit path.)

## Part 5 — De-dupe + harden intake

- **Retire the duplicate source:** keep `recqnHfdkJe2xGNCy` (the one the live tickets came
  from); **archive `rec9J2ottcC62qZqU`** via `updateMediaSource(id, { status: 'Archived' })`.
  Its one already-mirrored clip (`recOPqROF9PcsI7Ms` → Vishen `recCoiCyhf2RK1Q5z`) can stay;
  no ticket depends on it.
- **Harden `syncMajorVideos`** ([lib/media/major-videos.ts](../lib/media/major-videos.ts)):
  in addition to the `existingSourceRecordIds` set, build a **normalized-URL set** from
  existing Media Sources (reuse `normalizeMediaUrl` + a new `existingNormalizedSourceUrls()`
  helper, mirroring [existingSourceUrls](../lib/media/repository.ts#L226)) and skip a Major
  Video whose Final/Draft URL already maps to a live source. This closes the path that created
  source #2.

---

## Verification

1. `npm run lint` and `npm run build` clean.
2. **Data checks (Airtable MCP) after triggering the reconcile:**
   - Vishen Clips (`tblgGCaDK7W22UvSG`) query by `App Clip ID` in
     `[rec7l7Yxqg4lMAg86, recYyoqJqQSQ7AWld, recQW3MQDQp2Z6JBu, rec7kt2P3sALlQt3d, rechoIgN2scoE0wmC]`
     → **5 rows** now present, each linked to a live Major Video, tagged AI Suggested.
   - Clip Suggestions (`tblquXg7eesUZwvSH`) for those 5 → `Vishen Clip ID` (`fld4Qcvv1Q2biaJAO`)
     now populated.
   - Prio tickets 10738–10741 → `Clips (Sync)` link (`fld8evKonHAt3jBSH`) now set.
   - Media Sources: `rec9J2ottcC62qZqU` Status = Archived; `recqnHfdkJe2xGNCy`
     `Source Record ID` points to a Major Video that **exists** in `tblSrtPXAeiGeLUwW`.
3. **Regression:** re-run the reconcile — report shows 0 new mirrors/links (idempotent), no
   errors.
4. **Intake:** dry-run `syncMajorVideos` against a Major Video whose URL already has a live
   source → it is skipped (no duplicate created).
