# Recorder Review Skills — what it actually is, and what it means for Content Management's DNA feedback capability

## Correction (2026-09-02)

First pass at this plan searched public GitHub for the `/watch` repo Vishen couldn't name, and
speculated that his "Recorder" learning loop was a novel idea layered on top of a public tool.
**That was wrong.** Rhythm pointed out BlinkLife has this. It does — and it's not a side
experiment, it's a real, largely-built product epic in Mindvalley's own repo.

## What it actually is

`mindvalley-ai/blinklife-proto`, epic **[Recorder Review Skills](https://github.com/mindvalley-ai/blinklife-proto/blob/main/prd/P5.5-recorder-review.md)**
(`prd/P5.5-recorder-review.md`), status `resolved`, 7/7, created 2026-05-10.

The `/watch` command Vishen half-remembered is real too — it's an internal Mindvalley Claude Code
skill (`.claude/skills/watch/`, present in `mindvalley-ai/BlinkWork` and `mindvalley-ai/blinkwebinars`):
downloads a video, extracts frames via ffmpeg, gets a transcript, hands both to Claude. The
Recorder epic's own PRD says explicitly: *"lift the proven pattern from the existing `/watch`
skill into the server-side pipeline"* — that's the literal origin story, not a guess.

### The mechanism (three layers)

| Layer | What it is | Who edits |
|---|---|---|
| **Rulebook Note** | Per-user, per-content-type list of rules (a regular Note, tagged `Rulebook`+`Recorder`+sub-type) | Founder directly, or the post-recording conversation |
| **Platform Skill** | The behavior — what dimensions to check, what to ask during review | Mindvalley platform admins |
| **Per-User Skill State** | Learned weightings ("Vishen cares 5× more about hook than ending"), version pinning | The companion, written at runtime |

Each rule carries `statement`, `rationale`, `example`, `sourceTimestampMs` (clickable jump-to-video),
`weight` (1-5), `confidence`, `appliesTo`. Rules aren't terse tags — the rationale/example fields
exist specifically so a rule is still legible six months later.

### The loop, and it matches Vishen's voice note almost verbatim

1. Record yourself reviewing a video → companion proposes an initial rulebook from your reactions → you approve.
2. Record a review of a second, similar video → companion proposes new rules + flags refinements/contradictions against the existing rulebook → you approve/edit.
3. By the 3rd recording, a "Review Automatically" button unlocks — paste a URL, it reviews using your rulebook, no recording needed.
4. Corrections ("avoid that, say this instead") don't just fix one output — they update the rulebook.

This is precisely what Vishen described (3 reels → learns your editing style → auto-reviews reels
4-6+ → corrections refine it going forward), which makes sense: he's describing the product he
commissioned. **Success criterion #2 in the PRD is literally this test**: "By the 3rd recording in
the same content type, ≥70% of new rule proposals are accepted by the founder without edits."

### What's actually built vs. still in discovery (per `prd/index.md`, 2026-09-02)

| Piece | Status |
|---|---|
| Rulebook Notes, Rule Extraction Processor, Recording Flow | **built** |
| Recorder Mode 1 (record → rule extraction → rulebook) | **shipped** |
| Recorder Multimodal Review (frame extraction, opt-in "Review with visuals" button, ~$0.28/recording) | listed **built** in the index, but the PRD's own frontmatter says `status: discovery` — flag this discrepancy, don't assume it's fully solid |
| Mode 2 — "Review Automatically" / paste-a-URL, and its reframe into "AI review" (before recording) + "AI check" (rulebook-compliance check after) | **discovery, 0/8** — not built. This is the part Vishen may be testing manually / by hand right now, not a shipped automatic feature |

So: the record → learn → build-a-rulebook loop is real and working. The "paste any video and get
an instant automatic review with zero setup" version is still being designed.

## Why this matters for Content Management specifically

`context/intelligence-layer.md` capability **#4, AI-assisted DNA feedback**, already describes this
exact output shape ("hook lands at 0:06; DNA requires ≤0:03") and was marked **Phase 2, blocked on
"a multimodal review pipeline"** that didn't exist yet when that doc was written. It does now —
inside BlinkLife, at Mindvalley, already proven against Vishen's own real use case.

The meaningful upgrade Recorder brings to capability #4 as currently scoped: today's doc assumes
DNA standards are pre-authored (Airtable, or eventually Brain `Rule` nodes — see its own example,
`Rule: "never say 'unlock'"`). Recorder's mechanism **generates and maintains those rules from a
reviewer's spoken feedback**, continuously, per editor or per asset type — nobody has to sit down
and write a DNA doc. That's directly transferable: Content Management already has `asset_type` as
the natural unit a rulebook would scope to (each asset type already owns a `preferred_editor`),
and DNA/`dna` is already a named reference table in the schema waiting for exactly this kind of
content.

This is a **borrow-the-pattern** situation, same as CLAUDE.md §10's build/borrow table (Approvals ←
Ziflow, Version stacking ← Air): study Recorder's three-layer architecture and rule schema as the
reference design, then build the equivalent inside Content Management/Blinkwork rather than
reinventing it from scratch. Not a shared service — BlinkLife is a personal founder tool, Content
Management is a team production tool; the architecture transfers, the deployment doesn't.

## Next steps

- [ ] Read the four still-open sub-PRDs for full detail before designing anything:
      `P5.5-rulebook-notes.md`, `P5.5-rule-extraction.md`, `P5.5-adaptive-review-skills.md`,
      `P5.5-rulebook-editability.md`.
- [ ] Ask Vishen directly what he actually ran by hand — the epic covers Mode 1 (record + learn)
      as shipped; if he's describing "paste a video, ask what to study" that's the Mode 2 reframe
      that's still in discovery (0/8), so he may be testing an in-progress/manual version.
- [ ] Do not scope build work in Content Management yet. First: confirm with Vishen/whoever owns
      `blinklife-proto` whether Recorder's rule-extraction + multimodal pipeline could be factored
      out as a reusable service, or whether Content Management should just re-implement the pattern
      against its own `asset_type`/`dna` tables.
- [ ] When ready, write this up as a proper addendum to `context/intelligence-layer.md` capability
      #4, citing the Recorder rule schema as the reference shape rather than inventing a new one.
