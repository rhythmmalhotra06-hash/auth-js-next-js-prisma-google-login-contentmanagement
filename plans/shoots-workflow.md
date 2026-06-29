# Shoots workflow — intake chooser, shoot form, and a filterable Shoots queue

## Context

The Creative Services team runs **two** intake paths, not one:

1. **Creative request** — an editing/design job for an existing asset (today's `/intake` form).
2. **Shoot & production request** — "I want to film something." This is a real Airtable form
   (base `Creative Services` `appFEFygXo2pRc8AR`, form **"New 🎬 Shoots"** → table **📺 Shoots**
   `tblcZ8OIxfgnlUowC`). Fields: Your Name (employee), product/event type, asset type, Authors
   involved, Format (Studio/VLOG/Broll/Testimonial/Livestream/Interview), Short Description,
   Notes/Brief, Production Support, Filming Location, Vishen's Approval (checkbox).

Right now the app only models the *creative* path. Shoots exist in the **data layer** (`Shoot` /
`ShootTicket` Prisma models, `schema.sql`, the `📺 Shoots` Airtable table, and the intake form already
loads shoots as a *reference picker* so a ticket can link to a shoot), but there is **no submission
form, no Shoots queue, and no entry point** for someone who wants to request a shoot.

This build adds the missing workflow on **both surfaces** (decided with the user):

- **Demo mockup** (`context/mockups/demo.html`) — the clickable Artifact; build here first to lock the design.
- **Live React app** (`app/`) — the real product, mirroring the mockup.

The desired flow:

```
New request  →  [ Creative request ]   [ Shoot request ]
                       │                       │
                  /intake form           Shoot & production form  →  📺 Shoots table
                                                                          │
Library & media ▸ Shoots  ──────────────────────────────────────────────┘
   filterable queue · default saved view = "To Film in Studio Time"
   (created after 31 May + Filming Date not empty) · plus "All shoots" + custom filters
```

## Recommended workflow (refinements on the user's outline)

- **New-request chooser:** a two-card splash at `#/intake` (`/intake`) — *Creative request* vs
  *Shoot request* — instead of dropping straight into the creative form. Each card routes onward.
  This is the "two options" the user asked for and keeps the mandated form order intact.
- **Shoots view = one filterable queue**, not several nav items. It mirrors the **Clip-engine inbox**
  pattern (banner + KPI cards + status list). A **saved-view bar** sits on top:
  - **"To Film in Studio Time"** (default) = `Created > 2026-05-31` AND `Filming Date` set.
  - **"All shoots"** = no filter (the user explicitly wants to see the entire list).
  - **Custom filters** (status, created-date, filming-date-present, format, author) that can be
    saved/edited into a view — reusing the configurable-table approach already planned in
    `plans/adapt-demo-artifact-surfaces.md` (localStorage-persisted view state, locked-first columns).
  - Group/sort by **status**: `Needs Vishen's Review → Approved by Vishen → To Film → Done · Filmed
    → Cancelled` (the live `Shoot.status` enum from `RECONCILIATION.md`).
- **Vishen's Approval gate:** the form's checkbox maps to status `Approved by Vishen` vs
  `Needs Vishen's Review`. The Shoots KPIs surface "awaiting Vishen" — ties into the existing
  approval/decision-lock concept.
- **Shoot → tickets link:** a shoot detail shows linked production tickets (`shoot_tickets` /
  Airtable "Post-Production Ticket"), closing the pre-prod → post-prod loop already in the schema.

---

## Part A — Demo mockup (`context/mockups/demo.html`)

Vanilla-JS hash-router SPA. Pattern: a `NAV` array (line ~621), a `route()` map (line ~1204), per-view
`v*()` render functions writing `#view.innerHTML`, a delegated `click` handler `switch(a)` (line ~1304),
and in-memory data arrays (`MEDIA` line ~583, `TICKETS` ~544, `EMP` ~512).

1. **Seed data — `const SHOOTS=[…]`** near `MEDIA` (~line 600). Each: `{id, title, requester(emp),
   status, format, filmDate, location, created, authors[], brief, vishenApproved, tickets[]}`.
   Include a spread across all five statuses, some with/without `filmDate`, some `created` before and
   after `2026-05-31`, so the default view filters meaningfully.

2. **Nav** — add under the `Library & media` group (after the Clip-engine item, line ~633):
   ```js
   {r:'#/shoots',n:'Shoots',ic:'video',pip:()=>SHOOTS.filter(s=>s.status==='Needs Vishen\'s Review').length}
   ```
   Add a `video`/`camera` glyph to the `svg()` icon map if absent (reuse `film` if simpler).

3. **`vShoots()`** — mirror `vMedia()` (lines 1071–1095): future/live banner, KPI cards
   (*Awaiting Vishen · To film · Filmed this month*), a **saved-view bar** (`.toolbar`) with view
   pills (`To Film in Studio Time` default, `All shoots`) + filter selects (status, format,
   "has filming date", created-after date), and a `.stack` of `.mrow` rows like the media inbox —
   each row: thumb, title, `requester · format · 📆 filmDate · location`, status `badge()`, and
   "feeds N tickets". Rows use `data-action="open-shoot" data-id`. Apply the active view's filter
   before rendering; persist the chosen view/filters in a `STATE.shootView` object (and optionally
   `localStorage`) so it survives nav.

4. **`vShootDetail(id)`** — mirror `vMediaDetail()`: header, the submitted brief/production-support,
   filming details, Vishen-approval state, and the linked production tickets list.

5. **New-request chooser** — convert `vIntake()` (line 998) into a router:
   - New `vNewRequest()` rendering two `.card` choices → `#/intake/creative` and `#/intake/shoot`.
   - Rename the current creative form body to `vIntakeCreative()`.
   - New `vIntakeShoot()` — the Shoot & production form: Your Name (employee select), Event type,
     Asset type, Authors, **Format** (segmented/radio: Studio/VLOG/Broll/Testimonial/Livestream/
     Interview), Short Description, Notes/Brief (textarea), Production Support, Filming Location,
     **Vishen's Approval** checkbox. Submit via a new `submitShoot()` that pushes to `SHOOTS` and
     shows the same success modal pattern as `submitIntake()` (line 1387), then routes to `#/shoots`.

6. **Routing & handlers:**
   - `route()` map (~1204): add `'#/intake':vNewRequest, '#/intake/creative':vIntakeCreative,
     '#/intake/shoot':vIntakeShoot, '#/shoots':vShoots`; add a `#/shoot/{id}` prefix branch like the
     existing `#/media/` one (line 1204) → `vShootDetail`.
   - Click `switch` (~1304): add `open-shoot`, `submit-shoot`, and a `shoot-view`/`shoot-filter` case
     (re-render `vShoots()` with the new view). Reuse the `intake-aud`-style segmented toggle for Format.
   - `change` handler (~1348): wire shoot form selects (event→asset filtering can reuse
     `renderAutofill`/`renderLockbox` if asset taxonomy applies, else plain selects).

Keep the demo's existing CSS classes (`.mrow`, `.kpis`, `.toolbar`, `.stack`, `.badge`, `.segmented`,
`.banner future`) — no new styling system.

