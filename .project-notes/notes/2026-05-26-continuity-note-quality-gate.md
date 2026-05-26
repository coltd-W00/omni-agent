---
id: 2026-05-26-continuity-note-quality-gate
type: continuity
task: continuity-note-quality-gate
created_at: 2026-05-26
signal: Project-notes skill now treats continuity note creation as reusable project memory for future pnotes brief.
areas:
  - .agents/skills/project-notes
tags:
  - project-notes
  - self-improvement
decisions:
  - "Require slug-safe id/task and specific repo-path areas for continuity notes."
  - "Require behavior-focused tests.covers and explicit missing_tests when coverage gaps are known."
  - "Require non-placeholder traps and concrete next_agent_hint when reusable context exists."
invariants:
  - "Continuity note guidance should stay general across backend, frontend, CLI, and UI work rather than hard-coding story-specific rules."
risks:
  - "Overly broad quality gates can increase agent friction or encourage over-filling optional fields."
missing_tests:
  - "No automated lint or fixture test validates generated continuity note quality against the updated matrix."
---

## task
continuity-note-quality-gate — 2026-05-26

## deviations
None

## traps
This skill self-improvement edits both `SKILL.md` and self-improvement artifacts. The current skill requires backup/log/matrix handling for non-trivial self-improvement, so future edits should check section 14 before changing note-quality rules.

## dead_ends
None

## validation_delta
Diff inspection only; no automated test was run because this change updates skill documentation and self-improvement artifacts, not `pnotes` CLI behavior.

## next_agent_hint
When tightening project-notes again, prefer rewriting existing schema/quality-gate wording before adding new sections, and keep optional fields conditional but non-placeholder when applicable.
