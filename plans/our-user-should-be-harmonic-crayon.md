# Raise tickets from the Clips page + link tickets to clips

## Context

On the Clips page (`/media/[id]`, e.g. `/media/recp6DeoBJpYGgYZu`) users can already
**approve/dismiss** clip suggestions, but they can only **raise a ticket** from the Manager
Queue (`/manager`). The user wants to *also* raise tickets directly from the Clips page,
keeping the Manager flow untouched.

Second, when a ticket is created from a clip, the user wants the ticket **linked to the
clip in "Prio: Creatives"** so you can trace which ticket belongs to which clip. Two link
targets exist in the Creative Services base (`appFEFygXo2pRc8AR`), and their link fields
**already exist**:

- **`Clips (Sync)`** (`tblRXoSfDBFnpYk7G`) — the synced mirror of Vishen's real Clips
  (carries Rating / "24 Data" / Released / Feedback). Ticket link field `fld8evKonHAt3jBSH`
  ("Clips (Sync)"), reverse `fldBpNRq3e0oXka5F` on Clips (Sync). **This is the primary target
  the user asked for.** The link is a local field on the mirror, so it does **not** propagate
  back to Vishen's base — which is fine.
- **`🎬 Clip Suggestions`** (`tblquXg7eesUZwvSH`) — the app's own clip records the page
  renders. Ticket link `fldTcZh1Z5YvugMFX` ↔ ticket `fldP93wc2HWGsd7SZ`.

**Decisions (confirmed with user):** link the ticket to **both** targets; correlate to
Clips (Sync) via a **shared key + reconcile** (Clips (Sync) is an async Airtable mirror
with no app key today).

### Why a reconcile step is required
- A clip only appears in `Clips (Sync)` *after* the app pushes it to Vishen's base
  (`pushApprovedClipsToVishen`) and Airtable re-syncs it back — asynchronous.
