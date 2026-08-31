---
title: 'Transcript-Based Auto-Editing Agent'
slug: 'auto-editing-agent'
scope: epic
status: discovery
parent: content-production-management.md
children:
  - content-production-management/auto-editing-agent/edl-brain-service.md
  - content-production-management/auto-editing-agent/uxp-executor.md
  - content-production-management/auto-editing-agent/dna-pilot-selection.md
  - content-production-management/auto-editing-agent/instrumentation-drift-alerting.md
  - content-production-management/auto-editing-agent/portal-integration.md
  - content-production-management/auto-editing-agent/technical-design.md
created: 2026-06-30
updated: 2026-08-31
resolution: 6/7
imported-from: "AutoEditingAgent (3).zip (auto-editing-agent.md, auto-editing-agent-techdesign.md) — originally imported-from Gareth___Rhythm_-_2026_06_30_15_30_IST_-_Notes_by_Gemini.docx"
---

# E12 · Transcript-Based Auto-Editing Agent

> Part of [Mindvalley Content Production & Management System](../content-production-management.md)

> **Restructured 2026-08-31:** imported as a single flat feature doc, resolved 7/7 with no
> `[UNRESOLVED]` markers. Re-examined against the discovery protocol and split into an epic —
> it bundles four separable workstreams (brain, executor, DNA/pilot rollout, instrumentation) plus
> a deferred portal integration, matching the shape of E8 more than a single feature. Splitting
> also surfaced one real gap the flat "resolved" label had papered over: reviewer identity across
> risk tiers (see User Stories). Content below is preserved from the original almost verbatim
> per discovery-import convention; only the structure and the Ownership note changed.

## Purpose

The team turns long-form source media (stage talks, summit recordings, podcasts, YouTube
episodes) into short-form vertical clips for social. Today a finished, ship-ready vertical clip
takes an editor **1–2 hours** end to end — finding the moment, cutting, reframing landscape to
9:16, captioning, brand-styling — and the bottleneck is the *whole* pipeline, not one step. Worse,
much of that effort is wasted: when 10 reels are cut from a stage talk, Vishen may approve only
five, so roughly half the human editing time is spent on assets that never ship.

The clip engine (E8) already solves *which* moments to cut (timestamps, hooks, captions,
rationale). The unsolved gap is **execution**: turning an approved suggestion into a finished,
on-brand vertical cut still needs a human in the timeline. This epic is an agent that performs the
actual edit — transcript-based editing driven by Claude inside Adobe Premiere (a one-time-purchase
plugin Gareth is acquiring to test), the way Descript does transcript editing but inside the
team's existing Premiere workflow.

The payoff: collapse the 1–2 hour timeline-to-draft step toward near-zero so an editor's output is
governed by review capacity, not editing capacity. Because the agent does the cutting, rejected
clips cost no human time — there is "no skin in the game" on the ones Vishen doesn't pick. This is
the video-side equivalent of the speed jump the copy team captured from LLMs, which the video and
design teams have not yet realized.

This is explicitly **not** a moment-selection tool (that is E8, the clip engine) and **not** an
auto-publisher. It is an execution agent under a propose-only contract: the agent proposes a
finished cut, a human commits it.

> **Build decision (v1):** the agent must perform the edit end-to-end. A fast
> "approve-suggestion → templated auto-render" shortcut was explicitly rejected — the bet is that a
> true editing agent can reach a quality bar high enough that human review time *falls* over time,
> which a static template cannot do.

## User Stories

