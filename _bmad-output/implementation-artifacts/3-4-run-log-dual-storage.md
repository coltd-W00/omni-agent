# Story 3.4: Run Log Dual-Storage

Status: review

<!-- Validation tùy chọn — chạy validate-create-story trước khi dev-story nếu muốn double-check. -->

**Epic:** 3 — Session Lifecycle & Agent Execution
**Story ID:** 3.4
**Story Key:** 3-4-run-log-dual-storage
**Depends on:**
- Story 3.1 (AgentStrategy Trait & Start Session) — phải hoàn thành trước; story 3.4 reuse `subprocess_map`, background streaming task (`stream_and_capture`), helper `resolve_log_path`, `runs` row created khi `start_session`, và `models::run::Run` đã có sẵn các field `log_path` / `log_tail` / `exit_code` / `started_at` / `ended_at`.
- Story 3.2 (Session Exit Detection & Graceful Shutdown) — phải hoàn thành trước; story 3.4 reuse `services::runs::read_log_tail`, `services::runs::complete_run` (xử lý `log_tail` write trên exit), và bảng `runs` đã được flush đúng ở shutdown. Story 3.4 KHÔNG re-implement `read_log_tail` / `complete_run` — chỉ bổ sung các function read-side và stderr capture vào cùng module `services/runs.rs`.
- Story 3.3 (Resume Session & Comment Tracking) — phải hoàn thành trước; story 3.4 phải bao phủ stderr capture cho cả run spawn từ `start_session` (3.1) lẫn `resume_session` (3.3). Run row mà 3.3 tạo cũng phải xuất hiện đầy đủ trong API GET runs (cùng `run_number`, `input` = comment text).

---

## Story

As a developer using omni-agent,
I want agent run output (stdout + stderr) được lưu vừa ra file log đầy đủ vừa ghi tail vào DB, và truy xuất qua API REST kể cả sau khi backend restart,
So that tôi luôn xem được full output của mọi run, không mất history khi app restart, và frontend (Story 3.5b) có endpoint ổn định để render Runs / Logs tabs.

---

## Acceptance Criteria

> **Nguồn gốc AC:** `_bmad-output/planning-artifacts/epics.md` Story 3.4 (dòng 652–679) + FR-8 / NFR-3 (dòng 36, 137) + `_bmad-output/planning-artifacts/architecture.md` §"Data Architecture" / §"API Route Structure" (dòng 187–226) / §"Architectural Boundaries" / §"Gap 1 — DB Schema" + `_bmad-output/project-context.md` §"Critical Don't-Miss Rules" ("KHÔNG lưu full log output vào DB"). Backend conventions: error envelope `{ "error": "<code>", "message": "<text>" }`, JSON `camelCase` (serde `rename_all = "camelCase"`), task status DB lưu PascalCase serialize wire lowercase. SQLite single source of truth (project-context §"Data integrity assumptions"), `sqlx::migrate!()` auto-run on startup nên restart không mất data.

---

**AC-1 — Stdout + stderr cùng ghi vào log file (dual capture, append, interleaved):**

**Given** một session Run đã start qua `POST .../sessions/start` (Story 3.1) hoặc resume qua `POST .../sessions/resume` (Story 3.3)
**And** subprocess được spawn với `Stdio::piped()` trên cả `stdout` lẫn `stderr` (Story 3.1 `claude.rs` / `codex.rs` đã set sẵn)
**When** subprocess bắt đầu produce output trên BOTH stdout AND stderr
**Then** backend phải `.take()` cả `child.stdout` lẫn `child.stderr` TRƯỚC khi insert child vào `subprocess_map` (tránh deadlock khi pipe buffer đầy — đây là regression Story 3.1 KHÔNG xử lý: 3.1 chỉ take stdout, stderr bị mặc kệ → fill buffer → subprocess block).
**And** spawn **một background task riêng cho stderr** (song song với stdout streaming task của Story 3.1) đọc stderr theo `tokio::io::BufReader::new(stderr).lines()` và append vào CÙNG file `log_path` mà stdout task đang ghi.
**And** mỗi dòng stderr được prefix `[stderr] ` để phân biệt khi đọc lại log file (giúp debug — stdout không cần prefix vì là dòng "chính"). Format: `<line>\n` cho stdout, `[stderr] <line>\n` cho stderr.
**And** cả hai task dùng `tokio::fs::OpenOptions::new().create(true).append(true).open(log_path)` riêng biệt — KHÔNG share `File` handle giữa 2 task (tránh race condition trên write position). OS append mode đảm bảo atomic per-write trên POSIX cho block ≤ PIPE_BUF (4096 bytes) — line-by-line write an toàn.
**And** stderr task KHÔNG gọi `parse_session_id_chunk` — session ID capture chỉ scan stdout (theo design Story 3.1).
**And** khi subprocess exit, stderr task cũng kết thúc tự nhiên (stderr pipe EOF) — không cần signal riêng.

*Lưu ý regression Story 3.1:* helper `stream_and_capture` ở `services/sessions.rs` hiện chỉ nhận `ChildStdout`. Story 3.4 cần refactor (hoặc thêm helper bổ sung) để xử lý CẢ stderr. Pattern khuyến nghị: spawn 2 task riêng từ `start_session` và `resume_session`, KHÔNG nhét stderr vào trong `stream_and_capture` để giữ session ID parse logic rõ ràng.

---

**AC-2 — `Run.log_path` lưu đúng đường dẫn tuyệt đối, file thực sự tồn tại sau spawn:**

**Given** AC-1 hoàn tất (background tasks đã spawn)
**When** background task đầu tiên (stdout hoặc stderr) gọi `OpenOptions::open(log_path)` lần đầu
**Then** parent directory `~/.omni-agent/logs/{task_id}/` phải đã được `create_dir_all` từ trước (Story 3.1 task C.4.3 đã làm — KHÔNG duplicate). Nếu chưa tồn tại → first task tự `create_dir_all` (defensive).
**And** `runs.log_path` trong DB = string tuyệt đối resolve qua `resolve_log_path(task_id, run_id)` (helper từ Story 3.1) — format `<HOME>/.omni-agent/logs/{task_id}/{run_id}.log`. KHÔNG bao gồm `~` literal (đã expand `$HOME`).
**And** file vật lý xuất hiện trên disk trong vòng 2 giây sau response của `POST .../sessions/start` (test: poll filesystem). Nếu subprocess không produce output ngay, file vẫn được tạo (rỗng) ngay lần `OpenOptions::open` đầu tiên — đây là behavior mong muốn.

