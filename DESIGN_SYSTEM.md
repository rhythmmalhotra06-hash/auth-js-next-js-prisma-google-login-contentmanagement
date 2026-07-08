# Design System — Content Studio portal

> **Read this before building or changing any UI.** It is the canonical rulebook
> for this portal's visual language. When a rule here and the code disagree,
> `app/globals.css` is the source of truth for exact values — update this doc to match.
>
> **This is a living document.** Whenever Rhythm gives design feedback — a rule, a
> preference, a correction, a "from now on…" — fold it into this file in the same turn
> (add/adjust the relevant section) and mirror it to memory. Don't let design decisions
> live only in chat. (Future: promote this maintenance loop into a dedicated skill.)
>
> Order of authority: `app/foundation.css` + `app/fonts.ts` (shared mechanics) →
> `app/globals.css` (tokens + ported classes) → `components/ui/*` (primitives) →
> this document (the rules that tie them together) → `context/mockups/` (visual target).

---

## 0. The three non-negotiables

1. **Reuse before you build.** Never re-implement a button, badge, card, field, KPI,
   or table cell. A primitive already exists in `components/ui/` (§5) or a ported class
   in `app/globals.css` (§6). Compose those first.
2. **Tokens, never raw values.** No raw hex (`#572280` → `bg-brand`/`text-brand`), no
   arbitrary Tailwind sizes (`rounded-[8px]` → `rounded-sm`, `text-[11px]` → `text-2xs`),
   no inline `style={{}}` for spacing / typography / color. Inline `style` is allowed
   **only** for genuinely dynamic values (computed widths, `--i` animation indices).
3. **The mandated 5-column header.** Every list/table view's first five columns are, in
   this order: **Title, Priority, Assigned, Ticket Status, Priority Status.** This is a
   product mandate, not a style preference.

---

## 1. Brand identity

- **Primary — purple `#572280`** (`--mv-brand` / `bg-brand`, `text-brand`). The portal's
  dominant brand color: primary buttons, active nav, focus, links, brand mark.
- **Accent — gold `#f5b000`** (`--mv-gold` / `bg-gold`). **Attention only** — the single
  highest-priority thing on a screen (one "attention" KPI, an urgent pip). Never a second
  primary. If two things are gold, neither reads as urgent.
- **Typeface — Plus Jakarta Sans**, self-hosted (see §2).
- **Radii — 8px / 12px**, soft but not pill. Pill (`rounded-full`) is for dots & avatars only.
- **Dark mode is first-class.** Every token has a dark value; toggled via `.dark` /
  `[data-mv-theme="dark"]` (next-themes, `components/ui/ThemeProvider.tsx`). Never hard-code a
  color that won't invert — always go through a semantic token.

---

## 2. Typography

Body and display share **one typeface: Plus Jakarta Sans**, loaded self-hosted via
`next/font` in `app/fonts.ts` and applied in `app/foundation.css` (the shared mechanical
layer — do not redefine font-family / base size elsewhere).

| Role | Value | Token / how |
|------|-------|-------------|
| Base body | **14px** / line-height 1.5 | set on `body` in `foundation.css` — the baseline everything inherits |
| Body font | Plus Jakarta Sans | `--mv-font-body` / `font-sans` |
| Display (headings, KPI numerals) | Plus Jakarta Sans **bold** | `--font-display` / `font-display`; `h1–h4` auto-apply it at weight 600, `letter-spacing:-.015em` |
| Micro-labels (eyebrows, meta) | **11px** | `text-2xs` |
| xs / sm / base | 12 / 14 / 16px | Tailwind defaults — **deliberately not overridden**; changing them shifts text app-wide |
| Weights | 400 / 500 / 600 / 700 | `--mv-weight-*` |
| Mono (IDs, timecodes) | system mono stack | `--mv-font-mono` / `font-mono` |

Rules: headings use the display font automatically — don't set `font-family` by hand. Use
`text-2xs` for the 11px uppercase eyebrow/meta labels, `text-sm` (14) for body, and let KPI
values use `.kpi .val` rather than hand-sizing numerals.

---

