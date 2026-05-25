# Story 3.1: AgentStrategy Trait & Start Session

Status: ready-for-dev

<!-- Validation tùy chọn — chạy validate-create-story trước khi dev-story nếu muốn double-check. -->

**Epic:** 3 — Session Lifecycle & Agent Execution
**Story ID:** 3.1
**Story Key:** 3-1-agentstrategy-trait-and-start-session
**Lane (FEATURE_INTAKE.md):** high-risk — đây là story đầu tiên của Epic 3 và là lần đầu app spawn subprocess đến **CLI provider bên ngoài** (Claude/Codex). Risk flags: Data model (insert `sessions` + `runs` lần đầu), External provider behavior (spawn `claude` / `codex` binary qua `tokio::process::Command::spawn` — hard gate), Public contracts (route mới `POST /api/projects/{projectId}/tasks/{taskId}/sessions/start`), Existing behavior (mở rộng state machine `Task.status` `Assigned → Running` trong `services/tasks.rs`), Weak proof (chưa có test nào quanh `agent/` / `services/sessions.rs`). **5 flags + 1 hard gate → high-risk lane.** Story file vẫn dùng single-file BMAD template (theo convention các story trước trong `_bmad-output/implementation-artifacts/`), nhưng tăng cường Validation section, mock-binary test pattern, và rollback discipline cho subprocess.

---

## Story

As a developer using omni-agent,
I want to start an agent session cho một task đang ở status `Assigned`, giao đúng cho `claude` hoặc `codex` CLI qua subprocess không-blocking, đồng thời capture session ID khi CLI in ra (hoặc fallback scan filesystem cho Codex),
So that CLI agent thực sự bắt đầu xử lý task, app track được handle subprocess + session ID để Story 3.2 (exit detection) và Story 3.3 (resume) build tiếp trên cùng abstraction.

---

## Acceptance Criteria

> **Nguồn gốc AC:** `_bmad-output/planning-artifacts/epics.md` Story 3.1 (dòng 538–575) + `_bmad-output/planning-artifacts/architecture.md` §"Core Architectural Decisions" / §"Project Structure & Boundaries" / §"Gap 1 DB Schema" / §"Gap 3 Session ID Capture Timeout" + `_bmad-output/project-context.md` §"Critical Implementation Rules" và §"Critical Don't-Miss Rules". Backend dùng error envelope `{ "error": "<code>", "message": "<text>" }` (architecture §"Format Patterns"), JSON `camelCase` (serde `rename_all = "camelCase"`), task status DB lưu **PascalCase** (`"Assigned"`, `"Running"`) nhưng serialize wire **lowercase** (theo `models/task.rs::serialize_status_lowercase`).

**AC-1 — `AgentStrategy` trait + 2 impl bắt buộc:**
**Given** module `backend/src/agent/`
**When** inspect mã nguồn
**Then** tồn tại trait `AgentStrategy: Send + Sync + std::fmt::Debug` với (tối thiểu) các method:
- `fn name(&self) -> &'static str;` — trả `"claude"` hoặc `"codex"`.
- `fn spawn_command(&self, task: &Task, log_path: &Path) -> tokio::process::Command;` — build command chưa spawn (caller chịu trách nhiệm `.spawn()`).
- `fn resume_command(&self, session_id: &str, comment: Option<&str>) -> tokio::process::Command;` — Story 3.1 chỉ cần định nghĩa method này; **không có handler dùng nó ở 3.1** (Story 3.3 sẽ wire).
- `fn parse_session_id_chunk(&self, chunk: &str) -> Option<String>;` — parse 1 chunk stdout (utf8 lossy ok), trả `Some(session_id)` nếu khớp pattern agent đó, ngược lại `None`.
- `fn fallback_session_id_lookup(&self, cwd: &Path, started_at: chrono::DateTime<chrono::Utc>) -> Option<String> { None }` — default `None`, **chỉ `CodexStrategy` override**.

**And** tồn tại `ClaudeStrategy` (file `backend/src/agent/claude.rs`) và `CodexStrategy` (file `backend/src/agent/codex.rs`) đều impl trait này.
**And** tồn tại factory `pub fn strategy_for(agent: &str) -> Result<Box<dyn AgentStrategy>, AppError>` trong `agent/mod.rs`:
- `"claude"` → `Ok(Box::new(ClaudeStrategy::default()))`.
- `"codex"` → `Ok(Box::new(CodexStrategy::default()))`.
- giá trị khác → `Err(AppError::BadRequest { code: "invalid_agent", message: "Agent must be one of: codex, claude" })` (reuse message với `assign_agent` Story 2.2 để giữ contract nhất quán).

**Mục tiêu:** `services/sessions.rs` chỉ gọi qua `AgentStrategy`. Không có `match agent { "claude" => ... }` ngoài module `agent/` (architecture §"Architectural Boundaries").

---

**AC-2 — Spawn happy path cho Claude (subprocess thực tế qua mock binary):**
**Given** task `OMNI-001` ở status `Assigned` với `agent = "claude"`, `role = "coder"`
**And** binary `claude` resolved trên PATH (production) **hoặc** env var `OMNI_AGENT_CLAUDE_BIN` trỏ đến mock binary (test) — xem Dev Notes §"Binary resolution + test override"
**When** client gửi `POST /api/projects/{projectId}/tasks/OMNI-001/sessions/start` với body rỗng `{}` (hoặc không có body)
**Then** backend:
1. Spawn subprocess non-blocking qua `tokio::process::Command::spawn` (KHÔNG dùng blocking `std::process::Command`).
2. INSERT row mới vào bảng `sessions`: `id = <uuid>`, `task_id = "OMNI-001"`, `agent = "claude"`, `session_id = NULL`, `status = "running"`, `created_at = <now>`, `last_active = <now>`.
3. INSERT row mới vào bảng `runs`: `id = <uuid>`, `session_id = <session.id>`, `run_number = 1`, `input = NULL`, `exit_code = NULL`, `log_path = "~/.omni-agent/logs/OMNI-001/<run.id>.log"` (resolved tuyệt đối tới `$HOME/.omni-agent/logs/OMNI-001/<run.id>.log`), `log_tail = NULL`, `started_at = <now>`, `ended_at = NULL`.
4. UPDATE `tasks` SET `status = 'Running'`, `updated_at = <now>` WHERE `id = "OMNI-001"` AND `status = 'Assigned'` — chỉ trong `services/tasks.rs` (không trong `handlers/sessions.rs` hoặc `services/sessions.rs` trực tiếp; xem AC-7).
5. Register `Child` handle vào `AppState.subprocess_map` với key `task_id` (`"OMNI-001"`).
6. Spawn background tokio task để: (a) stream `Child::stdout` ghi vào `log_path` (append), (b) gọi `strategy.parse_session_id_chunk` cho mỗi chunk cho đến khi capture được session ID hoặc 10s timeout (xem AC-4).
7. Response **`200 OK`** với body:
```json
{
  "sessionPk": "<uuid của session row>",
  "taskId": "OMNI-001",
  "sessionId": null,
  "sessionIdMissing": false,
  "status": "running",
  "createdAt": "<iso8601>"
}
```
- `sessionPk` là UUID nội bộ (PK của `sessions` row), khác với CLI session ID (parse từ stdout, lưu vào `session_id` cột).
- `sessionId` luôn `null` tại thời điểm response vì capture chạy async — frontend sẽ poll task để lấy session ID sau (Story 3.5a).
- `sessionIdMissing: false` tại response time (capture chưa timeout). Polling task (Story 3.5a) sẽ thấy `sessionIdMissing: true` nếu sau 10s vẫn `null`.

**Whitespace:** không có body field cần validate — request body có thể là `{}` hoặc empty (`Content-Length: 0`).

---

**AC-3 — Session ID capture từ stdout JSON cho Claude:**
**Given** subprocess Claude đã spawn (AC-2)
**When** background streaming task đọc 1 chunk stdout chứa text JSON dạng `{"session_id":"abc-123-uuid","type":"start","cwd":"/path"}`
**Then** `ClaudeStrategy::parse_session_id_chunk(chunk)` trả `Some("abc-123-uuid")`.
**And** background task UPDATE `sessions SET session_id = 'abc-123-uuid', last_active = <now> WHERE id = <session_pk>`.
**And** background task tiếp tục streaming stdout vào log file đến khi subprocess kết thúc (exit detection và `runs.exit_code` là Story 3.2 — Story 3.1 chỉ ghi stdout vào log file, KHÔNG update `exit_code` / `ended_at`).

**Parse pattern (Claude):** tìm regex hoặc serde_json `Value` parse — match trên field tên `session_id` (snake_case). Pattern cụ thể (Dev Notes §"Claude stdout format"): scan từng dòng stdout (newline-delimited), thử `serde_json::from_str::<Value>(line)`, nếu có key `"session_id"` là string → capture. KHÔNG match trên text raw không phải JSON (tránh false positive).

---

**AC-4 — Session ID capture timeout (10 giây):**
**Given** subprocess vừa spawn (AC-2)
**And** background streaming task không capture được session ID trong 10 giây
**When** timeout đến (đo từ thời điểm sau `.spawn()`)
**Then** background task ghi `tracing::warn!(task_id = %task_id, "session_id not captured within 10s; subprocess continues, session.session_id stays NULL")`.
**And** subprocess **KHÔNG bị kill** — vẫn chạy tiếp; chỉ "session ID capture" timeout, không phải subprocess timeout.
**And** record `sessions.session_id` giữ `NULL`. Frontend polling task (Story 3.5a) sẽ thấy `sessionIdMissing: true` và hiển thị manual input UI (out-of-scope Story 3.1).
**And** background task tiếp tục stream stdout vào log file (Story 3.2 xử lý exit detection và update tail).

**Hard rule:** Không kill subprocess khi timeout (project-context.md §"Critical Don't-Miss Rules" — "Subprocess bị kill **chỉ** trong 3 trường hợp: user bấm Cancel, backend shutdown, timeout policy"; "timeout policy" hiện chưa định nghĩa cho Story 3.1, tức là KHÔNG timeout kill).

---

