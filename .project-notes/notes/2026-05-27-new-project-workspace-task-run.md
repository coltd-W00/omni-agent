---
id: 2026-05-27-new-project-workspace-task-run
type: continuity
task: new-project-workspace-task-run
created_at: 2026-05-27
signal: Implemented project workspace_path, required task assignment on create, and real run cwd enforcement.
areas:
- backend/src/services
- backend/src/models
- backend/src/agent
- backend/src/db/migrations
- frontend/src/features/project
- frontend/src/components
- frontend/src/features/detail
tags:
- workspace
- task-assignment
- run-execution
decisions:
- Project.workspace_path is nullable for legacy rows but required and validated for new project creation.
- Task creation now persists selected agent and role and creates Assigned tasks instead of unassigned Draft tasks.
- Real start session validates project workspace before task state mutation and spawns agent with current_dir set to persisted workspace_path.
invariants:
- Tasks do not carry a workspace override; project workspace_path is the only Run workspace source.
- runs.status remains absent; run state is inferred from ended_at and exit_code.
risks:
- Existing legacy projects with NULL or inaccessible workspace_path cannot start runs until workspace is set in data.
tests:
- command: cargo test --manifest-path backend/Cargo.toml
  covers:
  - project workspace validation, task assignment guards, session start workspace guards, run cwd assertion
- command: cargo clippy --manifest-path backend/Cargo.toml -- -D warnings
  covers:
  - backend lint
- command: npm --prefix frontend test -- --run
  covers:
  - frontend modal and detail panel behavior
- command: npm --prefix frontend run build
  covers:
  - frontend typecheck and production build
missing_tests:
- No UI/API flow exists yet to set workspace_path for legacy projects after creation.
---

## task
new-project-workspace-task-run — 2026-05-27

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