---

**AC-3 — Trên exit: `Run.log_tail` chứa last 100 lines OR last 10KB (whichever smaller):**

**Given** một Run hoàn tất (subprocess exit hoặc bị kill bởi cancel/shutdown — xem Story 3.2 AC-1/2/4/5)
**When** background exit monitor gọi `services::runs::complete_run(pool, run_id, exit_code, log_tail.as_deref())` (logic của Story 3.2)
**Then** `log_tail` truyền vào complete_run được tính bằng `services::runs::read_log_tail(log_path, 100, 10_240)` (helper Story 3.2):
- Nếu log file có ≤ 100 lines AND ≤ 10_240 bytes → toàn bộ content
- Nếu log file có > 100 lines AND tail của 100 lines ≤ 10_240 bytes → tail 100 lines
- Nếu tail 100 lines > 10_240 bytes → tail 10_240 bytes (cắt từ cuối, không quan tâm line boundary — chấp nhận dòng đầu tiên có thể bị cắt giữa chừng)
**And** `runs.log_tail` sau update KHÔNG vượt quá 10_240 bytes (assertable trong test bằng `len()`).
**And** stderr lines (đã prefix `[stderr] `) cũng có thể xuất hiện trong tail nếu chúng nằm trong window cuối cùng.

*Trách nhiệm:* Story 3.2 đã implement đầy đủ logic này. Story 3.4 chỉ thêm test e2e xác nhận output từ stderr cũng được include vào tail.

---

**AC-4 — Persistence sau backend restart: Run history vẫn đọc được từ DB:**

**Given** ít nhất 1 Run đã complete (có `exit_code` không null) ở thời điểm `T0`
**When** backend process bị restart (stop hoàn toàn → start lại — KHÔNG xóa file `~/.omni-agent/omni-agent.db`)
**Then** sau khi `db::run_migrations` hoàn tất (idempotent), `GET .../runs` và `GET .../runs/{run_id}` (AC-5, AC-6) phải trả về run record giống hệt như trước restart:
- `id`, `runNumber`, `input`, `exitCode`, `logPath`, `logTail`, `startedAt`, `endedAt` đều giữ nguyên giá trị
**And** nếu log file tại `runs.log_path` vẫn còn trên disk → API response vẫn dùng path đó (frontend có thể download file). Nếu file đã bị user xóa thủ công → `logPath` vẫn là string cũ (DB không tự sync với filesystem), nhưng `logTail` trong DB vẫn dùng được — backend KHÔNG cần re-read file để serve API (chỉ dùng `log_tail` đã lưu).
**And** restart KHÔNG được trigger migration mới hay alter table — SQLite file mở lại bằng cùng pool config.

*Test approach:* integration test `restart_persistence` — tạo run hoàn chỉnh với log_tail, drop pool, mở lại pool với cùng `db_url`, chạy `run_migrations` (idempotent), gọi service `list_runs_for_task` → assert record giữ nguyên. Không cần spawn lại real backend process.

---

**AC-5 — `GET /api/projects/{project_id}/tasks/{task_id}/runs/{run_id}` — happy path:**

**Given** một run đã tồn tại với `id = run-uuid-aaa`, thuộc session của task `OMNI-001` trong project `OMNI`
**When** client gọi `GET /api/projects/OMNI/tasks/OMNI-001/runs/run-uuid-aaa`
**Then** response **`200 OK`** với body (camelCase, đúng thứ tự field như liệt kê dưới — JSON serde stable):
```json
{
  "id": "run-uuid-aaa",
  "runNumber": 1,
  "input": null,
  "exitCode": 0,
  "logPath": "/home/user/.omni-agent/logs/OMNI-001/run-uuid-aaa.log",
  "logTail": "Last lines of stdout...\n[stderr] some warning\n",
  "startedAt": "2026-05-25T10:00:00+00:00",
  "endedAt": "2026-05-25T10:00:30+00:00"
}
```
**And** field tên đúng `camelCase` (`runNumber`, `exitCode`, `logPath`, `logTail`, `startedAt`, `endedAt`).
**And** field `null` thì serialize JSON `null` (KHÔNG omit). Việc serialize null vs omit theo serde default — `Option::None` → JSON `null`. Behavior này nhất quán với `Run` model hiện có trong `backend/src/models/run.rs`.
**And** content-type header: `application/json`.

**Given** run đang còn chạy (`exit_code = NULL`, `ended_at = NULL`)
**When** GET request đến trước khi exit detection chạy
**Then** response vẫn `200 OK` với `exitCode = null`, `endedAt = null`, `logTail = null` (chưa được populate). `logPath` đã có ngay từ start (theo AC-2). `input` có thể null (start) hoặc text (resume).

---

**AC-6 — `GET /api/projects/{project_id}/tasks/{task_id}/runs` — list endpoint:**

**Given** task `OMNI-001` có 3 runs (run_number 1, 2, 3) thuộc CÙNG một session
**When** client gọi `GET /api/projects/OMNI/tasks/OMNI-001/runs`
**Then** response **`200 OK`** với body là JSON array sorted theo `run_number` **giảm dần** (run mới nhất đầu tiên):
```json
[
  { "id": "...", "runNumber": 3, "input": "...", "exitCode": null, ... },
  { "id": "...", "runNumber": 2, "input": "...", "exitCode": 1, ... },
  { "id": "...", "runNumber": 1, "input": null, "exitCode": 0, ... }
]
```
**And** mỗi element có CÙNG shape như AC-5 (8 fields).
**And** nếu task chưa có session/run nào → response `200 OK` với body `[]` (empty array, KHÔNG 404).

