# Wire delivery-link fields on the ticket detail form

## Context

On the editor ticket detail page (`/tickets/[id]`), the **Assets** section today is a
raw/final "add-remove stack": pick `raw` or `final`, paste a URL, hit Add. Under the hood
raw → Airtable `Raw File/URL Links`, final → `Output link`. Editors have asked to deliver
work the way the team actually files it in Airtable — via an **Asset Folder Link** and a
**Working Files** link — and, for the **ads** team, via the per-ratio delivery fields the
Ads Creative view uses (`viwc47UTweeLSuPO5`).

This plan replaces that stack (confirmed: *replace entirely*) with editable link fields
bound directly to the real Airtable fields:

- **All tickets:** `Asset Folder Link`, `Working Files`
- **Ads tickets only** (Team/Service Level or Team contains "ad"): `16x9 Final Link` + `16x9 Folder`,
  `9x16 Final Link` + `9x16 Folder`, `4x5 Final Link` + `4x5 Folder`

Note: the request said "4x6" but the live base has no 4x6 field — the real fields are **4x5**,
so we wire 4x5.

### Two-way sync — already satisfied, nothing to build
The app is **Airtable-direct** for tickets. `getTicketDetail` reads live via `getRecord`
([lib/tickets/data.ts:319](lib/tickets/data.ts#L319)) and every edit PATCHes straight back
through `updateTicketFields` → `updateRecord`
([lib/repositories/ticket.repository.ts:136](lib/repositories/ticket.repository.ts#L136)).
Airtable is the single source of truth, so a link typed in the portal is written to Airtable
immediately, and a link edited in Airtable appears in the portal on next load. That *is* the
two-way sync — there is no Postgres mirror in this path (the `AirtableOutbox` model is unused).
Verification below confirms a real round-trip.

## Airtable fields (IDs verified live against `tblhrRl8GzsDMv0DD`)

| Purpose | Airtable field | Field ID | Type | In map? |
|---|---|---|---|---|
| Asset Folder Link | `Asset Folder Link` | `fldRQRCJXQ6U4SKLq` | singleLineText | ✅ `assetFolderLink` |
| Working Files | `Working Files` | `fldaOh1PVfKxz5FNR` | singleLineText | ➕ add `workingFiles` |
| 16x9 final | `16x9 Final Link` | `fldM3UIYvwgSEiICF` | singleLineText | ✅ `final16x9` |
| 9x16 final | `9x16 Final Link` | `fldExLdKe6qiJvtph` | singleLineText | ✅ `final9x16` |
| 4x5 final | `4x5 Final Link` | `fld4BuuOm2rnWYoIR` | singleLineText | ✅ `final4x5` |
| 16x9 folder | `16x9 Folder` | `fldvdw7SU93YLeruF` | **url** | ➕ add `folder16x9` |
| 9x16 folder | `9x16 Folder` | `fldbTDEvPGjOjzUaW` | **url** | ➕ add `folder9x16` |
| 4x5 folder | `4x5 Folder` | `fldI88FUBPH8yzijN` | **url** | ➕ add `folder4x5` |

The three `*Folder` fields are Airtable **url**-typed → they reject non-URL strings on write
(the existing `createTicket` guards `rawFileUrl` for exactly this reason,
[ticket.repository.ts:101-107](lib/repositories/ticket.repository.ts#L101-L107)). We apply the
same `^https?://` guard before writing them. The `Final Link` and `Asset Folder Link` /
`Working Files` fields are singleLineText and accept any string.

"Ads" detection: `Team/Service Level` (singleSelect) has value **`Ad Creatives Video`** for
ads; `Team` (`Creative Service Type`) may also carry an ad value. Detect with a case-insensitive
`"ad"` substring over both — no other current choice (Content/Social/Event/Brand/Pathway)
contains the substring "ad".

## Changes

### 1. `lib/airtable/field-map.ts` — add 4 field IDs
In `TICKETS.fields` (after the existing `final4x5` / `assetFolderLink` lines ~50-51):
```ts
workingFiles: 'fldaOh1PVfKxz5FNR', // "Working Files" (singleLineText)
folder16x9: 'fldvdw7SU93YLeruF',   // "16x9 Folder" (url)
folder9x16: 'fldbTDEvPGjOjzUaW',   // "9x16 Folder" (url)
folder4x5: 'fldI88FUBPH8yzijN',    // "4x5 Folder" (url)
```

### 2. `lib/tickets/data.ts` — expose the field values, drop the synthesized asset stack
- Add to `TicketDetail`: `assetFolderLink`, `workingFiles`, `final16x9`, `folder16x9`,
  `final9x16`, `folder9x16`, `final4x5`, `folder4x5` (all `string | null`), and `isAds: boolean`.
- In `getTicketDetail`, populate them with `str(f[F.*])`, and compute
  `isAds = [teamServiceLevel, team].filter(Boolean).join(' ').toLowerCase().includes('ad')`.
- Remove the `assets` synthesis + `pushAsset` ([data.ts:327-338](lib/tickets/data.ts#L327-L338))
  and the `assets: AssetRow[]` field. Remove the `AssetRow` interface (only used by the old
  panel; `QueueTicket`/`getRecentShipped` don't use it). Keep the existing `folderUrl` on
  `QueueTicket` (list views) untouched.

### 3. `app/tickets/[id]/actions.ts` — one allowlisted save action; retire add/removeAsset
- Add a whitelist keyed by the 8 field keys → `{ fieldId, url: boolean, delivery?: boolean }`
  (url:true for the three `folder*`). Import the new IDs via `TICKET_FIELD as F`.
- New action:
  ```ts
  export async function updateTicketLink(ticketId: string, key: string, value: string) {
    const spec = ASSET_LINK_FIELDS[key]; if (!spec) return { ok:false, error:'Unknown field' };
    const v = value.trim();
    if (v && spec.url && !/^https?:\/\//i.test(v)) return { ok:false, error:'Enter a full URL (https://…)' };
    const res = await updateTicketFields(ticketId, { [spec.fieldId]: v });
    if (!res.ok) return { ok:false, error: res.error.message };
    // preserve the "asset ready" signal: fire once when a delivery link lands
    if (v && spec.delivery) await maybeNotifyAssetReady(ticketId, v);
    return done(ticketId);
  }
  ```
  Mark the ratio `Final Link` keys and `assetFolderLink` as `delivery: true` so filling a
  final/folder link still triggers `maybeNotifyAssetReady` (deduped by the `Asset Ready
  Notified` checkbox, [actions.ts:80](app/tickets/[id]/actions.ts#L80)). `Working Files`/`Folder`
  are not delivery signals.
- Delete `addAsset` and `removeAsset` (only the old panel used them).

### 4. `components/tickets/AssetPanel.tsx` — rewrite as editable link fields
Replace the raw/final stack with a labeled list of link fields. Props:
`{ ticketId, isAds, values: { assetFolderLink, workingFiles, final16x9, folder16x9, ... } }`.
- Render a small client `LinkField` per field: label + text `Input` prefilled with the current
  value, **save on blur when changed** via `useTransition` → `updateTicketLink(ticketId, key, val)`,
  with optimistic value + rollback + inline error (mirror the pattern in
  [StatusUpdater.tsx](components/tickets/StatusUpdater.tsx) and the old
  [AssetPanel.tsx:25-34](components/tickets/AssetPanel.tsx#L25-L34)). When a value is present,
  also show it as a clickable link.
- Always show **Asset Folder Link** + **Working Files**. When `isAds`, additionally show the
  three ratio rows, each as a pair (Final Link + Folder), under a small "Ad ratios" subheading.
- Follow `DESIGN_SYSTEM.md`: reuse the `Field`/`Input` primitives and token utilities — no raw
  hex / arbitrary sizes / inline style. **Load the `artifact-design` skill before editing UI**
  (per repo rule) and keep the section visually consistent with the detail card's `field-row`
  grid.

### 5. `app/tickets/[id]/page.tsx` — pass the new props
Update the Assets card ([page.tsx:68-71](app/tickets/[id]/page.tsx#L68-L71)) to pass
`isAds={t.isAds}` and the `values` object instead of `assets={t.assets}`. Drop the
"raw & final stack under one asset" hint; retitle to reflect delivery links.

## Verification

1. `npm run lint` — clean.
2. Local round-trip (proves the write + read + 2-way sync):
   - Run `npm run dev`, open a ticket detail page.
   - Paste a URL into **Asset Folder Link**, blur → confirm it persists after `router.refresh`.
   - In Airtable (`appFEFygXo2pRc8AR / tblhrRl8GzsDMv0DD`, or via the Airtable MCP
     `list_records_for_table` filtered to that record) confirm `Asset Folder Link` now holds the
     value → **portal → Airtable** write confirmed.
   - Edit `Working Files` directly in Airtable, reload the portal page → value appears →
     **Airtable → portal** read confirmed.
   - Paste a non-URL into a **Folder** (url-typed) field → inline "Enter a full URL" error, no
     write. Paste `https://…` → saves.
3. Ads path: on a ticket whose Team/Service Level is **Ad Creatives Video**, confirm the three
   ratio rows render; on a non-ads ticket confirm they're hidden.
4. Confirm filling a **Final Link** / **Asset Folder Link** still fires the asset-ready
   notification once (check `#content-ready` / requester DM in staging) and re-saving does not
   re-notify (dedupe checkbox).
