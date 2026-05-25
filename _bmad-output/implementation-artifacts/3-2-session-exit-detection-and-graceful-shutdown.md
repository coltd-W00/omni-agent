# Story 3.2: Session Exit Detection & Graceful Shutdown

Status: ready-for-dev

<!-- Validation tùy chọn — chạy validate-create-story trước khi dev-story nếu muốn double-check. -->

**Epic:** 3 — Session Lifecycle & Agent Execution
**Story ID:** 3.2
**Story Key:** 3-2-session-exit-detection-and-graceful-shutdown
**Depends on:** Story 3.1 (AgentStrategy Trait & Start Session) — phải hoàn thành trước; story 3.2 build trên subprocess_map, background streaming task, và session/run DB records mà 3.1 tạo ra.

---

## Story

As a developer using omni-agent,
I want the app to automatically detect when an agent session ends (subprocess exit) and update the task status accordingly, and gracefully flush all running tasks on backend shutdown,
So that task status always reflects reality without me having to manually check, and no running session is lost when the backend stops.

---

## Acceptance Criteria

> **Nguồn gốc AC:** `_bmad-output/planning-artifacts/epics.md` Story 3.2 (dòng 577–611) + `_bmad-output/planning-artifacts/architecture.md` §"Subprocess ownership" / §"Graceful shutdown" + `_bmad-output/project-context.md` §"Subprocess lifecycle" / §"Critical Don't-Miss Rules" / §"Edge cases phải xử lý". Conventions: error envelope `{"error":"<code>","message":"<text>"}`, JSON `camelCase`, task status DB lưu PascalCase serialize wire lowercase.

---

**AC-1 — Exit code 0 → Task `Paused`:**
**Given** một subprocess trong `subprocess_map` đã exit với code `0`
**When** background monitor task detect exit
**Then** task status transition `Running → Paused` (chỉ trong `services/tasks.rs`)
**And** `sessions.status` update từ `"running"` → `"paused"`
**And** `runs.exit_code` set = `0`, `runs.ended_at` = `<now>`
**And** `runs.log_tail` được update với last ~100 lines (≤10KB) từ log file (nếu log file tồn tại)
**And** subprocess handle được remove khỏi `subprocess_map`

---

**AC-2 — Exit code ≠ 0 → Task `Failed`:**
**Given** một subprocess exit với non-zero exit code (ví dụ code `1`)
**When** background monitor task detect exit
**Then** task status transition `Running → Failed` (chỉ trong `services/tasks.rs`)
**And** `sessions.status` update từ `"running"` → `"paused"` (session vẫn resumable — không phải `"closed"`)
**And** `runs.exit_code` = actual exit code
**And** `runs.ended_at` = `<now>`
**And** `runs.log_tail` được update
**And** subprocess handle được remove khỏi `subprocess_map`

---

**AC-3 — Browser close does NOT kill subprocess:**
**Given** browser tab hoặc browser bị đóng
**When** backend tiếp tục chạy
**Then** subprocess KHÔNG bị kill (backend là process owner, không phải browser)
**And** subprocess tiếp tục chạy bình thường cho đến khi tự exit

*Lưu ý:* đây là invariant có sẵn từ architecture — Story 3.2 chỉ xác nhận rằng background monitor task KHÔNG có logic liên quan đến browser connection. Không cần implement gì thêm — chỉ cần đảm bảo không có code nào kill subprocess khi HTTP connection drops.

---

**AC-4 — Cancel button → kill subprocess + Cancelled:**
**Given** user click "Cancel" trên một Running task
**When** `POST /api/projects/{project_id}/tasks/{task_id}/sessions/cancel` được gọi
**Then** subprocess handle trong `subprocess_map` bị kill (`child.start_kill()` hoặc `child.kill().await`)
**And** task status transition `Running → Cancelled` (trong `services/tasks.rs`)
**And** `sessions.status` update → `"closed"` (session KHÔNG resumable sau cancel)
**And** `runs.exit_code` set = `-1` (convention cho force-killed)
**And** `runs.ended_at` = `<now>`
**And** `runs.log_tail` update
**And** subprocess handle remove khỏi `subprocess_map`
**And** response `200 OK` body:
```json
{
  "taskId": "<task_id>",
  "status": "cancelled",
  "message": "Session cancelled and subprocess killed"
}
```

