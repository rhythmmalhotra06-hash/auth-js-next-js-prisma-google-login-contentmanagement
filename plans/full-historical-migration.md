# Full historical migration — old tickets + asset library

## Context

Today the app only syncs **reference data** (employees, asset types, event types,
dimensions, calendars, authors) one-way from Airtable — that worker is built and
working ([lib/airtable/sync.ts](../lib/airtable/sync.ts)). But **no historical
transactional data exists yet**: when someone opens the tool, the queue is empty
and the asset library is empty. The existing tickets live in Airtable's
**🎯 Prio: Creatives Requests** table, and the team's existing creatives live in
the **Ads Creative Library** base. Until those are imported, the tool can't answer
Vision's core question ("what's been produced and how did it perform").

This plan adds a **one-time backfill** (re-runnable, idempotent) that imports:
1. Historical **tickets** from the live Prio/Requests table.
2. **Assets** — both the raw/final files attached to those tickets, and the main
   standalone creative library tables (Ad Creatives, Final Ad Asset, Best Videos).

Scope decisions (confirmed): **Airtable only** (no Jira CSV yet — leave a hook);
asset scope = **tickets + main creative tables** (not all ~44 legacy tables).

The Prisma `Ticket` model already anticipates this — it has a `source` field
(`"app" | "jira_migration" | "airtable"`) and an `airtableId` unique key
([prisma/schema.prisma:205,233](../prisma/schema.prisma)). The `Asset` model already
models raw/final stacking via `kind` + `airtableId`
([prisma/schema.prisma:312-326](../prisma/schema.prisma)). **No schema migration is
required** for tickets; one small additive migration may be needed for assets (see
below). We mirror the proven reference-sync pattern exactly.

---

## Approach

A new module `lib/airtable/migrate.ts` plus a CLI runner `scripts/migrate-history.ts`
and an admin route `app/api/sync/history/route.ts` — structurally identical to the
existing `sync-reference` trio, reusing `listRecords()`
([lib/airtable/client.ts:28](../lib/airtable/client.ts)), the `str/linkIds/dateVal`
helpers, and upsert-on-`airtableId` for idempotency. Supports `--dry-run`.

**Idempotent & re-runnable:** every imported row carries its Airtable `recId` in
`airtable_id`; re-running upserts instead of duplicating. Safe to run repeatedly as
the team keeps working in Airtable, until two-way sync replaces it.

### Stage 1 — Tickets (Prio/Requests `tblhrRl8GzsDMv0DD`)

Field mapping is already resolved in
[context/airtable-schema/RECONCILIATION.md](../context/airtable-schema/RECONCILIATION.md)
(lines 67-90). Add a `TICKETS` block to [lib/airtable/field-map.ts](../lib/airtable/field-map.ts)
with the stable field IDs, then map each record:

| Our column | Airtable field |
|---|---|
| `creativeBrief` | "Creative Brief" |
| `cta` | "Call to action" |
| `dueDate` | "Due date" |
| `prioStatus` | "Prio. Status" (store raw value) |
| `ticketStatus` | "Ticket Status" (store raw value) |
| `queueRank` | "Priority ranking (Manual)" |
| `publishedAt` | "📅 Published Date" |
| `sourceLinks` | "Raw File/Source URL/Stage Talk Links" |
| `notes` | "V's Notes" |
| `source` | constant `"airtable"` |
| `title` | derive from primary field (no live "Title" — `positioning`/`audience` stay null; they're E3 app-native) |

**Two-pass link resolution** (same as reference sync): pass 1 upserts ticket
scalars; pass 2 resolves linked-record arrays to our UUIDs using `airtable_id` →
`id` maps for: `event_type_id` ("🧩 Event Type"), `asset_type_id` ("🛎️ Asset Type"),
`assignee_id` ("Assigned Creative" → Employees), `requester_id` ("Requested By"),
`officialCalendarId`, and `ticket_authors`. Skip links that don't resolve (log a
count) rather than failing the row. **Reference sync must run first** so those
target rows exist.

- **Status mapping:** store the raw Airtable values verbatim into `prioStatus`/
  `ticketStatus` (the live values, per RECONCILIATION lines 15-24) — do not
  force-map onto the PRD lifecycle. UI already reads these.
- **Seed one `ticket_events` row** per imported ticket (`toState` = current
  ticketStatus, `note` = "imported from Airtable") so the audit trail isn't empty.
- **Contractor assignee:** "Assigned Creative" links Employees; a separate
  "Assigned Contractor/Freelancer" link exists. Resolve Creative first, fall back
  to contractor (open item in RECONCILIATION line 115) — log unresolved.

