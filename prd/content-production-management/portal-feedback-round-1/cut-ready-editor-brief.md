---
title: 'Cut-ready editor brief'
slug: 'cut-ready-editor-brief'
scope: feature
status: discovery
parent: content-production-management/portal-feedback-round-1.md
children: []
created: 2026-06-29
updated: 2026-06-29
resolution: 7/7
build-status: built
build-date: 2026-06-29
build-log: .builds/cut-ready-editor-brief.build.md
---

# E9.1 · Cut-ready editor brief

> **As-built note (Jun 29):** stored transcripts are normalized plain text (timestamps
> stripped), so the verbatim excerpt anchors on the clip's **hook line** (a near-verbatim
> quote) and returns a window of surrounding text — falling back to the opening window
> flagged "approx" when the hook can't be located. Live Airtable fields created:
> Prio "Download link" (`fldrwGSNIJ3pAsO20`), Media Sources "Download URL" (`fldHS8zfP5K9OtnQi`).

> Part of [Portal Feedback / Usability Round 1](../portal-feedback-round-1.md)

## Purpose

Gareth, on the live walkthrough: editors need "a brief which has the verbatim transcript of what they need to cut and trim, also a bit of flexibility to add some craft of humanness," **and** "a download link to the media e.g. Dropbox" — not just the YouTube viewing link. Today a clip→ticket conversion produces a brief with hook / why / caption / clip-range only, and carries only the source viewing URL. This feature makes a converted-clip ticket cut-ready: a download link plus the verbatim transcript for the clip's time range.

## Behavior

1. **Download link capture.** The media intake form ([components/media/MediaLinkForm.tsx](../../../components/media/MediaLinkForm.tsx)) gains an optional "Download link (Dropbox/Drive)" input alongside the YouTube URL. Stored on the `📺 Media Sources` row via `submitMediaLink` ([app/media/actions.ts](../../../app/media/actions.ts)).
2. **Verbatim slice.** The source transcript is already stored on the Media Source. A new `sliceTranscriptByRange(transcript, startMmSs, endMmSs)` helper in [lib/clipping/transcript.ts](../../../lib/clipping/transcript.ts) returns the transcript text spanning the clip's `timestampStart`–`timestampEnd`.
3. **Brief composition.** On `convertClipsToTickets` ([app/media/actions.ts](../../../app/media/actions.ts)), the creative brief appends a `Verbatim:` block (the slice) below the existing Hook/Why/Caption/Clip-range, and the ticket carries the download link.
4. **Display.** The editor ticket detail ([app/tickets/[id]/page.tsx](../../../app/tickets/[id]/page.tsx)) shows the download link as a clickable action and the verbatim block in the brief.

## Rules & Logic

- The download link is **optional** — absence must not block conversion (auto-discovered media won't have one yet).
- Timestamps are `mm:ss` strings. If the transcript has no usable timing, the slice falls back to a best-effort paragraph window around the clip and the brief flags it ("approx — verify against source").
- The verbatim block is **editable** by the editor (human craft) — it is a starting point, not a lock.

## Data

- `📺 Media Sources`: new `downloadUrl` (url) field; field ID added to `MEDIA_SOURCES` in [lib/airtable/field-map.ts](../../../lib/airtable/field-map.ts).
- Ticket (`🎯 Prio Requests`): a **dedicated "Download link" field** (new, url) — kept separate from `sourceLinks`, which continues to hold the source/provenance URL. New field on the live Prio Requests table + its field ID added to `field-map.ts`. *(Both new fields are live-base schema changes — create via Airtable MCP before wiring.)*
- Transcript text already persisted on the Media Source (`transcript`, ≤95k).

## Failure Modes

- **No transcript available** → omit the Verbatim block, keep hook/why/caption; do not fail the conversion.
- **Slice empty / timing mismatch** → fall back to paragraph window + flag; never insert an empty `Verbatim:` header.
- **Download link malformed** → store as-is (free URL field); editor sees the raw link.

## Acceptance Criteria

- Submitting a media link with a download URL persists it; it appears on every ticket converted from that source.
- A converted-clip ticket's brief contains a `Verbatim:` block matching the clip's time range, editable by the editor.
- Conversion still succeeds when the download link or transcript is absent.

## Open Questions

**Resolved (Jun 29):** Use a **dedicated "Download link" field** on the ticket, separate from `sourceLinks`. Transcript slicing is **best-effort**: slice exactly to `timestampStart`–`timestampEnd` when caption timing is available; when timing is missing, include a paragraph window near the clip and flag it "approx — verify against source" (no proportional-offset estimation).