**Given** task KHÔNG ở status `Running`
**When** `POST .../sessions/cancel` được gọi
**Then** return `409 Conflict` với `{"error":"task_not_running","message":"Can only cancel a running task"}`

**Given** task ở `Running` nhưng subprocess handle KHÔNG có trong `subprocess_map` (edge case: subprocess đã exit ngay trước cancel)
**When** `POST .../sessions/cancel` được gọi
**Then** vẫn transition task → `Cancelled` (status update vẫn đúng), log warning rằng subprocess handle not found, response 200 OK bình thường.

---

**AC-5 — Graceful shutdown (SIGINT/SIGTERM):**
**Given** backend process nhận SIGINT (Ctrl+C) hoặc SIGTERM
**When** shutdown handler chạy (`tokio::signal::ctrl_c()` hoặc SIGTERM handler)
**Then** tất cả subprocess handles trong `subprocess_map` được kill (`start_kill()` for each)
**And** tất cả tasks có status `Running` trong DB được flush → `Paused` (UPDATE tasks SET status='Paused', updated_at=<now> WHERE status='Running')
**And** tương ứng: tất cả sessions có status `"running"` → `"paused"`
**And** tất cả runs CHƯA có `ended_at` → set `ended_at = <now>`, `exit_code = -2` (convention cho graceful shutdown kill)
**And** `runs.log_tail` update cho mỗi affected run (best-effort — nếu log file read fail thì skip)
**And** sau khi flush xong → backend process exit cleanly

**Ordering critical:** kill subprocesses TRƯỚC → flush DB → exit. Nếu ngược lại, subprocess có thể ghi thêm vào log sau khi DB đã flush.

**Timeout:** shutdown handler phải complete trong ≤5 giây. Nếu quá → force exit (log error). Dùng `tokio::time::timeout(Duration::from_secs(5), shutdown_logic).await`.

---

## Tasks / Subtasks

### A. Backend: Background subprocess monitor

