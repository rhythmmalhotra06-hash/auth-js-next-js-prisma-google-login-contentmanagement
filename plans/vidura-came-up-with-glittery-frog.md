# Fix: "Raise Request" leaves *Requested By* empty on the Prio ticket

## Context

Vidura reported (Slack, 2026-08-18) that when he ticks **Raise Request (Creative)** in the
📣 Social table, the Prio ticket *is* created but his name never lands in **Requested By** — he had
to ask Yuthika to fill it in by hand on his two tickets.

This is not specific to Vidura. It affects **every** ticket raised through that checkbox.

### Root cause (verified against live Airtable)

The checkbox fires the deployed automation **`Social checkbox → Prio ticket`**
(`wflhKn1g3jVmS9jtI`, base `app9YRZOVeE65fJPA`, script node `wacDn4BBYX23xojCe`). Its script — repo
copy at [scripts/airtable-automations/social-raise-prio-ticket.js](scripts/airtable-automations/social-raise-prio-ticket.js) —
resolves the requester like this:

```js
const S_RAISED_BY = 'Raised By';   // line 29 — referenced BY NAME
...
if (social.fields.some((f) => f.name === S_RAISED_BY)) {   // line 126
  ...
} else {
  console.log(`"${S_RAISED_BY}" field missing → ...`);      // line 135
}
if (requesterId) fields[P_REQUESTED_BY] = [requesterId];    // line 155 — omitted when null
```

**There is no field named `Raised By` on `tblCcrdkHzOakOGnm`.** Confirmed: a field-name lookup for
`"Raised By"` returns `422 Could not find a field with name or ID "Raised By"`. So the guard always
takes the `else` branch, `requesterId` stays `null`, and `Requested By` is silently omitted from the
create payload. This was already flagged as a "secondary, optional" issue in
[plans/do-you-remember-we-jaunty-bear.md:48-59](plans/do-you-remember-we-jaunty-bear.md#L48-L59) —
it is not optional; it is the bug Vidura is reporting.

The table *does* already carry the two collaborator fields we need, just under different names:

| Purpose | Field ID | Type |
|---|---|---|
| who last touched the row (= who ticked the box) | `fldl91xQLNJgNOzxV` | `lastModifiedBy` |
| who created the row | `fldOK5B3lze2xQUgW` | `createdBy` |

So **no new Airtable field is needed** — the script just has to read the fields that exist, by ID.

### Blast radius (measured)

31 📣 Social rows have *Raise Request* checked **and** a *Creative Ticket ID* → 29 distinct Prio
tickets. Spot-checked 5: only Vidura's two have *Requested By* (Yuthika's manual fix); the rest are
blank. By creator:

| Raiser | Employees row | Tickets |
|---|---|---|
| Glen Jason Chittur | `recYwVh2wyYEUKmfD` | 13 — backfillable |
| Ishaan Jaiswal | `recJETCoGkoCq2wwu` | 4 — backfillable |
| Vidura Vishmitha … Don | `rect8pbXXU2IXpMzd` | 2 — already fixed by hand |
| Philine Unterberger | **none** | ~11 — cannot resolve (see below) |

**`philine@mindvalley.com` has no row in 👬 Employees (`tbllP5vRon54L7Ccf`)** — searched by both
`Work Email` and `Name`, zero hits. Her tickets will stay unattributed in the link field until the
team adds her (reference data is Airtable-owned; not ours to create). Handled by the brief fallback
below.

### Not affected