**AC-5 — Codex session ID capture: primary stdout, fallback filesystem scan:**
**Given** task với `agent = "codex"` đã spawn (AC-2 nhưng dùng `CodexStrategy`)
**When** background streaming task đọc stdout của `codex` binary
**Then** primary path: gọi `CodexStrategy::parse_session_id_chunk(chunk)` cho mỗi chunk. Pattern Codex (Dev Notes §"Codex stdout format"): scan line theo line, thử `serde_json::from_str::<Value>` và tìm key `session_id` (giống Claude), HOẶC match regex `"id":"([0-9a-fA-F-]{36})"` trong text rolling (Codex CLI có thể in event-stream JSON hoặc text — implementation chọn pattern an toàn nhất).
**And** nếu sau **2 giây** stdout primary path chưa capture được session ID **AND** subprocess vẫn alive, background task chạy fallback **một lần**:
1. Resolve `OMNI_AGENT_CODEX_SESSIONS_DIR` env var nếu set (test), else mặc định `~/.codex/sessions/`.
2. Scan tất cả file `.json` (hoặc `*.jsonl`) trong dir đó.
3. Lọc theo `mtime ≥ subprocess_started_at - 2s` (cho phép sai số đồng hồ).
4. Lấy file mtime gần nhất, parse session ID từ filename hoặc nội dung (Dev Notes §"Codex fallback filesystem layout").
5. Nếu tìm thấy → UPDATE `sessions.session_id`, không trigger lại fallback.
6. Nếu không tìm thấy → log warning, fallback đã chạy, không retry.
**And** Primary path tiếp tục chạy song song với fallback — nếu primary capture trước fallback → fallback skip.

**Test approach (AC-5):** integration test set `OMNI_AGENT_CODEX_SESSIONS_DIR` trỏ đến tmp dir; tạo file `<uuid>.json` với mtime gần đây; verify capture thành công.

---

**AC-6 — Lỗi: CLI binary không có trên PATH (`agent_not_found`):**
**Given** task `OMNI-001` ở status `Assigned`, `agent = "claude"`
**And** binary `claude` KHÔNG trên PATH (production) **hoặc** `OMNI_AGENT_CLAUDE_BIN` set nhưng path không tồn tại (test)
**When** client gửi `POST .../sessions/start`
**Then** backend KHÔNG insert vào `sessions` hoặc `runs`, KHÔNG transition task status, KHÔNG register vào `subprocess_map`.
**And** response **`400 Bad Request`** với body:
```json
{ "error": "agent_not_found", "message": "Agent binary not found on PATH" }
```
**And** task status vẫn là `Assigned` (DB row không đổi).

**Implementation:** `tokio::process::Command::spawn()` trả `Err` khi binary không tồn tại trên PATH (`io::ErrorKind::NotFound`). `services/sessions.rs::start_session` map error này → `AppError::BadRequest { code: "agent_not_found", .. }`. Phân biệt với các IO error khác (permission denied, …) — chỉ `NotFound` mới map sang `agent_not_found`, các IO error khác → `AppError::Internal` (500).

---

**AC-7 — Lỗi: task status sai (status không phải Assigned):**
**Given** task `OMNI-001` ở status `Draft` / `Ready` / `Running` / `Paused` / `Failed` / `Done` / `Cancelled` / `NeedsReview` / `ChangesRequested`
**When** client gửi `POST .../sessions/start`
**Then** backend trả error tương ứng (KHÔNG insert/spawn):
- `Draft`, `Ready` → `409 Conflict` `{ "error": "task_not_assigned", "message": "Cannot start session: task <id> is in <status> status (must be assigned)" }` — status lowercased trong message.
- `Running` → `409 Conflict` `{ "error": "session_already_active", "message": "Task <id> already has an active session" }` — phân biệt rõ với `task_not_assigned` vì semantics khác (đã có session đang chạy).
- `Paused`, `Failed` → `409 Conflict` `{ "error": "task_not_assigned", "message": "Cannot start session: task <id> is in <status> status (must be assigned; use /sessions/resume for paused/failed)" }`.
- `Done`, `Cancelled`, `NeedsReview`, `ChangesRequested` → `409 Conflict` `{ "error": "task_not_assigned", "message": "Cannot start session: task <id> is in <status> status (must be assigned)" }`.

**Implementation pattern (TOCTOU-safe):** đặt logic transition trong `services/tasks.rs::transition_to_running(pool, project_id, task_id) -> Result<Task, AppError>`. Hàm này:
1. `BEGIN IMMEDIATE` transaction (write lock từ đầu).
2. SELECT task — nếu không tồn tại → `NotFound { code: "task_not_found", .. }`.
3. Verify `existing.agent IS NOT NULL` — nếu `NULL` → `Conflict { code: "task_not_assigned", message: "Cannot start session: task <id> has no agent assigned" }`. (Defensive — workflow assign trước Start, nhưng schema cho phép NULL.)
4. UPDATE `tasks SET status = 'Running', updated_at = ? WHERE id = ? AND project_id = ? AND status = 'Assigned'` — atomic, race-safe.
5. Check `rows_affected`. Nếu 0:
   - Re-fetch task để biết status thực tế.
   - Map status → error code (theo bảng phía trên).
6. Nếu 1 → COMMIT, return updated `Task`.

`services/sessions.rs::start_session` gọi `transition_to_running` **trước khi spawn** subprocess. Nếu transition fail → return error luôn, không spawn. Nếu transition success **rồi** spawn fail → revert: gọi `revert_to_assigned(task_id)` trong `services/tasks.rs` (UPDATE status='Assigned' WHERE id=? AND status='Running') và return error (xem Dev Notes §"Rollback discipline").

---

**AC-8 — Lỗi: task không tồn tại (`task_not_found`) hoặc project không khớp:**
**Given** `project_id` không tồn tại HOẶC `task_id` không tồn tại HOẶC `task_id` tồn tại nhưng thuộc project khác
**When** client gửi `POST /api/projects/{projectId}/tasks/{taskId}/sessions/start`
**Then** response `404 Not Found` với envelope:
- project không tồn tại → `{ "error": "project_not_found", "message": "Project <id> does not exist" }`.
- task không tồn tại (hoặc thuộc project khác) → `{ "error": "task_not_found", "message": "Task <id> does not exist" }` — reuse pattern Story 2.2 `get_task` (không leak thông tin "tồn tại nhưng project khác" — cùng thông điệp).

---

**AC-9 — Subprocess registered đúng key, log file path đúng convention:**
**Given** start session thành công (AC-2)
**When** inspect `AppState.subprocess_map` ngay sau response trả về client
**Then** key trong map là `task_id` (`"OMNI-001"`), value là `tokio::process::Child` handle.
**And** file `~/.omni-agent/logs/OMNI-001/<run.id>.log` tồn tại (background streaming task đã tạo + append).
**And** parent dir `~/.omni-agent/logs/OMNI-001/` tự động được tạo nếu chưa có (`std::fs::create_dir_all`).
**And** `runs.log_path` trong DB khớp với path tuyệt đối của file đó.

**Lưu ý concurrency:** `subprocess_map: Arc<Mutex<HashMap<String, Child>>>` (đã có trong `AppState` Story 1.1). Insert key trong critical section `.lock().await` ngắn nhất có thể (chỉ HashMap::insert, không await IO trong critical section).

**Lưu ý task_id collision:** AC-7 đã guard — task chỉ vào subprocess_map khi transition Assigned → Running thành công, và `sessions.task_id UNIQUE` (DB schema) đảm bảo không có 2 session cho cùng task. Nếu key đã tồn tại trong map (defensive check) → log error + revert + return `Conflict { code: "session_already_active", .. }`.

---

**AC-10 — Mount route mới + regression Story 1.1/2.1/2.2:**
**Given** backend chạy `cargo run`
**When** route mới được mount: `POST /api/projects/{projectId}/tasks/{taskId}/sessions/start` → `handlers::sessions::start_session`
**Then** `GET /health` vẫn trả `200 OK` `{"status":"ok"}` (regression guard, giống Story 2.1/2.2).
**And** `GET /api/projects` + `POST /api/projects` + `DELETE /api/projects/{id}` vẫn hoạt động (Story 2.1).
**And** task CRUD routes Story 2.2 vẫn hoạt động.
**And** `Cargo.toml` thêm dependencies cần thiết với versions cụ thể (Dev Notes §"Dependencies thêm mới"): `regex = "1"`, `tokio` đã có sẵn (`features = ["full"]` đủ).

---

**AC-11 — Frontend wiring tối thiểu: "Start Session" button gọi API:**
**Given** Story 2.4 đã mount Task Detail Panel với `ActionBar`, button **"Start Session"** đã render khi `task.status === "assigned"` (stub không onClick)
**When** Story 3.1 wire button
**Then** click button gọi mutation `useStartSession(projectId, taskId)`:
- Trên success (`200`): invalidate query `['task', projectId, taskId]` (Story 2.3 cache key — verify trong codebase) + invalidate `['tasks', projectId]` để Task Board refetch. Toast `success` `"Session started for <taskId>"`. Button trong cùng panel sẽ tự ẩn vì task status đã đổi (re-render với `status="running"` → ActionBar return `null` theo AC-4 Story 2.4).
- Trên error `400 agent_not_found`: Toast `error` `"<message>"` (text từ `error.message`). KHÔNG đóng panel. KHÔNG mất state (panel vẫn hiển thị task ở status `assigned`).
- Trên error `409 task_not_assigned` / `session_already_active` / `404 task_not_found`: Toast `error` `"<message>"`. Invalidate `['task', ...]` để frontend refresh state thực.
- Trên network error / 500: Toast `error` `"Failed to start session"` (fallback message khi không có `error.message`).
- Trong khi mutation pending (`isPending`): button disabled, label vẫn "Start Session" (KHÔNG đổi sang "Starting...", giữ UI gọn — Story 3.5a sẽ thêm live status feed).

**Out of scope ở Story 3.1 (chuyển 3.5a):**
- Optimistic UI flip status badge ngay khi click (Story 3.5a wraps Resume optimistic — Start dùng cùng pattern sau).
- Manual session ID input modal khi `sessionIdMissing: true` (Story 3.5a).
- Live status feed "Starting session…" / "Agent running…" với `aria-live` (Story 3.5a).

---

**AC-12 — Idempotency và double-click protection:**
**Given** user click "Start Session" 2 lần liên tiếp rất nhanh (cùng task)
**When** request thứ 2 đến backend trước khi request thứ 1 commit transaction
**Then** **đúng một** trong hai request thắng (transition_to_running thành công):
- Request thắng: 200 OK, task → Running, session/run rows insert.
- Request thua: 409 `session_already_active` (sau khi request thắng đã COMMIT) hoặc 409 `task_not_assigned` (cùng nghĩa: status không còn Assigned).
**And** đúng một subprocess được spawn (subprocess_map có 1 entry cho `task_id`).
**And** không có orphan session/run rows.

**Frontend protection (defense-in-depth):** mutation `isPending` disable button trong khi request đang chạy (AC-11). Backend BEGIN IMMEDIATE + atomic UPDATE + UNIQUE(task_id) trên `sessions` là source of truth.

---

**Trace AC ↔ Task — xem section "Trace AC ↔ Task" cuối story.**

---

## Tasks / Subtasks

> **Quy ước:** Mỗi task root checkable. Subtasks indented. Chia 6 nhóm: **A** (Preflight + dependencies), **B** (Backend `agent/` module), **C** (Backend `models` + `services` + `handlers`), **D** (Backend integration: main.rs, state, tests), **E** (Frontend wiring), **F** (Validation + harness updates).

