---
prd: 'content-production-management/portal-feedback-round-1/cut-ready-editor-brief.md'
feature: 'E9.1 · Cut-ready editor brief'
started: 2026-06-29
completed: 2026-06-29
status: completed
current_step: 6
total_steps: 6
---

# Build Log: E9.1 · Cut-ready editor brief

## Approved Plan

Download link + verbatim transcript on clip→ticket. Live Airtable fields created:
- Prio Requests "Download link" (url) = fldrwGSNIJ3pAsO20
- Media Sources "Download URL" (url) = fldHS8zfP5K9OtnQi

- **Step 1** — field-map: add downloadUrl (MEDIA_SOURCES), downloadLink (TICKETS).
- **Step 2** — transcript.ts: `sliceTranscriptByRange(transcript, start, end)` (best-effort, flag when timing missing).
- **Step 3** — media repository: MediaSource.downloadUrl (map + LIST_FIELDS), CreateMediaSourceInput.downloadUrl, write on create.
- **Step 4** — MediaLinkForm + submitMediaLink: optional Download link input.
- **Step 5** — convertClipsToTickets: fetch parent source(s) for transcript + downloadUrl; append a Verbatim block (sliced to the clip range) to the brief; pass the download link to the ticket.
- **Step 6** — createTicket (intake/actions + repository): downloadLink field; TicketDetail + detail page display.

Verify: lint + build + manual.

## Progress

- [x] Step 1: field-map entries
- [x] Step 2: sliceTranscriptForClip (hook-anchored best-effort; transcript has no timestamps)
- [x] Step 3: media repository downloadUrl
- [x] Step 4: MediaLinkForm + submitMediaLink
- [x] Step 5: convertClipsToTickets verbatim + download link
- [x] Step 6: createTicket downloadLink + detail display

## Result

Files modified: 8 (field-map, clipping/transcript, media/repository, MediaLinkForm,
media/actions, intake/actions, ticket.repository, tickets/data, tickets/[id]/page).
Live Airtable fields created via MCP: Prio "Download link" (fldrwGSNIJ3pAsO20),
Media Sources "Download URL" (fldHS8zfP5K9OtnQi).
Verification: `npm run lint` clean (only pre-existing warnings), `npm run build` passes.
As-built note: stored transcripts are normalized plain text (timestamps stripped), so the
verbatim excerpt anchors on the clip's hook line (a near-verbatim quote) and falls back to
the opening window flagged "approx" when the hook can't be located — rather than mm:ss slicing.
