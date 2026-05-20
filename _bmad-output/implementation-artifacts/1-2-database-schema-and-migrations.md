# Story 1.2: Database Schema & Migrations

**Status:** review
**Epic:** 1 — Project Foundation & Infrastructure
**Story ID:** 1.2
**Story Key:** 1-2-database-schema-and-migrations

---

## Story

As a developer,
I want the SQLite database to be created automatically on startup with all required tables,
So that the app has persistent storage ready without manual setup.

---

## Acceptance Criteria

**AC-1:** Given `~/.omni-agent/` directory does not exist / When the backend starts for the first time / Then `~/.omni-agent/omni-agent.db` is created automatically **And** all 5 tables exist: `projects`, `tasks`, `sessions`, `runs`, `comments`

**AC-2:** Given the database already exists / When the backend starts again / Then migrations are skipped (idempotent) and no error is thrown

**AC-3:** Given the `tasks` table / When inspecting the schema / Then columns include: `id` (TEXT PK, format `{KEY}-NNN`), `project_id` (FK), `seq` (INTEGER), `title`, `description`, `acceptance_criteria`, `agent`, `role`, `status` DEFAULT 'Draft', `created_at`, `updated_at`

**AC-4:** Given the `sessions` table / When inspecting the schema / Then `task_id` has a UNIQUE constraint (max one session per task)

**AC-5:** Given the `comments` table / When inspecting the schema / Then `sent` column is INTEGER DEFAULT 0 (0=pending, 1=sent)

---

## Tasks / Subtasks

- [x] **Task 1: Tạo `backend/src/db/migrations/1_init.sql`** (AC: 1, 3, 4, 5)
  - [x] 1.1 Tạo thư mục `backend/src/db/migrations/`
  - [x] 1.2 Tạo file `1_init.sql` với toàn bộ schema (5 bảng + index) theo đúng spec trong Dev Notes bên dưới
  - [x] 1.3 Kiểm tra: không có trailing semicolon thừa, đúng syntax SQLite

- [x] **Task 2: Tạo `backend/src/db/mod.rs`** (AC: 1, 2)
  - [x] 2.1 Tạo file `backend/src/db/mod.rs`
  - [x] 2.2 Viết function `run_migrations(pool: &SqlitePool) -> anyhow::Result<()>` gọi `sqlx::migrate!("src/db/migrations")`
  - [x] 2.3 Function public trong module `db`

- [x] **Task 3: Cập nhật `backend/src/main.rs`** (AC: 1, 2)
  - [x] 3.1 Thêm `mod db;` vào đầu file
  - [x] 3.2 Gọi `db::run_migrations(&pool).await?;` **sau khi** tạo pool, **trước khi** khởi tạo AppState
  - [x] 3.3 Log `"Database migrations applied"` sau khi migrate thành công
  - [x] 3.4 **KHÔNG** thay đổi bất kỳ logic nào khác trong `main.rs` — chỉ thêm migration hook

- [x] **Task 4: Verify build và acceptance criteria** (AC: 1–5)
  - [x] 4.1 Chạy `cargo build` trong `backend/` — thành công (0 errors, 2 expected warnings)
  - [x] 4.2 Dùng HOME tạm trong `/tmp`, chạy `cargo run`, verify DB được tạo
  - [x] 4.3 Kiểm tra 5 bảng qua `cargo test` vì môi trường không có `sqlite3`
  - [x] 4.4 Chạy lại `cargo run` lần 2 — không lỗi (idempotent)
  - [x] 4.5 `GET /health` trả `200 {"status":"ok"}` sau khi thêm migration
  - [x] 4.6 `GET /unknown` trả `404 {"error":"not_found","message":"Route not found"}`

---

## Dev Notes

### ⚠️ CRITICAL: sqlx feature đúng phải dùng

Story 1.1 đã xác nhận **phải dùng `runtime-tokio-rustls`**, KHÔNG phải `runtime-tokio-native-tls`:

```toml
# backend/Cargo.toml — ĐÃ ĐÚNG, KHÔNG THAY ĐỔI
sqlx = { version = "0.8", features = ["runtime-tokio-rustls", "sqlite"] }
```

Lý do: `native-tls` yêu cầu OpenSSL không có sẵn trên môi trường build. `rustls` là Rust-native TLS và đã verified build thành công ở Story 1.1.

### File cần tạo mới (NEW)

```
backend/src/db/                     ← TẠO MỚI thư mục
├── mod.rs                          ← TẠO MỚI
└── migrations/                     ← TẠO MỚI thư mục
    └── 1_init.sql                  ← TẠO MỚI (sqlx 0.8 yêu cầu integer prefix)
```

### File cần cập nhật (UPDATE)

```
backend/src/main.rs                 ← CẬP NHẬT (chỉ thêm 2 dòng)
```