**Editor (today's baseline; the person this is built to free up).** As an editor, I spend 1–2
hours per finished clip on reframe/caption/grade work, and half of what I cut never ships because
Vishen only approves some of what's proposed — I want the agent to absorb the execution step so my
time only goes to work that actually ships.

**Reviewer, risk-tiered by destination channel.** As a reviewer, my review depth is keyed to the
**destination channel**, a field the system reads directly (not a human judgment): drafts bound
for **Vishen-owned channels are high-risk** and get a full scrub; other channels scale down toward
glance-and-go. [UNRESOLVED] The doc never pins down whether "reviewer" is the same person as the
editor who requested the source clip, or a distinct role (e.g. a team lead doing the full scrub on
Vishen-owned channels while the original requester just skims their own lower-risk work). This
matters for the Purpose claim above: if the reviewer is always the original editor, the "1–2 hours
collapses to near-zero" framing partly trades editing time for review time rather than eliminating
it, especially on the high-risk tier's full scrub. Needs a direct answer, not an inference.
**Reviewed 2026-08-31: deliberately left open**, not overlooked — genuinely undecided pending
E12.3's pilot asset-type selection, which may make the reviewer role obvious per type.

**Founder (Vishen).** As the founder, my channels carry the highest brand risk, so I want the
agent barred from serving my channels until it's proven — clear a ~70% first-pass acceptance bar
first (see Success Criteria) — rather than learning on my audience.

**System owner, phased.** As the v1 owner, **Rhythm Malhotra** runs this until the agent
stabilizes past the pilot. **Post-launch, ownership hands to Titus** (confirmed 2026-08-31,
supersedes the original "hand off to a creative lead later" placeholder). [UNRESOLVED] The
original drift-alert escalation path (owner has 24h, else escalate to Gareth) predates this
handoff — once Titus owns it, does drift still escalate to Gareth, or to someone else? Not yet
re-confirmed. **Reviewed 2026-08-31: deliberately left open** — to be raised with Titus/Gareth
directly before it matters in practice, not guessed at here.

**Pilot selectors (Gareth, Titus).** As the people running the DNA audit, we pick which 2–3 asset
types the agent builds against first — the set should span the risk spectrum, including at least
one Vishen-owned type, so the pilot actually exercises the high-risk gate rather than only easy
cases.

## Workflows

**Core flow:**

1. A long-form source (stage talk, summit, podcast, YouTube episode) and its transcript are
   brought into Premiere.
2. E8's identified clips (timestamps, hooks, captions, rationale) are handed to the Claude agent —
   piped directly from the existing clip generator where possible, pasted otherwise.
3. The agent is instructed to produce the cuts (e.g. "create 10 versions") under the asset type's
   standing editing rules (see DNA in Dependencies/E12.3): reframe to 9:16 with the active speaker
   centred, captions in the correct brand font/position, text inside current Instagram/TikTok safe
   areas.
4. The agent returns **draft** clips to a human review queue. It never publishes.
5. A human reviews each draft against the asset type's DNA and commits the ones that pass.
   Rejected drafts cost no further human time.

**Risk-tiered review.** Review depth is keyed to the destination channel (Vishen-owned = high-risk
= full scrub; other channels scale toward glance-and-go). The tier determines both the review
effort and the acceptance gate the agent must clear before it is allowed to serve that tier.

**Two-AI separation of concerns.** E8 (the clip engine) owns *moment selection*; this agent owns
*execution* (reframe, captions, audio/grade). Each is measured only on its own job — E8 on whether
the right moment was chosen, this agent on whether the cut of that moment is on-brand and
technically clean (see E12.4's rejection taxonomy, which explicitly routes moment-selection
rejects back to E8's feedback loop rather than counting them here).

**Portal integration target (post-standalone-proof, E12.5).** Surface in the content studio
portal: editors see clips linked to a source, raise a ticket from a clip, and a checkbox on the
ticket ("send to agent for editing") dispatches to the agent via MCP; the agent edits and returns
raw files into the review queue. Built **only after** the agent clears its acceptance gate
standalone (see Success Criteria).

## Boundaries

**In scope:** the execution step for clips already selected by E8 — reframe to 9:16, captioning to
brand spec, audio/grade QC — for a pilot set of 2–3 asset types, running as an editor-assist agent
inside Premiere (not a headless render farm in v1).

**Explicitly out of scope:**
- **Moment selection.** That's E8's job. If the wrong moment was cut, it's E8's miss, routed to
  E8's feedback loop — never counted against this agent (see E12.4's rejection taxonomy).
- **Auto-publishing.** The agent proposes; a human always commits. Non-negotiable, consistent with
  the wider system's propose-only contract — a human lens is required for what a transcript can't
  convey (delivery, tone, sarcasm, emotional quality).
- **A templated auto-render shortcut.** Explicitly rejected as a v1 alternative (see Purpose).
- **Headless/server-side batch rendering in v1.** Render happens locally inside the editor's
  Premiere; throughput is bounded by editor-workstation availability. A headless ffmpeg renderer
  is a v2 path that reuses the same EDL contract (see E12.1/technical design), not a v1 concern.
- **Portal integration before the standalone gate clears.** E12.5 is explicitly sequenced last.

## Dependencies

**Hard blockers, owned by people not code:**
- **DNA records for pilot asset types (Gareth/Titus)** — not yet built; the ~54–98 creative asset
  types are mid-audit. v1 builds against 2–3 pilot types with DNA ready first rather than blocking
  on the full audit — see E12.3. Gareth/Titus select the pilot set; guidance: span the risk
  spectrum, ≥1 Vishen-owned, so the pilot exercises the high-risk gate.
- **Premiere transcript-editing plugin acquisition & testing (Gareth)** — a one-time-purchase
  plugin Gareth is acquiring to test; the tool that actually drives the edit in v1 (named plugin vs
  Descript vs custom Claude/MCP build) is resolved via Gareth + Jason's side project, not decided
  yet.
- **Claude-integrations side project (Gareth + Jason)** — resolves the v1 render-driving tool
  choice and the MCP contract for portal dispatch (E12.5).

**Built and shipped, depended on:**
- E8, the AI Content Clipping Engine — this agent consumes E8's clip suggestions (timestamps,
  hooks, captions, rationale) as its primary input; it does not re-select moments.
