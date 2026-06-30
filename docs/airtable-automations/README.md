# Two-way sync — Airtable Automations

These scripts implement the full two-way mirror between Vishen's content base
(`appvBtCYdaSrD1y11`: **Major Videos**, **Clips**) and the Creative Services base
(`appFEFygXo2pRc8AR`: **📺 Media Sources**, **🎬 Clip Suggestions**). See
[`plans/vishen-two-way-sync.md`](../../plans/vishen-two-way-sync.md).

**Why it's all in Airtable Automations:** edits happen directly in *either* base (not only through
the portal), and the portal is IAP-gated so Airtable can't call it. Running Airtable→Airtable
covers every edit source and needs no relay/OIDC. Because of this, the **app-code outbound sync is
turned off** (`VISHEN_SYNC_ENABLED=false`) so the two systems don't race — the automations are the
single source of sync.

## The automations

| # | Base | Trigger | Script | Direction |
|---|------|---------|--------|-----------|
| 1 | Vishen | created/updated on **Major Videos** | [`major-videos-to-media-sources.js`](major-videos-to-media-sources.js) | MV → Media Sources (create + update) |
| 2 | Vishen | created/updated on **Clips** | [`vishen-clips-to-clip-suggestions.js`](vishen-clips-to-clip-suggestions.js) | Clips → Clip Suggestions (create + update; skips app-originated rows) |
| 3 | Creative Services | created/updated on **📺 Media Sources** | [`media-sources-to-major-videos.js`](media-sources-to-major-videos.js) | Media Sources → MV (**update-only**, never creates) |
| 4 | Creative Services | created/updated on **🎬 Clip Suggestions** | [`clip-suggestions-to-vishen-clips.js`](clip-suggestions-to-vishen-clips.js) | Clip Suggestions → Clips (update; creates only for Vishen media) |
| 5 | Creative Services | **scheduled, hourly** | [`reconcile-deletes.js`](reconcile-deletes.js) | Vishen delete → archive/dismiss the portal mirror |

1 & 3 are inverses (Major Videos ⇆ Media Sources); 2 & 4 are inverses (Clips ⇆ Clip Suggestions).

> **Social fan-out is NOT an Airtable automation.** The Marketing **Social Media** section
> (`/social`) raises tickets directly from the portal into the Creative Services Prio queue
> (`tblhrRl8GzsDMv0DD`) via the app's `createTicket` path — the same one the Clips flow uses. The
> `🎯 Prio` table in the Content & Comms base is a **read-only synced mirror** of that Creative
> Services table, so records can't be created there; an in-base automation is impossible. No
> automation or PAT is needed for the Social flow.

## Why there's no infinite loop
- **Diff-guarded:** every write compares against the current value and writes only changed fields;
  an equal-value write is skipped, so an A→B propagation that comes back as B→A settles to a no-op.
- **Correlation keys** pair the two sides: Media Sources `Source Record ID` = Major Video id;
  Clip Suggestions `Vishen Clip ID` ⇄ Vishen Clips `App Clip ID`. The clip automations key off these
  so a row is updated, never re-created.

## What syncs (common fields only)
- **Major Videos ⇆ Media Sources:** Name ⇆ Title, Final URL ⇆ Source URL. (Type/Select is
  Vishen→portal only — written into Guest/Show; the reverse would need a constrained select value.)
- **Clips ⇆ Clip Suggestions:** Name, Notes ⇆ Rationale, and Status —
  Proposed⇆Todo, Approved⇆In progress, Done→Approved, Dismissed→(left as-is).
- **Reverse create is update-only for media:** a Media Source with no `Source Record ID`
  (CS-only / YouTube / Slack source) does **not** create a Major Video.
- **Deletes** (hourly reconcile, Vishen→portal only): Major Video gone → Media Source `Archived`;
  Vishen clip gone → Clip Suggestion `Dismissed`. Deletions on the CS side are not pushed into
  Vishen's base (it's authoritative for what exists).

## Setup (once)

1. **Personal Access Token** (https://airtable.com/create/tokens) — dedicated, least-privilege:
   scopes `data.records:read` + `data.records:write`; access to **both** bases. It's stored in each
   automation's input config (visible to base collaborators) — don't reuse the main app token.

2. **Create the five automations** per the table above. For each "Run a script" action add the
   input variables: `recordId` = the trigger step's *Airtable record ID* (automations 1–4 only) and
   `apiKey` = the PAT. Paste the matching script, **Test**, then toggle **On**. Automation 5 is a
   scheduled trigger (hourly) and only needs the `apiKey` input.

3. **Disable the app-code outbound** so it doesn't double-write with automations 3 & 4:
   `kessel env set VISHEN_SYNC_ENABLED=false` then `kessel deploy`.

## Notes
- Scripts read Vishen's base by **field ID** (rename-proof) and the Creative Services base by field
  **name**. If a field is renamed/removed, update the corresponding constant.
- The hourly `POST /api/media/sync-major-videos` job remains a create-only backstop for new Major
  Videos (idempotent on Source Record ID).