- [ ] **Task A.1 — Refactor background streaming task (từ Story 3.1) thành exit-aware monitor** (AC: 1, 2)
  - [ ] A.1.1 Trong Story 3.1, background task chỉ stream stdout vào log file. Story 3.2 extends: sau khi subprocess exit (stdout EOF hoặc `child.wait()` returns), detect exit code và update DB.
  - [ ] A.1.2 Implementation pattern:
    ```rust
    // Trong background tokio::spawn (đã có từ Story 3.1)
    // Sau khi stdout BufReader loop kết thúc (EOF):
    let status = child_handle.wait().await; // hoặc try_wait() nếu đã exit
    let exit_code = status.map(|s| s.code().unwrap_or(-1)).unwrap_or(-1);

    // Remove from subprocess_map
    state.subprocess_map.lock().await.remove(&task_id);

    // Update DB: run → set exit_code + ended_at + log_tail
    let log_tail = read_log_tail(&log_path, 100, 10_240).await;
    services::runs::complete_run(&state.db, &run_id, exit_code, log_tail.as_deref()).await;

    // Update session status → "paused"
    services::sessions::mark_session_paused(&state.db, &session_pk).await;

    // Update task status based on exit code
    if exit_code == 0 {
        services::tasks::transition_to_paused(&state.db, &task_id).await;
    } else {
        services::tasks::transition_to_failed(&state.db, &task_id).await;
    }
    ```
  - [ ] A.1.3 **Quan trọng:** background task cần giữ reference đến `child` handle (ownership) để gọi `.wait()`. Trong Story 3.1, child handle đã được insert vào `subprocess_map`. Implementation options:
    - **Option A (recommended):** Background task own `Child` handle trực tiếp (KHÔNG insert vào `subprocess_map` cho stdout/wait lifecycle). Thay vào đó, background task register một `AbortHandle` hoặc `tokio::sync::oneshot::Sender` vào map để cancel/cancel handler có thể signal kill.
    - **Option B:** Background task clone `Arc<Mutex<HashMap>>` reference, periodically `try_wait()` trên child handle bên trong map. Phức tạp hơn.
    - **Option C (simplest, recommended):** Giữ `Child` trong `subprocess_map` như Story 3.1 đã làm. Background task KHÔNG own child. Thay vào đó, background task chỉ stream stdout (via piped stdout handle, đã taken trước khi insert child). Khi stdout EOF → background task lock map, remove child, gọi `.wait()` trên child handle để lấy exit code. Đây là pattern phù hợp nhất với Story 3.1 design.
  - [ ] A.1.4 **Chọn Option C**: stdout pipe handle được `.take()` trước khi child insert vào map (Story 3.1 AC-2 step 6 đã take stdout). Background task giữ `ChildStdout` (owned). Khi EOF:
    1. Lock `subprocess_map`, remove entry bằng `task_id` key → nhận lại `Child`.
    2. `child.wait().await` → `ExitStatus`.
    3. Extract `exit_code`.
    4. Update DB.
  - [ ] A.1.5 **Edge case:** subprocess bị kill từ cancel handler (AC-4) TRƯỚC khi background task detect EOF. Khi background task lock map, entry đã bị remove. Handle: nếu `.remove()` returns `None` → subprocess đã bị kill bởi cancel/shutdown. Background task vẫn cần update log_tail nếu log file exists. Nhưng KHÔNG update task/session/run status (cancel handler đã làm). Guard: check current task status trước khi update — nếu đã `Cancelled` → skip.

- [ ] **Task A.2 — Helper `read_log_tail`** (AC: 1, 2, 4, 5)
  - [ ] A.2.1 Tạo utility function:
    ```rust
    /// Read last `max_lines` lines from log file, capped at `max_bytes`.
    pub async fn read_log_tail(
        log_path: &Path,
        max_lines: usize,  // 100
        max_bytes: usize,   // 10_240 (10KB)
    ) -> Option<String> {
        let content = tokio::fs::read_to_string(log_path).await.ok()?;
        let lines: Vec<&str> = content.lines().collect();
        let tail_lines = &lines[lines.len().saturating_sub(max_lines)..];
        let tail = tail_lines.join("\n");
        if tail.len() > max_bytes {
            Some(tail[tail.len() - max_bytes..].to_string())
        } else {
            Some(tail)
        }
    }
    ```
  - [ ] A.2.2 Đặt file: `backend/src/services/runs.rs` (hoặc utility module nếu cần share).

### B. Backend: Cancel endpoint

- [ ] **Task B.1 — Tạo `backend/src/handlers/sessions.rs`** (AC: 4)
  - [ ] B.1.1 Nếu Story 3.1 đã tạo file này (cho `start_session`), thêm handler `cancel_session`. Nếu chưa tồn tại, tạo mới.
  - [ ] B.1.2 Handler `cancel_session`:
    ```rust
    pub async fn cancel_session(
        State(state): State<Arc<AppState>>,
        Path((project_id, task_id)): Path<(String, String)>,
    ) -> Result<impl IntoResponse, AppError> {
        let result = services::sessions::cancel_session(&state, &project_id, &task_id).await?;
        Ok(Json(result))
    }
    ```

