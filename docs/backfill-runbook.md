# Runbook: one-time historical backfill (tickets + assets)

Brings the existing Airtable tickets and the main asset library into the app's
Postgres. **One-time**, but idempotent (upsert-on-`airtable_id`), so it's safe to
re-run. Airtable-only (no Jira). See [plans/full-historical-migration.md](../plans/full-historical-migration.md).

## Preconditions (all currently true)

- ✅ Migration `0004_asset_library_fields` applied to the managed DB
  (`assets.name`, `assets.source_table` exist).
- ✅ Reference data seeded in the managed DB (employees, asset_types, event_types,
  dimensions, official_calendar, authors) — the link targets the backfill needs.
- ⛔ A connection to the **managed** Postgres (see
  [platform-iap-request.md](./platform-iap-request.md) → "Second request").
  The local `.env` `DATABASE_URL` points at `localhost`, which is the wrong DB.
- `AIRTABLE_TOKEN` present in `.env` (already is).

## Steps

Run from the repo root. Pass the managed connection string inline so it overrides
the `localhost` value in `.env` (dotenv does not clobber an already-set env var).
If using the Cloud SQL Auth Proxy, point the URL at the proxy's local socket/port.

```bash
# 0. Dry run FIRST — fetch + map, zero writes. Confirm counts (~10.4k tickets).
DATABASE_URL='<managed-connection-string>' \
  npx tsx scripts/migrate-history.ts --dry-run

# 1. Real run — writes tickets + assets to the managed DB.
DATABASE_URL='<managed-connection-string>' \
  npx tsx scripts/migrate-history.ts

# 2. Idempotency check — run it again; counts must NOT increase.
DATABASE_URL='<managed-connection-string>' \
  npx tsx scripts/migrate-history.ts
```

## Verify (via kessel, no connection string needed)

```bash
kessel db query "SELECT count(*) FROM tickets;"          -- expect ~10,438
kessel db query "SELECT count(*) FROM assets;"           -- expect ~15,000
kessel db query "SELECT source, count(*) FROM tickets GROUP BY source;"  -- 'airtable'
kessel db query "SELECT kind, count(*) FROM assets GROUP BY kind;"       -- raw + final
-- FKs resolved (not all null):
kessel db query "SELECT count(*) FROM tickets WHERE asset_type_id IS NOT NULL;"
```

Then open the Manager queue / Editor views in the app — historical tickets should
appear under the 5-column header, with raw/final assets stacked under each ticket.

## Notes / known caveats (from the dry-run)

- `authors` link resolves to ~0: the Prio "Speakers/Authors" field is empty on
  legacy rows. Authors themselves are seeded (1,404); tickets just don't link them.
- `requester` resolves on ~311 tickets: "Requested By" is a newer Airtable field
  most legacy tickets predate. Expected.
- Performance metrics (ROAS/CTR/views) are present on the Airtable rows but are
  **not** imported (Stage 3 deferred) — a separate follow-on into the `performance` table.
- Do **not** schedule this to re-run automatically: it overwrites app-owned ticket
  state (status, queue order, assignee) on every run. One-time / on-demand only.
