CREATE TABLE projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    key         TEXT NOT NULL UNIQUE,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE tasks (
    id                  TEXT PRIMARY KEY,
    project_id          TEXT NOT NULL REFERENCES projects(id),
    seq                 INTEGER NOT NULL,
    title               TEXT NOT NULL,
    description         TEXT NOT NULL,
    acceptance_criteria TEXT,
    agent               TEXT,
    role                TEXT,
    status              TEXT NOT NULL DEFAULT 'Draft',
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);

CREATE TABLE sessions (
    id          TEXT PRIMARY KEY,
    task_id     TEXT NOT NULL UNIQUE REFERENCES tasks(id),
    agent       TEXT NOT NULL,
    session_id  TEXT,
    status      TEXT NOT NULL DEFAULT 'none',
    created_at  TEXT NOT NULL,
    last_active TEXT NOT NULL
);

CREATE TABLE runs (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES sessions(id),
    run_number  INTEGER NOT NULL,
    input       TEXT,
    exit_code   INTEGER,
    log_path    TEXT,
    log_tail    TEXT,
    started_at  TEXT NOT NULL,
    ended_at    TEXT
);
CREATE INDEX idx_runs_session_id ON runs(session_id);

CREATE TABLE comments (
    id          TEXT PRIMARY KEY,
    task_id     TEXT NOT NULL REFERENCES tasks(id),
    content     TEXT NOT NULL,
    sent        INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL
);
CREATE INDEX idx_comments_task_id ON comments(task_id);
