---
title: 'E-A · Content graph & Publication'
slug: 'content-graph-and-publication'
scope: epic
status: discovery
parent: content-studio-v2.md
children: []
created: 2026-09-10
updated: 2026-09-10
resolution: 6/7
---

# E-A · Content graph & Publication

> Part of [Content Studio v2](../content-studio-v2.md)

> Stub created 2026-09-10 from `plans/i-want-to-reimagine-velvety-falcon.md` (§1, §2, §4, §7;
> decisions D10, D21, D22, D43–D45, D53). No code until the real-data prototype is approved [D23].

## Purpose

Give the product the noun it is missing. Today `ticket_airtable_id` is set on 0 of 1,642 metric
rows, `assets` has 0 rows, and the caption matcher in `lib/performance/attribution.ts` has no
caller — so nothing published can be traced back to the ticket that made it. This epic introduces
**Publication** (asset × channel × account × URL × published_at × goal × tags × short code ×
`derivedFrom`) as the middle between plan and observation, reshapes `Asset` into the repository,
widens `TicketEvent`, and ships a four-signal matcher where **the system matches and humans confirm
only on ambiguity** [D10]. It is the precondition for every readout and every learning in E-B.

## User Stories

**Yuthika (editor) — the link appears without her doing anything.** She delivered #11057 on 9 Sep;
Vidura posted it to IG + FB MV Manifesting that night. The next day the ticket shows a solid
Publication badge: `instagram.com/reel/DdFYhV8DXTk`, matched by URL from Airtable Social *Published
Link*. She typed nothing.

**Vidura (social manager) — confirm only what is ambiguous.** A post with no Published Link and a
rewritten caption lands in his "Confirm publications" inbox as a dotted *likely — confirm* card:
transcript overlap with ticket #11060's Social record. One tap confirms or rejects. He never fills
in a ticket id by hand [D10, D44].

**Vidura — the unticketed list.** A reel Perch captured has no ticket anywhere. It sits in
"Unticketed" with the coverage % beside it (ticketed ÷ all published) and a one-click *create
ticket retroactively* [D45].

**Titus (team lead) — the repurposed case.** #11057 is a re-cut of a paid Masterclass ad
(`recllHS6i1jgSoYYY`). The Publication is owned by #11057 — the last ticket that produced the
delivered file — and shows *derived from* the source asset. The readout and any learning go to
#11057's asset type, *Pathway Organic – Snippets*, not to the ad [D21].

**Anyone with a publish action — Log publish.** For channels Perch does not cover, a person on the
ticket pastes the live URL as a Publication; that link is confirmed by definition [D10].

## Workflows

**1. Publication model and backfill.** Add `Publication` with the fields above and a nullable
`shortCode`; add `SocialMetric.publicationId`. Backfill in this order: Airtable Social *Published
Link* → `VishenVideo.publishedLink` → Perch `platform_post_id` → matcher [plan §4, §7.3]. Every
backfilled row records its signal tier.

**2. The matcher, four signals in order** [D10, D43]:
1. URL / `platform_post_id` equality → **auto-link** (confirmed).
2. Caption fingerprint (`lib/performance/attribution.ts`) with overlap ≥ 80 normalised characters
   → **auto-link** (confirmed).
3. Transcript overlap (Airtable Social *Transcript* vs Perch caption/body) → **PROPOSE**.
4. Image similarity (Social cover attachment vs Perch thumbnail) → **PROPOSE**.
Otherwise **UNMATCHED**. Confirmed renders as a solid badge; proposed as a dotted "likely —
confirm". Readouts (E-B) go out only for confirmed links.

**3. Confirm publications.** Confirmers are the ticket's editor OR the social manager, via a small
inbox and on the ticket's performance band; pending confirms are listed in the Monday digest [D44].
Confirming writes the tier as `confirmed-by-<employee>`; rejecting removes the proposed link and
returns the post to Unticketed or to its next candidate.

**4. Unticketed.** Posts with no link stay in cohorts as peers; the Unticketed list offers *create
ticket retroactively* (creates a Ticket in the matching lane with `assigneeName` from the Social
record if present, then links) [D45]. Coverage % is computed as ticketed ÷ all published per
account and per lane and is always visible.

