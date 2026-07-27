---
title: 'E8.5 · Cover Generator'
slug: 'cover-generator'
scope: feature
status: resolved
parent: content-production-management/content-clipping-engine.md
children: []
created: 2026-07-24
updated: 2026-07-24
resolution: 7/7
---

# E8.5 · Cover Generator

> Part of [E8 · AI Content Clipping Engine](../content-clipping-engine.md)

## Purpose

Editors and the founder/social team need a fast, on-brand way to produce the **cover
image** (the still frame with the hook headline) that fronts a short-form clip — the first
thing a viewer sees in a Reel/TikTok/Short and the single biggest driver of whether they stop
scrolling. Today that cover is made by hand in design tools, off-brand and slow, disconnected
from the clip it belongs to.

A working standalone prototype already exists (`Clip Cover Generator/`): upload a 9×16
portrait, write the hook, pick one of two approved layouts, reposition/zoom the image, and
export a pixel-accurate **1080×1920 PNG**. This feature brings that tool **into Content Studio**
as a first-class page and **wires it into the clip pipeline**, so a cover can be generated
directly from an approved clip (prefilled with its hook + author) and attached back to that
clip's record — closing the loop from AI clip suggestion → production → finished cover.

## Behavior

**A. Standalone generator (`/cover-generator`)** — a faithful React port of the prototype,
producing identical output. Controls:

- **Portrait upload** (JPG/PNG) with **drag-to-reposition** (vertical-lock on by default),
  **zoom** slider (40–220%), and Reset. Pan bounds derive from the real image dimensions.
- **Background fill** when the image doesn't cover the frame: Blurred photo / MV Purple.
- **Layout:** `1a` (dark scrim + highlighted keyword) or `1d` (marker-block highlight).
- **Highlight color:** MV Purple `#9b37f2` / Yellow `#f5c919` (yellow auto-darkens text for
  contrast). **Title position:** Top / Bottom. **Text align:** Left / Center (left adds inset;
  author name is always centered).
- **Hook title** (manual line breaks via Enter), **highlight word**, **author name** + name
  color (white/black).
- **Title font** (Sharp Grotesk default / tight / italic, Google Sans, Archivo, Playfair) +
  custom-font upload; **title size** 60–140px; **title shadow** toggle; **gradient overlay**
  toggle; **safe-area guides** (preview-only, never exported).
- **Export:** downloads a **1080×1920 PNG** named `{author}-{first-3-hook-words}.png`, and
  **pixel-matches the on-screen preview**.

**B. Make cover from a clip (pipeline integration)** — on an **approved clip** in the clip
surfaces (`/media/[id]`, `/vishen`), a **"Make cover"** action opens the generator **prefilled**:
hook title ← `nuclearHookTitle || hookLine`, author ← the media source's author. The portrait
is still a manual upload (clips have no stored still frame; optionally seeded with the video
thumbnail). The cover is associated with that clip for save-back.

**C. Save cover back** — on export the user can, in addition to downloading, **save the cover
to the clip's record** so it lives with the clip (visible to the team and to Vishen's synced
base). Download always works; save-back is an additional action, never a precondition.

**Access:** the standalone page is in the sidebar's `Library & media` group and visible to
**every signed-in @mindvalley.com user**. Save-back is available only when launched from a clip.

## Rules & Logic

- **Output fidelity is the core rule.** Export must equal preview at 1080×1920. Preserve the
  prototype's proven capture technique exactly (documented in `Clip Cover Generator/CLAUDE.md`):
  capture the **un-scaled** stage with `width/height` AND `canvasWidth/canvasHeight` pinned to
  1080×1920, remove the preview transform during capture and restore after; await
  `document.fonts.ready` + one warm-up render before the real capture; **never use
  `text-wrap:balance`** on titles; give titles an **explicit `width`** (not `left+right`). These
  are load-bearing — regressing any one causes preview/export drift.
- **Layout geometry** (per prototype): 1a title width `1008 − inset`, 1d `1016 − inset`; left
  inset 128px (1a) / 120px (1d); bottom-position uses fixed widths (1a 936px, 1d 952px).
- **Highlight-word matching** is case-insensitive first-occurrence split into pre/keyword/post.
- **Yellow highlight** forces dark marker/keyword text (`#1a1206`) for contrast; purple keeps
  white.
- **Chrome vs. artwork colors:** the app UI (buttons, fields, labels) uses design-system tokens
  (`bg-brand` = `#572280`, etc.) per `DESIGN_SYSTEM.md`. The **rendered cover artwork keeps the
  approved cover palette** (`#9b37f2` / `#f5c919`) as literal values — it is output content, not
  chrome, and must not be retokenized to the app's `#572280`.
- **Prefill mapping** (from a clip): title = `nuclearHookTitle` else `hookLine`; author = media
  source author; highlight word left blank for the user to choose; everything else = defaults.
