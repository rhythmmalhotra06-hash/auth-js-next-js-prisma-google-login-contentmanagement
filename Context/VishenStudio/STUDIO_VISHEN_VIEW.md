# Build brief — Vishen's Studio view (founder landing)

**For:** Claude Code, updating the live Content Portal.
**Goal:** Replace the current founder landing (`/studio`) with a founder-first
layout reordered around sign-off, not production monitoring.

This document is the source of truth. `vishen-studio.html` (included) is a
**visual design reference only** — match its spacing, palette, type, and section
order, but reimplement in the portal's real stack and component patterns. Do not
copy its seed data or its single-file structure.

---

## 0. CONFIRM before building

These aren't in this brief because they live in your repo. Read the codebase and
confirm, or ask the user:

- **CONFIRM stack.** The deployed portal appears to be Next.js + Prisma +
  Google auth on Cloud Run. Confirm: App Router or Pages? Server Components?
  What component lib / styling (Tailwind? CSS modules?). Match it exactly.
- **CONFIRM routing.** Where does the founder view render today and how is the
  Vishen role gated? Build the new view at the same route, behind the same auth.
- **CONFIRM data path.** Does the portal read Airtable directly (REST/SDK) at
  request time, or sync into Postgres via Prisma? The field map below is the
  Airtable source; if there's a Prisma layer, map these fields to your models.
- **CONFIRM the two missing fields** (see §4). The at-risk and sign-off sections
  cannot run on live data until these exist. If they don't, build the sections
  against an empty/stub query and flag it — do not fake data in production.

---

## 1. Why this reorder (don't skip — it drives every layout call)

The current `/studio` treats Vishen like an ops manager: editor-capacity bars,
an 8-row "recently shipped" table as the centerpiece. He is not triaging the
queue. He is the **prioritization sign-off authority** and the **content source**.

Two documented fears govern the design:
1. He opens the system, sees work with no priority / no owner / no due date, and
   loses confidence in the whole process.
2. "Where is the ticket, who is editing it, what is happening here."

So the emotional job of this page is **trust and control**, not throughput. Every
section below earns its place against that. The editor-capacity leaderboard is
**removed** from his view (move behind a manager/admin toggle if needed).

---

## 2. Section order (top to bottom)

1. **Sign-off ("waiting on you")** — the hero. Two states:
   - **Zero pending:** calm green "Nothing is waiting on you" bar.
   - **Pending:** fully-saturated purple block at the very top, one-tap Approve
     per row, "Review all" → expanded queue. This is the ONE saturated element on
     the page (mirrors the pitch-deck "You commit" handoff card).
2. **The pulse** — 4 glance-only stat cards: In flight / Being made now /
   Awaiting sign-off / Shipped all-time. Reassurance, not a dashboard. Cards that
   drill (awaiting → sign-off queue, shipped → shipped list) are clickable.
3. **Flowing to your launches** — work grouped by EVENT, not asset type. This is
   the centerpiece that replaces the editor leaderboard. Each launch shows a
   status meter (shipped/review/production/todo) and links to a drill-down.
4. **At risk** — founder-decision items only: shoot with no post-prod ticket,
   untagged item the score can't read, work aged past its event. NOT every
   stalled ticket — the team clears those first.
5. **Your content → clip ideas** — Vishen's talks/podcasts → suggested clips.
   Keep as-is conceptually; it's the one section already right.
6. **Recently shipped** — demoted to a thin one-line proof strip, expandable.

Plus a persistent **propose-only footnote**: "Nothing here changes without you."

---

## 3. Expanded states to build (in-app navigation, same shell)

- **Sign-off queue** — full list, filter chips (all / tied to event / high score /
  shoots), per-row stars + Approve. Approve = the propose-only commit (see §5).
- **Launches (all)** — every active launch as a card.
- **Launch drill-down** — hero with the event's status breakdown + meter, filter
  chips (all / in progress / in review / shipped), asset-by-asset rows with
  Vishen's priority stars and live status dots. This is the literal answer to
  "where is the ticket, who is editing it."
- **At risk (full)** — all founder-decision items.
- **Recently shipped (full)** — status=Done, newest first.

---

## 4. Live Airtable field map (VERIFIED 29 Jun 2026)