---

## Part B — Live React app (`app/`)

Mirrors the mockup against the real Airtable `📺 Shoots` table. Server components + server actions,
following the **media** feature as the template.

1. **Field map** — extend `SHOOTS` in [lib/airtable/field-map.ts](../lib/airtable/field-map.ts) (line 62)
   beyond `title`: add field IDs for **Status, 📆 Filming Date, 📍 Filming Location, Format, Notes/Brief,
   Production Support, Requested by, Authors 🧠, Vishen's Approval, Created, Post-Production Ticket**.
   Resolve the exact field IDs from `Context/airtable-schema/creative_services.raw.json` (the raw schema
   lists all 36 fields) or via the Airtable MCP `get_table_schema` against `tblcZ8OIxfgnlUowC`.

2. **Repository** — new `lib/shoots/repository.ts` modeled on
   [lib/media/repository.ts](../lib/media/repository.ts):
   - `listShoots()` → `Result<ShootRow[]>` via `listRest(SHOOTS.baseId, SHOOTS.tableId, {fields})`,
     mapping records to a typed `ShootRow {id, title, status, filmDate, location, format, requester,
     authors, brief, vishenApproved, createdTime, ticketCount}`.
   - `getShoot(id)` for the detail page.
   - `createShoot(input)` → `createRecordsForTable` writing the form fields (used by the action).
   - A `TO_FILM_IN_STUDIO` predicate: `createdTime > '2026-05-31' && !!filmDate` — the default view.

