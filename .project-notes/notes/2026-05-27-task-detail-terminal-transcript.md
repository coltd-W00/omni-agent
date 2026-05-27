---
id: 2026-05-27-task-detail-terminal-transcript
type: continuity
task: task-detail-terminal-transcript
created_at: 2026-05-27
signal: Implemented full-page task detail as conversation snapshot plus curated terminal transcript.
areas:
- frontend/src/features/detail
tags:
- frontend
- task-detail
decisions:
- Full-page task detail uses a two-column conversation snapshot and terminal transcript instead of tabbed content.
- Transcript is curated from existing runs.logTail and run metadata without adding backend API or schema changes.
invariants:
- Slide-in TaskDetailPanel remains the tabbed operational panel; this change targets the full-page TaskDetailPage route.
risks:
- Transcript fidelity is limited by current run.logTail data; richer command/edit/test event grouping needs structured run events later.
tests:
- command: npm --prefix frontend run build
  covers:
  - TypeScript compile and production build for redesigned TaskDetailPage
- command: npm --prefix frontend test -- --run src/features/detail/TaskDetailPage.test.tsx
  covers:
  - Conversation snapshot and terminal transcript render from task and run data
missing_tests:
- Full npm test still fails in existing TaskDetailPanel/board tests because TaskDetailPanel uses useNavigate outside a Router in the current test harness.
---

## task
task-detail-terminal-transcript — 2026-05-27

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
