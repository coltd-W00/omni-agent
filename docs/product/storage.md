# Storage

Omni Agent uses a local SQLite database at `~/.omni-agent/omni-agent.db`.
The backend creates the containing directory and database file on startup, then
applies embedded `sqlx` migrations before building application state.

## Initial Schema

The initial migration owns five tables:

- `projects`: project identity, display name, unique project key, timestamps.
- `tasks`: task records tied to a project, with per-project `seq`, task text,
  optional agent/role assignment, status defaulting to `Draft`, and timestamps.
- `sessions`: one session per task enforced by `task_id UNIQUE`; stores agent,
  optional external session id, status defaulting to `none`, and activity times.
- `runs`: execution attempts for a session, including input, optional exit code,
  log metadata, bounded log tail, and start/end timestamps.
- `comments`: task comments with `sent INTEGER NOT NULL DEFAULT 0` where `0`
  means pending and `1` means sent to the assigned agent.

All timestamps are stored as ISO 8601 `TEXT`. Product-level formats such as
`tasks.id = {KEY}-NNN`, uppercase project keys, and per-project task sequencing
are enforced by later service-layer stories, not by the initial migration.
