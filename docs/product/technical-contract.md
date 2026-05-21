# Contract Kỹ Thuật

## Stack

- Frontend: React + TypeScript + Vite, strict mode.
- Backend: Rust + Axum + Tokio.
- Database: SQLite via SQLx connection pool.
- Agents: Codex CLI and Claude CLI via subprocess only.
- Environment: local-only, single-user.

## Contract Backend

Current backend foundation:

- `GET /health` returns `200` with `{"status":"ok"}`.
- Unknown routes return error envelope:

```json
{"error":"not_found","message":"Route not found"}
```

Route shape dự kiến:

```text
GET    /api/projects
POST   /api/projects
PUT    /api/projects/{id}
DELETE /api/projects/{id}

GET    /api/projects/{id}/tasks
POST   /api/projects/{id}/tasks
GET    /api/projects/{id}/tasks/{task_id}
PUT    /api/projects/{id}/tasks/{task_id}
DELETE /api/projects/{id}/tasks/{task_id}

POST   /api/projects/{id}/tasks/{task_id}/sessions/start
POST   /api/projects/{id}/tasks/{task_id}/sessions/resume
POST   /api/projects/{id}/tasks/{task_id}/sessions/cancel

GET    /api/projects/{id}/tasks/{task_id}/runs
GET    /api/projects/{id}/tasks/{task_id}/runs/{run_id}

POST   /api/projects/{id}/tasks/{task_id}/comments
```

All JSON fields should use `camelCase`.

## Contract Database

Migration `backend/src/db/migrations/1_init.sql` creates:

- `projects`
- `tasks`
- `sessions`
- `runs`
- `comments`

Constraints quan trọng:

- `projects.key` is unique.
- `tasks.project_id` references `projects(id)`.
- `sessions.task_id` is unique to enforce one session per task.
- `comments.sent` defaults to `0`.
- Timestamps are stored as ISO 8601 text.

## Contract Agent Execution

- Backend is the subprocess owner.
- Browser/tab close must not kill a subprocess.
- Codex resume command: `codex resume <uuid>`.
- Claude resume command: `claude --continue --session-id <uuid>`.
- Subprocesses are killed only on user cancel, backend shutdown, or timeout
  policy.
- Empty resume input should be logged as `retry`, not treated as an error.

## Contract Log

- Runtime log files live under `~/.omni-agent/logs/{task_id}/{run_id}.log`.
- SQLite stores the log path and bounded tail only.
- Do not store full stdout/stderr in SQLite.
