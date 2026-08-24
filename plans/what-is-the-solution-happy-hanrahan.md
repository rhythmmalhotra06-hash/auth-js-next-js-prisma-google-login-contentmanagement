# Durable creative attribution — keep ex-staff tagged without switching to Airtable Users

## Context

Titus asked to change **"Assigned Creative"** on the Creative Services Prio table from a
link → 👬 Employees into an Airtable **User (collaborator)** field, because when someone
leaves, the assignment "goes to Empty" and he can no longer tag them. His workaround today
is assigning those tickets to himself and re-creating leavers as rows in
👷🏼 Contractor/Freelancers — so the ticket history no longer says who actually did the work.

Rhythm's objection is right, and the diagnosis is not what the request assumes:

- **It isn't an employee-vs-user problem, it's a delete-vs-retire problem.** 👬 Employees
  (`tbllP5vRon54L7Ccf`) is a **synced table** fed from the HR/People base. Its source view
  only carries current staff, so when someone is offboarded the *row is deleted* by the sync.
  Airtable link cells hold a pointer to a record — delete the record and every
  "Assigned Creative" cell pointing at it silently blanks. Verified: the table currently
  holds **zero** records with `Active Status = "Not Active"` and zero at the
  `Ex-Team` / `Contract Ended` stage. Both fields exist (`fldVpmhLINGDPxJNG`,
  `fldzGBnI3SBeS7mtW`) and are simply never reached, because leavers vanish first.
- **A User field would not fix it and costs more.** Airtable collaborator fields can only
  hold people who are collaborators on that base — so every creative would need an Airtable
  seat (the exact per-seat cost this project exists to avoid), and the value still degrades
  when the account is deprovisioned from the workspace. It also breaks the single source of
  truth: the app resolves people by `airtable_id` into `employees`, which drives scoring,
  capacity, Slack DMs, team gating and the Vishen cross-base editor mirror.

**Intended outcome:** the person who did the work stays tagged forever — in Airtable *and*
in the app — while assignment pickers still only offer current staff, and Employees stays
the single source of truth.

---

## The solution, in one line

Stop the HR sync from *owning* the roster. Land the sync in a shadow table, make
👬 Employees a durable, app-maintained roster that only ever flips people to **Not Active**,
and make Postgres hold an assignee snapshot so a broken Airtable link can never erase
attribution again.

```
HR / People base
     │  Airtable sync (unchanged, one-way)
     ▼
🔄 HR Directory (synced)     ← NEW shadow table; nothing links to it
     │  nightly upsert by Work Email
     ▼
👬 Employees (tbllP5vRon54L7Ccf, sync REMOVED → static)
     •  new source row      → create
     •  changed source row  → update name / team / division / employment status
     •  source row gone     → set Active Status = "Not Active"   ← never delete
     ▲
     │  "Assigned Creative" (fldalbq653hBbZvu7) — unchanged, zero link migration
🎯 Prio / Requests (tblhrRl8GzsDMv0DD)
```

Removing the sync from the *existing* table (rather than building a new roster table) is
the key choice: record IDs, every existing link, and the app's whole `airtable_id` mapping
survive untouched. No backfill of historical tickets.

---

## Status

- **Phase 1 (Airtable config) — NOT DONE.** Manual work in the live base; removing a sync is
  not something to do unilaterally.
- **Phase 2 (app durability) — DONE.** Build + typecheck + lint clean. Details below.
- **Phase 3 (verification) — partly done:** build/typecheck/lint pass; the live reconcile
  regressions still need running against the deployed app.
- **Phase 4 (recovery) — NOT DONE.** Blocked on `kessel login` (session expired).

---

## Phase 1 — Airtable (no code)

1. Re-create the HR sync into a **new** table `🔄 HR Directory (synced)` in
   `appFEFygXo2pRc8AR`. Must carry Work Email, Name, Team, Division, Employment Status.
2. On 👬 Employees, **remove the sync configuration** ("stop syncing") so it becomes a
   normal editable table. Records, IDs and links are preserved.
3. Add to 👬 Employees: `Left On` (date) and `Roster Source` (single select: HR Sync /
   Manual). `Active Status` and the stage field already exist — start actually using them.
4. Airtable automation, nightly: upsert `🔄 HR Directory` → 👬 Employees matched on
   **Work Email** (not recId — a re-added HR row gets a new recId). Rows absent from the
   directory get `Active Status = "Not Active"` + `Left On = today`. **Never delete.**