- [ ] **Task B.2 — Service logic `services/sessions.rs::cancel_session`** (AC: 4)
  - [ ] B.2.1 Verify task exists và status = `Running`. Nếu không → 409.
  - [ ] B.2.2 Lock `subprocess_map`, remove child handle. Nếu child found → `child.start_kill()`. Nếu not found → log warning, proceed anyway.
  - [ ] B.2.3 Update task → `Cancelled` via `services::tasks::transition_to_cancelled`.
  - [ ] B.2.4 Update session → `"closed"`.
  - [ ] B.2.5 Update run → `exit_code = -1`, `ended_at = now`, `log_tail`.
  - [ ] B.2.6 Return JSON response.

- [ ] **Task B.3 — Task status transition functions** (AC: 1, 2, 4)
  - [ ] B.3.1 Thêm vào `services/tasks.rs`:
    ```rust
    pub async fn transition_to_paused(pool: &SqlitePool, task_id: &str) -> Result<(), AppError> {
        let now = chrono::Utc::now().to_rfc3339();
        let rows = sqlx::query(
            "UPDATE tasks SET status = 'Paused', updated_at = ? WHERE id = ? AND status = 'Running'"
        )
        .bind(&now)
        .bind(task_id)
        .execute(pool)
        .await?
        .rows_affected();
        if rows == 0 {
            tracing::warn!(task_id, "transition_to_paused: task not in Running state, skipping");
        }
        Ok(())
    }

    pub async fn transition_to_failed(pool: &SqlitePool, task_id: &str) -> Result<(), AppError> {
        let now = chrono::Utc::now().to_rfc3339();
        let rows = sqlx::query(
            "UPDATE tasks SET status = 'Failed', updated_at = ? WHERE id = ? AND status = 'Running'"
        )
        .bind(&now)
        .bind(task_id)
        .execute(pool)
        .await?
        .rows_affected();
        if rows == 0 {
            tracing::warn!(task_id, "transition_to_failed: task not in Running state, skipping");
        }
        Ok(())
    }

    pub async fn transition_to_cancelled(pool: &SqlitePool, task_id: &str) -> Result<(), AppError> {
        let now = chrono::Utc::now().to_rfc3339();
        let rows = sqlx::query(
            "UPDATE tasks SET status = 'Cancelled', updated_at = ? WHERE id = ? AND status = 'Running'"
        )
        .bind(&now)
        .bind(task_id)
        .execute(pool)
        .await?
        .rows_affected();
        if rows == 0 {
            return Err(AppError::Conflict {
                code: "task_not_running",
                message: "Can only cancel a running task".to_string(),
            });
        }
        Ok(())
    }
    ```
  - [ ] B.3.2 Pattern: dùng `rows_affected()` check — nếu 0 nghĩa là task KHÔNG ở Running, transition invalid. Cho `transition_to_paused`/`transition_to_failed` → chỉ warn (background monitor có thể race với cancel). Cho `transition_to_cancelled` → return error (user-facing action).

- [ ] **Task B.4 — Session/Run update helpers** (AC: 1, 2, 4, 5)
  - [ ] B.4.1 `services/sessions.rs`:
    ```rust
    pub async fn mark_session_paused(pool: &SqlitePool, session_pk: &str) -> Result<(), AppError> {
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query("UPDATE sessions SET status = 'paused', last_active = ? WHERE id = ? AND status = 'running'")
            .bind(&now).bind(session_pk).execute(pool).await?;
        Ok(())
    }

    pub async fn mark_session_closed(pool: &SqlitePool, session_pk: &str) -> Result<(), AppError> {
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query("UPDATE sessions SET status = 'closed', last_active = ? WHERE id = ? AND status = 'running'")
            .bind(&now).bind(session_pk).execute(pool).await?;
        Ok(())
    }
    ```
  - [ ] B.4.2 `services/runs.rs`:
    ```rust
    pub async fn complete_run(
        pool: &SqlitePool,
        run_id: &str,
        exit_code: i32,
        log_tail: Option<&str>,
    ) -> Result<(), AppError> {
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query(
            "UPDATE runs SET exit_code = ?, ended_at = ?, log_tail = ? WHERE id = ? AND ended_at IS NULL"
        )
        .bind(exit_code)
        .bind(&now)
        .bind(log_tail)
        .bind(run_id)
        .execute(pool)
        .await?;
        Ok(())
    }
    ```

