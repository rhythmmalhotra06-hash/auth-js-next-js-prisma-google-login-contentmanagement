# Align ContentManagement ↔ Vendor Portal — shared design foundation (mechanics only)

## Context

The Content app (`ContentManagement`) and the Vendor/Spend portal
(`auth-js-next-js-prisma-google-login-vendorportal`) are **two separate repos** whose design
systems were authored independently and drifted, so side by side they feel like different
products. Measured causes: different base font-size (14px vs 16px), different + differently-loaded
fonts (Inter/Bricolage via `next/font` vs a **broken** "Google Sans" `@import` that 404s and
silently falls back to Plus Jakarta Sans), and different container behavior.

**Decisions (confirmed with user via `/prd` discovery):**
- Direction: **extract a shared foundation** both repos consume; scope = **mechanics only**.
- **One typeface everywhere: Plus Jakarta Sans**, body + bold headings, self-hosted via
  `next/font`. This **retires Inter and Bricolage Grotesque from ContentManagement** and removes
  the vendor portal's broken Google Sans `@import` and stray Playfair `<link>`.
- **Base font-size 14px** across both.
- **Container width is NOT a shared mechanic** — vendor portal stays **full-bleed**, CM keeps its
  1180px `.content`. Each portal's layout width is its own identity.
- Each portal **keeps its own brand color + radii** (Content `#572280` + 12/16 radii; Vendor
  `#7a12d4` + pill 128px radii). Untouched.
- Sharing mechanism: **mirrored** `foundation.css` + `fonts.ts`, committed identically to both
  repos (each deploys independently on Kessel, so a `file:` dep won't resolve). Promote to a
  published `@mindvalley/*` package later during the Blinkwork migration.

Outcome: same typeface, same base size, same self-hosted loading across both portals; distinct
accent color, radii, and layout width preserved.

## The shared foundation (extracted mechanical layer)

Two small canonical files, mirrored into both repos with a "keep in sync — source of truth" header:

- **`fonts.ts`** — `Plus_Jakarta_Sans` from `next/font/google`, `variable: "--font-jakarta"`,
  `subsets: ["latin"]`, `weight: ["400","500","700"]`, `display: "swap"`. (next/font runs per-app
  at build; the file is identical in both.)
- **`app/foundation.css`** — the mechanical layer only:
  - `body` base: `font-family: var(--font-jakarta), ui-sans-serif, system-ui, …`,
    `font-size: 14px`, `line-height: 1.5`, font-smoothing, `text-rendering`.
  - `*, *::before, *::after { box-sizing: border-box }` and `html, body { margin:0; padding:0 }`.
  - Canonical `--mv-font-body` / `--mv-font-display` both = the Jakarta stack.

**NOT in the foundation** (stays per-app): brand color tokens, radii scale, semantic tokens,
container widths, all component classes.

## Changes

### ContentManagement
- Add `fonts.ts` + `app/foundation.css` (canonical copies); `@import "./foundation.css"` at the
  top of `app/globals.css`.
- `app/layout.tsx`: replace the `Inter` + `bricolage` local-font setup (lines 2–3, 7–19) with the
  `jakarta` import from `fonts.ts`; body `className` uses `${jakarta.variable} antialiased`. Add a
  `viewport` export (`width=device-width, initialScale=1`) for parity — currently absent.
- `app/globals.css`: drop the mechanical rules now owned by `foundation.css` (body font-family /
  `font-size:14px` / reset, lines ~210–222); repoint `--mv-font-body` (line 76) and
  `--font-display` (lines 206, 230) at `var(--font-jakarta)` — retiring `--font-inter` /
  `--font-display-face` / "Bricolage Grotesque". **Leave color + radii tokens untouched.**
- The local `app/fonts/BricolageGrotesque.woff2` import is removed (file can stay unused).

### Vendor Portal
- Add the same `fonts.ts` + `app/foundation.css`; `@import "./foundation.css"` in `app/globals.css`.
- `app/globals.css`: **delete** the Google Fonts `@import` lines (1–3); remove the `body`
  `font-size:16px` + reset now owned by `foundation.css` (lines ~166–179); repoint `--mv-font-body`
  / `--mv-font-display` (lines 93–96) at `var(--font-jakarta)`.
- `app/layout.tsx`: **remove** the `<head>` block — preconnect + Playfair `<link>` (lines 22–26);
  add the `jakarta` import from `fonts.ts` and apply `${jakarta.variable}` to `<body>`. Keep the
  existing `viewport` export.
- `app/of.css`: **no change** — vendor pages stay full-bleed (`.of-page` line 211,
  `.of-formshell__scroll` 920px stay as-is).
- **Do not touch** `--mv-brand` (`#7a12d4`) or the radii scale — identity preserved.

## Notes / expected behavior
- `of.css` hard-codes most type sizes in px (28/14/13/12/11), so the vendor 16→14 base change only
  affects *inheriting* text (unstyled copy, inputs/buttons) — deliberately low-regression.
- CM headings change character (Bricolage → Jakarta bold) — this is intended by the display-font
  decision.
- Honor `CLAUDE.md` styling rules: no raw hex, use `--mv-*` tokens / utilities.

## Verification
1. `npm run dev` in each repo; open a comparable page in both at the same zoom — body copy is the
   same size (14px) and typeface (Plus Jakarta Sans); headings are Jakarta bold in both.
2. Vendor portal DevTools → Network: **no** `fonts.googleapis.com` request, **no** `Google Sans`
   404; Jakarta served self-hosted from the app.
3. Confirm each portal still renders its own accent (CM `#572280`, Vendor `#7a12d4`) and its own
   radii; vendor pages still full-bleed, CM still 1180px.
4. `npm run build` in both repos to catch `next/font` import errors.