### A. Preflight & Dependencies

- [ ] **Task A.1 — Verify Epic 2 dependencies merged + DB schema có sẵn** (AC: 1–10)
  - [ ] A.1.1 Xác nhận Story 1.2 (`backend/src/db/migrations/1_init.sql`) đã có bảng `sessions` + `runs` đúng schema architecture.md §"Gap 1" (cột `task_id UNIQUE` trên `sessions`, cột `log_path` trên `runs`). Nếu DB schema khác → ESCALATE chat: "Story 3.1 expects `sessions.task_id UNIQUE` + `runs.log_path` from Story 1.2 schema; found <diff>. Need migration?"
  - [ ] A.1.2 Xác nhận Story 2.2 `services/tasks.rs` có pattern `BEGIN IMMEDIATE` + atomic UPDATE + rows_affected check (`F1`–`F5` review patches đã apply). Story 3.1 áp dụng cùng pattern cho `transition_to_running`.
  - [ ] A.1.3 Xác nhận `AppState.subprocess_map: Arc<Mutex<HashMap<String, Child>>>` đã tồn tại trong `backend/src/state.rs` (đã có từ Story 1.1). KHÔNG thay đổi shape — chỉ insert/lookup.
  - [ ] A.1.4 Xác nhận `frontend/src/api/client.ts::apiFetch` + `ApiError` class + `ToastProvider` + `useToast` đã có (Story 2.0 + 2.1).
  - [ ] A.1.5 Xác nhận `frontend/src/features/detail/TaskDetailPanel.tsx::ActionBar` đang render `<Button>Start Session</Button>` không onClick (Story 2.4). Sẽ wire onClick trong Task E.3.

- [ ] **Task A.2 — Thêm dependencies vào `backend/Cargo.toml`** (AC: 1, 3, 5)
  - [ ] A.2.1 Thêm `regex = "1"` (parse session ID fallback regex cho Codex).
  - [ ] A.2.2 Verify `chrono = { ..., features = ["clock", "serde"] }` đã có (Story 1.1).
  - [ ] A.2.3 Verify `tokio = { version = "1", features = ["full"] }` đã có (gồm `process`, `io-util`, `time`, `signal` — cần cho `Child`, `AsyncBufReadExt`, `tokio::time::timeout`).
  - [ ] A.2.4 KHÔNG thêm `which`, `async-trait`, `mockall` — keep stack tối thiểu, dùng tools đã có.
  - [ ] A.2.5 `cargo build` (không chạy test ở task này) — verify compile.

### B. Backend `agent/` module

- [ ] **Task B.1 — Tạo `backend/src/agent/mod.rs`** (AC: 1)
  - [ ] B.1.1 Tạo folder `backend/src/agent/` + file `mod.rs`.
  - [ ] B.1.2 Define trait `AgentStrategy` đúng spec AC-1:
    ```rust
    use std::path::Path;
    use tokio::process::Command;
    use chrono::{DateTime, Utc};
    use crate::error::AppError;
    use crate::models::task::Task;

    pub trait AgentStrategy: Send + Sync + std::fmt::Debug {
        fn name(&self) -> &'static str;
        fn spawn_command(&self, task: &Task, log_path: &Path) -> Command;
        fn resume_command(&self, session_id: &str, comment: Option<&str>) -> Command;
        fn parse_session_id_chunk(&self, chunk: &str) -> Option<String>;
        fn fallback_session_id_lookup(
            &self,
            _cwd: &Path,
            _started_at: DateTime<Utc>,
        ) -> Option<String> {
            None
        }
    }

    pub mod claude;
    pub mod codex;

    pub fn strategy_for(agent: &str) -> Result<Box<dyn AgentStrategy>, AppError> {
        match agent {
            "claude" => Ok(Box::new(claude::ClaudeStrategy::default())),
            "codex"  => Ok(Box::new(codex::CodexStrategy::default())),
            other => Err(AppError::BadRequest {
                code: "invalid_agent",
                message: format!("Agent must be one of: codex, claude (got: {})", other),
            }),
        }
    }
    ```
  - [ ] B.1.3 Add `pub mod agent;` vào `backend/src/lib.rs` (cạnh `pub mod db; pub mod error; ...`).
  - [ ] B.1.4 Unit tests trong `mod.rs` `#[cfg(test)] mod tests`:
    - `strategy_for_claude_returns_claude_strategy` → `strategy.name() == "claude"`.
    - `strategy_for_codex_returns_codex_strategy` → `strategy.name() == "codex"`.
    - `strategy_for_unknown_returns_bad_request` → assert `AppError::BadRequest { code: "invalid_agent", .. }`.

- [ ] **Task B.2 — Tạo `backend/src/agent/claude.rs`** (AC: 1, 2, 3)
  - [ ] B.2.1 Define `#[derive(Debug, Default)] pub struct ClaudeStrategy;`.
  - [ ] B.2.2 Impl `AgentStrategy`:
    - `name() -> "claude"`.
    - `spawn_command(task, log_path)`:
      ```rust
      let binary = std::env::var("OMNI_AGENT_CLAUDE_BIN")
          .unwrap_or_else(|_| "claude".to_string());
      let mut cmd = Command::new(binary);
      // Claude CLI args dựa trên project-context.md §"Agent CLI" — Story 3.1 chỉ start, args
      // không bao gồm `--continue` (đó là resume).
      // Truyền title + description làm prompt thông qua stdin hoặc args.
      // Implementation đề xuất: pass task.title + task.description qua stdin (an toàn với ký tự đặc biệt).
      cmd.kill_on_drop(true);  // safety: nếu Child handle bị drop, kill subprocess (tránh leak)
      cmd.stdin(Stdio::piped());
      cmd.stdout(Stdio::piped());
      cmd.stderr(Stdio::piped());  // stderr ghép vào log file ở Task D.x
      cmd  // caller: spawn + write task description vào stdin trong service layer
      ```
      *Lưu ý:* Story 3.1 KHÔNG đặc tả CLI flags chính xác — dev tham khảo Claude CLI docs hoặc dùng pattern đã document trong project-context.md. Mục tiêu: spawn ra subprocess chạy task; chi tiết CLI args có thể tinh chỉnh sau qua review.
    - `resume_command(session_id, comment)`:
      ```rust
      let binary = std::env::var("OMNI_AGENT_CLAUDE_BIN")
          .unwrap_or_else(|_| "claude".to_string());
      let mut cmd = Command::new(binary);
      cmd.arg("--continue").arg("--session-id").arg(session_id);
      cmd.kill_on_drop(true);
      cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
      // comment được pipe vào stdin trong service layer (Story 3.3)
      let _ = comment; // referenced để compiler không warn unused
      cmd
      ```
    - `parse_session_id_chunk(chunk)`:
      - Split chunk theo `'\n'`. Với mỗi line non-empty, try `serde_json::from_str::<serde_json::Value>(line)`.
      - Nếu parse ok và `value.get("session_id").and_then(|v| v.as_str())` is `Some(s)` → return `Some(s.to_string())`.
      - Continue cho đến hết chunk; nếu không tìm được → return `None`.
      - **KHÔNG fallback** sang regex trên raw text — chỉ JSON line. Tránh false positive.
  - [ ] B.2.3 Unit tests `#[cfg(test)] mod tests`:
    - `name_is_claude`.
    - `parse_returns_some_when_json_has_session_id`: input `"{\"session_id\":\"abc-123\",\"type\":\"start\"}"` → `Some("abc-123".into())`.
    - `parse_returns_none_when_no_session_id`: input `"{\"type\":\"start\"}"` → `None`.
    - `parse_returns_none_when_not_json`: input `"hello world session_id=foo"` → `None`.
    - `parse_handles_multiple_lines`: input 2 dòng, dòng đầu rác, dòng sau JSON → `Some(...)`.
    - `parse_handles_session_id_in_first_match`: input 2 dòng JSON với session_id khác nhau → return dòng đầu (first match wins).
    - `spawn_command_uses_env_override_when_set`: set `OMNI_AGENT_CLAUDE_BIN=/tmp/x`, build command, verify command bin path = `/tmp/x` (dùng `Command::as_std()` để inspect).

- [ ] **Task B.3 — Tạo `backend/src/agent/codex.rs`** (AC: 1, 5)
  - [ ] B.3.1 Define `#[derive(Debug, Default)] pub struct CodexStrategy;`.
  - [ ] B.3.2 Impl `AgentStrategy`:
    - `name() -> "codex"`.
    - `spawn_command(task, log_path)`: tương tự `claude.rs` nhưng binary `OMNI_AGENT_CODEX_BIN` default `"codex"`. CLI args dùng `cmd` chạy start (Codex CLI có thể không có flag riêng — pass task description qua stdin).
    - `resume_command(session_id, comment)`: `codex resume <session_id>` + comment qua stdin (project-context.md).
    - `parse_session_id_chunk(chunk)`: dùng cùng JSON-line pattern như Claude (line-by-line `from_str::<Value>` tìm field `session_id`). Codex CLI thường in event JSON với field `session_id` hoặc `id`. Implementation đề xuất scan cả 2 keys.
    - `fallback_session_id_lookup(cwd, started_at)`:
      ```rust
      use std::fs;
      use std::time::SystemTime;
      let dir = std::env::var("OMNI_AGENT_CODEX_SESSIONS_DIR")
          .map(std::path::PathBuf::from)
          .unwrap_or_else(|_| {
              let home = std::env::var("HOME").unwrap_or_default();
              std::path::PathBuf::from(home).join(".codex").join("sessions")
          });
      let entries = fs::read_dir(&dir).ok()?;
      let started_at_sys: SystemTime = started_at.into();
      let mut candidates: Vec<(std::path::PathBuf, SystemTime)> = vec![];
      for entry in entries.flatten() {
          let path = entry.path();
          if path.extension().and_then(|s| s.to_str()).map(|s| s == "json" || s == "jsonl").unwrap_or(false) {
              if let Ok(meta) = entry.metadata() {
                  if let Ok(mtime) = meta.modified() {
                      // Cho phép sai số 2s
                      let tolerance = std::time::Duration::from_secs(2);
                      if mtime + tolerance >= started_at_sys {
                          candidates.push((path, mtime));
                      }
                  }
              }
          }
      }
      let _ = cwd;  // hiện chưa filter theo cwd — Codex sessions dir tách per-host
      candidates.sort_by_key(|(_, m)| *m);
      let latest = candidates.into_iter().last()?;
      // Try parse session ID từ filename (stem) trước, sau đó nội dung file.
      let from_filename = latest.0.file_stem()
          .and_then(|s| s.to_str())
          .filter(|s| s.len() >= 8)  // UUID-ish length sanity
          .map(|s| s.to_string());
      if let Some(s) = from_filename {
          return Some(s);
      }
      // Fallback: parse content
      let content = std::fs::read_to_string(&latest.0).ok()?;
      for line in content.lines() {
          if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
              if let Some(sid) = v.get("session_id").and_then(|x| x.as_str()) {
                  return Some(sid.to_string());
              }
          }
      }
      None
      ```
  - [ ] B.3.3 Unit tests `#[cfg(test)] mod tests` (dùng `tempfile` crate nếu chưa có, hoặc tạo dir thủ công qua `std::env::temp_dir().join(format!("codex-test-{}", uuid))`):
    - `name_is_codex`.
    - `parse_returns_some_when_json_has_session_id` (giống claude).
    - `fallback_returns_some_when_matching_file_in_tmp_dir`: tạo tmp dir, tạo file `<uuid>.json` với mtime hiện tại, set `OMNI_AGENT_CODEX_SESSIONS_DIR` → fallback return `Some("<uuid>")`.
    - `fallback_returns_none_when_dir_missing`: env var trỏ dir không tồn tại → `None`.
    - `fallback_returns_none_when_no_recent_files`: tạo file với mtime cũ (5 phút trước `started_at`) → `None`.
    - `fallback_picks_latest_mtime_among_multiple`: 3 file mtime khác nhau → return file mới nhất.
    - **Test isolation:** dùng `serial_test::serial` HOẶC set env var trong `unsafe { std::env::set_var(..) }` + clean up sau test. Tốt hơn: đặt env var prefix `OMNI_AGENT_CODEX_SESSIONS_DIR_<uniqueid>` và đọc nó trong test setup. Implementation đề xuất: tests dùng `tempfile::tempdir()` + set env trong block, restore sau. Nếu test flaky do env race → áp dụng `serial_test`.