### C. Backend: Graceful shutdown handler

- [ ] **Task C.1 — Implement shutdown handler trong `main.rs`** (AC: 5)
  - [ ] C.1.1 Thay thế `axum::serve(listener, app).await?;` bằng:
    ```rust
    let state_for_shutdown = state.clone(); // Arc<AppState>
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal(state_for_shutdown))
        .await?;
    ```
  - [ ] C.1.2 Implement `shutdown_signal`:
    ```rust
    async fn shutdown_signal(state: Arc<AppState>) {
        // Wait for ctrl+c or SIGTERM
        let ctrl_c = tokio::signal::ctrl_c();
        #[cfg(unix)]
        let sigterm = async {
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                .expect("failed to install SIGTERM handler")
                .recv()
                .await;
        };
        #[cfg(not(unix))]
        let sigterm = std::future::pending::<()>();

        tokio::select! {
            _ = ctrl_c => { tracing::info!("Received SIGINT (Ctrl+C)"); }
            _ = sigterm => { tracing::info!("Received SIGTERM"); }
        }

        // Graceful flush with timeout
        let flush_result = tokio::time::timeout(
            std::time::Duration::from_secs(5),
            flush_running_tasks(state),
        ).await;

        match flush_result {
            Ok(Ok(())) => tracing::info!("Graceful shutdown: all tasks flushed"),
            Ok(Err(e)) => tracing::error!("Graceful shutdown flush error: {}", e),
            Err(_) => tracing::error!("Graceful shutdown: flush timed out after 5s, forcing exit"),
        }
    }
    ```
  - [ ] C.1.3 Implement `flush_running_tasks`:
    ```rust
    async fn flush_running_tasks(state: Arc<AppState>) -> Result<(), anyhow::Error> {
        // Step 1: Kill all subprocesses
        let mut map = state.subprocess_map.lock().await;
        let task_ids: Vec<String> = map.keys().cloned().collect();
        for (task_id, mut child) in map.drain() {
            tracing::info!(task_id, "Shutdown: killing subprocess");
            let _ = child.start_kill();
        }
        drop(map);

        // Step 2: Flush DB — all Running → Paused
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query("UPDATE tasks SET status = 'Paused', updated_at = ? WHERE status = 'Running'")
            .bind(&now)
            .execute(&state.db)
            .await?;

        // Step 3: Flush sessions running → paused
        sqlx::query("UPDATE sessions SET status = 'paused', last_active = ? WHERE status = 'running'")
            .bind(&now)
            .execute(&state.db)
            .await?;

        // Step 4: Flush open runs → set ended_at, exit_code = -2
        sqlx::query("UPDATE runs SET exit_code = -2, ended_at = ? WHERE ended_at IS NULL")
            .bind(&now)
            .execute(&state.db)
            .await?;

        // Step 5: Best-effort log_tail update for affected runs
        // Query runs that just got flushed and have log_path
        let flushed_runs: Vec<(String, String)> = sqlx::query_as(
            "SELECT id, log_path FROM runs WHERE exit_code = -2 AND log_path IS NOT NULL"
        )
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

        for (run_id, log_path) in &flushed_runs {
            let path = std::path::Path::new(log_path);
            if let Some(tail) = services::runs::read_log_tail(path, 100, 10_240).await {
                let _ = sqlx::query("UPDATE runs SET log_tail = ? WHERE id = ?")
                    .bind(&tail)
                    .bind(run_id)
                    .execute(&state.db)
                    .await;
            }
        }

        tracing::info!(flushed_count = task_ids.len(), "All running tasks flushed to Paused");
        Ok(())
    }
    ```
  - [ ] C.1.4 **Note:** `state` phải là `Arc<AppState>` (đã là vậy trong `main.rs` hiện tại). Clone Arc trước khi pass vào shutdown signal.

