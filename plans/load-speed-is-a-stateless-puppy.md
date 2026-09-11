# The message page, live-post links, and honest VL channel tags

> Supersedes the load-speed plan that lived in this file — that work shipped on 11 Sep
> (commits `08006f7`…`b4f1ec2`); its status notes are in git history.

## Context

Three asks from Rhythm after using the deployed Monday pack:

1. **"Click *Expert to Authority* and see everything that happened for it last week, with
   results."** Today the message on the brand card (`components/mow/BrandCard.tsx:37`) is plain
   text. The data to answer the question already exists in `CalendarWeek`: every MV post and
   email carries `messageName` per day (`data.airtable.ts` MV lane, `perAsset`), every VL asset
   carries `messageName` from its linked MOW record, and MV posts carry `results` from Perch.
   Nothing groups them by message anywhere.

2. **"Add the published link on the asset detail page so we can see the post live."** The VL
   asset detail (`app/studio/comms-calendar/asset/[id]/page.tsx:250-270`) renders the URL as a
   raw link buried in the Production grid; the post tiles on `/performance/week`
   (`components/mow/PostGrid.tsx:112-149`) have no live link at all. Decision: a clear
   "View live post ↗" action near the title on the detail page, and a ↗ on each tile that has a URL.

3. **"For VL media, whatever has a LinkedIn or YouTube published link, tag it correctly."**
   Verified against the live base (19 published VL assets since 24 Aug): `Medium`
   (`fld7DTNjp6neU9bUH`) is **empty on 18 of 19** — only the podcast has it. So `channel`
   (`data.airtable.ts:369`, derived from Medium alone) is null on nearly every live LinkedIn
   post. But every one of them has `Published Link` (`fldrym088lQmqfhGg`) = `lnkd.in/…` or
   `linkedin.com/pulse/…`, and the YouTube one has `youtube.com/watch…`; `Source`
   (`fldxt25kQecgDdQvR`) also says `VL LI: Two Comma PR` / `VL YT: Talking Heads`, and the
   `channels` link (`fldgM2xzF0LJkgyYu`) says `YT: Vishen`. Decision (Rhythm): **derive in the
   app, do not write back to Airtable.**

Scope agreed via questions: message page = every MV post + email + VL asset under the message
this week, grouped by day, with platform, image, live link and results. Per-platform totals and
"other weeks this message ran" were not selected — leave them out (the span is already stated
on the brand card as `spanNote`).

---

## 1. Channel derivation for VL assets — reuse `deriveChannel`, don't write a second one

**The helper exists.** `lib/media/vishen-videos.ts:58-70` `deriveChannel(publishedLink, medium)`
is URL-first (`linkedin.` → LinkedIn, `youtube.`/`youtu.be` → YouTube, `instagram.` →
Instagram), then falls back to Medium keywords, then `'Web'`. `/studio/media` already tags VL
media with it; the comms calendar reads the same table and ignores it — the two surfaces
disagree today. Fix = make the calendar use the same function.

