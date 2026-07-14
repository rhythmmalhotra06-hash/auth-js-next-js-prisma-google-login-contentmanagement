# Fix: Social checkbox → Prio ticket automation not creating tickets

## Context

The 📣 Social table (`tblCcrdkHzOakOGnm`) has an Airtable Scripting automation that raises a
🎯 Prio ticket in the Creative Services base (`appFEFygXo2pRc8AR`, Prio table
`tblhrRl8GzsDMv0DD`) when someone checks *Raise Request (Creative)*. It stopped creating tickets.

The execution log shows the create `POST` failing with:

```
INVALID_MULTIPLE_CHOICE_OPTIONS
Insufficient permissions to create new select option ""Social Media Video""
```

**Root cause:** the script writes `[P_TEAM]: 'Social Media Video'` to the *Team/Service Level*
single-select field (`fldHGT2p5SObJEzPh`). That option does not exist on the field, so Airtable
attempts to create it — but the automation's `pat…` token lacks schema permission to add select
options, so the whole request is rejected. `created.id` is then `undefined`, the script logs
`ticket create failed:` and returns, leaving no ticket and never stamping the source record's
`Creative Ticket ID` / status. This is the same "token can't mint select options" trap documented
in memory (Team/Service Level options).

The field's only live options are:
`Video Team - Non Campaign`, `Video Team - Campaign [Events, etc]`, `Event Design Graphic`,
`Brand Design Graphic`. The other two single-selects the script sends are already valid
(`Type of Request: 'Video'`, `Prio. Status: 'New Request'`) — Team is the sole blocker.

**Decision:** map social clips to the existing option **`Video Team - Campaign [Events, etc]`**
(script-only change, no Airtable schema permission needed).

## Change

The automation lives in the Airtable automation editor (📣 Social table → the "Raise Request →
Prio ticket" automation's Run-script action), **not** in this repo. Edit it there.

One line, in the `fields` object inside `run()`:

```js
// before
[P_TEAM]: 'Social Media Video',
// after
[P_TEAM]: 'Video Team - Campaign [Events, etc]',
```

Everything else in the script is correct and unchanged.

## Secondary (non-blocking) issue

The same log also shows:

```
"Raised By" field missing → add a "Last modified by" field named "Raised By" to set Requested By
```

This does **not** block ticket creation — it only means *Requested By* won't be populated on the
Prio ticket (the code already handles this gracefully and logs `(no requester match)`). If you want
the requester filled in, add a **Last modified by** field named exactly `Raised By` to the 📣 Social
table. Optional; do it only if you want requester attribution.

## Verification

1. In Airtable, open a test row in the 📣 Social table that has an *Asset Type* set and no
   *Creative Ticket ID*, and check *Raise Request (Creative)*.
2. Watch the automation run log — it should now log
   `raised ticket rec… for "<title>"` instead of `ticket create failed:`.
3. Confirm a new row appears in the Creative Services Prio table (`tblhrRl8GzsDMv0DD`) with
   Team/Service Level = `Video Team - Campaign [Events, etc]`, Type of Request = `Video`,
   Prio. Status = `New Request`, and the linked Asset Type.
4. Confirm the source Social row now has *Creative Ticket ID* populated and Status =
   `2A. Ticket Raised` (idempotency — re-running must skip with `already raised → skip`).

## Optional: check in a canonical copy

The script currently only exists inside Airtable. Consider saving the corrected version to the repo
(e.g. `scripts/airtable-automations/social-raise-prio-ticket.js`) for provenance, matching the
pattern of other documented Airtable automations.