*Lý do sort DESC:* UI Story 3.5b (Runs tab + RunTimeline) render run mới nhất trên cùng — backend trả sẵn để tránh sort phía client.

---

**AC-7 — Error case: project not found (404):**

**Given** project `XYZ` không tồn tại trong bảng `projects`
**When** client gọi `GET /api/projects/XYZ/tasks/XYZ-001/runs` hoặc `GET .../runs/{run_id}`
**Then** response `404 Not Found` với body:
```json
{ "error": "project_not_found", "message": "Project XYZ not found" }
```

---

**AC-8 — Error case: task not found (404):**

**Given** project `OMNI` tồn tại nhưng task `OMNI-999` không tồn tại
**When** client gọi `GET /api/projects/OMNI/tasks/OMNI-999/runs` hoặc `GET .../runs/{run_id}`
**Then** response `404 Not Found` với body:
```json
{ "error": "task_not_found", "message": "Task OMNI-999 not found" }
```

---

**AC-9 — Error case: run not found hoặc không thuộc task này (404):**

**Given** project `OMNI` + task `OMNI-001` tồn tại nhưng `run_id = unknown-uuid` không có trong bảng `runs`
**When** client gọi `GET /api/projects/OMNI/tasks/OMNI-001/runs/unknown-uuid`
**Then** response `404 Not Found` với body:
```json
{ "error": "run_not_found", "message": "Run unknown-uuid not found for task OMNI-001" }
```

**Given** run `run-uuid-bbb` thực sự tồn tại NHƯNG thuộc session của task `OMNI-002` (không phải `OMNI-001`)
**When** client gọi `GET /api/projects/OMNI/tasks/OMNI-001/runs/run-uuid-bbb`
**Then** response `404 Not Found` với CÙNG error code `run_not_found` (không leak existence cross-task). Service phải JOIN `runs` → `sessions` → `tasks` để verify ownership.

---

**AC-10 — Non-blocking writes: file I/O không block HTTP handler:**

**Given** `POST .../sessions/start` được gọi với mock binary in stdout liên tục
**When** backend xử lý request
**Then** HTTP response `200 OK` trả về trong vòng **≤ 500ms** (target: ≤ 200ms — đo từ request bắt đầu cho đến khi response body flush) — KHÔNG chờ background log writer task hoàn thành.
**And** background log writer task tiếp tục ghi vào file SAU khi handler đã return — verify bằng cách: response time ≤ 500ms, sau đó wait thêm 1-2s rồi đọc log file → có content xuất hiện.
**And** background task dùng `tokio::spawn` (không phải `tokio::task::spawn_blocking`) cho phần stream lines. Phần `OpenOptions::open` và `write_all` dùng `tokio::fs::*` (async, non-blocking) — KHÔNG dùng `std::fs::*` blocking trong background task chính.

*Lưu ý implementation:* Story 3.1 đã spawn background task non-blocking. Story 3.4 chỉ cần đảm bảo stderr task cũng follow pattern này. Test assertion: timing-based — không deterministic 100% nhưng có thể đặt threshold rộng (500ms cho CI sluggish).

---

**AC-11 — Logs directory được tạo recursively nếu chưa tồn tại:**

**Given** chưa có thư mục `~/.omni-agent/logs/OMNI-001/` (lần đầu start session cho task này)
**When** background task mở `log_path` lần đầu
**Then** `std::fs::create_dir_all(log_path.parent())` hoặc `tokio::fs::create_dir_all` được gọi (Story 3.1 task C.4.3 đã làm — Story 3.4 verify hành vi này, KHÔNG re-implement).
**And** nếu permission denied → log error qua `tracing::error!`, KHÔNG panic. Run row vẫn được tạo trong DB (`log_path` đã set), nhưng file rỗng. Frontend hiển thị "log file not available" — out-of-scope Story 3.4.

---

**AC-12 — Frontend API client + types cho Run:**

**Given** backend GET endpoints đã online (AC-5, AC-6)
**When** developer cần consume từ React (Story 3.5b sắp tới)
**Then** repo phải có sẵn:
- `frontend/src/types/run.ts` — TypeScript interface `Run` match đúng shape AC-5 (8 fields), export named.
- `frontend/src/api/runs.ts` — hai function `listRuns(projectId, taskId)` và `getRun(projectId, taskId, runId)`, dùng `apiFetch` helper từ `client.ts` (pattern giống `api/tasks.ts`).
**And** `Run` type không export hook (`useRuns` thuộc Story 3.5b — KHÔNG include trong 3.4).
**And** `apiFetch` URL build dùng `encodeURIComponent` cho `projectId`, `taskId`, `runId` (defensive, theo pattern `api/tasks.ts`).

---

## Tasks / Subtasks

### A. Backend: Stderr capture vào log file

- [x] **Task A.1 — Refactor spawn flow để take stderr** (AC: 1, 10, 11)
  - [x] A.1.1 Read `backend/src/services/sessions.rs` (sau khi Story 3.1 merge) — tìm vị trí `child.stdout.take()` trước khi `subprocess_map.insert(...)`. Thêm dòng song song: `let stderr = child.stderr.take().expect("stderr piped");` — phải nằm CÙNG block, TRƯỚC `subprocess_map.insert(child)`.
  - [x] A.1.2 Verify `agent/claude.rs` và `agent/codex.rs` (Story 3.1) đã set `cmd.stderr(Stdio::piped())` trong cả `spawn_command` lẫn `resume_command`. Nếu thiếu → ESCALATE: "Story 3.4 requires stderr piped from spawn; agent strategy missing `.stderr(Stdio::piped())`".
  - [x] A.1.3 Apply cùng pattern cho `resume_session` (Story 3.3) — chỗ spawn child trong resume flow cũng phải take stderr.

