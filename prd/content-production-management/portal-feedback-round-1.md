---
title: 'Portal Feedback / Usability Round 1'
slug: 'portal-feedback-round-1'
scope: epic
status: discovery
parent: content-production-management.md
children:
  - content-production-management/portal-feedback-round-1/cut-ready-editor-brief.md
  - content-production-management/portal-feedback-round-1/studio-shoot-approvals.md
  - content-production-management/portal-feedback-round-1/team-campaign-visibility.md
  - content-production-management/portal-feedback-round-1/asset-ready-notifications.md
  - content-production-management/portal-feedback-round-1/revenue-campaign-scoring.md
  - content-production-management/portal-feedback-round-1/auto-assign-preferred-editor.md
  - content-production-management/portal-feedback-round-1/asset-type-dna-editor.md
  - content-production-management/portal-feedback-round-1/multi-asset-requests.md
  - content-production-management/portal-feedback-round-1/studio-bento-redesign.md
created: 2026-06-29
updated: 2026-06-29
resolution: 7/7
imported-from: "plans/portal-feedback-jun29.md"
---

# E9 · Portal Feedback / Usability Round 1 (Jun 29)

> Part of [Mindvalley Content Production & Management System](../content-production-management.md)

## Purpose

The Jun 29 "Social Clips Strat/process" meeting (Gareth Winter, Monique van Waaijenburg, Glenn Jason Chittur, Rhythm; with Titus/KJ context) walked the live clip pipeline and the portal end-to-end. The verdict was positive — "this is looking really promising," "already really great" — but the team is still running on "5 Airtables + WhatsApp," and several concrete gaps block real adoption.

This epic is the first **feedback-driven usability round**: it closes the gap between "great demo" and "daily-driver" so the merged Creative Services team can stop living in the Airtable/WhatsApp patchwork and actually run production through the portal. It is deliberately broad rather than deep — the goal is to unblock every role enough to run one real cycle, not to perfect any single surface.

It does not introduce a new product area; it extends existing epics (E3 Intake, E4 Prioritization & Queue, E5 Lifecycle/Views/Approvals, E8 Clipping) with the specific fixes raised in the meeting.

## User Stories

**Users (all three weighted equally this round):**

- **Vishen / Vision (founder, approver).** Wants one place that shows what needs his approval (shoots, clips) and his prioritization queue — and to approve with a tap, not a WhatsApp reply. Propose-only: nothing is produced without his sign-off. "Vision needs requests and approvals; the bit in the middle is our problem."
- **Editors / designers (producers).** Pull a ticket and start cutting with no follow-up questions. Need a download link (e.g. Dropbox), not just a YouTube viewing link, and the verbatim transcript of the segment to cut, plus room to add human craft.
- **Requesters / managers (Glenn, Rama, Titus).** Raise requests, see beyond their own (team and campaign visibility, not gate-kept per person), and get notified when an asset is ready so they can prep thumbnail/copy and publish.

**Stories:**

- As an **editor**, when a clip is converted to a ticket, the brief shows me a download link and the verbatim transcript for the clip's time range, so I can cut without chasing anyone. *(E9.1)*
- As **Vision**, I open one studio view and approve or kill shoot requests there, instead of being pinged on WhatsApp. *(E9.2)*
- As **Glenn**, I switch my requests view to "my team" and see Vidura's requests; as **Rama**, I filter to a campaign and see everything raised for it. *(E9.3)*
- As a **requester**, I get a Slack DM the moment my asset is ready for publishing. *(E9.4)*
- As a **manager**, the queue ranks higher-revenue and campaign-deadline-driven work above low-revenue work automatically. *(E9.5)*
- As a **manager**, the unambiguous tickets (e.g. a VSSL short ad → Marwaq) arrive pre-assigned so I don't hand-route them. *(E9.6)*
- As an **admin / team lead**, I edit the DNA and rules for each asset type from a front-end panel. *(E9.7)*
- As a **requester**, I raise one campaign request and get multiple asset tickets, instead of filing one form per asset. *(E9.8)*

**Anti-users / non-goals:** not a self-publish tool; auto-assignment does not replace the manager's phase-1 manual-assisted review (CLAUDE.md §5) — it only covers the unambiguous single-preferred-editor case. External agencies (Simplex / Talking Heads) are acknowledged but their full onboarding is deferred (see Dependencies / F4).

## Workflows

The round is validated by one real **end-to-end cycle** on real Vision content, fully in-portal:

1. **Intake** — a clip is auto-discovered or a request is filed (single or multi-asset), carrying event type, asset type, dimensions, due date, and (for media) viewing + download links.
2. **Prioritize** — the ticket is scored using revenue tier (event type) + deadline + linked campaign-calendar window + asset difficulty; it lands in the ranked queue.
3. **Assign** — if the asset type has exactly one preferred editor, the ticket is pre-assigned; otherwise the manager assigns it.
4. **Produce** — the editor opens the ticket, sees the download link + verbatim transcript brief, cuts, and drops the asset link.
5. **Approve** — shoots and clips route to Vision's studio view; he approves or sends back, propose-only.
6. **Deliver** — on "ready," the requester gets a Slack DM and publishes; the requester/team/campaign views reflect status throughout.

Each child feature specifies its own step-by-step behavior.

## Boundaries

- Phase-1 **manual-assisted prioritization stays** — managers still confirm order and reassign (CLAUDE.md §5). Auto-assignment is limited to the unambiguous single-preferred-editor case.
- **Notifications are best-effort** — a failed Slack send is logged and never blocks the underlying status write.
- **DNA is app-native** — stored in the Postgres `Dna` model and edited in-portal; this round does NOT attempt to sync the messy free-text Airtable DNA field from the Ads Creative Library base.
- **Visibility is scoped, not open** — default stays "my requests"; team and campaign are opt-in toggles, not a blanket ungate.
- This round is **additive to existing epics** — it must not regress the mandated 5-column header, the propose→approve gate, or the Airtable provenance/sync rules.

## Dependencies

- **F1 — Auto-crawl cron access:** `/api/media/discover` is built but blocked on a Kessel scheduled job + Google OIDC token because the deployed app is IAP-gated (memory `deployed-app-behind-iap`). Needs MLE console access.
- **F2 — Transcription engine:** currently Supadata (~100 credits/mo) + youtubei.js fallback; Monique flagged building a proper engine with tech. Keep the provider interface swappable.
- **F3 — Portal naming:** Vision dislikes "creatives"; working name "Content Studio." Naming sign-off needed before a label sweep.
- **F4 — External agency access:** the `Agency / External` role exists; full Simplex/Talking Heads onboarding (role clarity, duplication problem) is a separate access-policy decision.
- Existing E3 `createTicket()` invariant (required taxonomy + scoring) — E9.6 and E9.8 build on it and must not bypass it.

## Success Criteria

- **One real end-to-end cycle** (intake → prioritize → assign → produce → approve → deliver) runs through the portal on real Vision content with **no WhatsApp approval and no Airtable-base fallback**.
- Editors confirm they can start cutting from a converted-clip ticket with **zero follow-up questions** (download link + verbatim transcript present).
- Vision approves at least one shoot and one clip **inside the studio view**.
- A measurable share of unambiguous tickets land **pre-assigned** (target the ~20–30% single-preferred-editor cases).
- Glenn/Rama confirm they can see **team / campaign** requests, and a requester receives a **Slack DM** when an asset is marked ready.

## Features

- **E9.1 · [Cut-ready editor brief](portal-feedback-round-1/cut-ready-editor-brief.md)** — download link + verbatim transcript on clip tickets. *(extends E8)*
- **E9.2 · [Shoot approvals in Studio](portal-feedback-round-1/studio-shoot-approvals.md)** — Vision approves shoots in his one view. *(extends E5)*
- **E9.3 · [Team + campaign visibility](portal-feedback-round-1/team-campaign-visibility.md)** — scope toggle on the requests view. *(extends E5)*
- **E9.4 · [Asset-ready notifications](portal-feedback-round-1/asset-ready-notifications.md)** — Slack DM to the requester. *(extends E5)*
- **E9.5 · [Revenue + campaign scoring](portal-feedback-round-1/revenue-campaign-scoring.md)** — richer prioritization inputs. *(extends E4)*
- **E9.6 · [Auto-assign by preferred editor](portal-feedback-round-1/auto-assign-preferred-editor.md)** — route the unambiguous cases. *(extends E4)*
- **E9.7 · [Asset-type DNA editor](portal-feedback-round-1/asset-type-dna-editor.md)** — front-end DNA/rules per asset type. *(extends E2/E3)*
- **E9.8 · [Multi-asset requests](portal-feedback-round-1/multi-asset-requests.md)** — one campaign request → many asset tickets. *(extends E3)* — **DEFERRED to a separate later effort; not part of this round.**

Dependency order: E9.1, E9.2, E9.6, E9.5 unblock the live cycle first; E9.3, E9.4 follow for adoption; E9.7 is the deeper build. E9.8 is deferred.