### C. Backend `models`, `services`, `handlers` cho session

- [ ] **Task C.1 — Tạo `backend/src/models/session.rs`** (AC: 1, 2, 9)
  - [ ] C.1.1 Define structs + helper:
    ```rust
    use serde::{Deserialize, Serialize};
    use sqlx::FromRow;

    #[derive(Debug, Clone, Serialize, FromRow)]
    #[serde(rename_all = "camelCase")]
    pub struct Session {
        pub id: String,                 // session_pk UUID (PK của row)
        pub task_id: String,
        pub agent: String,              // "claude" | "codex"
        pub session_id: Option<String>, // CLI session UUID (nullable cho đến khi capture)
        pub status: String,             // "none" | "running" | "paused" | "closed"
        pub created_at: String,
        pub last_active: String,
    }

    #[derive(Debug, Serialize)]
    #[serde(rename_all = "camelCase")]
    pub struct StartSessionResponse {
        pub session_pk: String,         // = Session.id
        pub task_id: String,
        pub session_id: Option<String>, // luôn None tại response time AC-2
        pub session_id_missing: bool,   // false tại response time
        pub status: String,             // "running"
        pub created_at: String,
    }

    // Story 3.1 KHÔNG có request body — accept empty. Define empty struct để
    // handler có thể `Json<StartSessionRequest>` nếu muốn typed, hoặc skip.
    #[derive(Debug, Deserialize, Default)]
    #[serde(default, rename_all = "camelCase")]
    pub struct StartSessionRequest {}
    ```
  - [ ] C.1.2 Add `pub mod session;` vào `backend/src/models/mod.rs`.

- [ ] **Task C.2 — Tạo `backend/src/models/run.rs`** (AC: 2, 9)
  - [ ] C.2.1 Define struct (Story 3.1 chỉ INSERT, không list/get — model nhẹ):
    ```rust
    use serde::Serialize;
    use sqlx::FromRow;

    #[derive(Debug, Clone, Serialize, FromRow)]
    #[serde(rename_all = "camelCase")]
    pub struct Run {
        pub id: String,
        pub session_id: String,         // FK đến sessions.id (session_pk)
        pub run_number: i64,
        pub input: Option<String>,
        pub exit_code: Option<i64>,
        pub log_path: Option<String>,
        pub log_tail: Option<String>,
        pub started_at: String,
        pub ended_at: Option<String>,
    }
    ```
  - [ ] C.2.2 Add `pub mod run;` vào `models/mod.rs`.

- [ ] **Task C.3 — Mở rộng `backend/src/services/tasks.rs`: thêm transition functions** (AC: 7, 12)
  - [ ] C.3.1 Thêm `pub async fn transition_to_running(pool: &SqlitePool, project_id: &str, task_id: &str) -> Result<Task, AppError>`:
    1. Acquire connection, `let mut tx = conn.begin_with("BEGIN IMMEDIATE").await?;` (cùng pattern `create_task` F1 patch).
    2. Inside transaction: `SELECT ... FROM tasks WHERE id = ? AND project_id = ?` (FromRow → Task). Nếu None → `NotFound { code: "task_not_found", .. }`.
    3. Verify `task.agent.is_some()` → nếu None → `Conflict { code: "task_not_assigned", message: format!("Cannot start session: task {} has no agent assigned", task_id) }`.
    4. Atomic UPDATE: `UPDATE tasks SET status = 'Running', updated_at = ? WHERE id = ? AND project_id = ? AND status = 'Assigned'`. `rows_affected`:
       - `0` → re-fetch task (inside tx), map status → error:
         - `Running` → `Conflict { code: "session_already_active", message: format!("Task {} already has an active session", task_id) }`.
         - `Draft` / `Ready` / `Paused` / `Failed` / `Done` / `Cancelled` / `NeedsReview` / `ChangesRequested` → `Conflict { code: "task_not_assigned", message: format!("Cannot start session: task {} is in {} status (must be assigned)", task_id, current.to_lowercase()) }`.
       - `1` → COMMIT, return updated `Task`.
  - [ ] C.3.2 Thêm `pub async fn revert_to_assigned(pool: &SqlitePool, task_id: &str) -> Result<(), AppError>`:
    1. `UPDATE tasks SET status = 'Assigned', updated_at = ? WHERE id = ? AND status = 'Running'`.
    2. Log warning nếu `rows_affected == 0` (defensive — race với 3.2 exit detection, không panic).
    3. Return `Ok(())` luôn — revert là best-effort.
  - [ ] C.3.3 Unit tests trong `services/tasks.rs::tests` (cùng module `#[cfg(test)]`):
    - `transition_to_running_assigned_to_running_success`: setup task status `Assigned`, agent `claude` → call → returns Task with status `Running`.
    - `transition_to_running_draft_returns_task_not_assigned`.
    - `transition_to_running_ready_returns_task_not_assigned`.
    - `transition_to_running_running_returns_session_already_active`.
    - `transition_to_running_paused_returns_task_not_assigned` (message mention "use /sessions/resume").
    - `transition_to_running_failed_returns_task_not_assigned`.
    - `transition_to_running_done_returns_task_not_assigned`.
    - `transition_to_running_cancelled_returns_task_not_assigned`.
    - `transition_to_running_unknown_task_returns_not_found`.
    - `transition_to_running_no_agent_returns_task_not_assigned`: tạo task ở status `Assigned` nhưng manually UPDATE để `agent = NULL` (defensive) → error.
    - `revert_to_assigned_running_to_assigned_success`.
    - `revert_to_assigned_not_running_is_noop`: revert task ở status `Paused` không lỗi, không thay đổi DB.