- [x] **Task A.2 — Thêm helper `stream_stderr_to_log` trong `services/sessions.rs`** (AC: 1, 10)
  - [x] A.2.1 Signature:
    ```rust
    async fn stream_stderr_to_log(
        stderr: tokio::process::ChildStderr,
        log_path: std::path::PathBuf,
    ) {
        use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
        let mut file = match tokio::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
            .await
        {
            Ok(f) => f,
            Err(e) => {
                tracing::error!(?e, log_path = ?log_path, "stderr task: failed to open log file");
                return;
            }
        };
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let formatted = format!("[stderr] {}\n", line);
            if let Err(e) = file.write_all(formatted.as_bytes()).await {
                tracing::warn!(?e, "stderr task: write failed, continuing");
            }
        }
    }
    ```
  - [x] A.2.2 Spawn helper trong `start_session` (Story 3.1) RIGHT AFTER stdout task spawn:
    ```rust
    // After Story 3.1's `tokio::spawn(stream_and_capture(...))`:
    tokio::spawn(stream_stderr_to_log(stderr, log_path.clone()));
    ```
  - [x] A.2.3 Lặp lại cho `resume_session` (Story 3.3) — cùng pattern, cùng `log_path` của run mới.
  - [x] A.2.4 KHÔNG share `File` handle giữa stdout task và stderr task — mỗi task tự `OpenOptions::open` với `.append(true)`. POSIX append mode đảm bảo các write ≤ PIPE_BUF (4KB) là atomic — line-by-line ghi an toàn không cần mutex.

- [x] **Task A.3 — Unit test logic format dòng stderr** (AC: 1)
  - [x] A.3.1 KHÔNG cần test ngay helper `stream_stderr_to_log` ở mức unit (cần real subprocess + filesystem) — coverage qua integration test Task D.
  - [x] A.3.2 Nếu tách logic format thành pure helper (`fn format_stderr_line(line: &str) -> String`) thì viết unit test đơn giản: `format_stderr_line("err msg")` → `"[stderr] err msg\n"`.

### B. Backend: Service layer cho read-side runs API

- [x] **Task B.1 — Mở rộng `backend/src/services/runs.rs`** (AC: 5, 6, 7, 8, 9)
  - [x] B.1.1 File đã tồn tại (Story 3.2 tạo cho `complete_run` + `read_log_tail`). KHÔNG được xóa hay sửa 2 function đó.
  - [x] B.1.2 Thêm `pub async fn get_run_by_id(pool: &SqlitePool, project_id: &str, task_id: &str, run_id: &str) -> Result<Run, AppError>`:
    1. Acquire connection từ pool.
    2. Verify project tồn tại: `SELECT id FROM projects WHERE id = ? OR key = ?` (cho phép path param là id hoặc key — theo pattern `services::tasks::get_task` — VERIFY pattern này từ code Story 1.x/2.x trước khi implement; nếu hiện tại chỉ accept `id` → giữ nguyên `WHERE id = ?`). Nếu không có → `AppError::NotFound { code: "project_not_found", message: format!("Project {} not found", project_id) }`.
    3. Verify task tồn tại + thuộc project: `SELECT id FROM tasks WHERE id = ? AND project_id = ?` (resolve project_id từ step 2). Nếu không có → `AppError::NotFound { code: "task_not_found", message: format!("Task {} not found", task_id) }`.
    4. JOIN query để verify run thuộc task này:
       ```sql
       SELECT r.* FROM runs r
       INNER JOIN sessions s ON r.session_id = s.id
       WHERE r.id = ? AND s.task_id = ?
       ```
       `bind(run_id).bind(task_id)`.
       - `fetch_optional` → `None` → `AppError::NotFound { code: "run_not_found", message: format!("Run {} not found for task {}", run_id, task_id) }`.
       - `Some(run)` → return `Ok(run)`.
  - [x] B.1.3 Thêm `pub async fn list_runs_for_task(pool: &SqlitePool, project_id: &str, task_id: &str) -> Result<Vec<Run>, AppError>`:
    1. Verify project + task (giống B.1.2 steps 2-3).
    2. Query: `SELECT r.* FROM runs r INNER JOIN sessions s ON r.session_id = s.id WHERE s.task_id = ? ORDER BY r.run_number DESC`.
    3. `fetch_all` → `Ok(Vec<Run>)`. Trả `vec![]` nếu task chưa có session → KHÔNG 404.
  - [x] B.1.4 KHÔNG dùng `unwrap()` / `expect()`. Mọi error path → `?` operator hoặc explicit map.
  - [x] B.1.5 KHÔNG hardcode SQL trong handler — handler chỉ gọi service.
  - [x] B.1.6 Verify alignment với `Run` struct trong `backend/src/models/run.rs` (đã có sẵn, không sửa).

- [x] **Task B.2 — Unit tests cho service functions** (AC: 5, 6, 7, 8, 9)
  - [x] B.2.1 Trong `services/runs.rs` thêm `#[cfg(test)] mod tests`. Pattern setup giống `services/tasks.rs` (Story 2.x):
    - Helper `setup_test_pool()` tạo in-memory SQLite, chạy `db::run_migrations`.
    - Seed project + task + session + runs qua raw SQL.
  - [x] B.2.2 Tests cho `get_run_by_id`:
    - `get_run_by_id_happy_path` — seed 1 run, query → match record.
    - `get_run_by_id_returns_project_not_found_when_project_missing`.
    - `get_run_by_id_returns_task_not_found_when_task_missing`.
    - `get_run_by_id_returns_run_not_found_when_run_id_unknown`.
    - `get_run_by_id_returns_run_not_found_when_run_belongs_to_different_task` — seed 2 tasks, query run của task A từ task B → 404 `run_not_found` (không 200, không leak).
  - [x] B.2.3 Tests cho `list_runs_for_task`:
    - `list_runs_for_task_returns_runs_sorted_desc_by_run_number` — seed 3 runs với `run_number` 1, 2, 3 (insert thứ tự ngẫu nhiên) → result `[3, 2, 1]`.
    - `list_runs_for_task_returns_empty_when_no_session` — task chưa có session → `[]`.
    - `list_runs_for_task_returns_project_not_found`.
    - `list_runs_for_task_returns_task_not_found`.
    - `list_runs_for_task_does_not_include_runs_of_other_tasks` — seed 2 tasks, mỗi task 1 run → query task A → chỉ 1 run của A.

