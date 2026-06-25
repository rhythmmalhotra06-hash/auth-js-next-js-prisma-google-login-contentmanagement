# Schema reconciliation — [VERIFY] → live Airtable ground truth

Generated from `context/airtable-schema/*.summary.json` (live pull 2026-06-25).
Bases: creative_services `appFEFygXo2pRc8AR`, titus_video `appDZnMnJGehbSOo5`,
ads_creative_lib `appWYOr2p4RKHf2LR`.

Resolves the `[VERIFY]` markers in `schema.sql` / `prisma/schema.prisma`.

---

## Status enums (the two axes) — RESOLVED

Both axes are real fields on **🎯 Prio: Creatives Requests (New)** (`tblhrRl8GzsDMv0DD`):

**`ticket_status`** ← field **"Ticket Status"** (singleSelect):
`Backlog · To Do · In Progress · Review · In Revision · Approved · Done · Won't Do · Shipping · Request on Hold`

**`prio_status`** ← field **"Prio. Status"** (singleSelect):
`New Request · To be reviewed by Vishen · In Queue · Pending Information/Brief Not Clear · Rejected - No need to work · Assigned`

> ⚠️ The `v_editor_queue` filter `ticket_status NOT IN ('Done','Published')` is WRONG.
> There is no "Published" status. Correct exclusion set: `Done`, `Won't Do`, `Shipping`.
> The PRD lifecycle states (Requested→…→Published) are our *model*; the live
> editor axis uses these values. Map our lifecycle onto them, or store the raw value.

**`shoots.status`** ← **📺 Shoots** (`tblcZ8OIxfgnlUowC`) "Status" (singleSelect):
`New Requests - Approved by Vishen · New Requests - Needs Vishen's Review · To Film · Done - Filmed · Cancelled`

---

## Employees (`tbllP5vRon54L7Ccf`, "👬 Employees") — RESOLVED w/ field renames

| Our column | Real Airtable field | Values |
|---|---|---|
| `team` | **"Creative Team (Editors)"** (singleSelect) | Content Production Video · Marketing Video · Organic Social Video · Design |
| `division` | **"MV Entity"** (singleSelect) | MV Labs (Malaysia) · Remote · MV Inc (USA) · MV OU (Estonia) · MV UK · MV ME (UAE) |
| `active` | **"Active Status"** | Active · Not Active |
| `employment_type` | **"Employment Status"** | Full-Time · Full-Time EOR · Part-Time · Part-Time EOR · Contractor · Advisor · Service Provider · Intern · Owner (Shareholder) · Other · Terminated · … |

> There is also a separate **👷🏼 Contractor/Freelancers** table (`tblRhzXG5vea37rYr`, 4 fields).
> The decision-log says contractors fold into Employees via employment flag — but a
> separate table exists. Confirm which is canonical before sync.

---

## Asset Type (`tblLbcgob2Bxevugy`, "🛎️ Creative Asset Type") — RESOLVED + discrepancies

| Our column | Real field | Notes |
|---|---|---|
| `name` | "Asset type" (singleLineText) + "Asset Type (Full title)" | per-record text, not enum |
| `category` (digital\|print) | **"Type of Asset"** (singleSelect) {Print, Digital} | ✓ matches decision |
| `active` | **"Status"** {Active, Inactive} | ✓ |
| `event_type_id` | **"Event Type"** `multipleRecordLinks` | ⚠️ **MULTI**-link, not single |
| `team_lead_id` | **"Team Lead"** `multipleRecordLinks` → Employees | ⚠️ **MULTI**-link |
| `preferred_editor_id` | **"Preferred Editors"** `multipleRecordLinks` → Employees | ⚠️ **MULTI**-link (plural) |
| `dna_id` | **"DNA"** (text) + **"DNA link"** (url) | DNA records live in another base (below) |
| (new) | "Importance" (rating), "Complexity" (rating), "Hours" (number) | feed the prioritization score |
| (new) | "Team" {Content, Social Media, Ad Creatives} | the owning team |