5. Create view **"Roster — Active"** filtered `Active Status = Active`, and set the
   "Assigned Creative" field's record-selection limit to that view. New assignments only
   offer current staff; existing links to leavers still render normally. Titus can lift the
   filter on the field if he ever needs to tag a leaver deliberately.
6. Backfill 👬 Employees with the leavers we can still identify (Phase 4).

**Risk to flag before doing step 2:** anything else that consumes the synced 👬 Employees
(interfaces, other automations, rollups in this base) keeps working — it's the same table —
but confirm nobody depends on HR-side field *edits* propagating live. After step 2 those
arrive on the nightly upsert instead of instantly.

---

## Phase 2 — App durability (this repo) — DONE

What was built:

| Change | Where |
|---|---|
| `assignee_name` column + backfill from the current FK | `prisma/schema.prisma`, `prisma/migrations/0019_ticket_assignee_name/migration.sql` |
| Pull may SET but never CLEAR an assignee (`assigneeUpdate` helper) | `lib/airtable/ticket-upsert.ts` |
| Snapshot written on every assignment (`resolveAssignee`) | `lib/tickets/write.postgres.ts` |
| `creditedTo()` — read falls back to the snapshot, flags `assigneeExTeam` | `lib/tickets/data.postgres.ts` |
| `AssigneeName` — shows the name + an `ex-team` marker instead of dropping it | `components/tickets/AssigneeName.tsx`, used by `components/tickets/QueueTable.tsx` |
| `getAssignableEmployees()` — picker offers ex-team in their own `<optgroup>`; a current assignee who is off the roster no longer renders as "Unassigned" | `lib/tickets/data.{postgres,airtable,}.ts`, `components/tickets/AssigneeUpdater.tsx`, `app/tickets/[id]/page.tsx` |
| `assigneePreserved` counter surfaced on the pull report | `lib/airtable/pull{,-core}.ts`, `app/admin/sync/actions.ts` |
| Ex-team excluded from the capacity chart (credit ≠ capacity) | `components/ui/FunnelCapacity.tsx` |

Two deliberate calls worth knowing:

- **A pull can no longer un-assign.** An empty incoming link is indistinguishable from a
  deleted-employee blank, and the blank is far more common, so preserving is the safe side.
  Un-assigning is an app action (`updateTicket({ assigneeRecId: null })`), which clears the
  FK *and* the snapshot. Consequence: un-assigning directly in Airtable won't propagate.
- **The Airtable-direct backend can't offer this.** `data.airtable.ts` hard-codes
  `assigneeExTeam: false` — reading Airtable live, a deleted employee leaves nothing to
  recover. Durability is a Postgres-backend property, which is another argument for
  `TICKETS_BACKEND=postgres` everywhere.

The migration is written but **not applied** — per the managed-DB constraint it goes out with
`kessel db migrate prisma/migrations/0019_ticket_assignee_name/migration.sql`.

### Original notes

