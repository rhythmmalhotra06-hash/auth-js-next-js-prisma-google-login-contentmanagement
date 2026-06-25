# Prioritization algorithm spec

> Phase 1. Manual-assisted: the algorithm produces a ranked queue; managers
> reorder it (~5 min/day) and handle reassignment for capacity/leave. The score
> exists to get the order ~80% right so managers only adjust the edges.

## Inputs

Every ticket carries enough taxonomy to score it. **If tags are missing, the
score is wrong** — so intake must enforce event_type, asset_type, and due_date
as required. (Hackathon: missing tags → inaccurate scores → broken queue.)

### Urgency (time + event pressure)
Two components combined:

1. **Due-date proximity** — days until `due_date`.
2. **Event proximity / product-line tier** — how soon and how important the
   linked event is. Mastery-tier events outrank States-tier. Pull tier from the
   event_type → Brain program mapping.

> [CONFIRM with Moniek] the exact tier ranking. Notes indicate roughly:
> Mastery / Summit / MBU (high) > Academy > States (lower). Social Media
> Promotion / Pathway organic priority depends on campaign window.

### Complexity (effort + coordination)
Derived from asset_type. Higher complexity = more effort/coordination, which
*lowers* throughput, so it should *raise* priority only insofar as it needs
earlier scheduling. Treat complexity as a scheduling weight, not a pure
multiplier. Inputs:

- Asset type's typical production effort (e.g. a full VSSL >> a single banner).
- Number of dimensions/variants required (asset_type_dimensions count).
- Whether a shoot is required (linked shoot = more lead time).

## Scoring (Phase 1 — keep it simple and explainable)

```
urgency_score    = w_due * due_proximity_norm + w_event * event_tier_norm
complexity_score = w_effort * effort_norm + w_variants * variants_norm + w_shoot * shoot_flag

priority_score   = urgency_score + lead_time_adjustment(complexity_score)
```

Where `lead_time_adjustment` nudges high-complexity items earlier in the queue
so they don't miss the due date — NOT a raw multiply that lets a trivial urgent
task outrank a critical campaign.

### Normalization
- `due_proximity_norm`: closer = higher. e.g. `max(0, 1 - days_until_due / 30)`.
- `event_tier_norm`: map tier → {1.0, 0.7, 0.4, 0.2}. [CONFIRM tiers.]
- `effort_norm`, `variants_norm`: 0–1 scaled against the busiest asset types.

### Starting weights (tune after one real week — OODA)
```
w_due      = 0.5
w_event    = 0.5
w_effort   = 0.3
w_variants = 0.2
w_shoot    = 0.5   (binary 0/1 flag)
```
> These are seeds, not gospel. Ship, observe the queue for a week, adjust.

### Tie-break
1. Earlier due_date wins.
2. Then higher event tier.
3. Then earliest created_at (FIFO) so nothing starves.

## Manual override (this is the point of Phase 1)
- `priority_score` produces the default order.
- Managers drag to set `queue_rank`; **`queue_rank`, when set, overrides
  `priority_score` for display order.** Editors always pull from the
  manager-confirmed order.
- Auto-assignment applies ONLY to the ~20–30% of cases that are unambiguous
  (a business unit that always routes to one person / preferred_editor set on
  the asset_type). Everything else lands in a manager triage view.

## Worked examples

**A. Masterclass trailer, due in 4 days, needs a shoot, 3 dimensions**
- due_proximity_norm = 1 - 4/30 = 0.87
- event_tier_norm (Mastery) = 1.0
- urgency = 0.5*0.87 + 0.5*1.0 = 0.93
- complexity: effort high (0.9), variants 3 (0.6), shoot=1
  → complexity_score = 0.3*0.9 + 0.2*0.6 + 0.5*1 = 0.89
- lead_time_adjustment(0.89) ≈ +0.15
- **priority_score ≈ 1.08 → top of queue**

**B. States ad banner, due in 12 days, no shoot, 1 dimension**
- due_proximity_norm = 1 - 12/30 = 0.60
- event_tier_norm (States) = 0.4
- urgency = 0.5*0.60 + 0.5*0.4 = 0.50
- complexity: effort low (0.2), variants 1 (0.2), shoot=0
  → complexity_score = 0.3*0.2 + 0.2*0.2 + 0 = 0.10
- lead_time_adjustment(0.10) ≈ +0.02
- **priority_score ≈ 0.52 → mid/lower queue**

**C. Social media promo, due tomorrow, no shoot, 2 dimensions**
- due_proximity_norm = 1 - 1/30 = 0.97
- event_tier_norm (Social, in-window) = 0.7
- urgency = 0.5*0.97 + 0.5*0.7 = 0.84
- complexity low → adjustment small
- **priority_score ≈ 0.87 → high, just below A**

Sanity check: A > C > B, matching intuition (critical campaign with a shoot >
imminent social post > distant low-tier banner). If real-world ordering
disagrees, adjust weights — don't add special cases.

## What NOT to build in Phase 1
- No predictive capacity modeling.
- No auto-rebalancing across editors.
- No SLA timers (queue model replaces SLAs by design).
These are Phase 2 candidates only if the manual queue proves insufficient.