> **Discrepancy RESOLVED (migration `0002_reconcile_multilinks`, applied 2026-06-25):**
> all three modeled as many-to-many join tables — `asset_type_event_types`,
> `asset_type_team_leads`, `asset_type_preferred_editors`. The single FK columns
> were dropped from `asset_types`. Sync now preserves multi-value links.

---

## Tickets ← Prio/Requests (`tblhrRl8GzsDMv0DD`) — field mapping

| Our column | Real field |
|---|---|
| `creative_brief` | "Creative Brief" (richText) ✓ |
| `due_date` | "Due date" (date) ✓ |
| `event_type_id` | "🧩 Event Type" (link) ✓ |
| `asset_type_id` | "🛎️ Asset Type" (link) ✓ |
| `priority_score` | "SCORE" (formula) |
| `queue_rank` | **"Priority ranking (Manual)"** (rating) — the manual override ✓ |
| `published_at` | "📅 Published Date" (date) |
| requester | "Requested By" (link → Employees) — REQUESTER, not assignee |
| `assignee_id` | **"Assigned Creative"** (link → Employees) ✓ + separate "Assigned Contractor/Freelancer" (link → Contractor/Freelancers) |
| `cta` | **"Call to action"** (singleLineText) ✓ |
| brain program | "Quest Program" (link → 📚 Programs) |
| `complexity` | rolled up from Asset Type ("Complexity_Asset Type_Lookup") — confirms algo |

> **`title`, `positioning`, `audience` (cold/warm) do NOT exist in the live Prio table.**
> These are NEW fields the redesigned intake form (E3) introduces — app-owned, not
> synced from Airtable. Consistent with the decisions (Summary→Title rename, new
> positioning/audience fields). Keep them in our schema as app-native.
> **`assignee`** has two link fields: "Assigned Creative" (employee) and "Assigned
> Contractor/Freelancer" (separate table) — both resolve to a person.

---

## Event Type (`tblzTFTZ2ttEvi2j1`) — RESOLVED

- Primary **"Event Type"** (singleLineText) — values are per-record (Masterclass, Mastery, States, MBU, Social Media Promotion, Pathway are *records*, not an enum).
- **"Production Type"** (singleLineText) is a separate field — ✓ confirms it's a sub-attribute of Event Type, not a primary axis.
- "Status" {Active, Not Active, To Review} → `active`.
- `brain_program_id` → links via the **📚 Programs** (`tblnwdwiy3HCu26hU`) and **🪜 Pathways** (`tblypdVsDH3ODLxrW`) tables in this base (also referenced by Prio "Quest Program").

## Dimensions (`tblHSG0MpdvUI9Z4X`) — RESOLVED
- Primary field is **"Name"** (not "label" as modeled) — rename `label` ← "Name".

## DNA — RESOLVED (lives in ads_creative_lib, not creative_services)
- **DNAs** (`tbl0fsHkGxD6HZz6k`), **🧬 Video DNA** (`tbl372UOX7zYnu2Gx`), **📣 Virality DNA** (`tblcCwTyeOMq09YoH`) — all in `appWYOr2p4RKHf2LR`. The sync source for `dna` is the Ads Creative Library base.

---

## Form variants (titus_video `appDZnMnJGehbSOo5`) — RESOLVED
Both confirmed as live tables:
- **"VIDEOS - Ads Creatives [Active]"** (`tblfijc416d0HZCfg`, 27f)
- **"VIDEOS - Pathway Organic [Active - July 2026 posts onwards]"** (`tbl75tcwlzWa6pu1B`, 34f)
- plus merged **"Ads Creatives & Pathway Organic [Jun 24 2026]"** (`tblJDelzKgtZxkfea`, 34f)

## Open items still to verify
- Canonical contractor location (Employees employment-flag vs the separate Contractor/Freelancers table — both exist and both are linked as assignees).
- Dimension / Event-Type record *values* (need record data via list-records, not just schema).
- Brain: whether 📚 Programs / 🪜 Pathways here are synced from a separate Brain base or are themselves the source.