Changes to `deriveChannel` (one place, both surfaces benefit):
- Add `lnkd.in` (LinkedIn's shortener — 12 of the 19 live published links use it; the
  calendar's own test fixture at `verify-calendar.mts:13` is one) and `m.youtube.com`.
  `.trim()` the URL first — live values carry trailing spaces.
- Add a `source` fallback tier before `'Web'`: `VL LI:` → LinkedIn, `VL YT:` → YouTube,
  `VL IG:` → Instagram (the multi-select `Source`, `fldxt25kQecgDdQvR`). Signature becomes
  `deriveChannel(publishedLink, medium, source?: string[] | null)` — optional, so the two
  existing callers (`vishen-videos.ts:92`, `vishen-videos.postgres.ts:48`) are untouched.
- Return `null` instead of `'Web'` when nothing matched? No — keep `'Web'` for `/studio/media`
  (its filter chips depend on it); the calendar maps `'Web'` → `null` at the call site so its
  tier-2 empty stays quiet.

Precedence is **URL first**, as the request states ("whatever has a LinkedIn or YT published
link, tag it correctly") and as `/studio/media` already does. The 8 Sep podcast (Medium =
Podcast, link = youtube.com) therefore reads **YouTube**; Medium stays visible as its own fact
where the detail page shows it. Do NOT read `links.channels` (`fldgM2xzF0LJkgyYu`) — declared,
never used anywhere, needs a table that isn't in `field-map.ts`.

Apply at the three identical call sites, all `channel: selectName(f[VL_VIDEOS.fields.medium])`:
`data.airtable.ts:369`, `asset.ts:203`, `not-dated.ts:98` (a tray grouping key — LinkedIn posts
will now group under LinkedIn instead of "no channel"). `publishedLink` and `source` are already
in the `VL_FIELDS` projection — no extra Airtable cost. Also set `platforms: [channel]` on VL
assets when non-null so the message page can badge them like MV posts.

Pin in `tests/offline/verify-calendar.mts` — **there is no `channel` assertion anywhere today**:
the existing L10-13 fixture (`lnkd.in` + Source, no Medium) must read LinkedIn; L14-17 (Podcast
+ youtube.com) must read YouTube; add a `linkedin.com/pulse` row and a no-link/no-medium row
(→ null). Also fix the duplicate "9." section label in that file while there.

## 2. Live-post links

- **`components/mow/PostGrid.tsx`** tile: when `p.publishedUrl`, render a small `↗ Live` anchor
  (`target="_blank" rel="noreferrer"`) in the footer row beside the platform badges. The tile is
  a `<Link>` today; an anchor inside a link is invalid HTML — restructure the tile to a `<div>`
  with the title/thumbnail wrapped in the `<Link>` and the ↗ as a sibling anchor.
  Use `Icon` from `components/ui/Icon.tsx` if an external-link glyph exists; else the `↗` glyph.
- **`app/studio/comms-calendar/asset/[id]/page.tsx`**: add a `Button`-styled anchor
  "View live post ↗" in the header block under the title (next to the badges), shown only when
  `asset.publishedUrl`. Keep the Production-grid URL as the raw provenance. When
  `asset.published && !asset.publishedUrl`, keep the existing `EmptyOwned` (U8) — do not add a
  dead button.
- **Message page rows** (§3) get the same ↗.

## 3. The message page — `app/performance/week/message/[name]/page.tsx` (new)

Route: `/performance/week/message/<encoded message name>?week=YYYY-MM-DD`. Streamed like the
pack: shell + title from the URL, body under `Suspense`.

**Link from the brand card**: `BrandCard.tsx:37` — when `h.message`, wrap it in a `Link` to the
route (brand-toned hover, ↗-free since it's internal). Also link each `related` beat
(`BrandCard.tsx:43-49`) — *Jim Kwik (Mention Expert to Authority)* is a message too.

**Data** — `lib/mow/message-week.ts` (new), pure over `CalendarWeek` + `PackDay[]`:

```ts
export function messageWeek(week: CalendarWeek, name: string): MessageWeek | null
```
- Reuse `getWeekPack(anchor)` (memoised per week — free second call) and select from it:
  - MV posts: `week.allPosts.filter(p => p.messageName === name)`.
  - Emails: for each `week.days[d]`, `d.mv.filter(a => a.id.endsWith(':email') && a.messageName === name)`
    — the synthetic email rows never reach `allPosts` (the `!a.id.includes(':')` filter at
    `data.airtable.ts:~420`), so read them from the lanes.
  - VL assets: `week.days[d].vl.filter(a => a.messageName === name)`.
  - **Name matching gotcha:** the header's `message` has been through `splitJammedName(raw,
    'MV')` (`data.airtable.ts:~211`) but each MV asset's `messageName` is the RAW day text
    (`meaningful(dayMessage)`, `~L410`). For `MV: Be Extraordinary VL: Podcast - Naveen Jain`
    they differ. Normalise both sides with `splitJammedName(x, brand) || x` before comparing —
    put that in one `sameMessage(a, b)` helper in `message-week.ts` and test it with the jammed
    fixture from `verify-calendar.mts` §10.
- Group by day (Mon→Sun), each item: brand, title, channel/platforms, imageUrl, publishedUrl,
  live, results. Day header shows the pack's planned/delivered for that day (`PackDay`).
- Summary line: `N items · M posts matched to a published post · reach shown per platform in
  the tiles` — no cross-platform total (the standing rule in `week-pack.ts` header).
- If the name matches nothing this week → `EmptyOwned` "No assets carry this message in this
  week" + a link back to the pack. Never 404: the name came from a card that had it.

**UI** — reuse `PostGrid` tiles for MV posts? Simpler and consistent: a per-day section using a
row component shared with the calendar's `AssetRow` (`components/comms-calendar/WeekGrid.tsx`)
for emails/VL, and `PostGrid`-style tiles for posts with images. Keep to tokens
(`DESIGN_SYSTEM.md`); VL rows teal-badged, MV brand-badged.

Also from the pack page: the "What went out" section title gets a "by message" hint? No — the
card link is the entry point; don't add a second.

Route precedent to copy: `app/studio/launches/[event]/page.tsx` (slug param, back link, hero,
table). Precedents for the ↗ external link: `components/comms-calendar/NotDatedTray.tsx:201-205`
(`published link ↗`) and `components/mow/AssetsTable.tsx:112-127`.

## Files

New: `lib/mow/message-week.ts`,
`app/performance/week/message/[name]/page.tsx`, `components/mow/MessageWeek.tsx`.

Modified: `lib/media/vishen-videos.ts` (`deriveChannel`: lnkd.in, trim, source tier),
`lib/comms-calendar/data.airtable.ts` (channel via `deriveChannel`, `platforms` on VL),
`lib/comms-calendar/asset.ts`, `lib/comms-calendar/not-dated.ts`,
`components/mow/BrandCard.tsx`, `components/mow/PostGrid.tsx`,
`app/studio/comms-calendar/asset/[id]/page.tsx`, `tests/offline/verify-calendar.mts`
(+ a new `verify-message-week.mts` over `messageWeek` with the existing fixtures).

## Verification

- `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run verify` (new sections pass).
- Local dev-login Playwright pass (harness from the load-speed work): `/performance/week` →
  click the MV message → message page renders shell then body; `/studio/comms-calendar/asset/<id>`
  shows the button only when a URL exists. Local has no Airtable token, so bodies show the error
  box — structure only.
- Production after deploy: on `/performance/week?week=2026-09-07`, click *Expert to Authority*
  → days Mon–Sun with the 4 emails, the Pathway posts and the summit posts, results on the
  matched ones. Open a VL LinkedIn asset from the calendar → channel reads **LinkedIn**, "View
  live post ↗" opens `lnkd.in/…`. The 8 Sep podcast reads **YouTube** (URL wins, matching
  `/studio/media`). Post tiles show ↗ only where a URL exists (MV: ~3%, so mostly VL). The
  not-dated tray grouped by channel now has a LinkedIn group instead of "no channel".
