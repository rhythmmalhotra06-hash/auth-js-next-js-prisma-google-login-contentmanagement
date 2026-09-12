---
title: 'E-A · Content graph & Publication'
slug: 'content-graph-and-publication'
scope: epic
status: discovery
parent: content-studio-v2.md
children: []
created: 2026-09-10
updated: 2026-09-12
resolution: 6/7
---

# E-A · Content graph & Publication

> Part of [Content Studio v2](../content-studio-v2.md)

> Stub created 2026-09-10 from `plans/i-want-to-reimagine-velvety-falcon.md` (§1, §2, §4, §7;
> decisions D10, D21, D22, D43–D45, D53). No code until the real-data prototype is approved [D23].

> **Extended 2026-09-12** with the rev-4 decisions that remove the developer's guesswork (plan §5d,
> §6): **D101** Publication identity, **D109** locales as derived assets and where the caption lives,
> **D115** `linkedAt` / `linkTier` stamping, **D119** metric retention. Transcription only — no new
> decisions [D129]. This epic's first four workflows are **slice 1** of the build, on the
> `v2/slice-1-publication` branch behind a preview link [D104, D121].

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

**Glen (social) — the same cut on two platforms is two facts.** The Manifest Love reel went to IG
and to FB MV Manifesting. He sees two Publications, one per account, each with the metrics that
platform actually reports — not one row with a summed "views" that is roughly 5× the truth [D101].

**Whoever cuts a DE or ES version — the localised cut is its own thing.** It is its own Asset
(`derivedFrom` the English one), with its own ticket and its own Publication on `@mindvalley.de`; it
is measured against German peers and its learning attaches to the German asset type, not the English
one [D109]. There is still **no localisation lane** — D69 holds; D109 only says how a locale cut is
modelled when one exists.

## Workflows

**1. Publication identity — one row per (account × platform post)** [D101].

- The **key** is `platform_post_id`; where the platform does not give one, the **normalised URL**.
  Uniqueness is on `(accountRef, coalesce(platformPostId, normalizedUrl))` [D101, plan §6.3].
- A **cross-post is its own row**, never a channel array on one row. The same cut on IG and on
  Facebook is two Publications, because the platforms do not report the same thing — IG reports
  reach, FB clicks, TikTok views — and summing them inflates the total roughly 5× [D101].
- **Stories get rows but are excluded from cohorts**: they are ephemeral, so they are recorded and
  never used as a peer or as a median input [D101].
- A Publication with **no asset and no ticket is legal** — the ~100 unticketed posts — and **stays a
  cohort peer**. `assetRef` and `ticketAirtableId` are nullable [D101, D45].
- A post **deleted from the platform keeps its last observation**, flagged *removed from platform*
  (`removedFromPlatformAt`); the observation is not deleted and the row is not rewritten [D101].

**1b. Publication model and backfill.** Add `Publication` with the fields above and a nullable
`shortCode`; add `SocialMetric.publicationId` (nullable, indexed, FK). Backfill in this order:
Airtable Social *Published Link* → `VishenVideo.publishedLink` → Perch `platform_post_id` → matcher
[plan §4, §7.3]. Every backfilled row records its signal tier. The backfill has **no date floor** —
its scope is specified in E-C [D118].

**2. The matcher, four signals in order** [D10, D43]:
1. URL / `platform_post_id` equality → **auto-link** (confirmed).
2. Caption fingerprint (`lib/performance/attribution.ts`) with overlap ≥ 80 normalised characters
   → **auto-link** (confirmed).
3. Transcript overlap (Airtable Social *Transcript* vs Perch caption/body) → **PROPOSE**.
4. Image similarity (Social cover attachment vs Perch thumbnail) → **PROPOSE**.
Otherwise **UNMATCHED**. Confirmed renders as a solid badge; proposed as a dotted "likely —
confirm". Readouts (E-B) go out only for confirmed links.

**Every link is stamped** with `linkedAt` (when the link was made) and `linkTier` (which of the four
signals made it) [D115]. These two columns are what makes attribution measurable rather than
asserted: "linked within 24h" is defined as `linkedAt − posted_at ≤ 24h`, and it is measured only on
posts that have a Social record, since a post with no record was never ticketed work [D115]. The
nightly coverage snapshot and the two 60-day numbers built on them live in E-B and are displayed on
E-C's Connections & data health screen.

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

**6b. Locales are derived assets** [D109]. A German or Spanish cut is **its own Asset**, with
`derivedFrom → source`, its own ticket and its own Publications. It is compared with
`@mindvalley.de` peers, never with the English original, and its learnings attach to **its own**
asset type. There is no language array on a Publication and no multi-locale Asset.

This also settles where copy lives, which D75 left in tension:

| Field | Lives on | Why |
|---|---|---|
| **Caption** | the **Publication** (per account, per language) | it is what the editor writes and the social manager polishes, and it differs per account and per locale [D75, D109] |
| **Hook, transcript, offer, CTA** | the **Asset** (`CreativeRecord`) | they are properties of the cut itself, shared by every publication of it [D109] |