Base: `appFEFygXo2pRc8AR` (Creative Services)
Main request table: `tblhrRl8GzsDMv0DD` (~10,428 records)
Asset Library (lineage/dimensions): `tblE92TpRabUS9gZL`

| Purpose | Field ID | Type / notes |
|---|---|---|
| Title | `fld59SWr1qd1XPuR0` | formula: `name \| service line \| year` |
| Status | `fldanOtkhcohQbnK1` | singleSelect: Backlog, To Do, In Progress, Review, In Revision, Approved, Done, Won't Do, Shipping, Request on Hold |
| Priority (1–5) | `fldg0R2kFydJ707ww` | formula → drives the stars |
| Score | `fldjY4VfI44oGmtuS` | formula: avg(urgency, complexity, strategic-value) |
| Event link | `fldKGGZMuyqnF7gP8` | → `tblzTFTZ2ttEvi2j1` (e.g. "Masterclass Funnel") — group launches on this |
| Production type | `fldHGT2p5SObJEzPh` | singleSelect: Content / Ad Creatives / Social Media / Event Design / Brand Design / Pathway Organic |
| Due date | `fldMbzZSolbVNAhGX` | date |
| Requested at | `flde8MIcH6FH9sU0T` | datetime |
| Program / Talent | `fldqR9AByOXqnp5WV` | → Brain table `tblnwdwiy3HCu26hU` |

**Pulse counts** = status rollups over the main table:
- In flight = not in {Done, Won't Do, Shipping}
- Being made now = In Progress
- Awaiting sign-off = Review + In Revision
- Shipped all-time = Done

**Launches** = group by `fldKGGZMuyqnF7gP8`, roll up status per group.
Records with NO event link must surface in At Risk (untagged), not silently vanish.

### Two fields that DON'T exist yet — needed for §2.1 and §2.4

The sign-off queue and at-risk logic can't run on live data until these are added:

1. **Priority Status** (manager-owned singleSelect, distinct from ticket Status):
   e.g. `New Request / In Queue / Vishen to Review / Assigned / On Hold`.
   This is the field Vishen approves. Editors manage ticket Status; managers manage
   Priority Status. The sign-off queue = records where Priority Status = "Vishen to Review".
2. **Shoot → post-production link** so "shoot with no editing ticket" is detectable
   automatically. Until it exists, that at-risk row can't be computed.

**CONFIRM with user** whether to create these (Airtable MCP can) before wiring.

---

## 5. Propose-only — non-negotiable architecture

AI/team suggestions land in STAGING fields. Human commits to the LIVE field.
Downstream automation reads ONLY live fields.

In this view: **Approve** writes to the live Priority Status field only.
```
// optimistic UI on tap, then:
update_records_for_table(BASE, 'tblhrRl8GzsDMv0DD',
  [{ id, fields: { <priorityStatusFieldId>: 'Assigned' } }])
```
Never write a staged/AI value to a live field without an explicit Approve tap.
The Approve button IS the commit boundary.

---

## 6. Design contract (match the reference exactly)

- White base `#FBFAF8` / surfaces `#FFFFFF`.
- Windsor purple `#572280` + Electric Violet `#7C3AED` as TEXT ACCENTS and the
  single saturated focal element (the sign-off block) ONLY. No black/gold.
- Display face Fraunces, body Inter (or the portal's existing pairing — match it).
- Status colors: green=shipped/done, violet=review, amber=in production,
  blue=to-do, red=at-risk.
- Brand link every Program/Event/Talent reference to Brain — never hardcode.
- Quality floor: responsive to mobile, visible keyboard focus, reduced-motion.

---

## 7. Definition of done

- [ ] Renders at the live `/studio` route, behind existing Vishen auth.
- [ ] All 6 landing sections + 5 expanded states, matching the reference layout.
- [ ] Pulse + launches + shipped read LIVE from the field map above.
- [ ] Sign-off + at-risk read live once the two new fields exist (else stubbed + flagged).
- [ ] Approve does a real propose-only write to the live Priority Status field.
- [ ] Zero hardcoded taxonomy — Programs/Events/Talent resolve via Brain links.
- [ ] No editor-capacity leaderboard on the founder view.