**5. Ownership on repurpose.** The last ticket that produced the delivered file owns the
Publication; the source ticket is linked as *derived from*; learning attaches to the re-cut's asset
type [D21].

**6. Asset reshape.** `Asset` (0 rows) becomes the repository record with raw/final versions plus a
tabular `CreativeRecord` (copy, transcript, hook, CTA, offer, cover). Kinds per lane [D53]: Email =
the send (versions = drafts, publication = the send event); Podcast = the episode with clips
*derived from*; Social = the post (final cut/image + caption + cover; one Publication per
channel/account); Shoot = raw footage batch (folder link, shot list) as a source asset.

**7. `TicketEvent` widening.** Log rank, assignee and prio changes alongside `ticketStatus`, so a
re-rank signal exists for later learning [plan §1.3, §7.4].

**8. Editor identity.** `Employee` matched by email; `assigneeName` snapshot on the ticket as the
fallback [D22].

## Boundaries

- No polymorphic JSON on the work item — queue, scoring, push-map and the 5-column mandate read
  concrete columns. `Shoot` stays its own table [plan §4].
- The matcher is never a data-entry discipline on Vidura or Ramya [D10].
- A proposed (unconfirmed) link never triggers a readout or a DM [D43].
- No file hosting: a version is a link [D54].
- Per-post revenue/leads are out until a short code exists [D16, O2].
- The image-similarity signal ships only after the O3 spike decides method and threshold; the
  first three signals do not wait for it.
- Airtable structure changes needed here (a Goal field, a short code field on Social) are allowed
  [D16].

## Dependencies

- **E-C** for the scheduler: the matcher and the day-1 capture window (18–36h, D35) need a cron
  that fires when it says it does, not 3–11h late.
- **E-C** for the Perch mapper fix (views, saves, shares, watch time, post_type, collaborators
  lifted into columns) — the Publication readout has nothing to show without it.
- Airtable Social fields *Published Link*, *Transcript*, *Creative Ticket*, cover attachment
  (`app9YRZOVeE65fJPA/tblCcrdkHzOakOGnm`).
- `VishenVideo.publishedLink` for VL rows.
- O2 (short code) for the future strongest signal; O3 (image similarity) for the fourth tier.

## Success Criteria

- Attribution coverage ≥ 80% of Released social posts confirmed-linked to a ticket within 24h of
  `posted_at`, 60 days after release; baseline ~0% [D14].
- The worked example resolves by tier 1: Social `recJ9laDP1uWIXTHe` → Publication
  `instagram.com/reel/DdFYhV8DXTk` (`platform_post_id 17841400376176964_18092461193412440`) → ticket
  #11057, tier = URL, without human action.
- Every Publication row carries its signal tier and, for proposed links, who confirmed and when.
- Coverage % is visible on the Performance and Unticketed surfaces and equals ticketed ÷ all
  published for the selected account and lane.
- Zero readouts or DMs are sent for a Publication whose link is only proposed (query: readouts
  joined to publications where tier ∈ {proposed} = 0).

## Features

Candidate breakdown, in build order:

1. `Publication` model + `SocialMetric.publicationId` + backfill from Published Link, `VishenVideo`,
   `platform_post_id`.
2. Matcher tiers 1–3 (URL, caption ≥ 80 chars, transcript overlap) with tier recorded per link.
3. Confirm-publications inbox + ticket-band confirm control + Monday-digest pending list.
4. Unticketed list with *create ticket retroactively* and coverage %.
5. Log publish action on the ticket.
6. `Asset` reshape + `CreativeRecord` + lane asset kinds.
7. `TicketEvent` widening (rank / assignee / prio).
8. Matcher tier 4 (image similarity) — after the O3 spike.

[UNRESOLVED] Feature 8 waits on O3 (perceptual hash vs embedding, and the threshold) and the
short-code convention O2 is not yet a feature because its shape and required locations
(`utm_content`, Hootsuite tag, filename) are undecided.
