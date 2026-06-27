# Plan: Direct ticket-form & direct clip-generation (no second click)

## Context

Two workflow steps currently require an extra navigation + second click:

1. **Manager "Convert to ticket"** — In the Manager (and Editor) "Approved by Vishen
   — ready to convert" panel, the "Convert to ticket →" control is a `<Link>` to
   `/media/{mediaSourceId}` ([ApprovedClipsPanel.tsx:30](../components/clips/ApprovedClipsPanel.tsx#L30)).
   The user lands on the Media detail page and must re-select the clip and click
   "Convert" again to reach the create-ticket form. They want clicking "Convert to
   ticket" to **open the create-ticket form modal directly** (the `ClipApprovalModal`
   shown in the screenshot), pre-loaded with that clip.

2. **Clips "Generate clips"** — On the Clips page, `NewMediaCard`'s "Generate clips"
   button only creates the Media Source then navigates to `/media/{id}`
   ([NewMediaCard.tsx:29](../components/vishen/NewMediaCard.tsx#L29)). The user must then
   click "Suggest clips" on the Media detail page to actually generate. They want one
   click to both create the source **and** kick off generation.

Both fixes reuse existing components/actions — no new modal, no new API.

---

## Change 1 — Manager/Editor: open the create-ticket form inline

### `components/clips/ApprovedClipsPanel.tsx` (make it a client component)
- Add `'use client'`; import `useState`, `ClipApprovalModal`, and the
  `IntakeReferenceData` type.
- New props: `reference: IntakeReferenceData` and `sourceUrls: Record<string,string>`
  (id→source URL), alongside existing `approved` + `sourceNames`.
- Only list clips that are genuinely still convertible: `approved.filter((c) => !c.ticketId)`
  (an Approved clip that already has a linked ticket is done — converting it again is a
  silent no-op in `convertClipsToTickets`, so it shouldn't show a Convert button).
- Replace the `<Link>` at line 30 with a `<button onClick={() => setModalClip(c)}>` that
  opens the modal for that single clip.
- Add state `const [modalClip, setModalClip] = useState<ClipSuggestion | null>(null)` and
  render at the bottom:
  ```tsx
  {modalClip && (
    <ClipApprovalModal
      clipIds={[modalClip.id]}
      sourceUrl={sourceUrls[modalClip.mediaSourceId ?? ''] ?? null}
      reference={reference}
      onClose={() => setModalClip(null)}
    />
  )}
  ```
- `ClipApprovalModal` already calls `router.refresh()` on success
  ([ClipApprovalModal.tsx:64](../components/media/ClipApprovalModal.tsx#L64)), which
  re-renders the server page and drops the converted clip from the panel. No extra work.

### `app/manager/page.tsx` and `app/editor/page.tsx` (identical edits)
- Import `getIntakeReferenceData` from `@/lib/intake/data`.
- Add `getIntakeReferenceData()` to the existing `Promise.all`.
- Build a `sourceUrls` map next to the existing `sourceNames` map:
  `Object.fromEntries(sources.map((s) => [s.id, s.sourceUrl]))`.
- Pass `reference={reference}` and `sourceUrls={sourceUrls}` to `<ApprovedClipsPanel>`.

(Editor gets the same inline-modal behavior since the panel is shared — keeps the two
views consistent and avoids a branching prop.)

---

## Change 2 — Clips: generate immediately, watch progress on the Media page

Generation takes 1–3 min and the Media detail page already has the full progress UI
(status badge, "Generating… (1–3 min)", error surface). So instead of duplicating that
on the Clips page, auto-start generation **on arrival** at the Media detail page.

### `components/vishen/NewMediaCard.tsx`
- Change the post-submit navigation (line 29) to carry an autostart flag:
  `router.push(\`/media/${res.id}?autostart=1\`)`.
- The transcript the user pasted here is already saved on the source by
  `submitMediaLink` → `createMediaSource`, and the suggest route falls back to
  `source.transcript` ([suggest/route.ts:45](../app/api/media/[id]/suggest/route.ts#L45)),
  so auto-generation uses it with no extra plumbing.

### `app/media/[id]/page.tsx`
- Add `searchParams: Promise<{ autostart?: string }>` to the page props, await it, and
  pass `autostart={autostart === '1'}` to `<MediaDetailClient>`.

### `components/media/MediaDetailClient.tsx`
- Add `autostart?: boolean` prop; import `useEffect`, `useRef`.
- Add a one-shot effect that fires the existing `suggest()` on mount when appropriate:
  ```tsx
  const autoFired = useRef(false);
  useEffect(() => {
    if (autostart && !autoFired.current && !hasClips && status !== 'Transcribing') {
      autoFired.current = true;
      router.replace(`/media/${sourceId}`); // drop the param so reload won't re-generate
      suggest();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  ```
- Reuses the existing `suggest()` function unchanged — same API call, same progress
  states, same `router.refresh()` on completion.

---

## Files touched
- `components/clips/ApprovedClipsPanel.tsx` — client component + inline modal
- `app/manager/page.tsx` — load reference + sourceUrls
- `app/editor/page.tsx` — load reference + sourceUrls
- `components/vishen/NewMediaCard.tsx` — `?autostart=1`
- `app/media/[id]/page.tsx` — pass `autostart` prop
- `components/media/MediaDetailClient.tsx` — one-shot auto-suggest effect

Reused as-is: `ClipApprovalModal`, `convertClipsToTickets`, `getIntakeReferenceData`,
the `suggest()` flow + `/api/media/[id]/suggest` route.

---

## Verification (`npm run dev`)
1. **Manager inline form:** Manager view → an "Approved by Vishen" clip → click
   "Convert to ticket". The create-ticket modal opens in place (no navigation).
   Fill Event Type → Asset Type → Due date, submit → ticket created, clip drops off
   the panel. Repeat in the Editor view to confirm shared behavior.
2. **Clips one-click generate:** Clips page → paste a YouTube URL (+ optional
   transcript) → "Generate clips". Lands on `/media/{id}` and generation starts
   automatically (status flips to Transcribing → "Generating…", then clips appear).
   The URL no longer carries `?autostart=1`; reloading the page does not re-generate.
3. `npm run build` / `npm run lint` clean.
