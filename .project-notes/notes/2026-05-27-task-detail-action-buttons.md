---
id: 2026-05-27-task-detail-action-buttons
type: continuity
task: task-detail-action-buttons
created_at: 2026-05-27
signal: Implemented Mark Done and Cancel actions for paused/failed tasks, updating database statuses and UI buttons safely.
areas:
- backend/src/services
- backend/src/models
- backend/src/handlers
- frontend/src/features/detail
- frontend/src/api
- frontend/src/hooks
tags:
- task-detail
- session-management
decisions:
- Serialize backend Done status to completed in JSON output to seamlessly match frontend expectations without complex UI mapping changes.
- Expose POST /api/projects/{project_id}/tasks/{task_id}/sessions/complete to handle task completion from Paused or Failed states.
- Expand POST /api/projects/{project_id}/tasks/{task_id}/sessions/cancel to support cancellation from Paused and Failed task states.
invariants:
- Task completion and cancellation go through strict database state transitions, allowing only Paused/Failed for complete, and Running/Paused/Failed for cancel.
- Session status closed is allowed to be set from both running and paused session states.
tests:
- command: cargo test --manifest-path backend/Cargo.toml
  covers:
  - completing and cancelling sessions from paused/failed states
- command: npm --prefix frontend test -- --run
  covers:
  - Mark Done and Cancel buttons in TaskDetailPanel API mutations
---

## task
task-detail-action-buttons — 2026-05-27

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