### Stage 2 — Assets

**2a. Ticket-attached raw/final.** For each migrated ticket, derive Asset rows
from its file fields: a `kind="raw"` row from "Raw File/Source URL/Stage Talk
Links" and a `kind="final"`/distribution row from the published/distribution URL.
Each linked to the ticket via `ticketId`. This is the clean, guaranteed-linked set.

**2b. Standalone creative tables** (the "library"): import as Assets from
- `Ad Creatives` (`tbl1AcKpMQvnF05YJ`, 31 fields)
- `(VSL) Final Ad Asset` (`tblgiW8VvCt2J68FD`, 63 fields)
- `🎉 Best Videos` (`tbl1oTzzum1OX2VKz`, 13 fields)

These need a **field-discovery step first** (run `get_table_schema` / sample
records) to identify each table's file-URL, name, published-date, and any
ticket/program link — the field names aren't yet mapped. Map the file URL →
`fileUrl`, mark `kind="final"`, set `ticketId` only where a link resolves
(otherwise leave null — `Asset.ticketId` is already nullable). Record the source
table in `airtable_id` provenance.

**Possible additive schema migration:** these standalone assets benefit from a
`name`/`title` and a `source_table` column on `Asset` (currently assets are
ticket-derived and have neither). Recommend a small migration
`0004_asset_library_fields` adding `name String?` and `sourceTable String?` to
`Asset`. Tickets need no schema change.

### Stage 3 — Performance (optional, deferred within this job)

`Best Videos` / `Ad Creatives` carry metric columns (views, spend, etc.). Wiring
those into the `performance` table is a natural follow-on but **not required** for
"old tickets + library show up." Leave a clearly-marked stub; do not block Stage 1-2.

---

## Files to create / modify

- **Create** `lib/airtable/migrate.ts` — the import logic (mirrors `sync.ts`
  structure: fetch → map → two-pass upsert → `MigrateReport`).
- **Modify** [lib/airtable/field-map.ts](../lib/airtable/field-map.ts) — add `TICKETS`,
  `AD_CREATIVES`, `FINAL_AD_ASSET`, `BEST_VIDEOS` blocks (stable `fld…` IDs,
  resolved via `get_table_schema` during build).
- **Create** `scripts/migrate-history.ts` — CLI runner with `--dry-run`
  (clone of [scripts/sync-reference.ts](../scripts/sync-reference.ts)).
- **Create** `app/api/sync/history/route.ts` — bearer-auth POST trigger
  (clone of [app/api/sync/reference/route.ts](../app/api/sync/reference/route.ts)).
- **Maybe** `prisma/migrations/0004_asset_library_fields` — add `Asset.name`,
  `Asset.sourceTable` (only for Stage 2b).
- **Reuse as-is:** [lib/airtable/client.ts](../lib/airtable/client.ts) (rate limit +
  pagination + 429 backoff), the `str/linkIds/dateVal` helpers (extract to a shared
  spot or duplicate), and the existing reference sync (run before this).

---

## Verification (end-to-end)

1. **Schema discovery:** use Airtable MCP `get_table_schema` on `tblhrRl8GzsDMv0DD`
   + the three creative tables; confirm `fld…` IDs before writing the field map.
2. **Dry run first:** `npx tsx scripts/migrate-history.ts --dry-run` → prints
   counts (tickets, link edges resolved/unresolved, assets) with **zero DB writes**.
   Confirm counts roughly match Airtable record totals.
3. **Real run against a branch DB / Kessel preview**, then spot-check:
   - `npx prisma studio` → `tickets` populated, `source = "airtable"`, statuses
     present, `event_type`/`asset_type`/`assignee` FKs resolved (not all null).
   - `assets` populated, raw+final rows stack under the same ticket.
   - Each ticket has ≥1 `ticket_events` row.
4. **In the app:** open the Manager queue and Editor views — historical tickets
   appear under the mandated 5-column header; open a ticket → its raw/final assets
   show in the library panel.
5. **Idempotency check:** run the migration twice — record counts must not change
   on the second run (upsert-on-`airtable_id` working).
6. Log and surface any unresolved links / skipped rows so nothing fails silently.

## Out of scope (explicit)

- Jira CSV import (Airtable-only for now; leave a `source="jira_migration"` hook).
- The remaining ~40 legacy library tables beyond the three named.
- Two-way push (PG → Airtable) and webhooks — separate later work.
- Full performance-metric wiring (Stage 3 stub only).
