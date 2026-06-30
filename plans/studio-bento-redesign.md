# Studio page — Bento redesign (with engine funnel on top)

## Context

The Studio (Vishen founder) page is today a single long vertical stack
([app/studio/page.tsx](../app/studio/page.tsx)). We brainstormed layout directions in an
HTML mock (`context/mockups/studio-redesign.html`) and the user chose the **Bento**
direction **with the cockpit's engine/pipeline funnel added as the first section on top**.
This plan ports that mock into the real React app.

Chosen layout (desktop, CSS grid):
```
funnel  funnel  funnel      ← engine/pipeline hero, full width, on top
media   media   signoff     ← media→clips (large) + Awaiting sign-off (tall focal right column)
pulse   pulse   signoff
launches launches shipped
foot    foot    foot
```
The **pulse KPIs and funnel stages are clickable** → open the relevant ticket grid with the
matching filter applied ("the filters as we have across other pages").

## What exists / reuse (from exploration)

- [lib/studio/data.ts](../lib/studio/data.ts) `pulseCounts()` → `{ inFlight, inProduction, awaiting, shippedAll, asOf }`; `getVishenMedia()`, `getLaunches()`, `getReviewQueue()`, `getPendingShoots()`. The funnel's 4 counts derive from these + `clipsByMedia` (media→clips), `inProduction`, `awaiting`, `shippedAll`.
- Studio components to re-lay-out (unchanged internally): [Pulse](../components/studio/Pulse.tsx), [SignOffHero](../components/studio/SignOffHero.tsx), [ShootSignOff](../components/studio/ShootSignOff.tsx), [LaunchCard](../components/studio/LaunchCard.tsx)/[Meter](../components/studio/Meter.tsx), [ClipsList](../components/studio/ClipsList.tsx), [AddVishenMedia](../components/studio/AddVishenMedia.tsx), [ProposeFootnote](../components/studio/ProposeFootnote.tsx).
- [components/ui/Kpi.tsx](../components/ui/Kpi.tsx) already supports `tone="attention"` (gold) and the cards can be wrapped in `Link` (the `.st-kpilink` pattern Pulse already uses).
- Status constants in [lib/tickets/constants.ts](../lib/tickets/constants.ts) (`In Progress`, `Review`, `In Revision`, …).
- Existing target routes: `/studio/launches`, `/studio/sign-off`, `/studio/shipped` (all render `QueueTable` except sign-off which uses `ReviewQueueTable`).

## Build

1. **Grid + funnel CSS** in [app/globals.css](../app/globals.css) (studio `.st-*` section): add
   `.studio-bento` grid (the template above + responsive single-column ≤920px), and port the
   mock's pipeline funnel as `.st-funnel`/`.st-lane` (brand top-accent, big tabular counts,
   arrow connectors, gold accent on the awaiting lane, hover/clickable). Reuse existing
   `.kpi`/`.st-commit`/`.st-launch` etc.
2. **New [components/studio/PipelineFunnel.tsx](../components/studio/PipelineFunnel.tsx)** — props:
   the four `{ label, count, sub, href, gold? }` stages. Server component; renders `Link` lanes.
3. **Restructure [app/studio/page.tsx](../app/studio/page.tsx)** `StudioBody` into the
   `.studio-bento` grid with zone wrappers (`grid-area`): funnel / media / signoff / pulse /
   launches / shipped / foot. Same data calls; just re-placed. Compute funnel counts from
   existing data. Sign-off zone = SignOffHero + ShootSignOff stacked (the tall right column).
4. **Clickable pulse** — extend [Pulse.tsx](../components/studio/Pulse.tsx) so all four KPIs are
   links (In flight, Being made now, Awaiting sign-off, Shipped), each with the right href
   (+filter param per the decision below). Add the gold `attention` tone to "Awaiting".

## Click-through (the one scope decision — see question)

Mapping pulse/funnel → grid:
| Card | Destination |
|------|-------------|
| In flight | `/studio/launches` |
| Being made now | `/studio/launches?ticketStatus=In Progress` |
| Awaiting sign-off | `/studio/sign-off` |
| Shipped | `/studio/shipped` |
| Funnel: Media→clips | `/vishen` (clip board) |

To make `?ticketStatus=…` actually pre-filter, add an **additive** `initialFilters?: Partial<Record<Dim,string>>`
prop to [QueueTable.tsx](../components/tickets/QueueTable.tsx) (seed `sel` state; default `{}` = no behavior change),
and have `/studio/launches` read `searchParams` and pass it through. This is the only change to a shared component.

## Verification
- `npm run dev` → `/studio` in light + dark: funnel hero on top, media + tall sign-off column, pulse, launches+shipped, footnote; no horizontal scroll; responsive collapse ≤920px.
- Click each pulse card + funnel stage → lands on the correct (pre-filtered) grid.
- `npm run build` + `npm run lint` clean.

## Out of scope
- No new "card grid" ticket view — "grid view" = the existing `QueueTable` with filters.
- No data-model/Airtable changes; funnel counts derive from existing selectors.