- Under `TICKETS_BACKEND=postgres` ([lib/tickets/backend.ts](lib/tickets/backend.ts)),
  `createTicket` returns a **Postgres UUID**, not an Airtable recId. Today
  [convertClipsToTickets](app/media/actions.ts#L195) writes that UUID straight into the
  clip's Airtable `Ticket` link field — an invalid recId — so the clip↔ticket link is
  unreliable. The real Airtable recId only exists after the outbox drainer
  ([lib/airtable/push.ts](lib/airtable/push.ts)) mirrors the ticket and stamps
  `ticket.airtableId`.

So links are set by a small **idempotent reconcile** that runs once the async pieces settle.

---

## Part A — Raise a ticket from the Clips page (UI)

Reuse the existing convert flow — no new business logic. Per-clip, after approve.

- **[app/media/[id]/page.tsx](app/media/[id]/page.tsx)** — in `MediaBody` (line 12), fetch
  `getIntakeReferenceData()` ([lib/intake/data.ts](lib/intake/data.ts)) in parallel with the
  existing `listClipSuggestions` (one `Promise.all`) and pass `reference` + `sourceUrl` into
  `<MediaDetailClient>` (lines 17-24). It's already inside `<Suspense>`, so the extra Airtable
  reads don't block the hero.
- **[components/media/MediaDetailClient.tsx](components/media/MediaDetailClient.tsx)** —
  add props `reference: IntakeReferenceData` and `sourceUrl: string | null`; add
  `modalClipId` state. In the clip body (currently lines 217-230), beside the existing
  `ClipActions` (shown only when Proposed):
  - **Approved + no `ticketId`** → a "Convert to ticket →" button (style from
    [ApprovedClipsPanel.tsx:42-48](components/clips/ApprovedClipsPanel.tsx#L42-L48)) that
    sets `modalClipId`.
  - **Approved + has `ticketId`** → a static "Ticket created" pill.
  - Render `<ClipApprovalModal clipIds={[modalClipId]} sourceUrl={sourceUrl}
    reference={reference} onClose=… />` once when `modalClipId` is set. The modal already
    `router.refresh()`es on success. Update the stale "happens on the Manager Queue" copy
    (file-top comment + line 165 hint).

Reused unchanged: [ClipApprovalModal.tsx](components/media/ClipApprovalModal.tsx),
[convertClipsToTickets](app/media/actions.ts#L140). `ClipSuggestion` already carries `status`
and `ticketId` ([lib/media/repository.ts:215-230](lib/media/repository.ts#L215)).

---

## Part B — Robust ticket ↔ clip linking (both targets)

### Airtable prerequisites (one-time, outside code — flag to user)
1. **Add "App Clip ID" to the `Clips (Sync)` synced fields** (Airtable sync settings). This
   is the match key: Vishen Clips already stamps `App Clip ID` = clip-suggestion recId
   ([field-map.ts:484](lib/airtable/field-map.ts#L484)); syncing it into the mirror lets the
   reconcile find the right row. **Reconcile is a no-op until this exists.**
2. **Add "App Ticket ID" (singleLineText) to `Clip Suggestions`** — app-managed pairing key
   the app writes at convert time (recId or PG UUID). Create via Airtable MCP `create_field`
   or the UI.

### Code

- **[lib/airtable/field-map.ts](lib/airtable/field-map.ts)**
  - `TICKETS.links`: add `clipSuggestions: 'fldP93wc2HWGsd7SZ'`, `clipsSync: 'fld8evKonHAt3jBSH'`.
  - `CLIP_SUGGESTIONS.fields`: add `appTicketId: '<new fld id>'`.
  - New `CLIPS_SYNC` map: `tableId: 'tblRXoSfDBFnpYk7G'`, `fields.appClipId: '<synced fld id>'`,
    `links.prioTicket: 'fldBpNRq3e0oXka5F'`.

- **[lib/media/repository.ts](lib/media/repository.ts)** — add `appTicketId` to the
  `ClipSuggestion` interface + `mapClip`; extend `updateClipSuggestion`'s patch to write
  `appTicketId`.

- **New `lib/tickets/airtable-id.ts`** — `ticketAirtableId(id): Promise<string|null>`:
  `TICKETS_BACKEND === 'postgres'` → `prisma.ticket.findUnique({where:{id}, select:{airtableId:true}})`
  (may be null until drained); else the id is already an Airtable recId → return it.

- **[app/media/actions.ts](app/media/actions.ts)** `convertClipsToTickets` (line ~195):
  after `createTicket`, write `appTicketId: res.ticketId` on the clip, and set the
  `ticketRecId` link **only when `ticketAirtableId(res.ticketId)` resolves now** (else write
  status + appTicketId only and let reconcile finish the link — this also removes the invalid
  UUID write). At the end, call `reconcileClipTicketLinks()` best-effort (completes the
  airtable-backend link immediately; Clips (Sync) usually defers to the cron).

- **New `lib/media/ticket-links.ts`** — `reconcileClipTicketLinks(limit=60)`, idempotent,
  best-effort. Load approved clips via `listClipsByStatus('Approved')`
  ([repository.ts:258](lib/media/repository.ts#L258)); for each clip with `appTicketId`:
  1. `recId = await ticketAirtableId(clip.appTicketId)`; skip if unresolved (not drained yet).
  2. **Clip Suggestions link:** if `clip.ticketId` isn't `recId`, `updateClipSuggestion(clip.id,
     { ticketRecId: recId })`.
  3. **Clips (Sync) link:** if `clip.vishenClipId` set, find the mirror row —
     `listRecords(CLIPS_SYNC.baseId, CLIPS_SYNC.tableId, { filterByFormula: `{App Clip ID} =
     '${clip.id}'` })`; if found, read the ticket's current `clipsSync` field
     (`getRecord`), and if the mirror recId isn't already linked, `updateRecord` the **ticket**
     (`TICKETS`) `clipsSync` field to the union (idempotent, no clobber).

- **New `app/api/media/link-tickets/route.ts`** — `POST`, Bearer `SYNC_SECRET` gated (copy
  the pattern from [app/api/sync/push/route.ts](app/api/sync/push/route.ts)) → returns the
  reconcile report. Register a Kessel scheduled job (~every 5 min); reachable with just
  `SYNC_SECRET` on the `-as` URL (no IAP).

---

## Out of scope / unchanged
- Manager Queue panel ([ApprovedClipsSection](components/clips/ApprovedClipsSection.tsx)) stays as-is.
- No role/permission gating (parity with the Manager panel).
- No changes to the Vishen push (`pushApprovedClipsToVishen`) — the Clips (Sync) link stays
  in the Creative Services base and is not sent to Vishen's base.

## Verification
1. `npm run dev`; open `/media/<source with clips>`. Expand a Proposed clip → Approve/Dismiss
   still show; approve one → after refresh it shows "Convert to ticket →".
2. Click it → `ClipApprovalModal` opens; pick Event Type → Asset Type (filtered), due date →
   submit → modal closes, clip shows "Ticket created".
3. Confirm the ticket exists in `🎯 Prio: Creatives Requests` and its **🎬 Clip Suggestions**
   link (`fldP93wc2HWGsd7SZ`) points back to the clip.
4. After the Vishen push + Airtable re-sync land the clip in `Clips (Sync)`, run
   `curl -X POST "$URL/api/media/link-tickets" -H "Authorization: Bearer $SYNC_SECRET"`;
   confirm the ticket's **Clips (Sync)** link (`fld8evKonHAt3jBSH`) now points to the mirror
   row. Re-run → no duplicate links (idempotent).
5. Verify on the postgres backend the clip is marked Approved and (post-drain + reconcile) the
   Clip Suggestions link resolves to a real recId — no invalid-UUID write.
6. `npm run lint` clean.
```