**KHÔNG tạo, KHÔNG sửa** (đây là story 1.2, không phải 1.3+):
- `backend/src/models/` — Story 1.2+
- `backend/src/handlers/` — Story 2.x
- `backend/src/services/` — Story 2.x
- `backend/src/agent/` — Story 3.x

### Nội dung `1_init.sql` — chép CHÍNH XÁC

```sql
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
```

**Giải thích schema quan trọng:**
- `projects.key`: UNIQUE, uppercase alphanumeric (e.g. `"OMNI"`) — được enforce ở service layer sau
- `tasks.id`: format `{KEY}-NNN` (e.g. `"OMNI-001"`) — được tạo ở service layer
- `tasks.seq`: auto-increment per project, không phải global — service layer tính toán
- `sessions.task_id UNIQUE`: enforce max one active session per task — đây là UNIQUE constraint bắt buộc (AC-4)
- `sessions.session_id`: nullable — chưa capture được ngay sau spawn (timeout 10s theo architecture)
- `sessions.status`: `"none"|"running"|"paused"|"closed"` — khác với `tasks.status` (8 trạng thái)
- `runs.exit_code`: nullable khi đang running
- `runs.log_tail`: last ~100 lines / 10KB — KHÔNG lưu full log (hard rule)
- `comments.sent`: INTEGER 0/1 — 0=pending, 1=sent to agent (AC-5)
- Tất cả timestamps: TEXT ISO 8601 string — không dùng DATETIME hay INTEGER

### Nội dung `db/mod.rs` — pattern đúng

```rust
use sqlx::SqlitePool;

pub async fn run_migrations(pool: &SqlitePool) -> anyhow::Result<()> {
    sqlx::migrate!("src/db/migrations")
        .run(pool)
        .await
        .map_err(|e| anyhow::anyhow!("Migration failed: {}", e))?;
    Ok(())
}
```

**Lưu ý về `sqlx::migrate!()` path:**
- Path `"src/db/migrations"` là relative từ `backend/` (crate root), KHÔNG phải từ `src/`
- `sqlx::migrate!()` macro được expand lúc compile — path phải đúng lúc build
- File naming convention trong `sqlx` 0.8: `{number}_{description}.sql`
- sqlx đọc theo thứ tự version number, không alphabetical

### Cập nhật `main.rs` — chỉ thêm 2 dòng

Thêm `mod db;` vào phần declarations đầu file (sau `mod error;` và `mod state;`):

```rust
mod error;
mod state;
mod db;  // ← THÊM DÒNG NÀY
```

Thêm migrate call sau khi tạo pool, trước khi tạo AppState:

```rust
    // ... existing pool creation code ...
    let pool = sqlx::SqlitePool::connect_with(opts).await?;

    db::run_migrations(&pool).await?;   // ← THÊM DÒNG NÀY
    info!("Database migrations applied"); // ← THÊM DÒNG NÀY

    let state = AppState {              // ... existing state creation (không đổi)
```

**KHÔNG** thay đổi bất kỳ dòng nào khác trong `main.rs`.

### State hiện tại của `main.rs` (story 1.1 đã tạo)

```rust
mod error;
mod state;

use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;

use axum::{
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use tokio::sync::Mutex;
use tracing::info;
use tracing_subscriber::EnvFilter;

use error::AppError;
use state::AppState;

async fn health_handler() -> impl IntoResponse {
    Json(serde_json::json!({"status": "ok"}))
}

async fn fallback_handler() -> impl IntoResponse {
    AppError::NotFound("Route not found".to_string())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .init();

    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let db_dir = std::path::PathBuf::from(&home).join(".omni-agent");
    std::fs::create_dir_all(&db_dir)?;
    let db_url = format!("sqlite://{}/omni-agent.db", db_dir.display());

    let opts = sqlx::sqlite::SqliteConnectOptions::from_str(&db_url)?
        .create_if_missing(true);
    let pool = sqlx::SqlitePool::connect_with(opts).await?;

    let state = AppState {
        db: pool,
        subprocess_map: Arc::new(Mutex::new(HashMap::new())),
    };
    // ... (router + serve)
}
```

Phần thêm vào sẽ là sau `let pool = ...` và trước `let state = ...`.

### Learnings từ Story 1.1

| Learning | Tác động đến Story 1.2 |
|---|---|
| `runtime-tokio-rustls` bắt buộc (không phải `native-tls`) | Không thay đổi Cargo.toml — đã đúng |
| Compiler warnings cho dead code là expected | `db` field trong AppState sẽ dùng trong story này — warning sẽ biến mất sau |
| `tokio::sync::Mutex` bắt buộc, không `std::sync::Mutex` | Không ảnh hưởng story này nhưng ghi nhớ cho các story sau |
| `AppState` wrap trong `Arc<>` khi pass vào router | Không ảnh hưởng story này |
| Pool được tạo với `SqliteConnectOptions.create_if_missing(true)` | DB file đã được tạo trước khi migrate — migration chỉ cần chạy DDL |

