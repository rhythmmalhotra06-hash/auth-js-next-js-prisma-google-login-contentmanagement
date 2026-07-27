# Cover Generator — add to Content Studio

## Context

There's a finished, standalone **Clip Cover Generator** prototype in the repo folder
`Clip Cover Generator/` — a self-contained "Design Component" HTML tool (custom `DCLogic`
framework, `html-to-image` PNG export, inline styles, Sharp Grotesk fonts). It lets a user
upload a 9×16 portrait, write a hook, pick a layout/style, reposition/zoom the image, and
export a pixel-accurate **1080×1920 PNG** cover for social clips (Reels/TikTok/Shorts). Two
approved layouts (`1a` scrim + highlighted keyword, `1d` marker-block highlight), documented
export gotchas, and a team guide all exist.

The goal is to bring this into the **Content Studio** Next.js app as a real, first-class
feature — not a loose HTML file — so covers are produced inside the same portal the team uses
for clips, and finished covers attach back to the clip they belong to.

The prototype is **not** React and shares no code with the app: the app has no image/canvas/export
dependency, no Sharp Grotesk fonts, no `public/` folder, and no Slider/Toggle primitives. So this
is a **faithful React port + pipeline integration**, keeping the prototype's exact visual output
and export behavior.

## Confirmed decisions (from the user)

1. **Process:** write a formal **Feature PRD via the `/prd` skill first**, then build.
2. **Integration:** **wire into the clip pipeline now** — a "Make cover" entry point from an
   approved clip that prefills the hook/author, in addition to a standalone page.
3. **Output:** in addition to PNG download, **save/attach the cover back** to the clip's record.
4. **Access:** visible to **everyone signed in** (in the `Library & media` nav group).

## Approach

### Phase 0 — Author the PRD (do first, via `/prd`)
Run `/prd new Cover Generator` → scope **Feature**, parent product
`content-production-management`, nested under the `content-clipping-engine` epic (it's part of the
clip workflow). Seed discovery with the four confirmed decisions above and the prototype spec
(`Clip Cover Generator/CLAUDE.md` + `Clip Cover Generator - Team Guide.md`). The PRD must resolve
the open technical question below (cover hosting) and define acceptance criteria; the build phases
follow from it.

