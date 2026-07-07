# Two-way sync — RETIRED (replaced by Airtable native two-way sync)

> **These automations are retired.** As of 2026-07 the Vishen ⇆ Creative Services mirror runs on
> **Airtable's native two-way sync** between Vishen's content base (`appvBtCYdaSrD1y11`: **Major
> Videos**, **🎞️ Clips**) and the Creative Services **"(Sync)"** mirror tables
> (`appFEFygXo2pRc8AR`: **Major Videos (Sync)** `tblV6nCO0Y0VigADH`, **Clips (Sync)**
> `tblRXoSfDBFnpYk7G`). The five "Run a script" automations that used to do this by hand have been
> removed from the repo (recoverable in git history). See
> [`plans/clips-…-newell.md`](../../plans/) for the current design.

## ⚠️ Action required in Airtable

The five live automations must be **turned off** in Airtable, or they will double-write / loop
against native sync and the new approval-time push. Disable these (names from the retired setup):

| # | Base | Trigger table | What it did |
|---|------|---------------|-------------|
| 1 | Vishen | Major Videos | MV → 📺 Media Sources (create + update) |
| 2 | Vishen | Clips | Clips → 🎬 Clip Suggestions |
| 3 | Creative Services | 📺 Media Sources | Media Sources → MV (update-only) |
| 4 | Creative Services | 🎬 Clip Suggestions | Clip Suggestions → Clips |
| 5 | Creative Services | scheduled hourly | `reconcile-deletes` — Vishen delete → archive/dismiss mirror |

## How sync works now

- **Vishen ⇄ "(Sync)" mirror tables:** Airtable native two-way sync (no scripts).
- **Portal → Vishen (app code):** AI clip/media suggestions are pushed into Vishen's Major Videos +
  Clips **only on approval** (`convertClipsToTickets` → `mirrorClipsToVishenBase` / `createMajorVideo`
  in `app/media/actions.ts`), tagged **AI Suggested**. Pending suggestions stay in the portal's own
  📺 Media Sources / 🎬 Clip Suggestions tables and never reach Vishen's base.
- **Env:** this outbound push is gated by **`VISHEN_SYNC_ENABLED`**, which must be **`true`** (or
  unset). The old automations required it `false`; that must be flipped back on.
- The hourly `POST /api/media/sync-major-videos` job remains a create-only backstop that pulls
  Vishen's newly-added Major Videos into 📺 Media Sources so the team can clip them (idempotent on
  Source Record ID).

> **Social fan-out** was never an automation and is unaffected: `/social` raises tickets directly
> into the Creative Services Prio queue via the app's `createTicket` path.
