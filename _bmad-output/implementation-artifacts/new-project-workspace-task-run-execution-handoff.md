# Execution Handoff

## 1. Objective

Implement project-level workspace support and real task execution flow. `Project.workspace_path` is the only workspace source of truth; tasks inherit it from parent project. Run must start a real async session/run in the project workspace using the assigned agent.

## 2. Final Decision

Readiness gate: **PASS**.

- Add nullable `Project.workspace_path` DB column for legacy compatibility.
- New project creation requires valid non-null `workspace_path`.
- Tasks have no task-level workspace override.
- Task creation must require selected agent/role; no default auto-pick.
- Existing task reassignment allowed only for `Draft`, `Ready`, `Assigned`.
- Run allowed only when task has assigned agent and parent project has valid workspace.
- Start session transitions task `Assigned -> Running`, creates async session/run, and executes spawned agent command with `cwd = project.workspace_path`.
- Do not add `runs.status`; infer from `ended_at` and `exit_code`.

## 3. Original Request Alignment

- Thay đổi/mở rộng: adds backend validation/error contracts, legacy NULL behavior, spawn cwd contract, failure semantics.
- Thu hẹp/trì hoãn: no task-level workspace override, no default agent, no `runs.status`, no canonical path storage.

## 4. Implementation Scope

- **In Scope:** DB migration, backend project/task/session/run contracts, workspace validation, run guards, agent spawn cwd, frontend forms/actions/types/tests.
- **Out of Scope:** task-level workspace, auto-select default agent, writable workspace requirement, canonicalizing stored paths, new run status field, broad session model rewrite.

## 5. Target Files / Areas To Inspect Or Modify

| Area / File Path | Expected Work |
|---|---|
| `backend/src/models/project.rs` | Add `workspace_path` field consistent with legacy nullable DB. |
| `backend/src/services/projects.rs` | Validate/store trimmed original workspace path on create/update. |
| `backend/src/handlers/projects.rs` | Expose request/response/API error `invalid_workspace_path`. |
| `backend/src/db/migrations/*.sql` | Add nullable `workspace_path` column. |
| `backend/src/db/mod.rs` | Ensure mapping/query compatibility. |
| `backend/src/models/task.rs` | Inspect exact status casing/serialization; preserve existing pattern. |
| `backend/src/services/tasks.rs` | Require assignment in create workflow or guarantee no completed task without selected agent; enforce reassignment status guard. |
| `backend/src/handlers/tasks.rs` | Return `task_not_assignable` for invalid reassignment. |
| `backend/src/services/sessions.rs` | Enforce run guards; handle transition/failure semantics; pass workspace cwd. |
| `backend/src/agent/mod.rs` | Ensure strategy API can receive cwd. |
| `backend/src/agent/{codex,claude}.rs` | Spawn command with persisted project workspace cwd; no current_dir fallback for real Run. |
| `backend/src/models/run.rs` | Preserve no `status`; ensure `ended_at`/`exit_code` semantics. |
| `backend/src/services/runs.rs` | Preserve list/get behavior and inferred state. |
| `backend/tests/{projects,tasks,sessions,runs}_test.rs` | Add focused tests for validation, guards, transitions, failures. |
| `frontend/src/types/{project,task}.ts` | Add workspace/assignment typing. |
| `frontend/src/api/{projects,tasks,sessions,runs}.ts` | Update payload/response/error handling. |
| `frontend/src/features/project/CreateProjectModal.tsx/css` | Add required workspace path input and validation display. |
| `frontend/src/components/CreateTaskModal.tsx/css` | Require agent/role selection; prevent create without selection. |
| `frontend/src/features/detail/TaskDetailPanel.tsx/test` | Verify workspace missing and Run disabled states. |
| `frontend/src/hooks/useStartSession.ts` | Surface run guard errors. |
| `frontend run/log/detail tests` | Cover Run button, session start, logs/detail continuity. |

## 6. Technical Contracts

