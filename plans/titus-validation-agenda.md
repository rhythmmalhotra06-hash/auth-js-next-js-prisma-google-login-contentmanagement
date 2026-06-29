# Titus 1:1 — Ads & Pathway-Organic Queue Validation

> Pre-filled from the live Video Base `appDZnMnJGehbSOo5` (pulled 2026-06-29).
> Most form/taxonomy items are now **confirm**, not **discover**. One real
> discrepancy with our spec is flagged 🔴.

## What the live base already shows (so we confirm, not ask)

The team **already built the consolidated intake model** on Jun 24:
`Ads Creatives & Pathway Organic [Jun 24 2026]` (`tblJDelzKgtZxkfea`) merges the
two legacy variant tables and pulls the read-only lookups exactly as our spec
wants — **Event Type, Team Lead, Preferred Editors, Dimensions, Team/Service
Level all lookup from the linked Asset Type**. So the Event→Asset→lookup chain
is validated against real structure.

Legacy variant tables still live:
- `VIDEOS - Ads Creatives [Active]` (`tblfijc416d0HZCfg`)
- `VIDEOS - Pathway Organic [Active - July 2026 posts onwards]` (`tbl75tcwlzWa6pu1B`)

---

## 🔴 Discrepancy to settle — "Pathway" vs "Social Media Promotion"

Our spec (CLAUDE.md / decision-log) says: *for pathway/organic, Event Type =
"Social Media Promotion", but a **literal "Pathway" event type also exists**.*

**Live data contradicts the second half.** In the Asset Type table there is an
asset type `Video - Pathway Organic` whose Event Type = `👥 Social Media
Promotion`, Team = Social Media, preferred editor Yuthika Peiris. **No literal
"Pathway" event type appears anywhere in the Asset Type Event Type values.**

→ **Ask Titus:** Is "Pathway" as a standalone Event Type dead/never-existed, or
does it live in a different base (Prio `appFEFygXo2pRc8AR`)? If it's gone, we
drop it from the intake taxonomy and treat pathway-organic purely as the
`Social Media Promotion` event type + `Pathway Organic` asset type.

---

## 🟡 Confirm (live answer in hand — just verify it's current)

**1. The two form variants — structural difference is real, confirm it's intended**
- Pathway Organic is **vertical-only**: the table carries only `9x16 Folder` /
  `9x16 Final Link`. Ads Creatives carries `4x5` + `9x16` + `16x9`.
  → Confirm: do pathway-organic requests ever need 4x5/16x9, or is 9x16-only
  the rule we enforce at intake?
- Ads Creatives `Video Type` options: VSL Leads, Short Ads, VSL, Ad Hooks,
  Masterclass, Consolidated Files, Close or CTA, Direct to Sales.
  → Confirm this is the live funnel-asset set.

**2. Event Types per queue (from live Asset Type records)**
- **Ad Creatives** asset types map to funnel event types: `📺 VSL Funnel`,
  `📧 Masterclass Funnel`, `📺 New Masterclass Video`, `📺 VSL Video`.
- **Pathway/Social** asset types nearly all map to `👥 Social Media Promotion`.
  → Confirm these are the right event-type buckets to filter the asset list on.

**3. Asset Type metadata that feeds scoring is already populated**
- Every asset type has **Importance (1–5)**, **Complexity (1–5)**, and **Hours**
  (e.g. VSL = 96h, Quest = 200h, Quote reel = 2h, Pathway Organic exists).
  → Confirm Importance/Complexity/Hours are trustworthy enough to seed the
  scoring weights, or are they placeholders?

**4. Preferred-editor auto-fill works — confirm the names**
- Ad Creatives → Marwah Al-Attraqchi (VSL/Short Ads/Hooks), Prashanth K.
  Palanival (Masterclass), Titus Thana Raj (Close or CTA - MC).
- Pathway Organic → Yuthika Peiris. Social/Content → Paul Hanna, Kuhan
  Kunasegaran, Mildred Michael, Jason Roper, Nadir Salam, Prashant P. Purana
  Vellu.
  → Confirm these preferred-editor assignments are current.

**5. Team / Service-Level taxonomy**
- Teams: **Content · Social Media · Ad Creatives**.
- Team/Service Level: Content Video · Ad Creatives Video · Social Media Video ·
  Event Design Graphic · Brand Design Graphic.
- Type of Asset: **Digital | Print** (matches our digital/print decision).
  → Confirm these three teams own the asset types as modeled.

---

## 🟡 Status enums — reconcile THREE competing sets (Titus to pick the canonical one)

This is the live mess to resolve. The status values differ across tables:

| Table | Status field | Values |
|---|---|---|
| New merged (`tblJDelzKgtZxkfea`) | **Ticket Status** | Backlog · To Do · In Progress · Review · In Revision · Approved · Shipping · Done · Won't Do · Request on Hold |
| Ads Creatives (legacy) | Video Status | Placeholder · Backlog · In Progress · Review · Adaptation · Video Done · Request on Hold |
| Pathway Organic (legacy) | Video Status | Backlog · In Progress · Review · Review Given · In Revision · Video Done · Request on Hold |

→ **Ask Titus:** the new merged table's **Ticket Status** looks like the
intended canonical editor lifecycle. Confirm it's the one to build against, and
that it maps cleanly to our state machine (Requested→…→Published). Note it mixes
editor states (In Progress/Review/In Revision) with manager/output states
(Approved/Shipping) — does he want them split into our two axes
(`ticket_status` vs `prio_status`), or kept as one field?

---

## 🟢 Still genuinely open — needs Titus/Moniek judgement (no live answer)

**6. Campaign-window priority** *(also Moniek)* — pathway-organic/social priority
"depends on campaign window." The Pathway table has `Month of Posting` /
`Year of Posting` fields — is *that* the campaign window we should score against
(urgency rises as posting month approaches)? Confirm.

**7. Event-tier ranking** *(Moniek owns; Titus validates)* — where do the funnel
event types (VSL/Masterclass) and Social Media Promotion sit vs Mastery/Summit
tiers? The Asset Type table has Importance ratings but not an event-tier order.

**8. Auto-routing rules (~20–30%)** — preferred editor is already on every asset
type, so most assignment could auto-fill. Which queues does Titus want truly
auto-assigned vs. left for manual confirmation?

**9. Capacity signal** — what does Titus use to judge editor load for
reassignment (active ticket count? the Hours estimate summed per editor?).
