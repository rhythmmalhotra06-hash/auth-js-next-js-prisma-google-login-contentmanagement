# Fix production login crash (`PrismaClientValidationError: Unknown field 'hours'`)

## Context

Login has been broken since ~Aug 31 with a server-side exception right after
auth (`PrismaClientValidationError: Unknown field 'hours' for select statement
on model 'AssetType'`), thrown by `prisma.ticket.findMany`/`findFirst` calls
that run on nearly every authenticated page load.

**Corrected root cause** (earlier turns in this session diagnosed this as "a
manual `kessel deploy` from a dirty working tree shipped uncommitted WIP" and
tried fixing it by stashing WIP + forcing redeploys of clean `HEAD` — that
didn't work, and here's why): the bug is **already committed and pushed to
`origin/main`**, not just sitting in the uncommitted stash.

Trace:
- Commit `8c6cfa5` ("feat(studio): surface masterclass production timeline")
  first added `hours: true` to a Prisma `select` in `lib/tickets/data.postgres.ts`,
  referencing an `AssetType.hours` column that was never added to
  `prisma/schema.prisma`.
- Commit `95258a8` ("revert: restore last known-good deploy after portal-wide
  server error", Aug 31) correctly reverted it after an identical outage.
- Commit `7ee334e` — same title, "feat(studio): surface masterclass production
  timeline" — **reintroduced the identical `hours: true` selects** when the
  feature was redone, again without the schema field ever landing. This commit
  is an ancestor of current `HEAD` (`62a5585`), already on `origin/main`.
- Separately, an *unrelated, unfinished* "asset-type economics" (E11.A) feature
  has been sitting **uncommitted** (now in `git stash@{0}`) since ~Aug 27. It
  adds the real `AssetType.hours`/`importance`/`complexity` schema fields and a
  real migration (`prisma/migrations/0022_asset_type_economics/migration.sql`),
  but per its own PRD's as-built note, was never actually applied/verified
  (`npx prisma generate` / `npm run build` never run clean), and is presently
  broken if committed as-is (`lib/asset-types/repository.ts` is missing
  `updateAssetTypeEconomics`, which only exists in an untracked duplicate file
  `lib/asset-types/repository 2.ts` that `app/settings/asset-types/actions.ts`
  already imports).

So two independent things are true: (1) committed `HEAD` code depends on a
schema field that was never committed, which is the actual cause of every
deploy reproducing the identical crash regardless of how many times we
redeploy, and (2) a separate, genuinely-incomplete feature is parked in the
working tree and must not accidentally get swept into a future deploy.

The current working tree is clean (matches `HEAD`); the WIP economics feature
is safely in `git stash@{0}` (stash message: "WIP asset-type economics,
stashed again to redeploy clean HEAD (retry, prior deploy apparently didn't
take)"). Nothing has been lost.

**Confirmed with the user:** (a) OK to push a fix directly to `main` (the
previously-approved "empty commit + push" is superseded by a real code fix +
push — same production-push consent, better mechanism, since an empty commit
of the current broken `HEAD` would not have fixed anything); (b) the stashed
WIP should be parked on its own branch **and cleaned up** (reconcile the
duplicate repository file, remove duplicate plan/PRD files) rather than left
loose in `main`'s working tree, where it's now caused three outages.

## Part 1 — Immediate fix: unbreak login

Edit `lib/tickets/data.postgres.ts` (mirroring exactly what the earlier
successful revert `95258a8` did, since the same bug is back):

- Remove `hours: true` from the two `assetType: { select: {...} } }` blocks
  (`TICKET_INCLUDE`, used by queue/listing queries, ~line 66; and the
  `assetType.select` inside `getTicketDetail`, ~line 374).
- Change the two `assetHours: t.assetType?.hours ?? null` assignments (~line
  133 and ~line 437) to a hardcoded `assetHours: null` — this exactly matches
  the placeholder pattern `lib/tickets/data.airtable.ts` already uses for the
  same field (`assetHours: null` at its two equivalent spots), so both backends
  stay behaviorally consistent.
- Change `underQuoted: t.underQuoted` / `underQuotedNote: t.underQuotedNote`
  (~line 134 and ~line 438-439) to hardcoded `underQuoted: false` /
  `underQuotedNote: null`. These don't currently throw (Prisma silently returns
  `undefined` for a column that isn't in the schema, since it's not an explicit
  `select`), but they're the same latent bug and worth fixing alongside for
  correctness — also matches `data.airtable.ts`'s existing `underQuoted: false`
  placeholder.
- Add a one-line comment at each spot: `// Pending E11.A migration — see
  lib/asset-types (stashed WIP). Revert to real values once that lands.` so
  this is easy to find and undo later.

No other files need changes — `app/stakeholder/[id]/page.tsx` (the only UI
consumer of `assetHours`/`underQuoted`/`underQuotedNote`) already handles
`null`/`false` gracefully (that's exactly what it renders today via the
Airtable backend).

**Commit and deploy:**
```
git add lib/tickets/data.postgres.ts
git commit -m "fix(tickets): stop selecting AssetType.hours — field was never migrated

Second occurrence of the bug 95258a8 reverted once already: the studio
timeline feature (7ee334e) reintroduced a select on AssetType.hours, which
only exists in the still-unfinished, uncommitted E11.A economics feature.
Every deploy from HEAD reproduces PrismaClientValidationError on login.
Placeholder null/false matches what data.airtable.ts already returns."
git push origin main
```
This is a genuinely different commit SHA with genuinely different (correct)
code — it doesn't depend on figuring out whether Kessel's documented
same-SHA no-op behavior ([[kessel-env-needs-new-commit]] memory) was in play.

**Verify:**
- Watch `kessel runtime-logs --since 5m` (background it and kill after ~12s —
  the CLI's own streaming hangs in this non-interactive shell) for a fresh
  cold-boot (`✓ Starting...` / `✓ Ready in Xs`) with no
  `PrismaClientValidationError` afterward.
- Ask the user to actually try logging in — that's the only fully conclusive
  test, since the crash only reproduces on an authenticated request and we
  have no way to simulate Google OAuth from this session.

## Part 2 — Park and clean up the E11.A economics WIP

Currently in `git stash@{0}`. Move it to its own branch instead of leaving it
loose (this is the third time work sitting uncommitted in this working
directory has caused a production incident).

1. `git stash branch feat/asset-type-economics stash@{0}` — creates the branch
   from current `main`, applies the stash onto it, and drops the stash entry
   automatically on success. Working tree on `main` goes back to clean
   afterward (don't switch back to `main` until cleanup below is committed on
   the new branch).
2. On `feat/asset-type-economics`, reconcile the duplicate file: diff
   `lib/asset-types/repository.ts` against `lib/asset-types/repository 2.ts`
   and merge the missing pieces (`updateAssetTypeEconomics` and the
   `hours`/`importance`/`complexity` fields on `AssetTypeDnaRow` and both
   select branches) into `lib/asset-types/repository.ts`, then delete
   `lib/asset-types/repository 2.ts`.
3. Delete the duplicate plan/PRD files: `plans/idempotent-tickling-emerson
   2.md` (byte-identical to `plans/idempotent-tickling-emerson.md`) and
   `prd/content-production-management/prioritisation-content-engine/asset-type-economics
   2.md` (byte-identical to `asset-type-economics.md`).
4. Run `npx prisma generate` and `npm run build` locally against the merged
   schema to confirm it actually compiles clean — this was never done before
   the WIP started causing outages, per the PRD's own as-built caveat.
5. Commit the reconciled feature on the branch with a message noting it's
   still unmerged/unmigrated: schema + migration + repository code all land
   together, but `prisma/migrations/0022_asset_type_economics/migration.sql`
   still needs `kessel db migrate` run against production before this can ever
   be merged to `main` — flag that as a follow-up decision for the user, not
   something to do in this session.
6. Push the branch (`git push -u origin feat/asset-type-economics`) so it's
   backed up remotely, not just local.
7. Confirm `git status` / `git stash list` on `main` afterward: working tree
   clean, no stash entries left.

## Part 3 — Update project memory

Two existing memory files need correction/extension once the fix lands:

- `kessel-manual-deploy-vs-git-autodeploy.md`: add a note that the Sep 1
  recurrence's *actual* cause was different from the Aug 31 one it
  documents — a committed-and-pushed regression (7ee334e reintroducing
  95258a8's already-reverted bug), not a manual dirty-tree deploy. The
  manual-deploy risk is still real and still documented, just wasn't the
  cause this time.
- Add a new memory (or fold into the same one) capturing the general lesson:
  when a revert like `95258a8` removes a feature "because its schema
  dependency isn't there yet," a later re-implementation of that same feature
  must check whether the dependency landed before reintroducing the same
  fields — otherwise the exact same outage recurs. This has now happened
  twice for the same `AssetType.hours` field.

## Verification

1. After Part 1's push, confirm via runtime logs + an actual login attempt
   that the crash is gone.
2. `npx prisma generate && npm run build` on `main` post-fix, to catch any
   other latent references to not-yet-migrated fields before they ship (this
   codebase evidently doesn't fail its build on this class of Prisma
   type-mismatch today — worth a quick manual check here since we can't fully
   explain why `next build` let `7ee334e` through in the first place).
3. On `feat/asset-type-economics`, `npx prisma generate && npm run build`
   clean is the bar for "actually done" before anyone considers merging it —
   don't merge in this session.