- **Data / State Contract:**
  - `Project.workspace_path` is source of truth.
  - DB column nullable only for legacy projects.
  - New create requires non-null valid path.
  - Store trimmed original input, not canonicalized.
  - Symlink accepted if target is accessible directory.
  - Legacy `NULL` project can list/render but cannot Run.
  - Existing task status casing may be DB PascalCase and serialized lowercase; executor must inspect and preserve current pattern.
  - Run state remains inferred:
    - running: `runs.ended_at IS NULL`
    - ended success/failure: `runs.exit_code` once `ended_at` is set.

- **Validation Contract:**
  - Trim input.
  - Must be absolute path.
  - Must exist on server.
  - Must be directory.
  - Process must be able to traverse/read enough to start agent.
  - Writable is not required.
  - Stable validation error code: `invalid_workspace_path`.

- **Action / Guard Contract:**
  - Reassign agent allowed only for `Draft`, `Ready`, `Assigned`.
  - Reassign rejected for `Running`, `Paused`, `Failed`, `Completed`, `Cancelled` with `task_not_assignable`.
  - Start Run allowed only if task has assigned agent and project has valid workspace.
  - Missing legacy workspace blocks Run with `project_workspace_missing`.
  - Start session transitions `Assigned -> Running`.

- **Failure Contract:**
  - Spawn fail before session/run persisted: create no run record; revert task to `Assigned`.
  - Fail after run persisted: set `ended_at`, non-zero `exit_code`, task `Failed`.

- **UI / UX Contract:**
  - Create Project modal shows required workspace path.
  - Legacy project with missing workspace renders visible label `Workspace missing`.
  - Run button disabled when workspace missing or task not assigned.
  - Create Task modal requires explicit agent/role selection.
  - No default selected agent unless user explicitly selects one.

- **API / Backend Contract:**
  - Project create/update validation errors use `invalid_workspace_path`.
  - Run start missing workspace uses `project_workspace_missing`.
  - Invalid reassignment uses `task_not_assignable`.
  - Real Run must spawn assigned agent with `cwd = persisted project.workspace_path`.

## 7. Execution Plan For Future Executor

1. Inspect current models, migrations, status serialization, task assignment flow, and session spawn flow.
2. Add nullable project workspace migration and backend model/API support.
3. Implement workspace validation in project service/handler.
4. Update task create/reassign flow to require selected agent and enforce allowed statuses.
5. Update session start guard, transition, failure handling, and cwd propagation.
6. Update frontend types, APIs, project/task modals, detail panel Run action, and error states.
7. Add focused backend/frontend tests and run relevant suites.

## 8. Verification & Risks

- **Acceptance Criteria:**
  - New project cannot be created without valid absolute accessible directory path.
  - Legacy project with NULL workspace still lists/renders.
  - Legacy workspace-missing project cannot Run and shows `Workspace missing`.
  - Task create cannot complete without selected agent/role.
  - Reassignment only works in `Draft`, `Ready`, `Assigned`.
  - Run without assigned agent is blocked.
  - Run with assigned agent and valid workspace creates async session/run and sets task Running.
  - Spawned command cwd equals persisted `project.workspace_path`.
  - No `runs.status` field added.

- **Required Tests:**
  - Backend project validation tests.
  - Backend task create/reassign guard tests.
  - Backend session start guard/transition/failure tests.
  - Backend run inference regression tests.
  - Frontend modal validation tests.
  - Frontend Run disabled/error state tests.
  - Frontend run/log/detail regression tests.

- **Regression Risks:**
  - Breaking legacy project rendering due nullable workspace.
  - Status casing mismatch between DB/model/API.
  - Creating draft task before assignment and leaving orphan unassigned task.
  - Existing session fallback accidentally running in process cwd.
  - Async spawn failure leaving task stuck Running.

- **Evidence Required:**
  - Migration applied cleanly.
  - Backend test output for project/task/session/run suites.
  - Frontend test output for affected modal/detail/run areas.
  - Short log or assertion proving spawned command receives project workspace cwd.

## 9. Do Not Do

- Do not add task-level workspace override.
- Do not auto-pick a default agent.
- Do not require workspace to be writable.
- Do not canonicalize stored workspace path.
- Do not add `runs.status`.
- Do not allow current process cwd fallback for real Run.
- Do not silently allow reassignment while Running or terminal states.
- Do not implement unrelated refactors.
