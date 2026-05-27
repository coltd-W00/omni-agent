---
id: 2026-05-27-task-detail-terminal-transcript-intent-snapshot
type: continuity
task: task-detail-terminal-transcript-intent-snapshot
created_at: 2026-05-27
signal: 'Created intent snapshot for task detail screen redesign: left chat summary and right curated terminal transcript.'
areas:
- docs
tags:
- handoff
decisions:
- Use curated terminal transcript rather than raw transcript for task detail.
invariants:
- Task detail main screen should split left chat input/final output from right terminal-like run transcript.
risks:
- Future implementation may over-style the terminal panel as card UI and lose terminal realism.
missing_tests:
- No implementation tests yet because this task only created an intent snapshot document.
---

## task
task-detail-terminal-transcript-intent-snapshot — 2026-05-27

## deviations
None

## traps
None

## dead_ends
None

## validation_delta
As expected

## next_agent_hint
See Handoff