3. **Routes** (mirror `app/media/*`):
   - `app/shoots/page.tsx` — server component: `listShoots()`, KPI grid (reuse `Kpi`/`KpiGrid`),
     status grouping, and a client **view/filter bar**. Default view = *To Film in Studio Time*;
     *All shoots* and custom filters reuse the `useTableView` hook from
     `plans/adapt-demo-artifact-surfaces.md` (§5) if that work has landed, else a local filter
     component with localStorage persistence. Rows use the existing `.mrow` styling like
     [app/media/page.tsx](../app/media/page.tsx) (line 57).
   - `app/shoots/[id]/page.tsx` — shoot detail + linked tickets.
   - `app/shoots/new/page.tsx` + `components/shoots/ShootForm.tsx` — the shoot submission form
     (client component mirroring [components/intake/IntakeForm.tsx](../components/intake/IntakeForm.tsx)),
     fed reference data (employees/event types/asset types/authors) from `getIntakeReferenceData()`.
   - `app/shoots/actions.ts` — `createShootAction` server action calling `repository.createShoot`,
     mirroring [app/media/actions.ts](../app/media/actions.ts) and [app/intake/actions.ts](../app/intake/actions.ts).

4. **New-request chooser** — make `/intake` a two-card chooser (Creative request → `/intake/creative`,
   Shoot request → `/shoots/new`). Move the current creative form to `app/intake/creative/page.tsx`
   (the body already exists in [app/intake/page.tsx](../app/intake/page.tsx); split it). Keep the
   AppShell title pattern.

5. **Navigation** — add **Shoots** under Library & media in the app nav. The flat navs live in
   [components/ui/Sidebar.tsx](../components/ui/Sidebar.tsx) (line 9) and
   [components/AppNav.tsx](../components/AppNav.tsx) (line 5) — add `{ href:'/shoots', label:'Shoots' }`
   (and the `📹` icon in Sidebar). If a categorized/grouped sidebar exists in `AppShell`, place it
   directly under the Clips/Media entry.

---

## Critical files

**Mockup:** [context/mockups/demo.html](../context/mockups/demo.html) — `NAV` (~621), `route()` (~1204),
`vMedia`/`vMediaDetail` (~1071) as the template, `vIntake`/`submitIntake` (~998/1387), click `switch` (~1304),
data arrays (~583).

**React — new:** `app/shoots/page.tsx`, `app/shoots/[id]/page.tsx`, `app/shoots/new/page.tsx`,
`app/shoots/actions.ts`, `components/shoots/ShootForm.tsx`, `lib/shoots/repository.ts`,
`app/intake/creative/page.tsx`.

**React — edit:** [lib/airtable/field-map.ts](../lib/airtable/field-map.ts) (expand `SHOOTS`),
[app/intake/page.tsx](../app/intake/page.tsx) (→ chooser), [components/ui/Sidebar.tsx](../components/ui/Sidebar.tsx)
+ [components/AppNav.tsx](../components/AppNav.tsx) (nav entry).

**Reuse:** `listRest`/`createRecordsForTable` (lib/airtable), `Kpi`/`KpiGrid`/`Badge`/`Icon`/`AppShell`
(components/ui), `getIntakeReferenceData` (lib/intake/data.ts — already returns `shoots`), the media
feature as the structural template, and `useTableView` from the configurable-tables plan.

**Verify field IDs against live Airtable** (`tblcZ8OIxfgnlUowC`) before wiring — do not trust inferred
names (CLAUDE.md §11).

## Verification

- **Mockup:** open `context/mockups/demo.html` → nav shows **Shoots** under Library & media;
  `#/intake` shows the two-card chooser; Shoot form submits and the new shoot appears in `#/shoots`;
  the default **To Film in Studio Time** view hides pre-31-May / no-filming-date shoots, **All shoots**
  shows everything, status grouping and filters work, a row opens the detail with linked tickets.
- **React:** `npm run dev` →
  - `/intake` → chooser; *Creative* → `/intake/creative` (unchanged form), *Shoot* → `/shoots/new`.
  - `/shoots/new` → submit a test shoot → confirm a record lands in the `📺 Shoots` Airtable table
    (check via Airtable MCP `list_records_for_table` on `tblcZ8OIxfgnlUowC`).
  - `/shoots` → KPIs + status groups render from live Airtable; default view filters correctly,
    "All shoots" and custom filters work, view choice persists across reload.
  - Nav shows Shoots; `/shoots/[id]` shows linked tickets.
  - `npm run lint` and `npm run build` clean.
- Use a throwaway test record for the live write; delete it after (Airtable MCP `delete_records_for_table`).