The mirror already survives deletion: `deactivateOrphans` in
[lib/airtable/sync.ts:306-319](lib/airtable/sync.ts#L306-L319) marks vanished employees
`active = false` and never hard-deletes them — reuse that, don't rebuild it. The leak is on
the ticket side.

1. **Never let a pull erase an assignee.** In
   [lib/airtable/ticket-upsert.ts:109-121](lib/airtable/ticket-upsert.ts#L109-L121),
   `assigneeId` is written unconditionally from the Airtable link, so a blanked link
   propagates `null` into Postgres on the next reconcile. Guard the `update` branch: when
   the incoming links resolve to nothing but the existing row has an `assigneeId`, keep the
   existing value. (`create` is unaffected.) Note `unresolved++` already counts this case —
   surface it in the sync health output, [lib/sync/health.ts](lib/sync/health.ts).
2. **Snapshot the credit.** Add `assigneeName String?` to `Ticket` in
   [prisma/schema.prisma](prisma/schema.prisma#L280) (migration under `prisma/migrations/`,
   applied with `kessel db migrate` per the managed-DB constraint). Write it wherever
   `assigneeId` is set — [lib/tickets/write.postgres.ts:67-68](lib/tickets/write.postgres.ts#L67-L68),
   `:111`, and the resolved branch of `ticket-upsert.ts`. Read paths fall back to it when
   `assignee` is null. This is the layer that makes attribution unloseable regardless of
   what happens in Airtable.
3. **Render ex-staff, don't hide them.** Pickers stay active-only —
   `getActiveEmployees` / `getEligibleAssignees` in
   [lib/tickets/data.postgres.ts:110-131](lib/tickets/data.postgres.ts#L110-L131) via
   `listActiveEmployeeRecords` ([lib/repositories/employee.repository.ts](lib/repositories/employee.repository.ts))
   — but ticket list/detail must still show an inactive assignee's name with an "ex-team"
   marker. Use the existing `Badge` primitive; no new component. Check
   [app/tickets/[id]/page.tsx](app/tickets/[id]/page.tsx) and the queue table for anywhere
   an inactive employee is filtered out of a *display* rather than a *picker*.
4. **Allow deliberate re-assignment to a leaver.** Add an "Include ex-team" toggle on the
   assignee `SearchableSelect` on the ticket detail page, so Titus can tag a leaver from the
   app without touching Airtable. Push already tolerates it —
   [lib/airtable/push-map.ts:98](lib/airtable/push-map.ts#L98) only ever sets the link when
   non-null, so the app never clears Airtable's value.

---

## Phase 3 — Verification

- `npm run build` and `npm run lint`.
- Reconcile dry-run first: hit the reference sync with `dryRun` and confirm
  `deactivated.employees` reports the leavers rather than a mass wipe (the
  empty-pull guard at `sync.ts:312` already blocks the catastrophic case).
- Regression that proves the fix: pick a test ticket, clear "Assigned Creative" in Airtable,
  run the ticket reconcile, and confirm Postgres **keeps** the assignee and the ticket page
  still shows the name. Before this change it goes blank.
- Assign a ticket to an employee, flip that employee to `Not Active` in Airtable, reconcile,
  and confirm the ticket still renders the name with the ex-team badge and the picker no
  longer offers them.
- Confirm the Vishen "Editor Assigned" cross-base mirror
  ([lib/media/clip-ticket-sync.ts](lib/media/clip-ticket-sync.ts)) still matches by Work
  Email once Employees is static.

---

## Phase 4 — Recover the history already lost

Airtable exposes no cell-revision API, so this is a best-effort reconstruction from what the
app retained. Order matters — the roster has to be durable before links can be restored.

1. Size it first (needs `kessel login`; the session was expired when this plan was written):
   ```sql
   select count(*) filter (where active = false) as ex_staff, count(*) from employees;
   select t.airtable_id, e.name
     from tickets t join employees e on e.id = t.assignee_id
    where e.active = false;
   ```
   Postgres has mirrored Employees since ~2026-06-24, so anyone who left after that is
   recoverable; anyone before that is not.
2. Re-create those ex-staff rows in the now-static 👬 Employees (`Active Status = Not
   Active`, `Roster Source = Manual`), then re-run the reference sync so the app re-maps
   them by `airtable_id`.
3. Push the retained assignees back to Airtable for the affected tickets via the existing
   push path.
4. Cross-check `ticket_events` for assignment transitions that predate the mirror.
5. Whatever is left: add a `Legacy Assignee` text field on Prio and have Titus fill it once
   from the contractor rows he created as a stopgap — then retire those rows (set them
   Inactive, don't delete, since `Assigned Contractor/Freelancer` links point at them).

**Optional follow-up, not in scope:** the Employees / Contractors split is what pushed Titus
into using the contractor table as an ex-staff dumping ground. Folding both into one roster
with a `Type` column would remove the ambiguity, but it does require migrating the
`Assigned Contractor/Freelancer` link — worth a separate decision.

---

## Reply Rhythm can send Titus

> Got to the bottom of it — it's not really an employee-vs-user thing. Our Employees table
> is synced from HR, and when someone is offboarded the sync **deletes** their row. Airtable
> links point at a record, so the moment the row goes, every "Assigned Creative" cell
> pointing at it blanks. Switching to a User field wouldn't actually save you: collaborator
> fields only accept people who have a paid seat on the base, and the value still drops when
> IT deprovisions the account — so we'd pay per seat and *still* lose the tag.
>
> The fix is to stop letting the HR sync own the roster. HR keeps feeding us into a shadow
> table, and our Employees table becomes ours: leavers get flipped to "Not Active" instead of
> deleted, so every ticket stays tagged to the person who actually did it, forever. Your
> assignment dropdown will still only show current staff, but nothing disappears from
> history, and you can still tag a leaver on purpose when you need to. On top of that I'm
> storing the creative's name on the ticket itself in the app, so even a broken link can't
> erase who edited what.
>
> I'll also do a pass to restore the ones we've already lost and clean up the ex-employees
> currently sitting in the Contractor/Freelancer table — you can stop assigning those to
> yourself.