### C. Backend: Handler + route mount

- [x] **Task C.1 — Tạo `backend/src/handlers/runs.rs`** (AC: 5, 6, 7, 8, 9)
  - [x] C.1.1 Module skeleton:
    ```rust
    use std::sync::Arc;
    use axum::{Json, extract::{Path, State}, response::IntoResponse};

    use crate::error::AppError;
    use crate::services;
    use crate::state::AppState;

    pub async fn list_runs(
        State(state): State<Arc<AppState>>,
        Path((project_id, task_id)): Path<(String, String)>,
    ) -> Result<impl IntoResponse, AppError> {
        let runs = services::runs::list_runs_for_task(&state.db, &project_id, &task_id).await?;
        Ok(Json(runs))
    }

    pub async fn get_run(
        State(state): State<Arc<AppState>>,
        Path((project_id, task_id, run_id)): Path<(String, String, String)>,
    ) -> Result<impl IntoResponse, AppError> {
        let run = services::runs::get_run_by_id(&state.db, &project_id, &task_id, &run_id).await?;
        Ok(Json(run))
    }
    ```
  - [x] C.1.2 Add `pub mod runs;` vào `backend/src/handlers/mod.rs`.

- [x] **Task C.2 — Mount routes trong `backend/src/main.rs`** (AC: 5, 6)
  - [x] C.2.1 Thêm vào `api_router`:
    ```rust
    .route(
        "/projects/{project_id}/tasks/{task_id}/runs",
        get(handlers::runs::list_runs),
    )
    .route(
        "/projects/{project_id}/tasks/{task_id}/runs/{run_id}",
        get(handlers::runs::get_run),
    )
    ```
  - [x] C.2.2 KHÔNG xóa hoặc đổi route khác. Position trong chain không quan trọng (Axum routing trie).
  - [x] C.2.3 Verify `use axum::routing::get;` đã import (main.rs hiện đã có).

### D. Backend: Integration tests

- [x] **Task D.1 — Tạo `backend/tests/runs_test.rs`** (AC: 4, 5, 6, 7, 8, 9, 10)
  - [x] D.1.1 Pattern giống `tests/sessions_test.rs` (Story 3.1) hoặc `tests/tasks_test.rs` (Story 2.x):
    - Helper `build_test_app_with_pool` (đã có từ Story 1.x — verify trước khi dùng).
    - Serial test execution (env var isolation cho `HOME`, `OMNI_AGENT_*_BIN`).
  - [x] D.1.2 Test `get_run_by_id_returns_200_with_camelcase_body`:
    - Seed project + task + session + 1 run với đầy đủ field.
    - HTTP `GET /api/projects/{id}/tasks/{id}/runs/{run_id}` → status 200, body parse được thành `serde_json::Value`, verify keys: `id`, `runNumber`, `input`, `exitCode`, `logPath`, `logTail`, `startedAt`, `endedAt` — KHÔNG có snake_case key nào lọt qua.
  - [x] D.1.3 Test `get_run_by_id_returns_404_run_not_found`.
  - [x] D.1.4 Test `get_run_by_id_returns_404_when_run_belongs_to_other_task` — seed 2 tasks, query cross-task → 404 `run_not_found`.
  - [x] D.1.5 Test `get_run_by_id_returns_404_project_not_found` / `404_task_not_found`.
  - [x] D.1.6 Test `list_runs_returns_sorted_desc` — seed 3 runs với `run_number` 1, 2, 3 → response array `[3, 2, 1]`.
  - [x] D.1.7 Test `list_runs_returns_empty_array_when_no_session`.
  - [x] D.1.8 Test `list_runs_returns_404_project_not_found` / `404_task_not_found`.

- [x] **Task D.2 — Test: persistence sau restart** (AC: 4)
  - [x] D.2.1 Test `runs_persist_after_pool_reopen`:
    1. Tạo temp dir cho DB (`tempfile::TempDir`).
    2. Mở pool 1 → run migrations → insert project/task/session/run đầy đủ.
    3. Drop pool 1 (`.close()` then drop).
    4. Mở pool 2 với CÙNG `db_url`.
    5. Chạy `db::run_migrations` lần nữa (idempotent — verify không panic).
    6. Gọi `services::runs::list_runs_for_task(&pool2, project_id, task_id)` → assert 1 run với đầy đủ field giống lúc insert.
  - [x] D.2.2 Test có thể chạy purely in-memory không cần subprocess.

- [x] **Task D.3 — Test: stderr capture interleaved trong log file** (AC: 1, 3)
  - [x] D.3.1 Tạo mock binary mới `backend/tests/fixtures/mock-agent-stderr.sh` (hoặc reuse `mock-agent.sh` từ Story 3.1 với env var mới):
    ```bash
    #!/bin/bash
    echo "stdout line 1"
    echo "stdout line 2"
    echo "stderr line A" >&2
    echo "stdout line 3"
    echo "stderr line B" >&2
    sleep 0.1
    exit 0
    ```
    `chmod +x`.
  - [x] D.3.2 Test `start_session_writes_both_stdout_and_stderr_to_log_file`:
    1. Set `OMNI_AGENT_CLAUDE_BIN` = path mock-agent-stderr.sh.
    2. Spawn session → wait 1s for completion.
    3. Read log file from `runs.log_path`.
    4. Assert file content chứa: `stdout line 1`, `stdout line 2`, `stdout line 3`, `[stderr] stderr line A`, `[stderr] stderr line B`.
    5. Stderr lines phải có prefix `[stderr] ` — assert bằng `content.contains("[stderr] stderr line A")`.
  - [x] D.3.3 Test `log_tail_includes_stderr_lines`:
    - Sau test D.3.2, query `runs.log_tail` từ DB (Story 3.2 đã populate). Assert tail string contain `[stderr] stderr line B` (dòng stderr cuối cùng).
  - [x] D.3.4 **Lưu ý:** test phụ thuộc Story 3.2 đã merge (cần `complete_run` chạy log_tail update). Nếu chạy isolated 3.4 trước khi 3.2 merge → skip với `#[ignore]` + note.

