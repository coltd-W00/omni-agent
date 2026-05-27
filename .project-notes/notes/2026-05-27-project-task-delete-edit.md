---
id: 2026-05-27-project-task-delete-edit
type: continuity
task: project-task-delete-edit
created_at: 2026-05-27
signal: Added task deletion, project edit, and force project deletion with related task cleanup.
areas:
- backend/src/services
- backend/src/handlers
- frontend/src/features/project
- frontend/src/features/detail
- frontend/src/hooks
tags:
- project-management
- task-crud
decisions:
- Project key remains immutable because task IDs embed the project key prefix.
- Project edit updates name and workspace_path only.
- Project deletion without force still returns project_has_tasks; frontend asks for stronger confirmation then calls force delete.
- Force project delete removes active subprocess entries for project task IDs before deleting related DB rows.
invariants:
- Project workspace_path remains the only execution workspace source.
- Task delete UI is available only for draft tasks, matching backend delete_task rules.
risks:
- Force deleting a project with historical sessions removes related comments, runs, sessions, and tasks permanently.
tests:
- command: cargo test --manifest-path backend/Cargo.toml
  covers:
  - project update route, force project delete service cleanup, existing task/project/session behavior
- command: npm --prefix frontend test -- --run
  covers:
  - task delete UI and existing frontend behavior
- command: npm --prefix frontend run build
  covers:
  - frontend typecheck and production build
missing_tests:
- No dedicated frontend test covers ProjectSwitcher force-delete confirmation or edit-project modal flow.
---

## task
project-task-delete-edit — 2026-05-27

## deviations
None

## traps
None

## dead_ends
None

## validation_delta
As expected

## next_agent_hint
If changing project deletion again, preserve the two-step frontend flow: normal DELETE first, then force DELETE only after the stronger "delete project and tasks" confirmation. Keep project key immutable unless task ID prefix migration is designed.
