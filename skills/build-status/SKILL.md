---
version: 1.0.0
author: Norman
description: Show visual build status — phase completion, PRD changes, launch progress, recent work, and strategic suggestions for what to build next.
allowed-tools: Read, Glob, Grep, Bash(git log *), Bash(git diff *), Bash(git show *), Bash(date *), Bash(wc *), Bash(ls *), Bash(cat *)
---

# /build-status — BlinkLife Build Status Dashboard

You are a strategic build advisor for BlinkLife. Your job is to read the current state of PRDs, the build priority matrix, the build queue, and recent git history, then produce a clear, visual status report. Be concise, visual, and strategic. Use block characters for progress bars. No fluff.

---

## Step 1: Gather Data

Read all of these files in parallel:

1. `prd/index.md` — PRD index with status and resolution counts
2. `prd/XX-build-priority-matrix.md` — Phase completion percentages, P1 build list, built/to-build tables
3. `prd/XX-build-queue.md` — Wave-based build queue with `[x]`/`[ ]`/`[~]` status markers

Then gather git data:

4. Run `git log --since="24 hours ago" --oneline --no-merges` for recent commits
5. Run `git log --since="24 hours ago" --stat --no-merges` for file change details
6. Run `git log --since="7 days ago" --oneline --no-merges -- prd/` for PRD changes in the last week
7. Run `git diff --stat HEAD~5..HEAD` for recent diff stats (fallback context if <24h has few commits)
8. Run `git branch --show-current` for current branch

---

## Step 2: Produce the Report

Output the following sections in order. Use monospace box-drawing characters and block characters (`█` and `░`) for all progress bars. Each progress bar should be exactly 21 characters wide.

### Section 1: Header

```
╔══════════════════════════════════════════════════════════════════════╗
║                    BLINKLIFE BUILD STATUS                          ║
║                    <today's date> · Branch: <current branch>      ║
╚══════════════════════════════════════════════════════════════════════╝
```

### Section 2: Phase Completion

Read the phase completion percentages from `XX-build-priority-matrix.md` (the "Phase Status Overview" section near the top). Display each phase with a 21-character progress bar.

Mark the phase that is currently being actively worked on (based on build queue status — the wave/track with `[~]` items or the lowest wave with `[ ]` items) with `← ACTIVE`.

```
PHASE COMPLETION
────────────────────────────────────────────────────────────────────────
Phase  1   Foundation + Voice        ████████████████████░   95%
Phase  2   Life Org + Smart Notes    █████████████████░░░░   85%
...
```

Include the cross-cutting items (Main Chat, Debug Dashboard) at the bottom with `✚` prefix.

### Section 3: PRD Status

Count PRDs from `prd/index.md`:

- Total active PRDs (all rows in tables, excluding archive)
- Count by status: resolved, discovery, draft, active (refs), other
- Count archived PRDs from `prd/archive/` directory

Show a progress bar for resolved PRDs as a percentage of total.

Then show PRD changes from the last 7 days using the git log for `prd/`. Categorize each change:

- `+ ADDED` — new PRD files that were created
- `↑ UPDATED` — existing PRD files that were modified
- `- ARCHIVED` — PRDs moved to archive
- `✂ REMOVED` — PRDs deleted

If no changes in the last 7 days, say "No PRD changes this week."

```
PRD STATUS
────────────────────────────────────────────────────────────────────────
  <total> active · <archived> archived · <future> future/unscheduled

  <resolved> resolved  <progress bar>  <percent>%
  <discovery> discovery
  <drafts> drafts

  Last 7 days:
  + ADDED    <filename> (<status>, <resolution>)
  ↑ UPDATED  <filename> (<status>)
  ...
```

### Section 4: Last 24 Hours

Analyze the git commits from the last 24 hours. For each commit, read the commit message and the files changed to understand what was done. Categorize each change into one of three buckets:

- **New Features** — new capabilities, new domains, new pages, new skills
- **Bug Fixes** — fixes to broken behavior
- **Fine-tuning** — improvements, polish, refactoring, PRD updates, config changes

For each item, write a one-line plain-language description of what changed and a brief second line explaining what it means for the product (not the code).

Show the commit count, file count, and lines changed in the header.

If there are no commits in the last 24 hours, expand to the last 48 hours and note it. If still nothing, show the last 5 commits with dates.

