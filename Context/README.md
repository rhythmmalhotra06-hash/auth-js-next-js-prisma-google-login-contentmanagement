# Project context for Claude Code

This folder is the context layer for building the Mindvalley Content Production
& Management System (a Blinkwork tool). Read it alongside `CLAUDE.md` (the build
spec) and `schema.sql` (the Postgres data model).

## What's here

```
context/
├── README.md                       ← you are here
├── export-airtable-schema.js       ← RUN FIRST: pulls live schema for all bases
├── prioritization-algorithm.md     ← the urgency×complexity scoring spec + examples
├── intelligence-layer.md           ← the "smarter path": 5 propose-only AI capabilities
├── productization.md               ← how this becomes a reusable Blinkwork app others enable
├── decisions/
│   └── decision-log.md             ← settled decisions (treat as fixed) + open items
├── airtable-schema/                ← (generated) live schema JSON per base
├── brain/                          ← (you add) Brain table names + key fields
└── migration/                      ← (you add) Jira CSV + field mapping
```

## Order of operations

1. **Run `export-airtable-schema.js`** with a token scoped `schema.bases:read`.
   This populates `airtable-schema/` and is the prerequisite for everything —
   it converts every `[VERIFY]` in schema.sql into ground truth.
2. **Reconcile `schema.sql`** against the generated `*.summary.json` files:
   real field names, select-option values, single-vs-multi links.
3. **Read `decisions/decision-log.md`** before making ANY architectural choice.
   These came from three meetings and several were hard-won reversals.
4. **Implement scoring** per `prioritization-algorithm.md` (seed weights, tune
   after one real week).
5. Build in the order in `CLAUDE.md` §11 (reference pull → intake → role views →
   scoring → two-way push last).

## Still owed to this repo (gaps the human must fill)

Checklist — these are NOT inferable; ask before guessing:

- [ ] **Brain base id + table names** (Programs, Quests, Pathways, Events,
      Talent) and the stable key field to link on → `brain/`
- [ ] **Blinkwork embedding model**: auth/SSO, how users map to `employees`,
      iframe vs module, shared component library, deploy pipeline, whether
      Postgres is shared infra or fresh
- [ ] **`.env.example`**: AIRTABLE_TOKEN, DATABASE_URL, connector keys
      (Clarisights, Amplitude, Ahrefs, Slack, Metabase are connected at MV)
- [ ] **Jira export CSV** + Jira→taxonomy field mapping → `migration/`
- [ ] **Event-tier ranking** for urgency (Moniek)
- [ ] **Performance metrics home**: Prio table vs Asset Library (team)
- [ ] **Sanitized meeting transcripts** for decision rationale (3 .docx files)

## Hard constraints to design around

- **Airtable API: ~5 req/sec + monthly caps.** Reference tables exceed 10k
  records. Batch ≤10 records/write, exponential backoff on 429. This is WHY the
  app reads from Postgres, not Airtable directly.
- **Reference data is read-only in the app** — edited in Airtable, synced down.
  Transactional data (tickets/assets/approvals/shoots) is app-primary, pushed
  back.
- **Phase 1 scope fence:** manual-assisted prioritization; auto-assign only the
  ~20–30% unambiguous cases. No predictive capacity, no auto-rebalancing, no
  SLA timers. Don't over-build.

## Working principle

Build first, validate against live data — never theorize from schema alone.
Define the workflow before fitting it to a tool. The three meetings already did
the workflow definition; sections 3–6 of CLAUDE.md and the decision log are the
output. Respect them.

## Architecture note (important)

`CLAUDE.md` + `schema.sql` describe a **standalone** build (Airtable → Postgres
mirror). `productization.md` **supersedes that architecture**: the system is
better built as a **Blinkwork app on the shared brain**, with Airtable as a
connector rather than the system of record. The workflow decisions, the
prioritization algorithm, and all UI mockups stay valid either way — only the
data-home and auth model change. Decide this fork before scaffolding:
standalone (faster, isolated) vs. Blinkwork app (reusable by other entities, and
the intelligence layer comes nearly free on the shared brain).
