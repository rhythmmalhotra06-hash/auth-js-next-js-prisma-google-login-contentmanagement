# Decision log

> Settled decisions from the Titus 1:1 (Jun 22), Blinkwork Content Ops session
> (Jun 24), and Creative Prio Hackathon (Jun 25). **Treat these as fixed.** Many
> are the result of reversals — the reasoning matters, so don't "improve" them.
> Where a decision superseded an earlier approach, the prior one is noted so
> Claude Code recognizes it if it surfaces in the transcripts.

## Taxonomy & data model

- **Two building blocks: Event Type and Asset Type.** Production Type is a
  SUBCATEGORY of Event Type, not a third axis. (Hackathon) Keep language
  consistent — the team chose Event/Asset deliberately to avoid confusion.
- **Teams own Asset Types, not Event Types.** Rationale: a Masterclass has both
  ad assets and social assets, so ownership can't hang off the event. team_lead
  and preferred_editor live on the asset_type. (Blinkwork)
- **Asset Type links to Event Type.** Form matching is done on the pair.
  Multiple asset types tie to one event type (e.g. Masterclass funnel → short
  ads + masterclass video). (Blinkwork)
- **Person fields link to an Employees table — never raw User fields.** Enables
  automation/reporting; lets the system derive department/division/team lead
  from the assignee. (Blinkwork governance decision)
- **Contractors/freelancers go in the Employees table** with an employment-type
  flag, marked Inactive when they leave. Do NOT add new fields to the main
  table for them. (Hackathon)
- **Asset category = digital | print** (print covers physical). All video =
  digital. (Hackathon — superseded an earlier digital/physical wording.)
- **Dimensions are a dedicated table** (9x16, 4x5, 16x9…) linked to asset types;
  mandatory at intake. (Blinkwork)
- **DNA per asset type** (requirements + feedback standards). Lives with the
  asset type for future AI-assisted feedback. Currently in separate bases —
  must be integrated. (Blinkwork)
- **Brain is the single source of truth** for Programs/Quests/Pathways/Events/
  Talent. Reference, never hardcode. (Standing principle)

## Form & intake

- **Form order: Event Type FIRST, which filters Asset Type.** Reasoning: people
  think "Masterclass" then "what item do I need"; the asset list is long, so
  filtering by event makes it navigable. (Blinkwork — this REVERSED an earlier
  asset-first approach; the flip was deliberate.)
- **Team Lead and Preferred Editor are read-only lookups from the asset type,
  not form inputs.** (Blinkwork)
- **"Summary" field renamed to "Title"** for Dropbox searchability. (Blinkwork)
- **Removed from the form:** Priority, Assignee (handled by backend/automation),
  and demographic fields like age/gender (redundant). (Blinkwork + Hackathon)
- **Kept on the form:** Title, Creative Brief, Due Date, CTA, Positioning,
  Audience (cold/warm). (Blinkwork)
- **CTA field** captures the asset's goal — URL, sign-up, or social instruction.
  (Blinkwork)
- **Removed "creative video type"** — conflicted with asset-type linking.
  (Blinkwork)
- **Two form variants** in Titus's Video Base: Ads Creative, Pathway Organic.
  For Pathway/organic, Event Type = "Social Media Promotion" (broader), while a
  literal "Pathway" event type also exists. [VERIFY both in appDZnMnJGehbSOo5.]

## Status & workflow

- **Two separate status axes, never merged:** prio_status (manager-set,
  external-facing) and ticket_status (editor/designer-set, internal).
  (Hackathon)
- **Queue model, not SLAs.** Editors pull the next ranked item; no SLA timers.
  (Blinkwork)
- **Standardized view template:** the first five columns are identical across
  ALL views — Title, Priority, Assigned, Ticket Status, Priority Status.
  (Hackathon)
- **Prioritization = urgency × complexity → score.** Manual-assisted in Phase 1;
  managers confirm order daily. See prioritization-algorithm.md. (Hackathon)

## Architecture & migration

- **Full migration off Jira to the new system.** Jira is NOT kept as a backend.
  (Blinkwork — the group weighed Jira-as-backend and rejected it.)
- **One Creative Services base as the consolidation point**, replacing the 4+
  scattered bases (VSSLs, masterclasses, social, etc.). (Blinkwork)
- **Two-way sync** between the Creative Services base and the DNA bases.
  (Blinkwork — owner: Matthew Wong)
- **Jira tickets created after Jun 24** migrate into the new system. (Hackathon —
  owner: Matthew Wong)
- **Historical backfill** owned by Matt. (Standing)
- **Every base must have a designated owner** to prevent unauthorized tab/field
  creation. (Blinkwork governance)

## Output, distribution & performance (the gap to close)

- **Raw asset vs final asset** must be distinguished. (Blinkwork)
- **Distribution link to the social media calendar** — today there's no link
  between a request, who edited it, and its appearance on the calendar. This is
  the core visibility gap (Vision's "who edited this?"). (Blinkwork)
- **Performance feedback loop** — how did the asset perform, tied back to the
  asset. Deferred decision: whether metrics live on the Prio table or the Asset
  Library. (Blinkwork — modeled library-side in schema.sql; CONFIRM.)
- **Stakeholder/agency views** showing pre-prod → post-prod in one place.
  (Blinkwork)

## Open decisions (NOT yet settled — do not guess)

- Exact event-tier ranking for the urgency score. [Moniek]
- Whether performance metrics live on Prio table vs Asset Library. [team]
- Brain table names + the stable key to link on. [team]
- prio_status / ticket_status / shoot-status enum values. [from live schema]