- **Save-back target:** a **Cover** attachment field on 🎬 Clip Suggestions —
  `fldKqhUWK7H3XvVnU`, app-created 2026-07-25 (the table had no attachment field; the
  `fldIuMoRGzVghUtKD` in an earlier draft was the Ads base's Final-Ad-Asset "Image",
  a different table). Mapped as `CLIP_SUGGESTIONS.fields.cover` in `lib/airtable/field-map.ts`.

## Data

**Inputs**
- User-provided: portrait image (client-side only, never uploaded unless saved back), all style
  controls, hook text, author name.
- From a clip (prefill): `nuclearHookTitle`, `hookLine`, media-source author, optional video
  thumbnail URL, and the clip's record id (for save-back).

**Output**
- A 1080×1920 PNG. For download-only use it never leaves the browser. For save-back it must be
  persisted and attached to the clip's Airtable record.

**Storage / hosting for save-back — DECIDED: Airtable upload-attachment content API (no new infra).**
Airtable attachment fields can't take raw bytes via the normal records API, but the **upload-
attachment content API** (`POST https://content.airtable.com/v0/{baseId}/{recordId}/{fieldId}/uploadAttachment`,
base64 `file` + `contentType` + `filename`) does. It uses the **same Bearer PAT and
`data.records:write` scope the app already holds** for two-way sync (see `lib/airtable/client.ts`
`Authorization: Bearer ${token()}`), so save-back needs **no bucket, no GCP console, no new secret,
and no ephemeral-URL endpoint**. This fits the Kessel-only reality (no GCS/S3 provisioning access).

**Payload constraint + mitigation:** the endpoint caps the request at ~5 MB and base64 inflates
size ~33%, so a photographic 1080×1920 **PNG** may exceed the cap. Therefore the **save-back copy
is encoded as high-quality JPEG** (covers are photos — visually equivalent, well under the cap);
the user's **download** stays PNG. No downscaling needed.

**Retention / model (v1):** one **current cover per clip, overwritten on re-save** (no version
stack in v1). Covers are app-side only in v1; propagating them into Vishen's Clips (Sync) mirror is
a deferred fast-follow, not part of the core save-back.

## Failure Modes

- **Preview/export mismatch** — mitigated by the capture rules above; if fonts aren't ready the
  warm-up render + `document.fonts.ready` gate prevents fallback-metric wrap. Regression here is
  the highest-severity bug and must be caught in verification (compare export to preview).
- **Image doesn't cover the frame** — background fill (blur / MV Purple) handles it; no error.
- **Very long hook** — the user breaks lines manually and picks the "tight" font / smaller size;
  no auto-fit in v1 (explicit boundary).
- **Save-back fails** (network, Airtable 429, hosting error) — the download must still succeed;
  save-back surfaces a non-blocking error and is retryable. Never lose the user's work.
- **Launched-from-clip but clip lacks a hook/author** — generator opens with empty fields rather
  than failing; user fills them in.
- **`html-to-image` can't embed `blob:`/cross-origin images** — swap stage images to data URIs
  before capture (as the prototype does); a seeded thumbnail URL must be CORS-safe or proxied.

## Acceptance Criteria

- `/cover-generator` renders in the sidebar for any signed-in user and visually matches the
  prototype; all controls (upload, pan/zoom, layouts, colors, position/align, fonts, size,
  toggles, safe-area) work.
- Exported PNG is **exactly 1080×1920** and **pixel-matches the on-screen preview** for the same
  inputs (spot-checked against a prototype export).
- From an approved clip, **"Make cover"** opens the generator prefilled with that clip's hook and
  author.
- After **save-back**, the PNG appears as an attachment on the clip's Airtable record; a failed
  save-back does not block the download.
- `npm run build` and `npm run lint` pass.

## Open Questions

_Resolved during discovery (2026-07-24):_

- **Cover hosting** → Airtable upload-attachment content API, save-back copy as JPEG. No new infra.
  (See Data.)
- **Thumbnail seeding** → No. Clip thumbnails are 16:9 and crop poorly to 9:16; prefill text/author
  only, portrait stays a manual upload.
- **Cover history** → Single current cover, overwritten on re-save. No version stack in v1.
- **Sync to Vishen's base** → Deferred fast-follow. v1 attaches app-side only; extending to the
  Clips (Sync) mirror comes after core save-back works.

_Confirmed during build (2026-07-25):_

- **PAT scope** — the Airtable PAT has `data.records:write` + `schema.bases:write`, and the
  `uploadAttachment` content API works. Verified end-to-end: a JPEG save-back produced a
  1080×1920, ~292KB attachment on a live Clip Suggestions record (well under the 5MB cap). No
  bucket/fallback needed.
