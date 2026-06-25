---
version: 1.0.0
author: Norman
description: '24-hour session report — what was built, what changed, and how much the project moved forward.'
allowed-tools: Read, Glob, Grep, Bash(git log *), Bash(git diff *), Bash(git show *), Bash(git branch *), Bash(git stash *), Bash(git ls-files *), Bash(date *), Bash(wc *), Bash(ls *)
---

# /status — BlinkLife 24-Hour Session Report

You are a project progress reporter for BlinkLife. Your job is to analyze everything that happened in the last 24 hours — committed work, uncommitted work, and the overall impact on the project — then produce a clear, visual session report. Be concise, visual, and specific. Use block characters for progress bars. No fluff.

---

## Step 1: Gather Data

Read all of these files in parallel:

1. `prd/index.md` — PRD index with status and resolution counts
2. `prd/XX-build-priority-matrix.md` — Phase completion percentages, P1 build list, built/to-build tables
3. `prd/XX-build-queue.md` — Wave-based build queue with `[x]`/`[ ]`/`[~]` status markers

Then gather git data:

4. Run `git log --since="24 hours ago" --oneline --no-merges` for recent commits
5. Run `git log --since="24 hours ago" --stat --no-merges` for file change details
6. Run `git diff --stat HEAD` for uncommitted changes (modified + staged)
7. Run `git diff --name-only HEAD` for list of uncommitted modified files
8. Run `git ls-files --others --exclude-standard` for new untracked files
9. Run `git branch --show-current` for current branch
10. Run `git log --since="48 hours ago" --oneline --no-merges` as fallback if <24h has few commits

Also check for build logs created/modified today:

11. Read any files in `prd/.builds/` that have `started: <today's date>` or `completed: <today's date>` in their frontmatter — these represent builds done in this session.

---

## Step 2: Produce the Report

Output the following sections in order. Use monospace box-drawing characters and block characters (`█` and `░`) for all progress bars. Progress bars should be exactly 21 characters wide unless specified otherwise.

### Section 1: Header

```
╔══════════════════════════════════════════════════════════════════════╗
║                    24-HOUR SESSION REPORT                          ║
║                    <today's date> · Branch: <current branch>      ║
╚══════════════════════════════════════════════════════════════════════╝
```

### Section 2: Work Summary

Count total work done from both committed AND uncommitted changes:

- Total commits in last 24h
- Total files touched (committed + uncommitted, deduplicated)
- Total lines added / removed (committed + uncommitted)
- Number of new files created (from untracked files list)

```
WORK COMPLETED
────────────────────────────────────────────────────────────────────────
<commit count> commits + <uncommitted status> uncommitted changes
<file count> files touched · +<additions> / -<deletions>
```

### Section 3: What Was Built

This is the main section. Analyze ALL changes (committed + uncommitted) and categorize them into three groups:

**New Features** — new capabilities, services, domains, pages, skills, infrastructure. For each:

- One-line description of WHAT was built
- One-line description of what it means for the PRODUCT (not the code)
- If it corresponds to a build queue item (P4.5-8, MC-1, etc.), note the ID

**Bug Fixes** — fixes to broken behavior. For each:

- What was broken
- What was fixed

**Fine-tuning** — improvements, polish, refactoring, PRD updates, config changes. Brief bullets.