- [ ] **Task C.4 — Tạo `backend/src/services/sessions.rs`** (AC: 2, 3, 4, 5, 6, 9, 12)
  - [ ] C.4.1 Module skeleton + imports:
    ```rust
    use std::path::PathBuf;
    use std::sync::Arc;
    use std::time::Duration;
    use sqlx::SqlitePool;
    use tokio::io::{AsyncBufReadExt, BufReader};
    use tokio::process::{Child, ChildStdout};
    use tokio::sync::Mutex;
    use chrono::Utc;
    use uuid::Uuid;
    use std::collections::HashMap;
    use std::process::Stdio;

    use crate::agent::{self, AgentStrategy};
    use crate::error::AppError;
    use crate::models::session::{Session, StartSessionResponse};
    use crate::services::tasks;
    ```
  - [ ] C.4.2 Helper `fn resolve_log_path(task_id: &str, run_id: &str) -> PathBuf`:
    ```rust
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home).join(".omni-agent").join("logs").join(task_id).join(format!("{}.log", run_id))
    ```
  - [ ] C.4.3 Main entrypoint `pub async fn start_session(...)`:
    ```rust
    pub async fn start_session(
        pool: &SqlitePool,
        subprocess_map: Arc<Mutex<HashMap<String, Child>>>,
        project_id: &str,
        task_id: &str,
    ) -> Result<StartSessionResponse, AppError> {
        // 1. Transition task status Assigned → Running atomically (also validates task exists + agent set).
        let task = tasks::transition_to_running(pool, project_id, task_id).await?;
        let agent_name = task.agent.as_deref().ok_or_else(|| AppError::Conflict {
            code: "task_not_assigned",
            message: format!("Cannot start session: task {} has no agent assigned", task_id),
        })?;

        // 2. Resolve strategy (validates agent value).
        let strategy = agent::strategy_for(agent_name)?;

        // 3. Prepare log path + create parent dirs.
        let session_pk = Uuid::new_v4().to_string();
        let run_id = Uuid::new_v4().to_string();
        let log_path = resolve_log_path(task_id, &run_id);
        if let Some(parent) = log_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                AppError::Internal(anyhow::anyhow!("Failed to create log dir: {}", e))
            })?;
        }

        // 4. Build command (Stdio::piped on stdout/stderr; stdin piped for prompt).
        let mut command = strategy.spawn_command(&task, &log_path);

        // 5. Spawn subprocess. Map NotFound → agent_not_found.
        let mut child: Child = match command.spawn() {
            Ok(c) => c,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                tasks::revert_to_assigned(pool, task_id).await.ok();
                return Err(AppError::BadRequest {
                    code: "agent_not_found",
                    message: "Agent binary not found on PATH".to_string(),
                });
            }
            Err(e) => {
                tasks::revert_to_assigned(pool, task_id).await.ok();
                return Err(AppError::Internal(anyhow::anyhow!("spawn failed: {}", e)));
            }
        };

        // 6. (Optional) Write task description to stdin to give the agent its prompt.
        if let Some(mut stdin) = child.stdin.take() {
            use tokio::io::AsyncWriteExt;
            let prompt = format!("{}\n\n{}", task.title, task.description);
            // best-effort write; ignore failures (binary may not consume stdin)
            let _ = stdin.write_all(prompt.as_bytes()).await;
            let _ = stdin.shutdown().await;
        }

        // 7. Take stdout BEFORE registering Child (we need ownership of stdout for the streaming task).
        let stdout = child.stdout.take().ok_or_else(|| {
            AppError::Internal(anyhow::anyhow!("Failed to capture stdout from subprocess"))
        })?;

        // 8. Defensive: subprocess_map must not have this task_id yet. Check + insert.
        {
            let mut map = subprocess_map.lock().await;
            if map.contains_key(task_id) {
                // Edge: race — DB transition_to_running succeeded but map already has entry
                // (unexpected). Kill the new child to avoid leak, revert task, return conflict.
                drop(map);
                let _ = child.kill().await;
                tasks::revert_to_assigned(pool, task_id).await.ok();
                return Err(AppError::Conflict {
                    code: "session_already_active",
                    message: format!("Task {} already has an active session", task_id),
                });
            }
            map.insert(task_id.to_string(), child);
        }

        // 9. INSERT session + run rows transactionally.
        let now = Utc::now().to_rfc3339();
        let log_path_str = log_path.to_string_lossy().to_string();
        let mut tx = pool.begin().await?;
        sqlx::query(
            "INSERT INTO sessions (id, task_id, agent, session_id, status, created_at, last_active) \
             VALUES (?, ?, ?, NULL, 'running', ?, ?)",
        )
        .bind(&session_pk)
        .bind(task_id)
        .bind(agent_name)
        .bind(&now)
        .bind(&now)
        .execute(&mut *tx)
        .await?;
        sqlx::query(
            "INSERT INTO runs (id, session_id, run_number, input, exit_code, log_path, log_tail, started_at, ended_at) \
             VALUES (?, ?, 1, NULL, NULL, ?, NULL, ?, NULL)",
        )
        .bind(&run_id)
        .bind(&session_pk)
        .bind(&log_path_str)
        .bind(&now)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;

        // 10. Spawn background streaming + session ID capture task.
        let pool_clone = pool.clone();
        let strategy_clone = agent::strategy_for(agent_name).expect("strategy already validated");
        let session_pk_clone = session_pk.clone();
        let log_path_clone = log_path.clone();
        let task_id_clone = task_id.to_string();
        let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let started_at_utc = Utc::now();
        tokio::spawn(async move {
            stream_and_capture(
                stdout,
                pool_clone,
                strategy_clone,
                session_pk_clone,
                task_id_clone,
                log_path_clone,
                cwd,
                started_at_utc,
            )
            .await;
        });

        Ok(StartSessionResponse {
            session_pk,
            task_id: task_id.to_string(),
            session_id: None,
            session_id_missing: false,
            status: "running".to_string(),
            created_at: now,
        })
    }
    ```
  - [ ] C.4.4 Background helper `async fn stream_and_capture(...)`:
    1. Open `log_path` for append (`tokio::fs::OpenOptions::new().create(true).append(true).open(...)`).
    2. Wrap `stdout` in `BufReader` + `.lines()`.
    3. Loop: `tokio::select!`:
       - branch 1: `lines.next_line()` — for each non-None line:
         - Write line + `\n` to log file (best-effort, log failure but continue).
         - If `session_id` chưa capture: gọi `strategy.parse_session_id_chunk(line)`. Nếu `Some(sid)`:
           - UPDATE `sessions SET session_id = ?, last_active = ? WHERE id = ?` (session_pk).
           - Set `captured = true`. Stop calling parse for subsequent lines (perf).
         - Continue.
       - branch 2: `tokio::time::sleep(Duration::from_secs(2))` chỉ kích hoạt 1 lần (Codex fallback timing). Sau 2s nếu chưa captured AND `strategy.name() == "codex"`:
         - Gọi `strategy.fallback_session_id_lookup(&cwd, started_at_utc)`.
         - Nếu `Some(sid)` → UPDATE sessions, set `captured = true`.
       - branch 3: `tokio::time::sleep(Duration::from_secs(10))` (overall capture timeout):
         - Sau 10s nếu vẫn `!captured` → log `tracing::warn!(task_id = %task_id, "session_id capture timeout after 10s, subprocess continues")`. Set flag để skip parsing tiếp.
         - Note: streaming stdout vào log file vẫn tiếp tục — chỉ session ID capture stop.
       - branch 4: stdout EOF (`next_line()` returns `Ok(None)`) → break loop.
    4. **Edge:** nếu UPDATE `sessions` fail (DB error) → log error, không panic; subprocess vẫn tiếp tục.
    5. **KHÔNG kill subprocess** trong helper này — Story 3.2 sẽ thêm exit detection. Story 3.1 chỉ stream stdout + capture session ID + write log; subprocess sống cho đến khi tự exit.

    Implementation detail: dùng pattern `select! { biased; ... }` hoặc 3 timers riêng với boolean flag `captured` + `timed_out_for_capture` để cấu trúc rõ ràng. Tham khảo `tokio::time::sleep_until` để absolute deadline.

  - [ ] C.4.5 Add `pub mod sessions;` vào `services/mod.rs`.
  - [ ] C.4.6 Unit tests **chỉ cho helper purely-functional** (parse, resolve_log_path) trong `#[cfg(test)] mod tests`. `start_session` end-to-end test ở integration tests Task D.3 (yêu cầu real DB pool + subprocess_map + mock binary).

- [ ] **Task C.5 — Tạo `backend/src/handlers/sessions.rs`** (AC: 2, 6, 7, 8, 10)
  - [ ] C.5.1 Handler thin, delegate sang service:
    ```rust
    use std::sync::Arc;
    use axum::{Json, extract::{Path, State}};
    use crate::error::AppError;
    use crate::models::session::StartSessionResponse;
    use crate::services::sessions;
    use crate::state::AppState;

    pub async fn start_session(
        State(state): State<Arc<AppState>>,
        Path((project_id, task_id)): Path<(String, String)>,
    ) -> Result<Json<StartSessionResponse>, AppError> {
        let resp = sessions::start_session(
            &state.db,
            state.subprocess_map.clone(),
            &project_id,
            &task_id,
        ).await?;
        Ok(Json(resp))
    }
    ```
  - [ ] C.5.2 Verify project tồn tại trước khi vào service: thêm 1 SELECT ngắn trong handler? Hoặc để service `transition_to_running` natively return `task_not_found` (nó SELECT task WHERE id = ? AND project_id = ?). Theo AC-8, project không tồn tại → `project_not_found`. Implementation simpler: trước khi gọi service, thêm helper `verify_project_exists(pool, project_id)` (đã tồn tại trong `services::tasks` — reuse).
  - [ ] C.5.3 Add `pub mod sessions;` vào `handlers/mod.rs`.

### D. Backend integration

- [ ] **Task D.1 — Mount route trong `backend/src/main.rs`** (AC: 10)
  - [ ] D.1.1 Thêm route trong `api_router`:
    ```rust
    .route(
        "/projects/{project_id}/tasks/{task_id}/sessions/start",
        axum::routing::post(handlers::sessions::start_session),
    )
    ```
  - [ ] D.1.2 KHÔNG xóa hoặc đổi route khác (AC-10 regression).

- [ ] **Task D.2 — Tạo mock binary cho integration test** (AC: 2, 3, 5, 6)
  - [ ] D.2.1 Tạo `backend/tests/fixtures/mock-agent.rs` (compile-time binary trong workspace) HOẶC dùng shell script bash trong `backend/tests/fixtures/mock-agent.sh`. Implementation đề xuất: shell script đơn giản hơn, không cần thêm `[[bin]]` vào Cargo.toml.
    ```bash
    #!/usr/bin/env bash
    # backend/tests/fixtures/mock-agent.sh
    # Reads $MOCK_AGENT_SESSION_ID env var; emits a JSON line and sleeps.
    set -e
    SID="${MOCK_AGENT_SESSION_ID:-mock-sess-12345678-1234-1234-1234-123456789abc}"
    DELAY_BEFORE_ID="${MOCK_AGENT_DELAY_MS:-50}"
    SLEEP_AFTER="${MOCK_AGENT_SLEEP_SECS:-30}"
    if [ "$DELAY_BEFORE_ID" -gt 0 ]; then
      # ms sleep — use python or perl for fractional sleep
      python3 -c "import time; time.sleep($DELAY_BEFORE_ID / 1000.0)" || sleep 0
    fi
    echo "{\"session_id\":\"$SID\",\"type\":\"start\"}"
    # Keep alive for the full integration test duration (so subprocess_map sees the child).
    sleep "$SLEEP_AFTER"
    ```
  - [ ] D.2.2 Make executable: `chmod +x backend/tests/fixtures/mock-agent.sh`. Verify path resolution trong test setup dùng `CARGO_MANIFEST_DIR`:
    ```rust
    let manifest = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let mock_bin = format!("{}/tests/fixtures/mock-agent.sh", manifest);
    unsafe { std::env::set_var("OMNI_AGENT_CLAUDE_BIN", &mock_bin); }
    ```
  - [ ] D.2.3 Variant "binary missing" cho AC-6: KHÔNG set env var OR set tới path không tồn tại (e.g. `/nonexistent/claude-binary`).
  - [ ] D.2.4 **Cross-platform note:** shell script chỉ chạy được trên Unix-like. Repo target = local dev (Linux/macOS per architecture), nên ok. Nếu cần Windows support sau này → port sang `mock-agent.rs` binary với `[[bin]]` trong Cargo.toml.

