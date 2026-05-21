# Yêu Cầu Product

## Entities Chính

- **Project**: top-level grouping for tasks. Project key is unique and forms
  the prefix for task IDs.
- **Task**: central work unit with title, description, acceptance criteria,
  status, assigned agent, and optional session.
- **Session**: CLI agent session attached to one task. A task has at most one
  session.
- **Run**: one start or resume execution inside a session.
- **Comment**: user input queued or sent to an agent on resume.

## Lifecycle Của Task

MVP statuses:

```text
Draft -> Ready -> Assigned -> Running -> Paused -> Done
                                      \-> Failed -> Running
Paused -> Cancelled
Failed -> Cancelled
```

Rules:

- New tasks start as `Draft`.
- Assigning an agent moves `Draft` or `Ready` to `Assigned`.
- `Assigned` tasks can start a session.
- Subprocess exit code `0` moves `Running` to `Paused`.
- Non-zero exit moves `Running` to `Failed`.
- `Paused` and `Failed` can resume.
- `Done` and `Cancelled` are read-only for task editing.

## Yêu Cầu Chức Năng

| ID | Requirement |
| --- | --- |
| FR-0 | Project CRUD with unique uppercase alphanumeric project key; deleting a project with tasks is blocked. |
| FR-1 | Create task with required title and description, optional acceptance criteria, and project-scoped ID `{PROJECT_KEY}-NNN`. |
| FR-2 | Assign Codex or Claude and a role to a task in `Draft` or `Ready`; status becomes `Assigned`. |
| FR-3 | Edit task details except when task is `Done` or `Cancelled`; delete only `Draft` tasks. |
| FR-4 | Kanban board shows every task in exactly one status column. |
| FR-5 | Start session for `Assigned` task by spawning CLI subprocess and capturing session ID. |
| FR-6 | Detect subprocess exit and update task status; browser close must not kill subprocess. |
| FR-7 | Resume `Paused` or `Failed` tasks using the stored session ID and optional comment. |
| FR-8 | Store full run output on disk and only a bounded tail in SQLite. |
| FR-9 | Add non-empty comments to any task except `Cancelled`. |
| FR-10 | Use selected/newest unsent comment as resume input and mark it sent. |
| FR-11 | Task detail panel shows task fields, session panel, comments, runs, and state-valid actions. |
| FR-12 | Session panel shows agent, hidden-by-default session ID, session status, created time, and last resume time. |

## Yêu Cầu Phi Chức Năng

| ID | Requirement |
| --- | --- |
| NFR-1 | Backend owns subprocess lifecycle independently from HTTP requests and browser sessions. |
| NFR-2 | Session ID capture has primary parse path plus fallback and manual recovery. |
| NFR-3 | Full logs live on disk; SQLite stores metadata and bounded tail only. |
| NFR-4 | Agent-specific spawn/resume behavior phải được cô lập sau agent strategy abstraction. |
| NFR-5 | Backend shutdown flushes `Running` tasks to `Paused` before exit. |
| NFR-6 | UI targets WCAG 2.1 AA. |
| NFR-7 | Resume should start subprocess within 30 seconds. |
| NFR-8 | Running task status updates in-place through polling for MVP. |