- [x] **Task D.4 — Test: non-blocking response time** (AC: 10)
  - [x] D.4.1 Test `start_session_response_returns_within_500ms_even_when_subprocess_produces_output`:
    1. Tạo mock binary `mock-agent-noisy.sh` print 100 dòng liên tục trong 2 giây rồi exit.
    2. Đo thời gian từ `POST /sessions/start` request đến response received.
    3. Assert `< 500ms` (threshold rộng cho CI). Note: response không chờ subprocess exit — chỉ chờ child spawn + run row insert + handle insert vào map.
  - [x] D.4.2 Sau response, sleep 1.5s rồi đọc log file → assert có ≥ một số dòng (verify background task vẫn chạy non-blocking).

### E. Frontend: Types + API client

- [x] **Task E.1 — Tạo `frontend/src/types/run.ts`** (AC: 12)
  - [x] E.1.1 Nội dung:
    ```ts
    export interface Run {
      id: string;
      runNumber: number;
      input: string | null;
      exitCode: number | null;
      logPath: string | null;
      logTail: string | null;
      startedAt: string;
      endedAt: string | null;
    }
    ```
  - [x] E.1.2 KHÔNG thêm hook / enum khác — giữ scope tối thiểu cho 3.5b consume.

- [x] **Task E.2 — Tạo `frontend/src/api/runs.ts`** (AC: 12)
  - [x] E.2.1 Pattern theo `frontend/src/api/tasks.ts`:
    ```ts
    import { apiFetch } from "./client";
    import type { Run } from "../types/run";

    export const listRuns = (projectId: string, taskId: string) =>
      apiFetch<Run[]>(
        `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/runs`,
      );

    export const getRun = (projectId: string, taskId: string, runId: string) =>
      apiFetch<Run>(
        `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/runs/${encodeURIComponent(runId)}`,
      );
    ```
  - [x] E.2.2 KHÔNG thêm mutation (runs chỉ read trong scope 3.4).

- [x] **Task E.3 — Lint / type check frontend** (AC: 12)
  - [x] E.3.1 `cd frontend && pnpm typecheck` (hoặc `npm run typecheck` — verify command qua `package.json` "scripts").
  - [x] E.3.2 `cd frontend && pnpm lint` — không introduce warning.
  - [x] E.3.3 KHÔNG implement test cho `api/runs.ts` (consistent với pattern `api/tasks.ts` — không có test file riêng cho api client; coverage qua hook tests ở 3.5b).

### F. Documentation + Sprint status

- [x] **Task F.1 — Update sprint status** (workflow requirement)
  - [x] F.1.1 `_bmad-output/implementation-artifacts/sprint-status.yaml`: `3-4-run-log-dual-storage: backlog` → `ready-for-dev`. `last_updated` → current datetime.
  - [x] F.1.2 KHÔNG đổi status story khác trong sprint.

- [x] **Task F.2 — Verification gates trước khi mark Done** (workflow requirement)
  - [x] F.2.1 `cd backend && cargo fmt --check && cargo clippy -- -D warnings && cargo test` — tất cả pass.
  - [x] F.2.2 `cd frontend && pnpm typecheck && pnpm lint` — pass.
  - [x] F.2.3 Số test mới expected: ≥ 5 unit tests trong `services/runs.rs` + ≥ 6 integration tests trong `tests/runs_test.rs` + ≥ 2 stderr/non-blocking tests.
  - [x] F.2.4 No regression: existing test suite của Story 1.x/2.x/3.1/3.2/3.3 vẫn pass đầy đủ.

---

## Dev Notes

### Architecture compliance

**File locations (theo `architecture.md` §"Project Directory Structure", dòng 486–522):**
- `backend/src/handlers/runs.rs` — NEW (architecture đã list, chưa tồn tại).
- `backend/src/services/runs.rs` — EXTEND (Story 3.2 đã tạo file cho `complete_run` / `read_log_tail`; story 3.4 thêm `get_run_by_id` + `list_runs_for_task` vào CÙNG file).
- `backend/src/services/sessions.rs` — UPDATE (thêm `stream_stderr_to_log` helper + call site sau `tokio::spawn(stream_and_capture)`).
- `backend/tests/runs_test.rs` — NEW.
- `backend/tests/fixtures/mock-agent-stderr.sh` — NEW (hoặc mở rộng mock-agent.sh từ 3.1 nếu phù hợp).
- `frontend/src/types/run.ts` — NEW.
- `frontend/src/api/runs.ts` — NEW.

**KHÔNG được tạo module mới ngoài danh sách trên** (architecture là single source of truth).

### Library / framework constraints

Story 3.4 KHÔNG thêm crate Rust mới. Tất cả đã có từ Story 3.1/3.2:
- `tokio` (process, io, fs, time) — feature `fs` đã enable.
- `sqlx` (sqlite, runtime-tokio) — JOIN query support có sẵn.
- `axum` (Path extractor multi-arg) — `Path<(String, String, String)>` syntax.
- `serde` / `serde_json` — `Serialize` + `rename_all = "camelCase"` đã apply trên `Run` model.
- `chrono` — datetime serialize.
- `anyhow`, `thiserror`, `tracing` — error/log.

Frontend: chỉ cần TypeScript types — KHÔNG cần thêm dependency (`apiFetch` đã có trong `client.ts`).

### DB schema (no migration needed)

Bảng `runs` đã đủ field từ Story 1.2 migration `1_init.sql`. Story 3.4 chỉ READ + extend write-side cho `log_tail`. KHÔNG migration mới — verify trước:
```sql
-- Existing schema từ Story 1.2 (1_init.sql)
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
```

Nếu schema khác → ESCALATE chat: "Story 3.4 expects `runs` table from Story 1.2 schema; found <diff>. Need migration?".

### Background task ownership model (recap)

