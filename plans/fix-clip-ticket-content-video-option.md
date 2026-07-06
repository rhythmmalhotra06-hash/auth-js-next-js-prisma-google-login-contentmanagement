# Fix: clip → ticket fails with `INVALID_MULTIPLE_CHOICE_OPTIONS: "Content Video"`

## Context

Raising a ticket from a suggested clip fails with:

```
INVALID_MULTIPLE_CHOICE_OPTIONS: Insufficient permissions to create new select option ""Content Video""
```

Root cause is a **stale taxonomy list**, not a clip bug. The clip approval modal's
"Team / Service Level" dropdown is populated from the app's hardcoded
`TEAM_SERVICE_LEVELS` array. That value is written verbatim into the Airtable
single-select field **"Team/Service Level"** (`fldHGT2p5SObJEzPh`) at ticket create.

The app's list is out of date. The live Airtable field only accepts these 4 options
(verified via Airtable schema on 2026-07-06):

- `Video Team - Non Campaign`
- `Video Team - Campaign [Events, etc]`
- `Event Design Graphic`
- `Brand Design Graphic`

The app still offers `Content Video`, `Ad Creatives Video`, `Social Media Video`,
`Pathway Organic` — none exist in Airtable. Writing any of them makes Airtable try to
*create* a new option, which the token can't do → the error. Only `Event Design Graphic`
and `Brand Design Graphic` currently work.

This is broader than clips: the invalid default `'Social Media Video'` is hardcoded in the
clip flows **and** in Social-team intake (`app/social/actions.ts`), so those ticket
creates are silently broken by the same cause.

**Decisions (confirmed with user):**
1. Match the app to Airtable's 4 live options (token can't create options; Airtable was
   intentionally restructured).
2. New default for the clip/social/content-engine flows: `Video Team - Non Campaign`.

## Changes

### 1. Update the option list — `lib/intake/data.ts:36-43`
Replace the stale `TEAM_SERVICE_LEVELS` array with the 4 live Airtable options:

```ts
export const TEAM_SERVICE_LEVELS = [
  'Video Team - Non Campaign',
  'Video Team - Campaign [Events, etc]',
  'Event Design Graphic',
  'Brand Design Graphic',
];
```

This fixes the intake form dropdown ([IntakeForm.tsx:63](components/intake/IntakeForm.tsx#L63))
and both clip modals ([components/media/ClipApprovalModal.tsx:113](components/media/ClipApprovalModal.tsx#L113),
[components/clipping/ClipApprovalModal.tsx:110](components/clipping/ClipApprovalModal.tsx#L110)),
which all render from this array.

### 2. Fix the invalid `'Social Media Video'` defaults → `'Video Team - Non Campaign'`
Same string replacement in all five locations:

- [components/media/ClipApprovalModal.tsx:38](components/media/ClipApprovalModal.tsx#L38) — `useState(...)`
- [components/clipping/ClipApprovalModal.tsx:36](components/clipping/ClipApprovalModal.tsx#L36) — `useState(...)`
- [app/media/actions.ts:179](app/media/actions.ts#L179) — `convertClipsToTickets` fallback (also update the `:97` comment)
- [app/content-engine/actions.ts:100](app/content-engine/actions.ts#L100) — fallback (also update the `:34` comment)
- [app/social/actions.ts:69](app/social/actions.ts#L69) — Social-team intake

### 3. Fix the ads-detection signal (secondary, same root cause)
`isAds` keys off `teamServiceLevel` containing the substring `"ad"`
([lib/tickets/data.airtable.ts:354](lib/tickets/data.airtable.ts#L354),
[lib/tickets/data.postgres.ts:328](lib/tickets/data.postgres.ts#L328)). The old
`Ad Creatives Video` matched; none of the 4 new options contain `"ad"`, so per-ratio
delivery fields would stop showing for ad tickets. There is no ad-specific option in the
new field, so ads are now distinguished by the separate `creativeServiceType`
(`fldHav5N7f7Rpi08Q`, multipleSelects) field instead. **Confirm** whether ad detection
should move to `creativeServiceType`; if so, update both `isAds` computations and their
comments. If out of scope, leave a `// TODO` noting the signal is stale — do not silently
leave misleading comments.

> Note: the `*.ts 2` / `*.postgres 2.ts` files in `lib/tickets/` are stray editor
> duplicates (untracked in git status) — do **not** edit them; edit only the real files.

## Verification

1. `npm run lint` and `npm run build` — no type errors from the changed strings.
2. Drive the real flow (use the `/run` skill or dev-login harness): open a media source
   with suggested clips → tick a clip → raise ticket with the default service level →
   confirm the ticket is created in Airtable with no `INVALID_MULTIPLE_CHOICE_OPTIONS`
   error and "Team/Service Level" = `Video Team - Non Campaign`.
3. Repeat for the intake form and the Social intake path (`app/social`) — pick each of
   the 4 options and confirm all create cleanly.
4. If change #3 is applied: create one ad ticket and confirm the per-ratio delivery fields
   still render.