`derivedFromPublicationId` on the Publication carries re-cuts and locale cuts at the publication
level; `derivedFrom` on the Asset carries them at the asset level [D101, D109, plan §6.3].

**7. `TicketEvent` widening.** Log rank, assignee and prio changes alongside `ticketStatus`, so a
re-rank signal exists for later learning [plan §1.3, §7.4].

**8. Editor identity.** `Employee` matched by email; `assigneeName` snapshot on the ticket as the
fallback [D22]. Access, scoping and ownership resolve through **Party** (E-E, D113), not through
`Employee.id`.

**9. Metric retention** [D119]. Snapshots are not all kept at the same fidelity:

- **Day-1, day-7 and day-30 snapshots are kept forever.** They are the readout windows and the
  evidence every rule cites.
- **Everything else is thinned to weekly after 90 days.**
- **Raw Perch payloads are kept only on retained rows** — they carry the caption, tags and
  collaborators the matcher needs, so a thinned row keeps its columns but loses its `raw` blob.

Thinning is a scheduled job (E-C) and is only ever applied to rows outside the retained set; no
retained snapshot is rewritten or recomputed.

## Boundaries

- No polymorphic JSON on the work item — queue, scoring, push-map and the 5-column mandate read
  concrete columns. `Shoot` stays its own table [plan §4].
- **No channel array on a Publication** and no summed cross-platform total; a cross-post is a second
  row [D101].
- **Stories never enter a cohort** — neither as the subject nor as a peer [D101].
- A Publication is never deleted because the post was deleted; the last observation is kept and
  flagged *removed from platform* [D101].
- **No locale variants inside one Asset or one Publication**, and no comparison of a localised cut
  with its English source [D109].
- Retention is never applied to day-1 / day-7 / day-30 snapshots, and a thinned row never keeps a
  `raw` payload [D119].
- Schema writes in slice 1 are **new tables and new nullable columns only**; no existing column is
  rewritten [D122].
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
- **E-E** for `Party` — ownership and scoping resolve through Party keyed by email, while
  `Employee.id` (an Airtable recId with ~430 references) is never refactored [D113].
- **E-C** for the retention/thinning job's schedule [D119] and for the backfill's scope [D118].

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
- **Identity holds under query** [D101]: 0 Publications share `(accountRef, platformPostId)` or
  `(accountRef, normalizedUrl)`; every cross-post is two rows; 0 story rows appear in any cohort
  computation; Publications with a null `assetRef` are present in cohort peer counts.
- **Every Publication carries `linkedAt` and `linkTier`** — 0 linked rows with either null; the
  "within 24h" number is computable as `count(linkedAt − posted_at ≤ 24h) ÷ count(posts with a
  Social record)` [D115].
- **Locale separation holds** [D109]: 0 cohorts mix accounts of different locales; every localised
  Asset has a non-null `derivedFrom`; captions exist only on Publications and hook/transcript/offer/
  CTA only on Assets (schema check).
- **Retention holds** [D119]: 100% of day-1/7/30 snapshots survive the thinning job; 0 rows older
  than 90 days outside those windows are denser than weekly; 0 thinned rows retain a `raw` payload.

## Features

Candidate breakdown, in build order. Features 1, 2 and 11 are **slice 1** [D104, D127].

1. `Publication` model on the D101 identity key + `SocialMetric.publicationId` + backfill from
   Published Link, `VishenVideo`, `platform_post_id`, with no date floor [D101, D118].
2. Matcher tiers 1–3 (URL, caption ≥ 80 chars, transcript overlap) with tier recorded per link, and
   `linkedAt` / `linkTier` stamped on every link [D43, D115].
3. Confirm-publications inbox + ticket-band confirm control + Monday-digest pending list.
4. Unticketed list with *create ticket retroactively* and coverage %.
5. Log publish action on the ticket.
6. `Asset` reshape + `CreativeRecord` + lane asset kinds, with the caption on the Publication and
   hook/transcript/offer/CTA on the Asset [D53, D109].
7. `TicketEvent` widening (rank / assignee / prio).
8. Matcher tier 4 (image similarity) — after the O3 spike.
9. **Locale cuts as derived assets** — `derivedFrom` on the Asset, `derivedFromPublicationId` on the
   Publication, locale-peer cohorts [D109].
10. **Removed-from-platform handling** — flag the last observation, keep the row [D101].
11. **Metric retention job** — keep day-1/7/30 forever, thin the rest to weekly after 90 days, drop
    `raw` on thinned rows [D119].

[UNRESOLVED] Feature 8 waits on O3 (perceptual-hash vs embedding method and threshold) — owner:
engineering spike; and the short-code convention O2 is still not a feature because its shape and
required locations (`utm_content`, Hootsuite tag, filename) are undecided — owner: Glen + Gareth.