- [ ] **Task D.3 — Integration tests `backend/tests/sessions_test.rs`** (AC: 2, 3, 4, 5, 6, 7, 8, 9, 10, 12)
  - [ ] D.3.1 Setup helper (copy/extend từ `backend/tests/tasks_test.rs::build_test_app_with_pool`):
    - Add route `POST /api/projects/{project_id}/tasks/{task_id}/sessions/start` vào test app.
    - Add helper `setup_app_with_assigned_task(agent: &str) -> (Router, String /*project_id*/, String /*task_id*/, PathBuf /*log_dir_root*/)`:
      1. Create project.
      2. Create task.
      3. Assign agent.
      4. Override `HOME` env var to a tmp dir so log files không pollute `~/.omni-agent/` (`unsafe { std::env::set_var("HOME", &tmp_home); }`).
      5. Return ids + tmp_home path.
  - [ ] D.3.2 **Test: `start_session_claude_happy_path`** (AC-2, AC-3, AC-9, AC-10):
    - Set `OMNI_AGENT_CLAUDE_BIN` → mock script. Set `MOCK_AGENT_SESSION_ID=test-uuid-aaa`.
    - Call `POST /api/projects/<pid>/tasks/<tid>/sessions/start` body `{}`.
    - Assert `200 OK`. Response JSON has `sessionPk`, `taskId`, `sessionId: null`, `sessionIdMissing: false`, `status: "running"`.
    - Sleep 500ms (cho phép mock script in JSON + background task UPDATE).
    - Re-fetch task via `GET /api/projects/<pid>/tasks/<tid>` → `task.status == "running"`.
    - SELECT từ DB: `sessions WHERE task_id = ?` → 1 row, `agent = "claude"`, `status = "running"`, `session_id = "test-uuid-aaa"` (đã capture).
    - SELECT `runs WHERE session_id = ?` → 1 row, `run_number = 1`, `log_path` không null, `exit_code` null.
    - Verify log file tồn tại tại `$HOME/.omni-agent/logs/<tid>/<run_id>.log` và chứa JSON line.
    - Cleanup: kill subprocess via `state.subprocess_map.lock().await.remove(&task_id).map(|mut c| c.start_kill())`.
  - [ ] D.3.3 **Test: `start_session_codex_happy_path_via_stdout`** (AC-5 primary):
    - Set `OMNI_AGENT_CODEX_BIN` → mock script. Same flow as Claude but `agent = "codex"`.
    - Assert sessionId capture trong DB sau 500ms (primary path).
  - [ ] D.3.4 **Test: `start_session_codex_fallback_filesystem`** (AC-5 fallback):
    - Set `OMNI_AGENT_CODEX_BIN` → mock script với `MOCK_AGENT_SESSION_ID=` (empty → script in JSON với session_id rỗng, parse fail).
    - Hoặc: set mock script in non-JSON output (`echo "starting codex..."`).
    - Set `OMNI_AGENT_CODEX_SESSIONS_DIR=<tmp>` chứa file `fb-sess-uuid.json` mtime hiện tại.
    - Call start_session.
    - Sleep 3s (đủ cho 2s primary fail threshold + fallback execute).
    - SELECT sessions → `session_id = "fb-sess-uuid"` (từ filename stem).
  - [ ] D.3.5 **Test: `start_session_capture_timeout`** (AC-4):
    - Mock script in nothing (`sleep 60`).
    - Call start_session → 200 OK ngay.
    - Sleep 11s (chờ timeout).
    - SELECT sessions → `session_id` vẫn `NULL`.
    - Verify subprocess vẫn alive (`state.subprocess_map.lock().await.contains_key(&task_id) == true`).
    - Verify task status vẫn `Running` (KHÔNG bị revert).
    - Cleanup.
    - **Test runtime:** 11s — đánh dấu test này `#[ignore]` hoặc `#[cfg_attr(not(feature = "slow-tests"), ignore)]` để CI default skip. Document trong test file: `cargo test -- --ignored` để chạy.
  - [ ] D.3.6 **Test: `start_session_agent_not_found_returns_400`** (AC-6):
    - Set `OMNI_AGENT_CLAUDE_BIN=/nonexistent/path`.
    - Call start_session → assert `400` body `{ "error": "agent_not_found", "message": "Agent binary not found on PATH" }`.
    - SELECT sessions WHERE task_id = ? → 0 rows.
    - SELECT runs → 0 rows (no orphan).
    - Re-fetch task → status vẫn `assigned` (revert đã chạy).
    - `state.subprocess_map.lock().await.contains_key(&task_id) == false`.
  - [ ] D.3.7 **Test: `start_session_task_in_draft_returns_409`** (AC-7):
    - Setup task NHƯNG bỏ qua assign (task ở `Draft`).
    - Call start_session → 409 `{ "error": "task_not_assigned", "message": "Cannot start session: task OMNI-001 is in draft status (must be assigned)" }`.
  - [ ] D.3.8 **Test: `start_session_task_in_running_returns_session_already_active`** (AC-7):
    - Setup task ở Assigned, call start_session lần 1 (happy path), sleep 500ms.
    - Call start_session lần 2 → 409 `{ "error": "session_already_active", ... }`.
    - DB: sessions có 1 row duy nhất (lần 2 không insert).
  - [ ] D.3.9 **Test: `start_session_task_in_paused_returns_task_not_assigned`** (AC-7):
    - Setup task ở Paused (manually UPDATE DB sau khi assign).
    - Call → 409 `task_not_assigned` với message contain "use /sessions/resume".
  - [ ] D.3.10 **Test: `start_session_unknown_task_returns_404`** (AC-8):
    - Call với task_id random `"OMNI-999"`.
    - → 404 `{ "error": "task_not_found", ... }`.
  - [ ] D.3.11 **Test: `start_session_unknown_project_returns_404`** (AC-8):
    - Call với project_id random UUID.
    - → 404 `{ "error": "project_not_found", ... }`.
  - [ ] D.3.12 **Test: `start_session_health_route_still_works`** (AC-10):
    - Regression: gọi `GET /health` sau khi mount route mới → `200 OK`.
  - [ ] D.3.13 **Test: `start_session_subprocess_registered_in_map`** (AC-9):
    - Happy path, sleep 200ms.
    - Lấy `state.subprocess_map.lock().await` (test cần access AppState — refactor helper trả `(Router, Arc<AppState>)` thay vì chỉ Router).
    - Assert `map.contains_key(&task_id) == true`.
  - [ ] D.3.14 **Test: `start_session_double_click_idempotency`** (AC-12):
    - Mock script với `DELAY_BEFORE_ID=500` (in JSON sau 500ms).
    - Spawn 2 request đồng thời (qua `tokio::join!` hoặc `futures::join_all`).
    - Assert đúng 1 request return 200, 1 request return 409.
    - DB: sessions có đúng 1 row, runs có đúng 1 row.
    - subprocess_map có đúng 1 entry.
    - **Note:** test này nhạy với timing — nếu flaky, thêm `MOCK_AGENT_DELAY_MS=200` + `tokio::time::sleep(100ms)` giữa 2 spawn requests.

  - [ ] D.3.15 **Cleanup pattern:** mỗi test cuối block:
    ```rust
    // Drain subprocess_map to kill any test children.
    let mut map = state.subprocess_map.lock().await;
    for (_, mut child) in map.drain() {
        let _ = child.start_kill();
    }
    ```
    Nếu helper khó truyền `state` ra, dùng `tokio::process::Child::kill_on_drop(true)` ở `spawn_command` (đã đặt trong Task B.2/B.3) — khi map drop, children sẽ tự kill.

### E. Frontend wiring

- [ ] **Task E.1 — Tạo `frontend/src/types/session.ts`** (AC: 11)
  - [ ] E.1.1 Define types:
    ```ts
    export const SessionStatus = {
      None: "none",
      Running: "running",
      Paused: "paused",
      Closed: "closed",
    } as const;
    export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

    export interface Session {
      id: string;             // sessionPk
      taskId: string;
      agent: "claude" | "codex";
      sessionId: string | null;
      status: SessionStatus;
      createdAt: string;
      lastActive: string;
    }

    export interface StartSessionResponse {
      sessionPk: string;
      taskId: string;
      sessionId: string | null;
      sessionIdMissing: boolean;
      status: SessionStatus;
      createdAt: string;
    }
    ```

- [ ] **Task E.2 — Tạo `frontend/src/api/sessions.ts`** (AC: 11)
  - [ ] E.2.1 Implement:
    ```ts
    import { apiFetch } from "./client";
    import type { StartSessionResponse } from "../types/session";

    export const startSession = (projectId: string, taskId: string) =>
      apiFetch<StartSessionResponse>(
        `/projects/${projectId}/tasks/${taskId}/sessions/start`,
        { method: "POST", body: JSON.stringify({}) },
      );
    ```

- [ ] **Task E.3 — Tạo `frontend/src/hooks/useStartSession.ts`** (AC: 11)
  - [ ] E.3.1 Implement TanStack mutation hook:
    ```ts
    import { useMutation, useQueryClient } from "@tanstack/react-query";
    import { startSession } from "../api/sessions";

    export function useStartSession(projectId: string, taskId: string) {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: () => startSession(projectId, taskId),
        onSuccess: () => {
          // Story 2.3 task cache invalidation
          qc.invalidateQueries({ queryKey: ["tasks", projectId] });
          // Single-task cache (if Story 2.x introduced a per-task key — verify trong codebase; nếu chưa có, skip)
          qc.invalidateQueries({ queryKey: ["task", projectId, taskId] });
        },
      });
    }
    ```
  - [ ] E.3.2 **Verify cache key:** đọc `frontend/src/hooks/useTasks.ts` để xác định Story 2.3 cache key exact (theo Story 2.3 đã dùng `tasksQueryKey(projectId) = ["tasks", projectId]`). Cập nhật invalidate keys cho đúng.

- [ ] **Task E.4 — Wire `ActionBar` trong `TaskDetailPanel.tsx` để gọi mutation** (AC: 11)
  - [ ] E.4.1 Edit `frontend/src/features/detail/TaskDetailPanel.tsx`:
    - Pass `projectId: string, taskId: string` vào `ActionBar` props (hoặc dùng `project` + `task` đã có).
    - Trong `ActionBar`, dùng `useStartSession(projectId, taskId)` mutation + `useToast()`:
      ```tsx
      function ActionBar({ projectId, task }: { projectId: string; task: Task }) {
        const { showToast } = useToast();
        const startMut = useStartSession(projectId, task.id);

        const handleStart = () => {
          startMut.mutate(undefined, {
            onSuccess: () => {
              showToast({ variant: "success", message: `Session started for ${task.id}` });
            },
            onError: (err) => {
              const msg = err instanceof ApiError ? err.message : "Failed to start session";
              showToast({ variant: "error", message: msg });
            },
          });
        };

        if (task.status === "assigned") {
          return (
            <div className="task-detail-panel__action-bar">
              <Button
                variant="primary"
                size="md"
                onClick={handleStart}
                disabled={startMut.isPending}
              >
                Start Session
              </Button>
            </div>
          );
        }
        // … existing branches paused/failed/etc giữ nguyên (no Resume wiring at Story 3.1)
      }
      ```
  - [ ] E.4.2 KHÔNG đổi behavior cho status `paused` / `failed` (Resume / Mark Done / Cancel buttons giữ stub — wire trong Story 3.3).
  - [ ] E.4.3 KHÔNG implement optimistic UI / manual session ID input modal — defer Story 3.5a (cập nhật vào AC-11 outscope).

- [ ] **Task E.5 — Frontend tests cho mutation + button wiring** (AC: 11)
  - [ ] E.5.1 Tạo / mở rộng `frontend/src/features/detail/TaskDetailPanel.test.tsx`:
    - Mock `../../api/sessions` module trực tiếp (pattern Story 2.2 `mock("../api/tasks")`).
    - **Test:** click "Start Session" → mutation `startSession(projectId, taskId)` được gọi đúng args.
    - **Test:** sau success → `showToast({ variant: "success", ... })` được gọi với message chứa task id.
    - **Test:** khi error là `new ApiError(400, "agent_not_found", "Agent binary not found on PATH")` → `showToast({ variant: "error", message: "Agent binary not found on PATH" })`.
    - **Test:** khi error là network (Error không phải ApiError) → toast với fallback message `"Failed to start session"`.
    - **Test:** trong khi mutation pending → button disabled.
  - [ ] E.5.2 Helper test wrapper phải include `QueryClientProvider` + `ToastProvider` + `TaskDetailProvider`. Reuse pattern từ existing `TaskDetailPanel.test.tsx`.