### Kiểm tra build thủ công

```bash
cd /home/locdt/omni-agent/backend

# Build
cargo build

# Xóa DB cũ để test first-run
rm -f ~/.omni-agent/omni-agent.db

# Start server
cargo run &
SERVER_PID=$!

# Verify health
curl http://127.0.0.1:8080/health
# Expected: {"status":"ok"}

# Verify 404
curl http://127.0.0.1:8080/unknown
# Expected: {"error":"not_found","message":"Route not found"}

# Verify tables
sqlite3 ~/.omni-agent/omni-agent.db ".tables"
# Expected: comments  projects  runs  sessions  tasks

# Stop server
kill $SERVER_PID

# Test idempotency — start again, should not error
cargo run &
SERVER_PID=$!
sleep 2
curl http://127.0.0.1:8080/health
kill $SERVER_PID
```

### Unit test pattern (optional, nếu thêm)

Nếu thêm unit test, dùng in-memory SQLite:

```rust
#[cfg(test)]
mod tests {
    use sqlx::SqlitePool;

    async fn test_pool() -> SqlitePool {
        let pool = SqlitePool::connect(":memory:").await.unwrap();
        crate::db::run_migrations(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn migrations_are_idempotent() {
        let pool = test_pool().await;
        // Second run should not fail
        crate::db::run_migrations(&pool).await.unwrap();
    }
}
```

### Cross-story dependencies

Story 1.2 là **prerequisite** cho:
- **Story 2.1 (Project Management):** `projects` table phải tồn tại
- **Story 2.2 (Task CRUD):** `tasks` table phải tồn tại, FK constraint phải đúng
- **Story 3.1 (Session lifecycle):** `sessions`, `runs` tables phải tồn tại
- **Story 3.3 (Resume):** `comments` table + `sent` flag phải tồn tại

Không có story nào trong Epic 2 hay Epic 3 có thể bắt đầu trước khi Story 1.2 hoàn thành.

### sqlx migrate! macro — cạm bẫy thường gặp

1. **Path resolution:** `sqlx::migrate!("src/db/migrations")` — path tương đối từ package root (thư mục chứa `Cargo.toml`). Nếu dùng `"./src/db/migrations"` cũng work.
2. **File naming:** Với `sqlx` 0.8 trong repo này, file phải dùng integer version prefix như `1_init.sql`. `V1__init.sql` fail compile với lỗi `expected integer version prefix`.
3. **Compile-time embed:** macro `sqlx::migrate!()` embed SQL vào binary lúc compile — nếu sửa SQL phải rebuild.
4. **Migration tracking:** sqlx tạo table `_sqlx_migrations` để track đã apply migration nào — đây là cơ chế idempotency.
5. **Không dùng `sqlx::query!()` macro** trong story này vì cần `DATABASE_URL` env var lúc compile — dùng `sqlx::query()` (không macro) cho các story sau.

---

## References

- **Architecture:** `_bmad-output/planning-artifacts/architecture.md` — Section "Gap Analysis & Resolutions > Gap 1 — DB Schema"
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md` — Section "Structure Patterns > Backend"
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md` — Section "Data Architecture"
- **Epics:** `_bmad-output/planning-artifacts/epics.md` — Story 1.2 Acceptance Criteria
- **Previous Story:** `_bmad-output/implementation-artifacts/1-1-monorepo-setup-and-backend-scaffold.md` — Dev Agent Record
- **Project Context:** `_bmad-output/project-context.md` — Section "Critical Don't-Miss Rules"

---

## Dev Agent Record

### Agent Model Used

Codex GPT-5

### Debug Log References

- `cargo build` — pass, 0 errors, 2 expected dead-code warnings
- `cargo test` — pass, 2 tests
- `cargo run` with temporary `HOME` — startup migration applied, DB file created
- `curl -i http://127.0.0.1:8080/health` — HTTP 200 `{"status":"ok"}`
- `curl -i http://127.0.0.1:8080/unknown` — HTTP 404 `{"error":"not_found","message":"Route not found"}`

### Completion Notes List

- Implemented automatic SQLite migrations on backend startup.
- Added focused migration tests for idempotency and schema contract because `sqlite3` CLI is unavailable in this environment.
- Adjusted migration filename from the original `V1__init.sql` note to `1_init.sql` because `sqlx` 0.8 rejects `V1__init.sql` at compile time.

### File List

**Tạo mới:**
- `backend/src/db/mod.rs`
- `backend/src/db/migrations/1_init.sql`

**Cập nhật:**
- `backend/src/main.rs` (thêm `mod db;` và 2 dòng migrate call)
- `_bmad-output/implementation-artifacts/1-2-database-schema-and-migrations.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `docs/product/storage.md`
- `docs/TEST_MATRIX.md`