- [ ] **Task C.2 — Route mount cho cancel endpoint** (AC: 4)
  - [ ] C.2.1 Thêm vào `api_router` trong `main.rs`:
    ```rust
    .route(
        "/projects/{project_id}/tasks/{task_id}/sessions/cancel",
        axum::routing::post(handlers::sessions::cancel_session),
    )
    ```
  - [ ] C.2.2 KHÔNG xóa hoặc đổi route khác.

### D. Backend: Models & exports

- [ ] **Task D.1 — Đảm bảo models/session.rs và models/run.rs tồn tại** (AC: 1, 2, 4, 5)
  - [ ] D.1.1 Story 3.1 nên đã tạo. Nếu chưa, cần tạo `Session` và `Run` struct phù hợp với DB schema.
  - [ ] D.1.2 Verify `Session` có field `status: String` (values: "none", "running", "paused", "closed").
  - [ ] D.1.3 Verify `Run` có field `exit_code: Option<i32>`, `ended_at: Option<String>`, `log_tail: Option<String>`, `log_path: Option<String>`.

- [ ] **Task D.2 — Export modules** (AC: all)
  - [ ] D.2.1 `handlers/mod.rs` phải export `pub mod sessions;`
  - [ ] D.2.2 `services/mod.rs` phải export `pub mod sessions;` và `pub mod runs;`
  - [ ] D.2.3 `models/mod.rs` phải export `pub mod session;` và `pub mod run;`

### E. Integration Tests

- [ ] **Task E.1 — Test: subprocess exit code 0 → Paused** (AC: 1)
  - [ ] E.1.1 Dùng mock-agent.sh (từ Story 3.1) với `MOCK_AGENT_SLEEP_SECS=1` (exit nhanh, code 0).
  - [ ] E.1.2 Start session → wait 2s → verify task status = `"paused"`, session.status = `"paused"`, run.exit_code = 0, run.ended_at not null.

- [ ] **Task E.2 — Test: subprocess exit code ≠ 0 → Failed** (AC: 2)
  - [ ] E.2.1 Tạo mock script variant exit code 1: `mock-agent-fail.sh` → `exit 1` after printing session ID.
  - [ ] E.2.2 Start session → wait 2s → verify task status = `"failed"`, run.exit_code = 1.

- [ ] **Task E.3 — Test: cancel endpoint** (AC: 4)
  - [ ] E.3.1 Start session (mock sleeps 60s) → POST cancel → verify 200, task = `"cancelled"`, session = `"closed"`, run.exit_code = -1.
  - [ ] E.3.2 Test cancel on non-Running task → 409.

- [ ] **Task E.4 — Test: graceful shutdown** (AC: 5)
  - [ ] E.4.1 Khó test end-to-end (cần kill process). Approach: unit test `flush_running_tasks` trực tiếp — setup state với fake subprocess entries, gọi flush, verify DB state.
  - [ ] E.4.2 Hoặc: integration test spawn server process, send SIGINT, wait exit, verify DB has Paused tasks.

- [ ] **Task E.5 — Test: race condition cancel vs background monitor** (AC: 4, 1)
  - [ ] E.5.1 Mock agent exit code 0 with sleep 0 (exit immediately). Simultaneously POST cancel. Verify task ends up in either `Paused` or `Cancelled` (both acceptable), no crash, no panic.

---

## Dev Notes

### Architecture & patterns phải tuân theo