### Phase 1 — Standalone React port (`/cover-generator`)
- New route `app/cover-generator/page.tsx`, wrapped in `<AppShell title="Cover Generator" …>`
  like [app/media/page.tsx:23](app/media/page.tsx#L23). Client component holds the generator.
- **Add dependency** `html-to-image` (no export/canvas lib exists today — confirmed in
  `package.json`). Reuse the prototype's `download()` capture logic verbatim, including the
  documented gotchas — capture the un-scaled 1080×1920 stage (pin width/height + canvasWidth/
  canvasHeight, remove the preview transform during capture, restore after), `document.fonts.ready`
  + a warm-up render, **no `text-wrap:balance`**, and **explicit title `width` (not left+right)**.
  These are load-bearing; see `Clip Cover Generator/CLAUDE.md` §"Critical export gotchas".
- **Add Sharp Grotesk fonts:** copy `SharpGroteskSmBold.otf`, `…Tight.otf`, `…Italic.otf` from
  `Clip Cover Generator/assets/` into the app and wire via `next/font/local` (the app currently
  loads only Plus Jakarta Sans via `next/font`; see [app/fonts.ts](app/fonts.ts)). Google Sans/
  Archivo/Playfair stay as `next/font/google` or Google Fonts links. Also copy `assets/sample.jpg`.
  Create a `public/` folder (none exists) for the sample image, or import it as a module asset.
- Port all controls/state from `Clip Cover.dc.html`'s `Component` class into React
  `useState`/handlers: upload (FileReader→dataURL), pan (drag, vertical-lock), zoom slider,
  layout 1a/1d, top/bottom, left/center, highlight color, author name + color, title font/size,
  shadow/overlay toggles, background fill, safe-area guides, keyword-highlight splitting
  (`renderVals`' pre/kw/post logic).
- **Styling:** UI **chrome** uses app design-system tokens/primitives — reuse `Button`,
  `Field/Input/Select/Textarea` ([components/ui/Field.tsx](components/ui/Field.tsx)), `Icon`, `cn`,
  brand tokens (`bg-brand` = `#572280`). Build the two missing primitives — a **Slider** (styled
  `input[type=range]`) and a **Toggle/Switch** — under `components/ui/` since none exist. Follow
  the design skill + `DESIGN_SYSTEM.md` (load `artifact-design` before writing UI).
  The **rendered cover artwork keeps the approved cover colors** (highlight purple `#9b37f2`,
  yellow `#f5c919`) — these are output content, not chrome, so they stay as literal values in the
  stage markup, not app tokens.
- **Nav:** one line in [lib/roles.ts:144-145](lib/roles.ts#L144) in `navForRoles`, group
  `'Library & media'`, icon `'photo'` (exists in [components/ui/Icon.tsx](components/ui/Icon.tsx);
  `'image'` does not). Push it unconditionally (before the role-gated Clips line) so **every**
  signed-in user sees it.

### Phase 2 — Wire into the clip pipeline
- Add a **"Make cover"** action on an approved clip in the media/clip surfaces
  ([components/media/MediaDetailClient.tsx](components/media/MediaDetailClient.tsx),
  [components/vishen/ClipBoard.tsx](components/vishen/ClipBoard.tsx)) that opens the generator
  **prefilled** from the clip: hook title ← `nuclearHookTitle || hookLine`, author ← the media
  source's author (Vishen). Pass via query params or a client store into `/cover-generator`.
  Note: clips have **no stored portrait frame**, so the image is still a manual upload (optionally
  seed with the video thumbnail if available); prefill covers text/author only.

### Phase 3 — Save cover back to the clip
- On export, in addition to download, POST the PNG to a new server action/route that **attaches it
  to the clip's Airtable record**. Clip Suggestions has `multipleAttachments` fields —
  `image` (`fldIuMoRGzVghUtKD`), `file`, `reference` — in [lib/airtable/field-map.ts:129-154](lib/airtable/field-map.ts#L129).
- **RESOLVED (2026-07-25):** used Airtable's **upload-attachment content API** (option c) — no bucket
  needed. The PAT has `data.records:write` + `schema.bases:write`. Clip Suggestions had no attachment
  field, so a **Cover** field was created (`fldKqhUWK7H3XvVnU`). Save-back encodes JPEG and posts via
  the `saveCoverToClip` server action → `uploadAttachment` in `lib/airtable/client.ts`. Verified
  end-to-end (1080×1920, ~292KB JPEG attached to a live clip). **All 3 phases done, build+lint green.**

## Critical files
- **Reference (do not modify):** `Clip Cover Generator/Clip Cover.dc.html` (source of truth for
  layout math + export logic), `Clip Cover Generator/CLAUDE.md`, `Clip Cover Generator/assets/*.otf`.
- **New:** `app/cover-generator/page.tsx` (+ client component), `components/ui/Slider.tsx`,
  `components/ui/Toggle.tsx`, font wiring in `app/fonts.ts` (or a local `@font-face`), a save-cover
  server action/route.
- **Edit:** [lib/roles.ts](lib/roles.ts) (nav entry), `package.json` (add `html-to-image`),
  clip surfaces for the "Make cover" action ([components/media/MediaDetailClient.tsx](components/media/MediaDetailClient.tsx),
  [components/vishen/ClipBoard.tsx](components/vishen/ClipBoard.tsx)).

## Verification
- `npm run dev` → open `/cover-generator`; confirm it renders in the sidebar for a signed-in user
  (dev-login harness), matches the prototype visually, and drag/zoom/all controls work.
- Export a PNG and verify it is exactly **1080×1920** and **pixel-matches the on-screen preview**
  (the whole point of the gotchas) — compare against a prototype export using the same inputs.
- `npm run build` + `npm run lint` clean.
- Phase 2: from an approved clip, "Make cover" opens the generator prefilled with the clip's hook
  and author.
- Phase 3: after save, the PNG appears as an attachment on the clip's Airtable record.