| Component | Owner | Lifetime |
|---|---|---|
| `Child` handle | `subprocess_map` (key = task_id) | Until exit detection remove (Story 3.2) hoặc cancel/shutdown kill |
| `ChildStdout` | `tokio::spawn(stream_and_capture)` background task (Story 3.1) | Until stdout EOF |
| `ChildStderr` | `tokio::spawn(stream_stderr_to_log)` background task (Story 3.4 — NEW) | Until stderr EOF |
| Log file (`log_path`) | OS filesystem | Persistent until user delete |

**Important:** stdout task có thể kết thúc TRƯỚC stderr task (hoặc ngược lại) — KHÔNG có sync giữa hai task. Khi cả 2 đều EOF, subprocess đã exit, exit detection của Story 3.2 sẽ:
1. Lock `subprocess_map`, remove child.
2. `child.wait().await` → exit code (đảm bảo child status đã reap).
3. Call `read_log_tail(log_path, 100, 10_240)` — đọc CẢ stdout + stderr lines (interleaved trong file).
4. Call `complete_run(pool, run_id, exit_code, log_tail)`.

Vì stderr task ghi `[stderr] ` prefix, `log_tail` có thể chứa cả 2 loại line — đây là behavior mong muốn (frontend hiển thị raw trong Logs tab).

### Edge cases phải xử lý

**EC-1 — Subprocess không produce stdout/stderr nào:**
- Background tasks open file (empty), EOF ngay → task exit nhanh.
- File vẫn tồn tại (0 byte) — `log_tail` = `""` (empty string) hoặc `Some("")` tùy `read_log_tail` impl. Acceptable.

**EC-2 — Subprocess produce output rất lớn (MB level):**
- File ghi append liên tục — không có cap. Out-of-scope handling (NFR future: log rotation).
- `log_tail` cap 10KB — không phụ thuộc file size.

**EC-3 — User xóa log file thủ công trong khi run đang chạy:**
- `OpenOptions::append` đã giữ FD — write tiếp vẫn ok trên Linux (write tới deleted file). Khi exit detection chạy, `read_log_tail` sẽ fail vì file gone → `log_tail = None`. Acceptable — `runs.log_tail` giữ NULL.
- KHÔNG cần special handling — `read_log_tail` đã `.ok()?` ở step đầu (Story 3.2).

**EC-4 — Permission denied khi tạo log file:**
- `OpenOptions::open` → `Err` → background task log error qua `tracing` và exit early.
- Subprocess KHÔNG bị kill — vẫn chạy, nhưng output bị drop.
- Run row vẫn tồn tại trong DB với `log_path` set nhưng file rỗng — frontend hiển thị "log file not available". Out-of-scope UI handling.

**EC-5 — Race: GET runs/{run_id} ngay khi run vừa start, log_path đã set nhưng file chưa exist:**
- `log_path` trong DB là string — API trả về nguyên giá trị, KHÔNG verify file tồn tại trên disk. Frontend chịu trách nhiệm handle 404 khi download file (Story 3.5b — defer).

**EC-6 — Run thuộc về session đã bị xóa (data inconsistency):**
- Schema có `FOREIGN KEY` → SQLite enforce nếu enable `PRAGMA foreign_keys = ON`. Verify pool setup có set pragma. Nếu chưa → defer (out-of-scope 3.4).
- Defensive: JOIN query trong B.1.2/B.1.3 dùng `INNER JOIN` → orphan run không xuất hiện trong response. Acceptable behavior.

### Subprocess lifecycle invariants (project-context)

- ❌ KHÔNG kill subprocess khi log task fail (project-context §"Critical Don't-Miss Rules").
- ❌ KHÔNG lưu full log vào DB (chỉ tail 100 lines / 10KB).
- ✅ Backend là process owner cho subprocess — log task không ảnh hưởng lifecycle.
- ✅ Log file persistent qua app restart — nằm ngoài project dir (`~/.omni-agent/logs/`).

### API contract stability

Backend response shape phải lock từ AC-5 ngay từ 3.4 — Story 3.5b sẽ render dựa vào contract này. **KHÔNG đổi field name hoặc shape sau khi merge 3.4** trừ khi qua correct-course workflow.

### Testing standards (theo Story 3.1/3.2/3.3)

- **Unit tests** trong `services/runs.rs#[cfg(test)] mod tests` — purely functional, in-memory SQLite.
- **Integration tests** trong `backend/tests/runs_test.rs` — full app via `build_test_app_with_pool`, serial execution với mock binary.
- **Mock binary** trong `backend/tests/fixtures/` — shell scripts ngắn (≤ 20 lines), exit nhanh.
- **No external deps**: KHÔNG gọi Claude/Codex thật trong test (project-context §"KHÔNG").
- **Timing assertion** (AC-10) — chấp nhận threshold rộng cho CI sluggish.

### Project Structure Notes

Alignment hoàn toàn với architecture directory structure (dòng 486–522):
- `services/runs.rs` đã có (3.2) — extend (KHÔNG tạo file mới).
- `handlers/runs.rs` — file mới, đúng pattern `handlers/{tasks,sessions,projects}.rs`.
- Route mount centralized trong `main.rs` — KHÔNG tách `Router::merge` chuyên biệt.
- Frontend `types/run.ts` + `api/runs.ts` — đúng vị trí, đúng pattern.

No detected conflicts.

### References

- Epics: `_bmad-output/planning-artifacts/epics.md`
  - Story 3.4 (dòng 652–679)
  - FR-8 (dòng 36, 137)
  - NFR-3 (dòng 145)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
  - §"Data Architecture" — Log file location (dòng 187–193)
  - §"API Route Structure" — `/runs`, `/runs/{run_id}` (dòng 222–223)
  - §"Architectural Boundaries" — handlers/services split (dòng 524–539)
  - §"Subprocess ownership" — backend là process owner (dòng 390–393)
  - §"Enforcement Guidelines" — `camelCase` JSON, no unwrap (dòng 396–412)
  - §"Project Directory Structure" — `handlers/runs.rs`, `services/runs.rs`, `types/run.ts`, `api/runs.ts` (dòng 486–522)
  - §"Gap 1 — DB Schema" — bảng `runs` với `log_path`, `log_tail` (dòng 657–668)