- **Task status machine** chỉ trong `services/tasks.rs` — không handler nào update task.status trực tiếp.
- **Subprocess ownership:** `AppState.subprocess_map: Arc<Mutex<HashMap<TaskId, Child>>>` — single source of truth. Shutdown handler là nơi DUY NHẤT iterate + kill all. Cancel handler kill 1.
- **Error handling:** `thiserror` cho AppError, `anyhow` cho application-level. Production code KHÔNG dùng `unwrap()`/`expect()`.
- **JSON conventions:** `camelCase` (serde `rename_all = "camelCase"`). Error envelope: `{"error":"<code>","message":"<text>"}`.
- **DB:** SQLite via `sqlx::SqlitePool`. Status column lưu PascalCase ("Running", "Paused", "Failed", "Cancelled").
- **Subprocess kill cases (hard rule):** ONLY 3 cases: (1) user Cancel, (2) backend shutdown, (3) timeout policy (chưa defined). KHÔNG kill khi browser đóng.

### Background monitor design (critical)

Story 3.1 tạo background task stream stdout → log file. Story 3.2 extend task này:

```
┌─ Background Task (per session) ─────────────────────────┐
│                                                          │
│  1. Stream stdout → log file (Story 3.1)                │
│  2. Parse session_id từ chunks (Story 3.1)              │
│  3. Khi stdout EOF:                                      │
│     a. Lock subprocess_map, remove child                 │
│     b. child.wait() → ExitStatus                         │
│     c. Read log_tail (last 100 lines / 10KB)            │
│     d. Update runs (exit_code, ended_at, log_tail)      │
│     e. Update sessions.status → "paused"                │
│     f. Update tasks.status → Paused (code=0) / Failed   │
│                                                          │
│  Race guard: nếu remove() returns None → subprocess     │
│  đã bị kill bởi cancel/shutdown → check task status:    │
│  - Cancelled → skip all DB updates                       │
│  - Paused (from shutdown) → skip all DB updates         │
│  - Still Running (timing edge) → proceed with updates   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Exit code conventions

| exit_code | Meaning | Source |
|-----------|---------|--------|
| 0 | Normal exit (agent finished) | subprocess natural exit |
| 1+ | Error exit (agent crashed/failed) | subprocess natural exit |
| -1 | Force-killed by user Cancel | cancel handler |
| -2 | Killed by graceful shutdown | shutdown handler |
| NULL | Still running (run not ended) | initial state |

### Cancel endpoint state machine

```
POST /api/projects/{pid}/tasks/{tid}/sessions/cancel

Preconditions:
- Task exists in project
- Task status = "Running"

Actions:
1. Lock subprocess_map
2. Remove child handle (if present)
3. Kill child (if present)
4. transition_to_cancelled (Running → Cancelled)
5. mark_session_closed
6. complete_run (exit_code=-1)

Error cases:
- Task not found → 404
- Task not Running → 409 "task_not_running"
```

### Graceful shutdown sequence

```
Signal (SIGINT/SIGTERM)
  │
  ▼
1. Kill ALL children in subprocess_map
  │
  ▼
2. UPDATE tasks SET status='Paused' WHERE status='Running'
  │
  ▼
3. UPDATE sessions SET status='paused' WHERE status='running'
  │
  ▼
4. UPDATE runs SET exit_code=-2, ended_at=now WHERE ended_at IS NULL
  │
  ▼
5. Best-effort: read + store log_tail for each flushed run
  │
  ▼
6. Exit process