The portal's own paths are fine and need no change — [app/social/actions.ts:57](app/social/actions.ts#L57),
[app/media/actions.ts:187](app/media/actions.ts#L187), [app/content-engine/actions.ts:76](app/content-engine/actions.ts#L76)
all default `requesterId` to `getEmployeeForSession()`, and [lib/repositories/ticket.repository.ts:97](lib/repositories/ticket.repository.ts#L97)
always writes `links.requestedBy`. Only the Airtable-side checkbox automation is broken.

---

## Change 1 — fix the requester resolution in the automation script

Edit [scripts/airtable-automations/social-raise-prio-ticket.js](scripts/airtable-automations/social-raise-prio-ticket.js).

**a. Replace the name-based constant (line 29)** with the two field IDs that actually exist:

```js
const S_LAST_MODIFIED_BY = 'fldl91xQLNJgNOzxV'; // "Last Modified By" — who ticked the box
const S_CREATED_BY       = 'fldOK5B3lze2xQUgW'; // "Created By" — fallback when the above is empty
```

**b. Replace the requester block (lines 124–136)** with an ID-based read, no schema probe:

- Read `S_LAST_MODIFIED_BY`; if empty, fall back to `S_CREATED_BY`. Both yield a collaborator object
  `{ id, email, name }`.
- Resolve to an Employee recId with the existing helpers, unchanged: `findEmployeeId(email)` (matches
  `Work Email` / `fldCSlSk6mwmQYK74`), then `findEmployeeByName(name)` as fallback. Both were verified
  live: `{Work Email}` and `{Name}` are valid formula field names on `tbllP5vRon54L7Ccf`, and Vidura's
  collaborator email + display name both resolve to `rect8pbXXU2IXpMzd`.
- Keep the raiser's `{ name, email }` in a local (e.g. `raiserLabel`) regardless of whether the
  Employees lookup succeeded — Change 1c needs it.
- Keep the existing `console.log` of the resolved id; it is what makes the run log diagnosable.

**c. Never lose attribution when the raiser isn't an employee.** In the brief assembly (lines 140–144),
append a `Raised by: <name> (<email>)` line whenever `requesterId` came back `null` but we had a
collaborator. Philine's future tickets then carry her name in the Creative Brief even though the link
field stays empty.

**d. Re-sync the live automation.** The deployed script has drifted from the repo copy — live still
inlines `'Video Team - Campaign [Events, etc]'` and lacks the `TEAM_SERVICE_LEVEL` const and the debug
logs the repo copy has. Push the corrected repo file as the whole script body so the two match:
`update_automation` on `wflhKn1g3jVmS9jtI` / node `wacDn4BBYX23xojCe`. MCP edits land on the **draft**,
so confirm `deploymentStatus` is still `deployed` afterwards (via `get_automation`) and publish in the
Airtable UI if it flipped. Manual paste into the Run-script action is the fallback.

> Design note on the primary signal: *last modified by* is read before the script's own
> `updateRecordAsync`, so at ticket-create time it is the person who ticked the box — which is the
> right meaning of "who raised this". `Created By` is only the fallback.

## Change 2 — one-off backfill of the ~17 resolvable tickets

A throwaway script (scratchpad, not committed — this is a one-time data repair):

1. List 📣 Social rows where `fldrNumf2EpoRetuf` is true **and** `fldZxIaWrFImce9H9` (Creative Ticket
   ID) is non-empty, selecting `fldOK5B3lze2xQUgW` (Created By). 31 rows today.
2. Dedupe by ticket recId (`recXZusJfatuwS7wX` appears twice).
3. For each, read the Prio ticket's `fldgw7zf5fD2YK2EL` and **skip any that already has a value** —
   never overwrite Yuthika's manual fixes.
4. Resolve Created By → Employee recId by `Work Email`, then `Name`. Skip + report unresolved
   (Philine's ~11).
5. `PATCH` in batches of ≤10 records, back off on 429 (the standing rule in `CLAUDE.md` §8).
6. Print a summary: filled / already-set / unresolved.

**Backfill must use `Created By`, not `Last Modified By`** — the automation's own
`updateRecordAsync` already stamped itself as last modifier on every row it processed, so that field
is useless retroactively. `Created By` is immutable. Caveat to state in the summary: for these rows
we're asserting *the person who drafted the row also raised it*, which matches every sample checked
but isn't provable from Airtable history.

## Change 3 — docs + memory

- [plans/do-you-remember-we-jaunty-bear.md](plans/do-you-remember-we-jaunty-bear.md): rewrite the
  "Secondary (non-blocking) issue" section — it advised adding a `Raised By` field as optional; record
  that the fields already existed under other names and point at this plan.
- [lib/airtable/field-map.ts:454](lib/airtable/field-map.ts#L454): the `raiseRequest` comment says
  "kept for the team's manual flow; the portal uses Creative Ticket ID below". Add that this checkbox
  drives the live `Social checkbox → Prio ticket` automation.
- Correct the stale `content-comms-prio-is-synced` memory, which asserts "no Airtable automation" for
  the Social path — there is one, and it is the path the team actually uses from the grid.
- Flag to Glen/the team: **Philine Unterberger needs a 👬 Employees row** or her tickets stay
  unattributed in the link field.

## Verification

1. **Unit-of-one, live:** pick a 📣 Social row with an *Asset Type* set and no *Creative Ticket ID*,
   tick *Raise Request (Creative)*, and read the automation run log. Expect
   `resolved requesterId = rec…` and `raised ticket rec… (requester set)` — not `no requester match`.
2. Open the new Prio row in `tblhrRl8GzsDMv0DD`: **Requested By** = the person who ticked the box,
   plus the usual `Team/Service Level = Video Team - Campaign [Events, etc]`, `Type of Request = Video`,
   `Prio. Status = New Request`, linked Asset Type.
3. **Idempotency unchanged:** untick/retick is not a valid test (the *Creative Ticket ID* gate makes
   the second run log `already raised → skip`) — confirm that skip fires rather than a duplicate.
4. **No-match path:** temporarily raise from a row created by Philine (or any non-employee) and confirm
   the ticket's Creative Brief ends with `Raised by: … (…)` while *Requested By* stays empty.
5. **Backfill:** re-query the 29 ticket recIds and assert `Requested By` is non-empty for all except
   the ~11 unresolved; assert Vidura's `recfmrnlmw9pqbgO3` / `recs7Iz9m959hVSVU` still point at
   `rect8pbXXU2IXpMzd` (untouched).
6. **Portal reflects it.** Tickets are Postgres system-of-record, so the Airtable-side values only
   surface after an inbound pull. Run it, then check the *Requested by* field on a ticket detail page
   ([app/tickets/[id]/page.tsx:56](app/tickets/[id]/page.tsx#L56)):
   ```bash
   curl -X POST "$URL/api/sync/pull?entity=ticket" -H "Authorization: Bearer $SYNC_SECRET"
   ```
   `push-map.ts:99` *omits* a null requester rather than clearing it, so the outbound push can't undo
   the backfill.
7. Reply to Vidura in Slack: fixed at the source, his two tickets stay as Yuthika set them, and the
   other ~17 were backfilled.

---

## Outcome (2026-08-18)

**Done:**

- **Change 1 — script fixed** in [scripts/airtable-automations/social-raise-prio-ticket.js](scripts/airtable-automations/social-raise-prio-ticket.js):
  requester now read from `fldl91xQLNJgNOzxV` (lastModifiedBy) with `fldOK5B3lze2xQUgW` (createdBy)
  fallback, both by ID; `raiserLabel` appends `Raised by: <name> (<email>)` to the Creative Brief when
  the raiser has no 👬 Employees row. `node --check` and `tsc --noEmit` both clean.
- **Change 2 — backfill applied.** 15 tickets filled (Glen ×11, Ishaan ×4). Verified by re-query:
  19 of the 30 checkbox-raised tickets now carry a requester.
- **Change 3 — docs + memory** updated: this plan, the "secondary issue" section of
  [plans/do-you-remember-we-jaunty-bear.md](do-you-remember-we-jaunty-bear.md),
  the `raiseRequest` comment in [lib/airtable/field-map.ts:454](../lib/airtable/field-map.ts#L454),
  the corrected `content-comms-prio-is-synced` memory, and a new `social-raise-requested-by-bug` memory.

**Two things found mid-flight that changed the plan:**

1. **`update_automation` cannot edit `customScript` nodes** — the API rejects it with
   `readOnlyNodeType: customScript` ("Edit this automation in the Airtable UI instead"). The attempt
   was rejected outright, so the live automation is untouched and still `deployed`. **Change 1d must be
   a manual paste.** This also means the repo copy will always be able to drift silently from live —
   recorded in memory.
2. **Two of Glen's 13 tickets already had a requester** (`recmcjSyJcC7X7DX4`, `recLO2li66vv4Sf8B` →
   Rhythm Malhotra), so the backfill was 15, not 17. The skip-if-already-set rule caught them.

**Still open — needs you:**

1. **Paste the script.** Airtable → 📣 Social → automation `Social checkbox → Prio ticket`
   (`wflhKn1g3jVmS9jtI`) → the Run-script action → replace the whole body with the repo file, then
   **Update** to publish. Until this is pasted, new tickets still land with no requester. Note the live
   copy had *already* drifted from the repo (it lacked the `TEAM_SERVICE_LEVEL` const), so replace the
   whole body rather than patching the requester block.
2. **Run the inbound pull** so the backfilled values reach Postgres and the portal — I couldn't
   (`kessel` session expired, and `SYNC_SECRET` isn't in the local `.env`). Skip if the ~2–3 min pull
   cron is already live:
   ```bash
   curl -X POST "$URL/api/sync/pull?entity=ticket" -H "Authorization: Bearer $SYNC_SECRET"
   ```
3. **Ask Glen to add Philine Unterberger to 👬 Employees** (`tbllP5vRon54L7Ccf`) — 11 of her tickets
   stay unattributed in the link field until then, and future ones will only carry the brief line.