```
LAST 24 HOURS (<commit count> commits · <file count> files · +<additions> / -<deletions>)
────────────────────────────────────────────────────────────────────────

  New Features
  • <feature> — <what it means for the user>

  Bug Fixes
  • <fix> — <what was broken>

  Fine-tuning
  • <change>
  • <change>
```

### Section 5: Launch Target

Read the P1 Build List from `XX-build-priority-matrix.md` (the numbered table near the bottom). Cross-reference each item with the Built tables earlier in that file and with the `[x]`/`[ ]` markers in `XX-build-queue.md` to determine which P1 items are done vs remaining.

Count total P1 items, done items, and remaining items. Show a progress bar.

Group the remaining items by workstream and show sub-progress for each. The workstreams are:

1. **Phase 4.5 — Brains + Super Skills** — items related to Brains, context_graph, Resource Resolver, memory channels, live sources
2. **Main Chat & Side Convos** — items related to isMainChat, migration, chat redesign, Side Convos, channel routing
3. **Debug Dashboard** — items related to EventLogService, instrumentation, admin UI, WebSocket
4. **Proactive Intelligence** — items related to heartbeats, Stage 2/3, gap detection, risk detection
5. **App Composition** — items related to AppManifest, AppLoaderService, lifecycle
6. **Onboarding + Polish** — items related to 7-day onboarding, memory visibility

For each workstream, show done/total and a short progress bar (11 chars wide). Add a one-line description of WHY this workstream matters (what the user loses without it).

```
═══════════════════════════════════════════════════════════════════════
  TARGET: FIRST PUBLIC RELEASE (500 invite-only beta)
  <total> P1 items · <done> done · <remaining> remaining
  <progress bar 40 chars wide>  <percent>%
═══════════════════════════════════════════════════════════════════════

  What must ship before real users touch this:

  Phase 4.5 — Brains + Super Skills         <done>/<total> done  <bar>
    <one line on why this matters>

  Main Chat & Side Convos                    <done>/<total> done  <bar>
    <one line on why this matters>
  ...
```

### Section 6: Suggestions — What to Build Next

This is the most important section. Think strategically about what to suggest next. Consider:

1. **Critical path** — What is blocking the most downstream work? (Check dependency chains in the build queue)
2. **Parallelism** — What can run simultaneously with the critical path item? (Items with no dependencies on each other)
3. **Quick wins** — Are there any trivial items (`Effort: Small` or `Trivial`) that would move the launch target percentage meaningfully?
4. **Independence** — If there are multiple engineers, what items can be assigned to separate people?

Produce exactly 3 suggestions. Each suggestion should:

- Name the specific build queue items (by ID if available, e.g., P4.5-8, MC-1)
- Explain WHY NOW in 2-3 sentences — what it unblocks, why it's the right priority
- Show EFFORT (from the build queue) and what it UNBLOCKS
- Be actionable — the user should be able to say "ok, build suggestion 1" and you'd know exactly what to do

End with an "OPTIMAL PLAY" line that summarizes how to run the 3 suggestions for maximum progress (parallel vs sequential, engineer assignment).

```
SUGGESTIONS — What to Build Next
────────────────────────────────────────────────────────────────────────

  1. <TITLE> (<item IDs>)
     ┌─────────────────────────────────────────────────────────────┐
     │  WHY NOW: <2-3 sentences on why this is the right next     │
     │  thing to build, what it unblocks, and why it can't wait.  │
     │                                                             │
     │  EFFORT: <effort level> (~<time estimate>)                 │
     │  UNBLOCKS: <what becomes buildable after this>             │
     └─────────────────────────────────────────────────────────────┘

  2. <TITLE> (<item IDs>)
     ...

  3. <TITLE> (<item IDs>)
     ...

  OPTIMAL PLAY: <one-line summary of how to run all 3 for max progress>
```

---

## Formatting Rules

1. All progress bars use `█` for filled and `░` for empty. Phase bars are 21 chars. Launch target bar is 40 chars. Workstream bars are 11 chars.
2. Use `────` horizontal rules to separate sections.
3. Use `═══` double rules for the launch target section.
4. Use box-drawing characters (`┌ ─ ┐ │ └ ┘`) for suggestion boxes.
5. Keep the entire output readable in an 80-column terminal.
6. Do not use markdown headers (`##`) in the output — use the visual separators instead.
7. Do not add commentary outside the formatted report. The report IS the output.