### F. Validation, regression, harness

- [ ] **Task F.1 — Backend toàn bộ test suite** (AC: All backend ACs)
  - [ ] F.1.1 `cd backend && cargo build` — exit 0.
  - [ ] F.1.2 `cd backend && cargo test` — toàn bộ test pass. Số test mới (D.3.1–D.3.14): 14 tests (trừ D.3.5 cần `--ignored`). Existing Story 1.x/2.x tests: 68/68 pass (no regression).
  - [ ] F.1.3 `cargo test -- --ignored` chạy thêm timeout test (D.3.5) — exit 0 (cho phép skip trong PR CI nếu CI có time budget; chạy manual trước khi mark story done).
  - [ ] F.1.4 `cargo fmt --check` + `cargo clippy --all-targets -- -D warnings` (nếu repo có lint config) — exit 0.

- [ ] **Task F.2 — Frontend test suite + typecheck + build** (AC: 11)
  - [ ] F.2.1 `cd frontend && npx tsc --noEmit` — exit 0.
  - [ ] F.2.2 `cd frontend && npm test` (Vitest) — tests Story 2.x existing pass + tests mới Task E.5 pass.
  - [ ] F.2.3 `cd frontend && npm run build` — exit 0.

- [ ] **Task F.3 — Manual smoke check** (AC: 2, 10, 11)
  - [ ] F.3.1 Tạo mock binary tạm thời (e.g. `/tmp/mock-claude.sh` đơn giản `echo '{"session_id":"manual-test-uuid"}' && sleep 30`).
  - [ ] F.3.2 Set env: `OMNI_AGENT_CLAUDE_BIN=/tmp/mock-claude.sh`, chạy `cargo run` backend + `npm run dev` frontend.
  - [ ] F.3.3 Mở browser `http://localhost:5173`, tạo project + task, assign agent claude.
  - [ ] F.3.4 Click "Start Session" trong Task Detail Panel.
  - [ ] F.3.5 Verify: toast success xuất hiện, task status đổi sang "running" (sau polling 5s — Story 2.3 cache); UI vẫn responsive.
  - [ ] F.3.6 Check log file `~/.omni-agent/logs/<task_id>/<run_id>.log` chứa JSON output.
  - [ ] F.3.7 Check DB `sessions` table có row với `session_id = "manual-test-uuid"`.
  - [ ] F.3.8 Kill backend (Ctrl+C) — subprocess cũng nên kill (kill_on_drop) nhưng process orphan check bằng `ps aux | grep mock-claude` — Story 3.2 sẽ thêm graceful shutdown formal.

- [ ] **Task F.4 — Harness: cập nhật `docs/TEST_MATRIX.md`** (FEATURE_INTAKE.md normal+ requirement)
  - [ ] F.4.1 Update row Story 3.1:
    - Status: `planned` → `implemented`.
    - Cột Unit: `no` → `yes`.
    - Cột Integration: `no` → `yes`.
    - Cột E2E: `no` → `no` (defer 3.5a).
    - Evidence: link tới `_bmad-output/implementation-artifacts/3-1-agentstrategy-trait-and-start-session.md` + cargo test + vitest output paste.

- [ ] **Task F.5 — Update `_bmad-output/implementation-artifacts/sprint-status.yaml`** (Skill Step 6)
  - [ ] F.5.1 `epic-3: backlog` → `epic-3: in-progress` (Story 3.1 là story đầu tiên của Epic 3).
  - [ ] F.5.2 `3-1-agentstrategy-trait-and-start-session: backlog` → `ready-for-dev` ngay khi story file commit.
  - [ ] F.5.3 Sau dev-story complete + code review pass → `ready-for-dev` → `review` → `done`. Story 3.1 file chỉ commit với status `ready-for-dev`; transitions sau là responsibility của dev-story / code-review skills.
  - [ ] F.5.4 Update `last_updated` field.

---

## Dev Notes

### Architecture pillars (cùng module, cùng convention)

- **Backend module shape (architecture.md §"Structure Patterns"):** `agent/` là **abstraction point duy nhất** biết per-agent CLI format. `services/sessions.rs` chỉ gọi qua `AgentStrategy`. `handlers/sessions.rs` thin (delegate). State machine transition (`Assigned → Running`, `Running → Paused/Failed`) chỉ trong `services/tasks.rs`.
- **Subprocess ownership (project-context.md §"Critical Don't-Miss Rules"):** Backend là process owner. `Arc<Mutex<HashMap<TaskId, Child>>>` trong `AppState` là single source of truth. Insert ngay sau spawn thành công + DB commit. Story 3.1 KHÔNG remove khỏi map (đó là Story 3.2 exit detection / Cancel).
- **Async non-blocking:** dùng `tokio::process::Command::spawn` + `tokio::io::AsyncBufReadExt` cho stdout streaming. KHÔNG dùng `std::process::Command` hoặc blocking `read_to_string`.
- **Error envelope:** reuse `AppError::BadRequest / NotFound / Conflict / Internal` (đã có từ Story 1.1). Mới: 4 error codes — `invalid_agent` (reuse Story 2.2), `agent_not_found`, `task_not_assigned`, `session_already_active`.

### Binary resolution + test override

| Production | Test (integration) | Override mechanism |
|---|---|---|
| `claude` (PATH lookup) | mock-agent.sh path | env var `OMNI_AGENT_CLAUDE_BIN` |
| `codex` (PATH lookup) | mock-agent.sh path | env var `OMNI_AGENT_CODEX_BIN` |
| `~/.codex/sessions/` | tmp dir per-test | env var `OMNI_AGENT_CODEX_SESSIONS_DIR` |
| `$HOME` (log dir root) | tmp dir per-test | env var `HOME` (set in test) |

Lý do: env var đơn giản, không cần modify `AppState` shape, không cần `mockall` / `trait object injection`. Cost: tests phải `serial_test` hoặc set env trong từng test (clean up sau). Implementation đề xuất: dùng `serial_test` chỉ cho tests `start_session_*` integration. Unit tests cho `parse_session_id_chunk` không cần env, có thể parallel.

### Claude stdout format

Claude CLI in JSON events vào stdout dạng newline-delimited JSON (NDJSON). Mỗi event có field `type` (`"start"`, `"output"`, `"end"`, …). Event đầu tiên thường là `{"session_id": "...", "type": "start", "cwd": "..."}`. Implementation: parse từng line bằng `serde_json::from_str::<Value>` → check `value.get("session_id").and_then(|v| v.as_str())`. First match wins.

**Edge cases:**
- Stdout có thể gửi partial JSON (chia chunk giữa line) — dùng `BufReader::lines()` để guarantee complete line trước khi parse.
- Stdout có thể có dòng plain text trộn JSON (debug logs) — `from_str` fail trên dòng đó, skip.

### Codex stdout format

Codex CLI in event stream tương tự Claude (NDJSON). Cũng có field `session_id` (snake_case) hoặc `id` ở event đầu. Implementation: scan cả 2 keys an toàn:

```rust
fn parse_session_id_chunk(&self, chunk: &str) -> Option<String> {
    for line in chunk.lines() {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(line) {
            if let Some(s) = value.get("session_id").and_then(|v| v.as_str()) {
                return Some(s.to_string());
            }
            if let Some(s) = value.get("id").and_then(|v| v.as_str()) {
                if s.len() >= 8 { return Some(s.to_string()); }
            }
        }
    }
    None
}
```

### Codex fallback filesystem layout

`~/.codex/sessions/` chứa file mỗi session (filename = session UUID, e.g. `<uuid>.json` hoặc `<uuid>.jsonl`). mtime updated mỗi khi session ghi log. Story 3.1 fallback:
1. Scan `*.json` và `*.jsonl`.
2. Filter `mtime ≥ started_at - 2s` (tolerance).
3. Sort by mtime desc, lấy 1.
4. Parse session ID từ filename stem trước (cheap), fallback parse content nếu stem không match UUID-ish.

**Tolerance 2s:** xử lý đồng hồ skew giữa subprocess và backend process. Mở rộng sau nếu thấy false negative.

### Rollback discipline (subprocess + DB)

Nếu sau `transition_to_running` (DB committed) mà spawn fail HOẶC subprocess_map insert collision:
- **Best-effort revert:** gọi `tasks::revert_to_assigned(pool, task_id)` — UPDATE status='Assigned' WHERE id=? AND status='Running'. rows_affected=0 không lỗi (idempotent).
- **KHÔNG dùng DB transaction wrap subprocess spawn** — spawn là I/O không hợp với SQLite transaction (transaction nên ngắn).
- **KHÔNG delete session/run rows nếu chúng đã insert** — vì spawn fail xảy ra TRƯỚC khi insert sessions/runs (theo C.4.3 order: transition → spawn → check map → insert sessions/runs). Nếu spawn fail → chỉ task status revert là cần thiết.

**Wait, double-check order:** trong C.4.3, order là:
1. `transition_to_running` (Assigned → Running + DB commit).
2. `strategy_for(agent_name)`.
3. Create log dir.
4. Build command.
5. **Spawn** — fail here → revert task status, no session/run rows yet (chưa insert). OK.
6. Take stdout.
7. Lock subprocess_map, check collision, insert child handle. Collision → kill child + revert task. Vẫn no session/run rows.
8. INSERT sessions + runs trong 1 transaction.
9. Spawn background task.

Nếu step 8 (DB insert) fail → child đã trong map, task ở Running. Best-effort: remove from map + kill child + revert task. Implementation đề xuất: wrap step 7-8 trong helper, on error rollback step 7 trước khi return.

```rust
// pseudocode
let result: Result<(), AppError> = async {
    // step 7
    let mut map = subprocess_map.lock().await;
    if map.contains_key(task_id) { return Err(conflict); }
    map.insert(task_id.to_string(), child);  // takes ownership
    drop(map);
    // step 8
    let mut tx = pool.begin().await?;
    sqlx::query(... session insert).execute(&mut *tx).await?;
    sqlx::query(... run insert).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(())
}.await;
if let Err(e) = result {
    // rollback: remove from map (might already be gone if collision), revert task
    if let Some(mut child) = subprocess_map.lock().await.remove(task_id) {
        let _ = child.start_kill();
    }
    let _ = tasks::revert_to_assigned(pool, task_id).await;
    return Err(e);
}
```

### State machine: Task statuses Story 3.1 cares about