- Project context: `_bmad-output/project-context.md`
  - §"Critical Don't-Miss Rules" — KHÔNG lưu full log vào DB (dòng 124–134)
  - §"Edge cases phải xử lý" (dòng 135–139)
  - §"Business logic quan trọng" (dòng 141–145)
- Previous stories (READ before implementing):
  - `_bmad-output/implementation-artifacts/3-1-agentstrategy-trait-and-start-session.md` — stdout streaming pattern, `resolve_log_path`, `stream_and_capture`, mock binary harness, subprocess_map model.
  - `_bmad-output/implementation-artifacts/3-2-session-exit-detection-and-graceful-shutdown.md` — `services/runs::complete_run`, `services/runs::read_log_tail`, exit detection ordering, log_tail update flow.
  - `_bmad-output/implementation-artifacts/3-3-resume-session-and-comment-tracking.md` — resume spawn flow (cần stderr capture giống start_session).
- Existing code (READ before editing):
  - `backend/src/models/run.rs` — đã có struct `Run` với 8 field đúng AC-5 — KHÔNG sửa.
  - `backend/src/handlers/mod.rs` — thêm `pub mod runs;`.
  - `backend/src/services/runs.rs` — thêm 2 function read-side, GIỮ NGUYÊN `complete_run` + `read_log_tail`.
  - `backend/src/services/sessions.rs` — refactor spawn flow để take + stream stderr (3.1 + 3.3 spawn paths).
  - `backend/src/main.rs` — thêm 2 route mount.
  - `backend/src/db/migrations/1_init.sql` — verify schema, KHÔNG migration mới.
  - `frontend/src/api/client.ts` — `apiFetch` helper, không sửa.
  - `frontend/src/api/tasks.ts` — pattern reference cho `api/runs.ts`.

### Out-of-scope reminders

| Hạng mục | Story chịu trách nhiệm |
|---|---|
| Live log streaming (SSE / WebSocket) | Post-MVP |
| Frontend Runs / Logs tab UI (RunsTab.tsx, LogsTab.tsx, RunTimeline.tsx) | 3.5b |
| `useRuns` hook + TanStack Query polling cho runs | 3.5b |
| Full log file download endpoint (`GET .../logs/{run_id}`) | Out-of-scope MVP — frontend đọc trực tiếp `log_path` qua filesystem hoặc dùng tail từ DB |
| Log rotation / archival policy | Post-MVP NFR |
| `PATCH /api/.../runs/{run_id}` (manual editing) | Không có yêu cầu |
| Authentication / authorization trên endpoints | Out-of-scope MVP (local single-user app) |

### AC ↔ Task ↔ Test traceability matrix

| AC | Tasks | Tests |
|---|---|---|
| AC-1 stdout+stderr dual capture | A.1, A.2, A.3 | D.3.2 (`writes_both_stdout_and_stderr_to_log_file`) |
| AC-2 log_path absolute + file exists | A.1, A.2 (reuse Story 3.1) | D.3.2 (file existence check) |
| AC-3 log_tail 100 lines / 10KB | (covered by Story 3.2 — verify only) | D.3.3 (`log_tail_includes_stderr_lines`) |
| AC-4 persistence sau restart | D.2 | D.2.1 (`runs_persist_after_pool_reopen`) |
| AC-5 GET single run | B.1.2, C.1, C.2 | B.2.2 (unit), D.1.2 (integration) |
| AC-6 GET list runs DESC | B.1.3, C.1, C.2 | B.2.3 (unit), D.1.6 (integration) |
| AC-7 404 project_not_found | B.1.2 step 2 | B.2.2 (unit), D.1.5 (integration) |
| AC-8 404 task_not_found | B.1.2 step 3 | B.2.2 (unit), D.1.5 (integration) |
| AC-9 404 run_not_found (incl. cross-task) | B.1.2 step 4 | B.2.2 (unit), D.1.4 (integration) |
| AC-10 non-blocking writes | A.2 (async tokio::fs) | D.4 (timing assertion) |
| AC-11 logs dir create recursive | A.2.1 (defensive) + 3.1 reuse | D.3.2 (file existence) |
| AC-12 frontend types + api client | E.1, E.2, E.3 | (typecheck only — pattern theo `api/tasks.ts` không có test runtime) |

---

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `cargo fmt --check`
- `cargo clippy -- -D warnings`
- `cargo test`
- `npm run build`
- `npm test`
- `npm test -- --runInBand` fail vì Vitest không hỗ trợ `--runInBand`; đã chạy lại bằng `npm test`.

### Completion Notes List

- Đã thêm capture song song stdout/stderr cho cả `start_session` và `resume_session`; stderr ghi vào cùng run log với prefix `[stderr] `.
- Đã thêm service, handler và route read-side cho list/get runs API, gồm 404 project/task/run và kiểm tra ownership cross-task.
- Giữ `Run.session_id` cho SQL mapping nhưng không serialize ra JSON, để wire contract chỉ có các field của AC-5.
- Đã thêm unit/integration tests cho runs API contract, sort order, persistence sau reopen DB, stderr log/tail capture và non-blocking session start.
- Đã thêm frontend `Run` type và API client `listRuns` / `getRun`. `frontend/package.json` không có script `typecheck` hoặc `lint`; `npm run build` đã cover TypeScript compilation và `npm test` pass.

### File List

- `_bmad-output/implementation-artifacts/3-4-run-log-dual-storage.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `backend/src/handlers/mod.rs`
- `backend/src/handlers/runs.rs`
- `backend/src/main.rs`
- `backend/src/models/run.rs`
- `backend/src/services/runs.rs`
- `backend/src/services/sessions.rs`
- `backend/src/services/tasks.rs`
- `backend/tests/fixtures/mock-agent-noisy.sh`
- `backend/tests/fixtures/mock-agent-stderr.sh`
- `backend/tests/runs_test.rs`
- `frontend/src/api/runs.ts`
- `frontend/src/types/run.ts`

### Change Log

- 2026-05-26: Implement Story 3.4 run log dual-storage và runs read API; chuyển story sang review.
