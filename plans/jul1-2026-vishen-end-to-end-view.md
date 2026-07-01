# Vishen's End-to-End View — clickable mock first, then production

## Context

From the **Jul 1 2026 Glen ↔ Rhythm** call (prep for Glen's Friday call with Marisha):
Glen relayed what **Vishen** and the team need — one view where:

- the **team** sees when a Vishen-originated asset is *ready and needs publishing*, and adds the live link on release, and
- **Vishen** sees, for every request he made: **where it got posted → the live link → how it performed** (impressions + engagement rate — *not* views).

Today this is fragmented: Creative Services (production), Content & Comms (posting), and Vishen's own base don't share a "this is Vishen's request → here's where it's live → here's its performance" thread. The existing **Studio · Vishen** founder view (`lib/studio/data.ts` → `/studio`, redesign target `context/mockups/studio-redesign.html`) has sign-off / pulse / launches / recently-shipped, but **no published→performance zone**. That zone is the gap.

**Decisions locked with the user:**
1. **Deliverable now = a detailed clickable mock** using what we have, but genuinely delivering Marisha's ask.
2. Identify Vishen's work via a **new "Request from Vishen" flag** (accepted; this is the Marisha/Gareth alignment Glen flagged — overrides the no-new-field preference).
3. **Wire a real performance source** — now unblocked: **Hootsuite Perch MCP** (see below).

**Performance source is now unblocked (Hootsuite doc, Jul 1):** Hootsuite ships MCP servers connectable as custom connectors via OAuth/DCR. **Perch** (`https://mcp.hootsuite.com/perch`) covers *social publishing and analytics* — the impressions + engagement feed we need. (Nest = inbox, Lumen/Talkwalker = social listening — not needed.) This supersedes the earlier Apify fallback and the "blocked on Glenn" status.

Good news for reuse: most link fields **already exist** on the ticket (`TICKETS.fields` in [lib/airtable/field-map.ts](lib/airtable/field-map.ts#L22)): `publishedAt` ("📅 Published Date"), `outputLink`, `final16x9/9x16/4x5`, `assetFolderLink`, `downloadLink`. So "where it's live / final link" needs **no new field** — only the Vishen flag and the metrics source are genuinely new.

---

## Phase 1 — the clickable mock (the deliverable now)

**New file: `context/mockups/vishen-tracker.html`** — self-contained, same pattern as [studio-redesign.html](context/mockups/studio-redesign.html): copy its brand-token `:root` block (purple `#572280`, gold accent, Bricolage/Inter, 8/12/16 radii, `[data-theme="dark"]`), reuse its topbar/zone/card/kpi/btn CSS. No external assets — shareable as an Artifact for Marisha/the team.

**Topbar/head:** "Content Portal · For Vishen" + subtitle "Your requests, end to end — posted, live, and how they performed."

**Interactive controls (make it genuinely clickable):**
- **Channel filter** chips: `All · Vishen Lakhiani IG · Mindvalley IG · YouTube · LinkedIn` — filters the table.
- **Time filter**: `Last 30 days · This year · All time` (covers Vishen's recurring "what was published last year?").
- **Asset-type** group toggle: podcast clips · stage-talk clips · long-form/full podcast · Vishen-shot clips · campaign invite/content.
- **Dark-mode** toggle (reuse `toggleTheme`).

**Zones:**
1. **Pulse (Vishen-tuned KPIs):** Requested by you · In production · Published this month · Impressions (30d) · Avg engagement rate. Clicking a KPI filters the table below.
2. **The tracker table (core).** One row per Vishen request. Columns lead with the **mandated 5** (Title, Priority, Assigned, Ticket Status, Priority Status per `DESIGN_SYSTEM.md`) then **Channel · Published link · Published date · Impressions · Engagement**. Rows clickable → drawer.
3. **Awaiting publish (team-facing).** Items at "Ready to release" that need a live link — each row has an **"Add live link → mark published"** action (simulated: paste URL, row flips to Published, appears in perf). This delivers the *team* half of Marisha's ask.
4. **Detail drawer** (on row click): lifecycle timeline (Requested → Prioritized → In production → In review → **Published**), channel, live link, and a **performance card** (impressions + engagement + a small sparkline, 24h vs 7d, labelled "via Hootsuite").
5. **Top performers** strip — best published clips by impressions (Vishen-facing payoff).
6. **Trust footnote** — reuse studio-redesign's "nothing changes without you" line.

**Sample data:** hard-coded rows reflecting real content types from the transcript — Vishen podcast clips (Tim Gray, Eve × Vishen), stage-talk snippets, an invite video, a campaign clip — split across Vishen Lakhiani IG and Mindvalley IG, with plausible impressions (e.g. 75k) + engagement %.

---

## Productionize (build now)

> **Performance is no longer deferred.** Because the source is open-source (Postiz), the full
> performance loop is folded into this build — see `plans/jul1-2026-postiz-performance.md`.
> Item 3 below is now built alongside 1/2/4, running on manual entry until Postiz+Meta connects.

1. **"Request from Vishen" flag.** Add the field in Airtable (🎯 Prio Requests + the intake form + 📣 Social), register it in `TICKETS.fields` / `SOCIAL.fields` in [lib/airtable/field-map.ts](lib/airtable/field-map.ts). Auto-set it for the Vishen-origin chain (`getVishenMedia` → linked tickets, [lib/studio/data.ts:246](lib/studio/data.ts#L246)); allow manual set at intake. Add a `getVishenRequests()` selector alongside `getReviewQueue`.
2. **Published link + status sync (no new link field).** Reuse `outputLink`/`final*`/`publishedAt`. Add a server action for the team's "add live link → mark published" (sets `publishedAt` + flips `ticketStatus` to Done/Shipping). Cross-system: when a Content & Comms Social item is released, flip its linked Creative ticket (extend the `raiseSocialRequestAction` / `getSocialTicketStates` path in [lib/social/repository.ts](lib/social/repository.ts)) — see [[content-comms-prio-is-synced]].
3. **Performance source — Hootsuite Perch MCP (unblocked).** Connect Perch (`https://mcp.hootsuite.com/perch`) as a custom connector (Settings → Connectors → Add Custom Connector → paste URL → OAuth/DCR). Pull **impressions + engagement rate** keyed to each published link; persist to the `performance` table (`schema.sql`) via a scheduled job (mind IAP — [[metrics-snapshot-iap-cron]]) and surface through the Studio data path. Updates [[performance-loop-data-source]] (Hootsuite is now the chosen, unblocked source).
4. **React port.** Build `/studio/delivered` (or a zone on the Studio landing) reusing `SocialBoard`-style table + `DetailDrawer` + `Kpi`/`Badge` primitives, honoring the 5-column header. Load via the existing `loadStudio()` fetch — see [[vishen-media-clip-pipeline]].

---

## Verification

- **Mock:** open `context/mockups/vishen-tracker.html` in a browser — confirm channel/time/asset filters and KPI clicks filter the table, a row opens the lifecycle+performance drawer, the "add live link → mark published" flow moves an item into Published, and dark mode works. Then publish it as an Artifact and share the link with Marisha/team for Friday.
- **Phase 2 (later):** verify the flag round-trips via the Airtable MCP; connect Hootsuite Perch and confirm one real published item pulls impressions/engagement; click through `/studio/delivered` end-to-end (`npm run dev`).

---

## Notes / open alignment (Glen → Marisha, Friday)

- The **"Request from Vishen" tagging rule** still needs Gareth/Marisha agreement on *who sets it and when* (auto on Vishen-origin vs. manual). The mock assumes auto-tag + manual override.
- Impressions vs views: report **impressions + engagement rate** only (Glen was firm).
- Performance now flows from **Hootsuite Perch MCP** — no longer waiting on a source decision.
