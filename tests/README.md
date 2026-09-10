# Verification suites

No test runner is configured. These are plain `tsx` scripts that assert against **real record
shapes captured from the live bases**, print `ok` / `FAIL` lines, and exit non-zero on failure.

They lived in a session scratchpad until 10 Sep, which meant the only tests in the repo were one
`rm -rf` from gone. Moved here so they survive.

```bash
npm run verify          # tests/offline — no database, no network, no token
npm run verify:db       # tests/db — needs a reachable Postgres (see below)
```

## `tests/offline/` — pure

Assert against fixtures, so they run anywhere. What each one holds the line on:

| Suite | Guards |
|---|---|
| `verify-calendar` | The week reader: lane separation, the coverage rule, empty states, no borrowed messages |
| `verify-derive` | Week derivation from linked dates, the `Mindalley` typo, the jammed `MV: … VL: …` record |
| `verify-smart` | One headline object (never an array) and the three target provenances |
| `verify-tags` | Hootsuite campaign-tag extraction from the stored Perch payload |

**Fixtures are verbatim, not invented.** Every record in them was copied from a live API response
with its real ids and field shapes — including the awkward ones (`test`, `vcvdsv`, the goal that
changes mid-week, `MV: Be Extraordinary VL: Podcast - Naveen Jain`). A fixture that tidied those up
would test a base we do not have.

## `tests/db/` — needs Postgres

`DATABASE_URL` must point at a scratch database with the migrations applied. Production is
reachable **only** via `kessel db`, so never point these at it — they write.

## The limit worth knowing

These test **shapes**, not **selection**. On 10 Sep the calendar reader passed all 24 offline
checks and still shipped three defects on its first live run, because every one of them was about
choosing between multiple real rows — two messages in a week, a goal that changes mid-week, a
message linked from outside the week — and each fixture had only one of each. The fixtures now
carry the plural cases. **Run the surface against the live API before deploying it**; that is what
caught them.