## 3. Color tokens

Defined in `app/globals.css` `:root` (light) + `.dark` (dark). Reference by **name**, never hex.

**Brand:** `--mv-brand` `#572280`, `-bright` `#6d34a0` (hover), `-content` `#3f1860` (ink on
light brand), `-soft` `#f1eaf7` (tint bg), `-border` `#e3d4f0`.
**Gold (accent only):** `--mv-gold`, `-bright`, `-content` `#6b4e00`, `-soft` `#fff6e0`.
**Status:** green `#159f65`, blue `#2563cf`, amber `#c9801a`, red `#dc2626` — each with a
`-content` (accessible ink) and `-soft` (tint bg). Exposed as `success`/`info`/`warning`/`danger`.
**Neutrals:** `--mv-grey-100…700` (cool, purple-tinted), `--mv-white`, `--mv-black` `#1a1523`.

**Semantic (use these, not the raw scales above):**

| Purpose | Token | Utility |
|---------|-------|---------|
| Page background | `--mv-bg-muted` | `bg-bg-muted` |
| Card / panel surface | `--mv-surface` | `bg-surface` |
| Subtle fill (hover, chips) | `--mv-bg-subtle` | `bg-bg-subtle` |
| Primary text | `--mv-text` | `text-text` |
| Secondary text | `--mv-text-muted` | `text-text-muted` |
| Tertiary / placeholder | `--mv-text-subtle` | `text-text-subtle` |
| Link | `--mv-text-link` | `text-text-link` |
| Border (default) | `--mv-border` | `border-border-default` |
| Border (strong, inputs) | `--mv-border-strong` | `border-border-strong` |
| Focus ring | `--mv-focus-ring` | (auto via `:focus-visible`) |

**Event/priority tiers** (`.tier` + `.high/.mid/.soc/.low`) have dedicated bg/ink pairs that
invert in dark mode — use the `TierBadge` primitive, don't reach for the raw tokens.

**Agency palette** (`--mv-ag-simplex` teal · `-svishen` indigo · `-talking` pink · `-twocomma`
cyan · `-internal` slate; short aliases `--ag-*`, lifted in dark). A **categorical** palette for
"who made it" on Vishen's media calendar/lanes only — it is **not** a status axis and **not** the
accent. Status stays green/blue/amber/red; gold stays attention. Map an agency to its color with
`agencyColor()` in `components/studio/media/shared.tsx`; a data-driven `style={{ background:
agencyColor(source) }}` (dynamic value) is the sanctioned use.

---

## 4. Radius, shadow, spacing, motion

- **Radius:** `rounded-xs` 4 · `rounded-sm` **8** (buttons, badges, inputs, chips) ·
  `rounded-md` **12** (cards, panels) · `rounded-lg` 16 (table wrappers, large containers) ·
  `rounded-full` (dots/avatars only). Tokens: `--mv-radius-*`.
- **Shadow:** `--mv-shadow-light` (cards, default) · `-medium` (popovers) · `-strong` (modals) ·
  `-focus` (focus glow). Prefer `var(--sh-1|2|3)` via the ported classes.
- **Spacing:** use Tailwind's scale (`gap-2`, `p-4`, …). Page content padding and max-width are
  owned by `.content` (22px/26px, `max-width:1180px`) — don't re-pad the page shell.
- **Motion:** `--mv-ease-standard` with `--mv-dur-fast` 120ms / `-base` 200ms / `-slow` 320ms.
  Keep transitions to color/background/transform; respect reduced-motion.

---

## 5. Component primitives (reuse first) — `components/ui/`

| Need | Use |
|------|-----|
| Buttons | `Button` (variants: primary / gold / ghost / sm / block) |
| Status/label chips | `Badge`, `TierBadge` |
| Metric tiles | `Kpi`, `MetricCard` |
| Forms | `Field` (+ `Input`/`Select`/`Textarea`), `SearchableSelect` |
| Icons | `Icon` |
| Data viz | `Sparkline`, `FunnelCapacity` |
| Insights / AI proposals | `InsightCard`, `AskPanel`, `BriefText` |
| App chrome | `AppShell`, `ShellChrome`, `Sidebar`, `DetailDrawer` |
| Loading | `Skeletons` |
| Tables | `components/ui/table/*` |

