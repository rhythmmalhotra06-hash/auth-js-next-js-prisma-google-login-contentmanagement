# Weekly MOW figure ingest — scheduled agent instructions

Run **Sunday night, Kuala Lumpur time**, before the Monday 08:00 MYT meeting.

This is decision **S6**: the deployed app cannot call a claude.ai connector, so a scheduled Claude
agent runs with the Metabase connector attached, pulls the week's figures, and POSTs them to the
app. When IT delivers `METABASE_URL` and an API key, `lib/metabase/client.ts` replaces this and the
page never changes — `source` records which path produced the figure.

---

## The four guards. Do not skip any of them.

Each was verified against live data on 10 Sep 2026, and the first alone is the difference between
a correct number and one that is **74× too large**.

### 1. Question 32044 is NOT filtered to organic social. Filter it yourself.

It returns every channel. Measured for w/c 7 Sep:

| | |
|---|---|
| As the question returns it | **$504,747.91** — Paid Social, Email, App, Paid Search, Affiliate… |
| `unified_traffic_channel == 'Organic Social'` | **$6,854.74** |

Nothing in the question's name or output warns you. Glen's rule is *"organic social ONLY — not
App, Email or Paid"*, and reporting the unfiltered figure overstates this team's contribution by
98.6%.

Question **31846** (leads) *is* already filtered — every row carries `Organic Social` — so leads
need no channel filter. Do not "fix" what is already correct.

### 2. Sum `DISTINCT order_id`, never rows.

`fact_sales_order` joined to `fact_sales_attribution` can emit several rows per order. Counting
them has inflated figures twice before, once by $6,261 and once enough to flip a year-on-year sign.
In the 10 Sep sample the join happened to be clean — that is not a reason to drop the rule.

### 3. Check for truncation before you report anything.

Both questions cap at **10,000 rows** and sort **descending by timestamp**. That means the cap
bites the *oldest* rows and the current week is usually complete — but only usually.

**Before reporting, confirm the earliest returned timestamp is BEFORE the Monday of the target
week.** If it is not, the week is truncated and the figure is too low. Say so and report nothing
rather than posting a number that is quietly wrong.

Room as measured on 10 Sep: revenue returned 10,000 rows across 11 days (~900/day), so a single
week is ~6,300 — comfortable, but not guaranteed during a launch.

### 4. Always name the brand. `brands` is not optional in practice.

Question 31846 is **Mindvalley's** lead funnel and 32044 is Mindvalley's revenue. Neither is split
by brand. Omitting `brands` applies the same figure to *every* brand in the week, which silently
credits Vishen's brand with Mindvalley's leads — the pack then shows the identical number twice
under two different names.

Post `"brands": ["MV"]`. Vishen's lane gets a figure only when there is a genuinely separate one;
until then his card correctly shows no number rather than a borrowed one.

---

## Never

- **Question 31815.** Same collection, plausible name. It filters on the *first lead's*
  `traffic_channel` rather than the order's: returns $80,076 where 32044 returns $422,722, and $0
  for a campaign that converted 16 times.
- **Summing the two revenue reports.** They overlap.
- **Braze figures in the headline.** Braze is "engaged revenue" and is labelled as such (S5).
- **Writing prose.** Post figures only. The AI never narrates a number — that was Glen's condition,
  and the learnings on the page are written by people.

---

## Post it

```bash
curl -X POST "$APP_URL/api/mow/metrics/ingest" \
  -H "Authorization: Bearer $SYNC_SECRET" \
  -H 'content-type: application/json' \
  -d '{
        "weekOf": "2026-09-14",
        "source": "session:metabase",
        "brands": ["MV"],
        "figures": { "leads": 883, "revenue": 6854.74 }
      }'
```

`weekOf` is any date in the target week; it is normalised to the Monday.

The route is **safe to re-run**: it writes `smartNumberStaged` only, and refuses to touch a week a
human has already committed (`skippedCommitted` in the response). A partial payload leaves the
other figure alone rather than blanking it.

### Reading the response

```json
{ "ok": true, "weekStart": "2026-09-14", "updated": ["MV"],
  "skippedCommitted": [], "missingFigure": [] }
```

- `updated` empty and `skippedCommitted` populated → the week was already committed. Correct, not
  an error.
- **404 "No MOW week for …"** → nobody has opened `/performance/week` for that week yet, so the row
  does not exist. Loading the page creates it (`ensureWeek`). Open it and retry.
- `missingFigure: ["MV:leads"]` → that brand's headline metric was not in your payload.

---

## Sanity check before posting

Compare against Glen's own curated report for the same week. **If they disagree, the query is
wrong, not the report.** He has been producing these by hand for months; treat his number as the
reference until yours has agreed with his several weeks running.
