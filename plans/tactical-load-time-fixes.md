# Tactical load-time fixes

## Context

Pages feel slow across the whole app. The cause is **not** the client bundle (it's lean — no chart/date/icon/lodash libs, edge-safe auth, custom SVG icons). The cause is that every page is `force-dynamic` and renders by reading **live from Airtable**, whose REST client serializes all calls through a module-local queue at **~5 req/sec** ([rest.ts:8](lib/airtable/rest.ts#L8) = 200ms; client.ts = 220ms).

A critical consequence: because each queue serializes, **`Promise.all` does not speed anything up** — page latency ≈ (number of Airtable requests) × 200ms. So the only levers that matter are: **(1) reduce request count, (2) cache, (3) stream the shell so pages *feel* instant.** The user chose tactical quick wins (keep reading from Airtable; the Postgres-mirror migration is a separate future effort).

Goal: cut the worst pages from 10s+ down to ~1s actual, and make every page paint its chrome instantly with per-section skeletons.

---

## Tier 1 — Kill the N+1 clip fetch (biggest single win)

**Problem:** [getClipsByIds](lib/media/repository.ts#L257-L265) loops `getRecord` once **per clip**. A source with 50 clips = 51 serialized requests ≈ **11+ seconds** on every media detail page load ([media/[id]/page.tsx:31](app/media/[id]/page.tsx#L31) → `listClipSuggestions`).

**Fix:** Replace the per-id loop with a single batched list call using Airtable's `RECORD_ID()` in `filterByFormula`:

```ts
export async function getClipsByIds(ids: string[]): Promise<AirtableResult<ClipSuggestion[]>> {
  if (ids.length === 0) return { ok: true, data: [] };
  const out: ClipSuggestion[] = [];
  for (let i = 0; i < ids.length; i += 50) {           // chunk to stay well under formula-length limits
    const chunk = ids.slice(i, i + 50);
    const formula = `OR(${chunk.map((id) => `RECORD_ID()='${id}'`).join(',')})`;
    const res = await listAll<Raw>(C.baseId, C.tableId, { filterByFormula: formula });
    if (!res.ok) return res;
    out.push(...res.data.records.map(mapClip));
  }
  return { ok: true, data: out };
}
```

This collapses 51 requests → ~1–2. `listClipSuggestions` already sorts by index afterward, so no other change needed there. `getClipsByIds` is also used by the convert flow — the batched version is a drop-in.

**Bonus (small):** [media/[id]/page.tsx:20-31](app/media/[id]/page.tsx#L20) calls `getMediaSource(id)` and then `listClipSuggestions(id)` re-fetches the same parent record to read its linked-clip ids. `getMediaSource` already returns the full record. Add an optional `linkedClipIds` param to `listClipSuggestions` so the page can pass the ids it already has, dropping the redundant parent `getRecord`. Keep the no-arg path working for other callers.

Files: [lib/media/repository.ts](lib/media/repository.ts), [app/media/[id]/page.tsx](app/media/[id]/page.tsx).

---

## Tier 2 — Stream the shell so every page feels instant

**Problem:** Every page `await`s all data before returning any JSX, so `<AppShell>` (sidebar/header chrome) only paints after Airtable resolves. The generic [app/loading.tsx](app/loading.tsx) shows during navigation, but the whole route still blocks on the slowest fetch.

**Fix:** Refactor heavy pages to paint the shell immediately and stream the data body via `<Suspense>`:

- Keep `<AppShell title=...>` (and any instantly-known props) rendering synchronously at the top of the page component.
- Move the data-fetching `await Promise.all([...])` + the body JSX into an **async child component** (e.g. `EditorQueueBody`).
- Wrap that child in `<Suspense fallback={<skeleton/>}>` inside `<AppShell>`.

```tsx
export default async function EditorPage({ searchParams }) {
  await guardRoute('/editor');
  const { assignee } = await searchParams;
  return (
    <AppShell title="Editor — My Queue">
      <Suspense fallback={<QueueSkeleton />}>
        <EditorQueueBody assignee={assignee} />
      </Suspense>
    </AppShell>
  );
}
```

Apply to the heavy pages: [editor](app/editor/page.tsx), `manager`, `stakeholder`, `tickets`, `studio`, [media/[id]](app/media/[id]/page.tsx), `vishen`, `intake`. Reuse the existing `.skel` CSS and the skeleton shapes already in [app/loading.tsx](app/loading.tsx) — factor them into a small shared `components/ui/Skeletons.tsx` rather than duplicating.

**Extra win on pages with a secondary panel:** On [editor/page.tsx:70](app/editor/page.tsx#L70) the `ApprovedClipsPanel` needs `getIntakeReferenceData()` (6 Airtable reads) and on media detail `MediaDetailClient` needs it too. Put each such secondary panel in its **own** nested `<Suspense>` so the expensive reference load streams in separately and never blocks the primary queue/table. This means the main list appears fast even while reference data is still loading.

---

## Tier 3 — Reduce redundant requests & cache harder

1. **Raise reference cache TTL.** Taxonomy (employees/event types/asset types/calendars/authors) changes rarely. Bump `TTL_MS` in [reference-live.ts:28](lib/airtable/reference-live.ts#L28) and the `nameMap` cache in `lib/repositories/reference.repository.ts` from **60s → ~5 min**. Cuts how often pages pay the cold multi-table fetch. (The 60s "new taxonomy shows up fast" goal is over-eager for a load-time-sensitive app.)

2. **Don't load intake reference where it isn't needed up front.** With Tier 2's nested Suspense, the 6-call `getIntakeReferenceData()` no longer sits in the page's blocking `Promise.all` — it only loads inside the panel that uses it. Confirm no page keeps it in the top-level `Promise.all` after the refactor.

3. **(Optional) Single shared Airtable queue.** [rest.ts](lib/airtable/rest.ts) and client.ts each own a separate `RequestQueue`, so they can momentarily exceed 5 req/s combined (risking 429s/backoff that *add* latency). Low-risk consolidation: have client.ts route through rest.ts's queue, or export one shared queue. Defer unless 429 backoff is observed.

---

## Tier 4 — Client-side polish (optional, smaller)

- `QueueTable` ([components/tickets/QueueTable.tsx](components/tickets/QueueTable.tsx)) and `ClipBoard` ([components/vishen/ClipBoard.tsx](components/vishen/ClipBoard.tsx)) render full lists with no virtualization. Only matters past ~200 rows; current data volumes are likely fine. If a specific page still feels janky after Tiers 1–3, add windowing or a "show more" cap. Not part of the core fix.

---

## Verification

1. **Reproduce baseline:** `npm run dev`, open a media source with many clips (the worst case) and a queue page; note load time in the Network tab / server logs.
2. **After Tier 1:** the media detail page should drop from 10s+ to ~1s; confirm the Airtable request count for that page falls from ~50 to ~2 (server logs / Airtable usage).
3. **After Tier 2:** on navigation, the sidebar + header + section skeletons should paint immediately; the table streams in after. Verify across editor/manager/stakeholder/tickets/studio/media/vishen/intake.
4. **After Tier 3:** repeat-load a queue page within the new TTL window and confirm reference data is served from cache (no repeated multi-table fetch in logs).
5. `npm run build` and `npm run lint` must pass. No DB/schema changes, so no migration.
6. Spot-check the convert flow still works (it shares `getClipsByIds`): tick a clip's "Create Ticket" and confirm `/api/clips/convert` still resolves it.
