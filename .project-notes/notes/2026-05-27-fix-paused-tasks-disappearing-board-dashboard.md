---
id: 2026-05-27-fix-paused-tasks-disappearing-board-dashboard
type: continuity
task: fix-paused-tasks-disappearing-board-dashboard
created_at: 2026-05-27
signal: Map paused tasks to the running column and active sessions list while displaying their Paused badge.
areas:
- frontend/src/features/board
- frontend/src/features/dashboard
decisions:
- Use running column/section to group paused tasks instead of filtering them out
invariants:
- tasks with status 'paused' must map to key 'running' on board grouping and tasksRunningSessions selector on dashboard
tests:
- command: npm --prefix frontend test -- --run
  covers: []
---

## task
fix-paused-tasks-disappearing-board-dashboard — 2026-05-27

## deviations
None

## traps
None

## dead_ends
None

## validation_delta
All 218 frontend tests pass (including the new paused task on board test and the updated running sessions filter test). All 93 backend tests pass successfully.

## next_agent_hint
See Handoff
