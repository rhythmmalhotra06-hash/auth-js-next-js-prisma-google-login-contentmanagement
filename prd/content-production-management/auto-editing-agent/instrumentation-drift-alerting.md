---
title: 'Instrumentation & Drift Alerting'
slug: 'instrumentation-drift-alerting'
scope: feature
status: discovery
parent: content-production-management/auto-editing-agent.md
children: []
created: 2026-06-30
updated: 2026-08-31
resolution: 6/7
---

# E12.4 · Instrumentation & Drift Alerting

> Part of [E12 · Transcript-Based Auto-Editing Agent](../auto-editing-agent.md)

## Purpose

The launch gate and the top failure mode are the same coin: **first-pass acceptance rate** is both
how the epic measures success and how it detects the agent quietly drifting off-brand at scale.
This feature owns that measurement, the rejection taxonomy that keeps it honest, and the
alert/escalation path when it drops.

## Behavior

**Measurement window:** acceptance rate is tracked **per pilot asset type, since the last DNA
update** — every DNA change resets the baseline so the agent is always measured against current
rules, and drift is isolated per type rather than blurred into one average.

**Headline outcome, reported as two separate numbers, never conflated:**
- **Source-uploaded → draft-ready** — pure agent performance ([E12.1](edl-brain-service.md) +
  [E12.2](uxp-executor.md)), fully in the agent's control.
- **Source-uploaded → shippable** — the full human-in-loop pipeline; honest end-to-end, and exposes
  when review staffing (not the agent) is the constraint.

## Rules & Logic

**Gate threshold:** the agent may not serve Vishen-owned (high-risk) channels until it clears
**~70%** first-pass acceptance on that tier (early/learning bar; ratchets up monthly). Lower-risk
channels may run at a looser bar while the agent learns, since their review is lighter and the
blast radius smaller.

## Data

**Rejection taxonomy** — what counts against this agent vs. what routes elsewhere:
- **Real rejects (count against the agent):** reframe/crop fixes, caption position/timing fixes,
  audio/grade fixes — execution the agent owns.
- **Not a reject (does NOT count against the agent):** swapping which moment was cut — that's
  moment-selection, E8's job, routed to E8's feedback loop as a separate signal.

**Instrumentation events logged per clip:** first-pass acceptance result and reject reason (from
the taxonomy above); time-to-draft and time-to-shippable; drift signal per asset type. Sink:
Airtable (events) + Slack (alerts).

## Failure Modes

**Silent off-brand drift at scale (TOP risk).** The agent fails quietly and consistently, not
loudly — and because it's fast, it can ship dozens of subtly-wrong clips (shifted brand yellow,
stale safe areas) before anyone notices. **Mitigation:** first-pass acceptance rate is the drift
detector, reset at each DNA update. On a downward signal the system **alerts a human (Slack DM to
owner + channel post) and keeps running** — the alert carries an SLA (below) so "keep running"
never means "drift unnoticed." Auto-pause/circuit-breaker is a v2 candidate once the baseline is
trusted.

**Review queue floods.** High draft volume could swamp the reviewer and recreate the bottleneck
downstream. **Mitigation:** risk-tiered review (low-risk = glance-and-go) and the two time metrics
above expose whether review, not the agent, is the constraint. Throughput caps/batching are a v2
lever if needed.

## Acceptance Criteria

**First-pass acceptance rate** is defined as the share of agent drafts a human commits with **no
real reject**, per the rejection taxonomy in Data above.

**Gate:** the ~70% threshold on Vishen-owned channels (see Rules & Logic) is what actually blocks
or unblocks E12.5 and any high-risk rollout — this is the mechanical definition behind the epic's
Success Criteria, not a separate bar.

**Ownership & escalation:**
- **Owner (v1, pilot phase):** Rhythm Malhotra, as system owner, until the agent stabilizes.
- **Owner (post-launch):** **Titus** (confirmed 2026-08-31) — supersedes the original "hand off to
  a creative lead later" placeholder.
- **Drift alert routing:** Slack DM to owner **plus** a post in the creatives channel.
- **Escalation SLA:** owner has **24 hours** to act on a drift alert; if not, it escalates. This
  gives "alert, keep running" real teeth so silent scale-drift — the top failure mode — cannot
  persist unowned.

[UNRESOLVED] The escalation target was originally **Gareth**, set when Rhythm was the sole named
owner during the pilot. Now that ownership hands to Titus post-launch, is the escalation path
still Rhythm (pilot) → Gareth, then Titus (post-launch) → Gareth? Or does Titus's own escalation
go elsewhere (e.g. back to Rhythm, or to Vishen directly given it's his channels at risk)? Not
re-confirmed since the 2026-08-31 ownership decision. **Reviewed 2026-08-31: deliberately left
open** — to be raised with Titus/Gareth directly, not guessed at here.

## Open Questions

- **v2 levers** — auto-pause circuit-breaker once the baseline is trusted; review-throughput
  caps/batching if the queue floods. Neither is scoped for v1.