Timeout: 5 seconds total. If exceeded → force exit.
```

### File locations (UPDATE vs NEW)

| File | Action | Notes |
|------|--------|-------|
| `backend/src/main.rs` | UPDATE | Add shutdown handler, mount cancel route |
| `backend/src/services/tasks.rs` | UPDATE | Add `transition_to_paused`, `transition_to_failed`, `transition_to_cancelled` |
| `backend/src/services/sessions.rs` | UPDATE (from 3.1) | Add `cancel_session`, `mark_session_paused`, `mark_session_closed` |
| `backend/src/services/runs.rs` | NEW | `complete_run`, `read_log_tail` |
| `backend/src/services/mod.rs` | UPDATE | Add `pub mod runs;` |
| `backend/src/handlers/sessions.rs` | UPDATE (from 3.1) | Add `cancel_session` handler |
| `backend/tests/sessions_test.rs` | UPDATE (from 3.1) | Add exit detection + cancel tests |
| `backend/tests/fixtures/mock-agent-fail.sh` | NEW | Mock that exits with code 1 |

### Previous Story Intelligence (Story 3.1)

Từ Story 3.1 file, các patterns quan trọng cho 3.2:
- `subprocess_map` key = `task_id` (String), value = `Child`
- Background task đã take `child.stdout` trước khi insert child vào map → child trong map KHÔNG có stdout (đã taken)
- `services/tasks.rs` dùng pattern `BEGIN IMMEDIATE` cho write transactions + `rows_affected()` check
- Session PK = UUID nội bộ (khác CLI session_id)
- Run ID = UUID
- Log path pattern: `~/.omni-agent/logs/{task_id}/{run_id}.log`
- Mock binary dùng shell script `backend/tests/fixtures/mock-agent.sh`
- Integration test setup: `build_test_app_with_pool` + serial test execution (env var isolation)
- `kill_on_drop(true)` trên Command → safety net

### Dependencies (check Cargo.toml)

Story 3.2 KHÔNG cần thêm crate mới. Tất cả đã available từ Story 3.1:
- `tokio` (signal, process, time, fs)
- `sqlx` (sqlite, runtime-tokio)
- `chrono`
- `tracing`
- `serde_json`
- `anyhow`, `thiserror`

Verify: `tokio` features include `signal` (cần cho `ctrl_c()` và `unix::signal`). Nếu chưa có, thêm feature `signal` vào `tokio` dependency trong Cargo.toml.

### Testing strategy

- Unit tests: `transition_to_paused`, `transition_to_failed`, `transition_to_cancelled`, `read_log_tail` — test trực tiếp, không cần subprocess.
- Integration tests: dùng mock script (exit nhanh code 0/1), serial execution.
- Shutdown test: unit test `flush_running_tasks` với in-memory DB + empty subprocess_map (subprocess handles đã drained manually).
- Race condition tests: best-effort — test cancel immediately after start, verify no panic.

### Project Structure Notes

- Alignment: hoàn toàn khớp architecture directory structure — không tạo module mới ngoài `services/runs.rs`.
- `services/runs.rs` là file MỚI — pattern theo `services/tasks.rs` (function-based, nhận `&SqlitePool`, trả `Result<T, AppError>`).
- Shutdown handler nằm trong `main.rs` (cùng scope với server setup) — không tách module riêng (simplicity first).

### References

- Epics: `_bmad-output/planning-artifacts/epics.md` §"Epic 3" Story 3.2 (dòng 577–611)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
  - §"Subprocess ownership" (dòng 539)
  - §"Graceful shutdown" (dòng 392)
  - §"Architectural Boundaries" (dòng 524–539)
  - §"Gap 1 — DB Schema" (sessions + runs table definitions)
- Project context: `_bmad-output/project-context.md`
  - §"Subprocess lifecycle" — kill chỉ 3 cases
  - §"Critical Don't-Miss Rules" — backend shutdown flush Running→Paused
  - §"Edge cases phải xử lý" — backend shutdown bất ngờ
  - §"Business logic quan trọng" — exit code 0 → Paused, ≠ 0 → Failed
- Previous story: `_bmad-output/implementation-artifacts/3-1-agentstrategy-trait-and-start-session.md`
  - Background task design, subprocess_map pattern, mock binary, test patterns
  - §"Out-of-scope reminders" → Story 3.2 owns: exit detection, graceful shutdown, Cancel button
- Existing code (READ before editing):
  - `backend/src/main.rs` — current server setup (no shutdown handler yet)
  - `backend/src/state.rs` — `AppState.subprocess_map` definition
  - `backend/src/services/tasks.rs` — status transition patterns, BEGIN IMMEDIATE
  - `backend/src/services/sessions.rs` (from 3.1) — session lifecycle
  - `backend/tests/fixtures/mock-agent.sh` (from 3.1) — mock pattern

---

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