- The clip-engine base prompt in the clip-rules Airtable table — the starting point for DNA's
  natural-language layer (see E12.3). Gareth estimates ~10% improvement available from adding
  granular editing detail; not yet done.

**External:** none named beyond the above; MCP contract details (payload, auth, return path,
large-file/timeout handling) are explicitly deferred to Rhythm + Jason at build time (E12.5).

## Success Criteria

**Launch gate (primary metric): first-pass acceptance rate** — the share of agent drafts a human
commits with no real reject (execution fixes only; moment-selection swaps don't count against this
agent — see E12.4 for the full rejection taxonomy and measurement definition).

**Gate threshold:** the agent may not serve Vishen-owned (high-risk) channels until it clears
**~70%** first-pass acceptance on that tier (early/learning bar, ratchets up monthly). Lower-risk
channels may run at a looser bar while the agent learns.

**Baseline to beat:** 1–2 hours per finished clip today.

**v1 is a success at 90 days if:** first-pass acceptance clears the gate on at least one
Vishen-owned pilot type, **and** source-uploaded→draft-ready time is a step-change below the
manual baseline, **with** source-uploaded→shippable trending down as review tiers settle. These
are two separate numbers, deliberately never conflated (see E12.4) — the first is pure agent
performance, the second is the honest full human-in-loop pipeline and exposes whether review
staffing, not the agent, is the constraint.

## Features

Five workstreams plus a companion technical design. Only the sequencing is fixed by dependency;
depth of resolution varies per child (see each file's own resolution count).

| # | Feature | Purpose | Status |
|---|---|---|---|
| **E12.1** | [EDL Brain Service](auto-editing-agent/edl-brain-service.md) | The Claude Code agent that decides the edit — reads DNA, slices transcript, calls Claude per clip, emits an Edit Decision List (EDL) | Child PRD created |
| **E12.2** | [UXP Executor](auto-editing-agent/uxp-executor.md) | The Premiere UXP plugin that applies an EDL — builds the sequence, reframes, captions, exports the draft | Child PRD created |
| **E12.3** | [DNA Records & Pilot Selection](auto-editing-agent/dna-pilot-selection.md) | Per-asset-type DNA (structured fields + brief + gold reference) for the 2–3 pilot types that unblock v1 | Child PRD created |
| **E12.4** | [Instrumentation & Drift Alerting](auto-editing-agent/instrumentation-drift-alerting.md) | First-pass acceptance measurement, rejection taxonomy, the two headline time metrics, and the drift-alert/escalation path | Child PRD created |
| **E12.5** | [Portal Integration](auto-editing-agent/portal-integration.md) | Ticket checkbox → MCP dispatch → agent → review queue. Explicitly deferred until E12.1–E12.4 clear the standalone acceptance gate | Child PRD created — deferred |
| — | [Technical Design](auto-editing-agent/technical-design.md) | Companion architecture doc: brain/executor split, EDL contract, build sequence | Reference (not a build unit) |

**Dependency order:** E12.3 (pilot DNA) and E12.1 (brain) can start in parallel once pilot types
are chosen; E12.2 (executor) needs a real EDL from E12.1 to build against; E12.4 instruments all
three from day one (the spike in the technical design's Build Sequence proves the whole chain —
E12.1→E12.2 against one pilot type's DNA — before any of this scales); E12.5 is explicitly last,
gated on the others clearing the acceptance bar.