For builds done via `/build` (check `prd/.builds/` for today's build logs), give them prominence — they represent structured feature work. Show the build name, step count, and what it delivered.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  NEW FEATURES

  1. <Feature Name> [COMMITTED or UNCOMMITTED]
     <what was built — 1-2 lines>
     <what it means for the product — 1 line>

  2. ...

  ──────────────────────────────────────────────────────────────

  BUG FIXES

  3. <Fix Name> [COMMITTED]
     <what was broken> → <what was fixed>

  ──────────────────────────────────────────────────────────────

  FINE-TUNING

  • <change>
  • <change>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Section 4: Launch Target Progress

This shows how much the P1 launch target moved today. Read the P1 Build List from `XX-build-priority-matrix.md` and cross-reference with `XX-build-queue.md` to count done vs remaining items.

Show before → after for the overall P1 progress. To determine "before", subtract items that were completed today (items marked `[x]` in the build queue that correspond to today's work from Section 3).

Show a 40-character progress bar.

Then list each build queue item that moved to DONE today with a checkmark.

```
LAUNCH TARGET PROGRESS
────────────────────────────────────────────────────────────────────────

  P1 Build List (<total> items):
  Yesterday:  <bar 40 chars>  <percent>%  (<done_before>/<total>)
  Today:      <bar 40 chars>  <percent>%  (<done_after>/<total>)
                                           +<delta>%  (+<count> items)

  Items completed today:
  ✓ <ID>  <item name>
  ✓ <ID>  <item name>
  ...
```

If no P1 items were completed today, say "No P1 items completed today — work was bug fixes / polish."

### Section 5: Phase Completion

Read phase percentages from `XX-build-priority-matrix.md` (the "Phase Status Overview" section). Display ALL phases — every single one from Phase 1 through Phase 10, plus cross-cutting items.

For any phase whose percentage changed today (based on items completed in Section 4), show the delta with an arrow.

```
OVERALL PROJECT STATUS
────────────────────────────────────────────────────────────────────────
Phase  1    Foundation + Voice        ████████████████████░   95%
Phase  2    Life Org + Smart Notes    █████████████████░░░░   85%
Phase  3    Memory Architecture       ██████████████████░░░   90%
Phase  4    Multi-Companion           ████████░░░░░░░░░░░░░   40%
Phase  4.5  Brains + Super Skills     ████████████████░░░░░   78%  ↑ was 30%
Phase  5    Proactive Intelligence    ███████████░░░░░░░░░░   55%
Phase  5.5  App Composition           ░░░░░░░░░░░░░░░░░░░░░    0%
Phase  6    Google Integration        ░░░░░░░░░░░░░░░░░░░░░    0%
Phase  7    Communication Channels    ████░░░░░░░░░░░░░░░░░   20%
Phase  8    RAG + Document Intel      ██░░░░░░░░░░░░░░░░░░░   10%
Phase  8.5  Shareable Brains          ░░░░░░░░░░░░░░░░░░░░░    0%
Phase  9    Groups + SDK              ░░░░░░░░░░░░░░░░░░░░░    0%
Phase 10    Production + Launch       ░░░░░░░░░░░░░░░░░░░░░    0%
  ✚         Main Chat & Side Convos   ░░░░░░░░░░░░░░░░░░░░░    0%
  ✚         Debug Dashboard           ████░░░░░░░░░░░░░░░░░   20%
```

IMPORTANT: Always show ALL phases from 1 through 10, including phases at 0%. Also show all cross-cutting items with the `✚` prefix. Never truncate the phase list.

### Section 6: What This Unlocks

Analyze the items completed today and determine what downstream work is now unblocked. Check the dependency graph in `XX-build-queue.md` — which items had dependencies on today's completed work?

Show 2-4 bullet points describing what is now possible that wasn't before.

```
WHAT THIS UNLOCKS
────────────────────────────────────────────────────────────────────────

  → <What is now unblocked and why it matters>
  → <What is now unblocked and why it matters>
  → <What can now be upgraded/improved as a result>
```

If no P1 items were completed, instead show "Next priorities:" with the top 2-3 items from the build queue that should be tackled next.

---

## Formatting Rules

1. All progress bars use `█` for filled and `░` for empty. Phase bars are 21 chars. Launch target bars are 40 chars.
2. Use `────` horizontal rules to separate sections.
3. Use `━━━━` thick rules to wrap the main "What Was Built" section.
4. Use `═══` double rules for the launch target section header.
5. Keep the entire output readable in an 80-column terminal.
6. Do not use markdown headers (`##`) in the output — use the visual separators instead.
7. Do not add commentary outside the formatted report. The report IS the output.
8. Show phases that changed today with `↑ was X%` annotation.
9. Always show ALL phases (1 through 10 + half-phases + cross-cutting). Never skip 0% phases.