Build a new primitive only when nothing composes — and put it in `components/ui/` using tokens,
so the next feature reuses it.

---

## 6. Ported global classes — `app/globals.css`

Prototype-parity classes (source of truth: `context/mockups/demo.html`). Use where a primitive
doesn't fit:

- **Layout:** `.app` · `.side` / `.brand` / `.nav` · `.main` / `.topbar` · `.content`
- **Cards:** `.card` + `.pad`
- **KPIs:** `.kpis` grid · `.kpi` (+ `.alert` / `.danger` / `.attention` / `.clickable`)
- **Buttons:** `.btn` (+ `.primary` / `.gold` / `.ghost` / `.sm` / `.block`)
- **Badges:** `.badge` + `.b-neutral/-brand/-success/-info/-warning/-danger/-gold`
- **Tiers:** `.tier` + `.high/.mid/.soc/.low`
- **Section headers / labels:** `.sec-head`, `.eyebrow`, `.toolbar`
- **Tables:** `.tw` (wrapper) + `.tscroll` (horizontal scroll with edge shadows)
- **Form controls** are styled globally (13px, `rounded-sm`, `border-strong`, brand focus ring) —
  a bare `<input>/<select>/<textarea>` already looks right; wrap with `Field` for label + spacing.

---

## 7. Responsiveness & overflow

- Page body must never scroll horizontally. Wide content (tables, diagrams) scrolls inside its
  own `overflow-x:auto` container (`.tscroll`).
- `html, body { overflow-x: clip }` is set globally so off-canvas fixed panels (the Ask panel,
  the mobile nav drawer) can't add page-level horizontal scroll. Use `clip`, **not** `hidden` —
  `hidden` creates a scroll container that breaks the sticky topbar. Any new off-canvas element
  (drawer, toast rail, side sheet) may rely on this rather than reinventing containment.
- Sidebar collapses to a drawer at ≤820px (handled by the shell). Don't build a second nav. The
  drawer has a dim backdrop (`.side-scrim`) that closes it on tap; Escape also closes it.
- **Mobile breakpoint ladder** (custom `@media (max-width:…)` in `globals.css`, mobile-first fixes
  layer on top): `900` detail→1col · `820` sidebar→drawer + ≥44px tap targets (`.icobtn`, nav) ·
  `760` datarow→1col · `680` form-grid/grid2/funnel→stacked · `560` topbar declutter
  (subtitle + role pill hidden, "New request" icon-only via `.btn-label`), factgrid→1col, and the
  queue table reflows to stacked cards. Reuse these; don't introduce new breakpoints.
- **Wide list tables on phones:** the shared `QueueTable` reflows to stacked `.qcard` cards below
  560px (Title + the mandated five fields), toggled against `.tw.has-cards`. Denser spreadsheet
  grids (ShootsBoard, review queue, scoring) keep horizontal `.tscroll` — a card reflow there
  would be a rebuild.
- Interactive controls need a ≥44×44px touch target on mobile; body text stays ≥14px.
- Use relative units and flex/grid; `max-width:100%` on media.

---

## 8. The shared foundation (do not fork casually)

`app/foundation.css` + `app/fonts.ts` are the **mechanical layer** (typeface, 14px base, reset)
and are mirrored with the Vendor Portal repo — they carry a "keep in sync" header. Change
typeface or base size **there**, not in `globals.css`, and mirror the change. `globals.css` owns
everything brand-specific (color, radii, components); those are *not* shared.

---

## 9. Checklist before shipping a UI change

- [ ] Reused a `components/ui/*` primitive or ported class — no re-implemented button/field/card
- [ ] No raw hex, no arbitrary `[...]` Tailwind sizes, no inline `style` for color/type/spacing
- [ ] Verified in **both** light and dark mode
- [ ] List/table views lead with the 5 mandated columns
- [ ] Gold used for at most one attention element per screen
- [ ] No horizontal page scroll; wide content scrolls in its own container