| DB value | Wire (lowercase) | Story 3.1 action on POST /sessions/start |
|---|---|---|
| `Draft` | `draft` | 409 `task_not_assigned` |
| `Ready` | `ready` | 409 `task_not_assigned` |
| `Assigned` | `assigned` | **Happy path** → `Running` |
| `Running` | `running` | 409 `session_already_active` |
| `Paused` | `paused` | 409 `task_not_assigned` (msg hint Resume) |
| `Failed` | `failed` | 409 `task_not_assigned` (msg hint Resume) |
| `NeedsReview` | `needs-review` | 409 `task_not_assigned` |
| `ChangesRequested` | `changes-requested` | 409 `task_not_assigned` |
| `Done` | `done` | 409 `task_not_assigned` (terminal) |
| `Cancelled` | `cancelled` | 409 `task_not_assigned` (terminal) |

Story 3.2 sẽ thêm `Running → Paused | Failed` transitions. Story 3.3 thêm `Paused/Failed → Running` (resume). Story 3.1 chỉ owns `Assigned → Running`.

### `agent.is_some()` invariant

Task có thể ở status `Assigned` mà `agent IS NULL`? Story 2.2 `assign_agent` set cả 2 cùng lúc (agent + role + status), nên trong workflow chuẩn KHÔNG. Nhưng schema cho phép — defensive guard trong `transition_to_running` (C.3.1 step 3) bảo vệ.

### Dependencies thêm mới

- `regex = "1"` — Story 3.1 hiện KHÔNG dùng regex (parse via `serde_json::Value`). Có thể **KHÔNG cần thêm** — verify trong implementation, nếu không dùng thì bỏ.
- `serial_test = "3"` (dev-dependency) — để xử lý test env var race. Optional: nếu kiểm soát được test order qua từng test set env trong block + tokio runtime isolation thì có thể skip. Verify pragmatic trong implementation.
- KHÔNG thêm `mockall`, `async-trait`, `which`.

### Test discipline cho subprocess

- Mock binary là shell script (Linux/macOS only). Acceptable vì target = local app, không CI Windows.
- Mỗi test set env var → potential race nếu chạy parallel. Mitigate:
  - **Option 1:** dùng `serial_test::serial` annotation cho group integration tests.
  - **Option 2:** spawn separate test process (cargo nextest mỗi test isolated process) — nhưng đó là tooling change, out of scope.
  - **Option 3:** truyền env vars qua `Command::env()` thay vì `std::env::set_var` global — nhưng `strategy_for` đọc env trong `spawn_command`, nên không trivial.
  - **Đề xuất implementation:** Option 1 (`serial_test`) cho `sessions_test.rs` integration tests. Unit tests `claude.rs` / `codex.rs` parse logic không cần env, có thể parallel.
- `kill_on_drop(true)` trên Command đảm bảo nếu test panic / không cleanup explicit, OS kill subprocess khi Child drop.

### Frontend cache invalidation

Story 2.3 dùng key `["tasks", projectId]` cho Task Board polling (5s khi có Running). Story 2.4 chưa có per-task query cache (Task Detail Panel đọc trực tiếp từ context, không refetch). Story 3.1 chỉ cần invalidate `["tasks", projectId]` để Task Board / Panel re-render với status mới.

Story 3.5a sẽ giới thiệu per-task query (`["task", projectId, taskId]`) cho live status feed — không phải scope 3.1. Trong `useStartSession`, gọi `invalidateQueries({ queryKey: ["task", projectId, taskId] })` cũng OK (no-op nếu key chưa tồn tại trong cache).

### Out-of-scope reminders

| Item | Defer story |
|---|---|
| Resume Session button wiring | 3.3 |
| Mark Done / Cancel button wiring | 3.2 (Cancel) / sau (Mark Done) |
| Subprocess exit detection (`Running → Paused/Failed`) | 3.2 |
| Graceful shutdown (`Running → Paused` on SIGINT) | 3.2 |
| Comment tracking (`Run.input`, `sent` flag) | 3.3 |
| Log tail (last 100 lines vào DB) | 3.4 |
| Summary tab live status feed + manual session ID UI | 3.5a |
| Comments / Runs / Logs tabs | 3.5b |

---

## References

- Epics: `_bmad-output/planning-artifacts/epics.md` §"Epic 3" + Story 3.1 (dòng 538–575)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
  - §"Core Architectural Decisions" / "API & Communication Patterns" (route `/sessions/start`)
  - §"Structure Patterns" / "Backend" (folder layout `agent/`, `services/sessions.rs`, `handlers/sessions.rs`)
  - §"Architectural Boundaries" (AgentStrategy abstraction, subprocess_map ownership)
  - §"Gap 1 — DB Schema" (sessions + runs tables)
  - §"Gap 3 — Session ID Capture Timeout" (10s rule)
- Project context: `_bmad-output/project-context.md` §"Rust (Backend)" + §"Agent CLI" + §"Critical Don't-Miss Rules"
- PRD: `_bmad-output/planning-artifacts/prds/prd-omni-agent-2026-05-20/prd.md` (FR-5, NFR-1, NFR-2, NFR-4)
- Feature intake: `docs/FEATURE_INTAKE.md` §"Lanes" / §"Risk Checklist" / §"Hard gates"
- Previous story patterns:
  - `_bmad-output/implementation-artifacts/2-2-task-crud-and-agent-assignment.md` (backend service + handler + integration test pattern, BEGIN IMMEDIATE + rows_affected discipline)
  - `_bmad-output/implementation-artifacts/2-4-task-detail-panel.md` (frontend ActionBar + TaskDetailPanel structure)
- Existing code (UPDATE, **read fully before editing**):
  - `backend/src/main.rs` (router mount)
  - `backend/src/state.rs` (`AppState.subprocess_map` — đã có shape)
  - `backend/src/services/tasks.rs` (BEGIN IMMEDIATE pattern + state transition discipline; thêm `transition_to_running` + `revert_to_assigned` cùng module)
  - `backend/src/db/migrations/1_init.sql` (verify `sessions.task_id UNIQUE` + `runs.log_path` columns — KHÔNG sửa file đã apply; nếu cần migration mới → file `3_*.sql`)
  - `backend/tests/tasks_test.rs` (build_test_app_with_pool helper — extend cho sessions test)
  - `frontend/src/features/detail/TaskDetailPanel.tsx` (ActionBar wire onClick)
  - `frontend/src/api/client.ts` (`apiFetch` + `ApiError`)
  - `frontend/src/components/Toast.tsx` (`useToast`)
  - `frontend/src/hooks/useTasks.ts` (verify cache key `tasksQueryKey`)

---

## Trace AC ↔ Task

| AC | Tasks | Test evidence |
|---|---|---|
| AC-1 AgentStrategy trait + 2 impl + factory | B.1, B.2, B.3 | unit tests `agent/mod.rs::tests`, `agent/claude.rs::tests`, `agent/codex.rs::tests` |
| AC-2 Spawn happy path Claude | C.4, D.1, D.2, D.3.2 | integration `start_session_claude_happy_path` |
| AC-3 Session ID capture Claude stdout | B.2 (parse), C.4.4 (stream), D.3.2 | unit `parse_returns_some_*` + integration `start_session_claude_happy_path` |
| AC-4 Capture timeout 10s | C.4.4 (select timer), D.3.5 | integration `start_session_capture_timeout` (ignored slow) |
| AC-5 Codex stdout + filesystem fallback | B.3, C.4.4, D.3.3, D.3.4 | unit `fallback_*` + integration `*_codex_happy_path_via_stdout`, `*_codex_fallback_filesystem` |
| AC-6 Binary not on PATH → 400 | C.4.3 (spawn error map), D.3.6 | integration `start_session_agent_not_found_returns_400` |
| AC-7 Task status wrong → 409 | C.3.1 (transition logic), D.3.7, D.3.8, D.3.9 | integration `*_task_in_draft_*`, `*_task_in_running_*`, `*_task_in_paused_*` |
| AC-8 Task/project not found → 404 | C.5.2 (verify_project_exists), C.3.1 (NotFound), D.3.10, D.3.11 | integration `*_unknown_task_*`, `*_unknown_project_*` |
| AC-9 Subprocess registered + log path | C.4.3 (map insert), C.4.2 (resolve_log_path), D.3.13 | integration `start_session_subprocess_registered_in_map` + log file existence assertion in D.3.2 |
| AC-10 Mount route + regression | D.1, D.3.12 | integration `start_session_health_route_still_works` + existing Story 1.x/2.x tests pass |
| AC-11 Frontend "Start Session" wiring | E.1, E.2, E.3, E.4, E.5 | vitest `TaskDetailPanel.test.tsx` (Story 3.1 additions) |
| AC-12 Idempotency double-click | C.3.1 atomic UPDATE, C.4.3 map collision check, D.3.14 | integration `start_session_double_click_idempotency` |

---

## Validation

| Layer | Expected proof |
|---|---|
| Unit (backend) | `cargo test` Tasks B.1.4, B.2.3, B.3.3, C.3.3 — `AgentStrategy` factory + parsers + state transition; >= 20 unit tests mới (no subprocess spawn). |
| Unit (frontend) | `npm test` Task E.5 — mutation mocking, toast asserts, button disabled state; >= 5 test mới. |
| Integration (backend) | `cargo test` Task D.3 — 14 integration tests (1 marked `--ignored` cho timeout 10s); cover happy path, all error paths, idempotency, subprocess map registration, log file creation. |
| E2E | Out-of-scope Story 3.1 — Playwright E2E cho lifecycle hoàn chỉnh defer Story 3.5a (Session Summary Tab) hoặc Epic 3 retro. |
| Platform | Manual smoke (Task F.3) trên Linux/macOS local dev — cargo run + npm run dev + mock binary. |
| Release | Story 3.1 không thay đổi deployment (vẫn local single binary). Không release gate. |

---

## Harness Delta

- Cập nhật `docs/TEST_MATRIX.md` row Story 3.1: status `planned → implemented`, Unit/Integration `no → yes`, Evidence link tới story file + cargo/vitest output. (Task F.4)
- KHÔNG cần thêm row mới — Story 3.1 đã có row sẵn trong matrix (`3.1 Start Session`).
- Sprint status: `epic-3: backlog → in-progress`, `3-1-...: backlog → ready-for-dev` (Task F.5).
- KHÔNG cần update `docs/FEATURE_INTAKE.md` hoặc `docs/HARNESS.md` — high-risk lane đã tồn tại trong intake.
- Optional: nếu dev gặp pain point với subprocess test mock pattern → ghi vào `docs/HARNESS_BACKLOG.md` đề xuất một skill / utility chung (e.g. `mock-agent.sh` thành crate-shared fixture, hoặc `mockall` cho `AgentStrategy`).

---

## Dev Agent Record

### Agent Model Used

_To be filled by dev-story_

### Debug Log

_To be filled by dev-story_

### Completion Notes

_To be filled by dev-story_

### File List

_To be filled by dev-story_

---

## Change Log

| Date | Change | Author |
|---|---|---|
| 2026-05-25 | Story file created via bmad-create-story, status set to ready-for-dev | bmad-create-story |
