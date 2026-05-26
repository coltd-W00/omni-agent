---
id: 2026-05-27-new-project-workspace-task-run-handoff
type: continuity
task: new-project-workspace-task-run-handoff
created_at: 2026-05-27
signal: Created party-mode Execution Handoff for project workspace path, required task agent assignment, and real async Run execution in project workspace.
handoff: _bmad-output/implementation-artifacts/new-project-workspace-task-run-execution-handoff.md
areas:
- _bmad-output/implementation-artifacts/new-project-workspace-task-run-execution-handoff.md
- backend/src/services/sessions.rs
- backend/src/services/projects.rs
- frontend/src/components/CreateTaskModal.tsx
tags:
- party-mode
- handoff
decisions:
- Project.workspace_path is the only execution workspace; tasks must not add workspace overrides.
- Workspace validation requires trimmed absolute existing accessible directory; store trimmed original path, not canonicalized; use invalid_workspace_path.
- Legacy projects may have NULL workspace_path and still render, but Run is blocked with project_workspace_missing.
- Task agent reassignment is allowed only in Draft, Ready, Assigned; Run keeps runs.status out and infers state from ended_at/exit_code.
invariants:
- Real agent Run must spawn with cwd equal to persisted project.workspace_path; no process current_dir fallback for execution.
risks:
- Executor must inspect exact existing task status casing because DB appears PascalCase while API serializes lowercase.
- Current task create UI can create draft then assign; implementation must avoid leaving completed unassigned tasks when selected agent is required.
missing_tests:
- No implementation tests yet; future executor must add backend project/task/session/run tests and frontend modal/detail run-state tests.
---

## task
new-project-workspace-task-run-handoff — 2026-05-27

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
