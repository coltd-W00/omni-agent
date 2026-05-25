# Story 3.3: Resume Session & Comment Tracking

Status: ready-for-dev

<!-- Validation tùy chọn — chạy validate-create-story trước khi dev-story nếu muốn double-check. -->

**Epic:** 3 — Session Lifecycle & Agent Execution
**Story ID:** 3.3
**Story Key:** 3-3-resume-session-and-comment-tracking
**Depends on:**
- Story 3.1 (AgentStrategy Trait & Start Session) — phải hoàn thành trước; story 3.3 reuse `AgentStrategy::resume_command`, `subprocess_map`, factory `strategy_for`, background streaming task (stdout → log file + `parse_session_id_chunk`), DB row patterns cho `sessions` / `runs`, và mock binary harness.
- Story 3.2 (Session Exit Detection & Graceful Shutdown) — phải hoàn thành trước; story 3.3 reuse helper `services/runs::complete_run` / `read_log_tail`, helper `services/sessions::mark_session_paused` / `mark_session_closed`, route mount pattern trong `main.rs`, và transition functions trong `services/tasks` (đặc biệt `transition_to_paused` / `transition_to_failed`).

---

## Story

As a developer using omni-agent,
I want to resume một agent session đang ở status `Paused` hoặc `Failed` với một comment optional, và quản lý lifecycle "sent" của comment để không gửi trùng,
So that agent tiếp tục từ đúng session cũ (cùng CLI `session_id`), nhận đúng comment mới làm input cho run kế tiếp, và comment đã gửi không bị resent lần resume sau.

---

## Acceptance Criteria

> **Nguồn gốc AC:** `_bmad-output/planning-artifacts/epics.md` Story 3.3 (dòng 612–650) + `_bmad-output/planning-artifacts/architecture.md` §"API & Communication Patterns" / §"Architectural Boundaries" / §"Gap 1 — DB Schema" + `_bmad-output/project-context.md` §"Critical Don't-Miss Rules" / §"Business logic quan trọng" / §"Development Workflow Rules". Backend conventions: error envelope `{ "error": "<code>", "message": "<text>" }`, JSON `camelCase` (serde `rename_all = "camelCase"`), task status DB lưu PascalCase (`"Paused"`, `"Failed"`, `"Running"`) serialize wire lowercase. Comment lưu nguyên văn UTF-8 (không trim text bên ngoài kiểm tra "empty").

---

**AC-1 — `POST /api/projects/{project_id}/tasks/{task_id}/sessions/resume` happy path với comment (Claude):**

**Given** một task `OMNI-001` ở status `Paused` với `agent = "claude"`
**And** session row của task đó có `session_id = "cli-sess-uuid-aaa"` (đã capture từ Story 3.1) và `status = "paused"`
**And** binary `claude` resolved (production PATH hoặc env override `OMNI_AGENT_CLAUDE_BIN` cho test — theo pattern Story 3.1)
**When** client gửi `POST /api/projects/OMNI/tasks/OMNI-001/sessions/resume` với body `{"comment":"Check edge case email khi unverified"}`
**Then** backend thực hiện theo đúng thứ tự:
1. INSERT row mới vào `comments`: `id = <uuid>`, `task_id = "OMNI-001"`, `content = "Check edge case email khi unverified"`, `sent = 1`, `created_at = <now>`. (Resume tự tạo comment record + đánh dấu sent trong cùng transaction — không cần client gọi `POST .../comments` trước.)
2. Build resume command qua `strategy.resume_command(session_id = "cli-sess-uuid-aaa", comment = Some("Check edge case email khi unverified"))` → `claude --continue --session-id cli-sess-uuid-aaa` với comment làm stdin.
3. Spawn subprocess non-blocking qua `tokio::process::Command::spawn` (KHÔNG dùng blocking std).
4. INSERT row mới vào `runs`: `id = <uuid>`, `session_id = <session.id pk>`, `run_number = MAX(run_number) + 1` (computed atomically trong cùng tx — xem AC-9), `input = "Check edge case email khi unverified"`, `exit_code = NULL`, `log_path = "~/.omni-agent/logs/OMNI-001/<run.id>.log"` (resolve tuyệt đối), `log_tail = NULL`, `started_at = <now>`, `ended_at = NULL`.
5. UPDATE `sessions SET status = 'running', last_active = <now> WHERE id = <session_pk>`.
6. UPDATE `tasks SET status = 'Running', updated_at = <now> WHERE id = 'OMNI-001' AND status IN ('Paused','Failed')` — gọi qua `services::tasks::transition_to_running_in_tx` (function mới — không reuse `transition_to_running` của Story 3.1 vì cần chấp nhận cả `Paused` lẫn `Failed`, và phải chạy inside cùng tx với insert comment/run/session update; xem Task B.2).
7. Register `Child` handle vào `AppState.subprocess_map` với key `task_id` (`"OMNI-001"`). Pattern giống Story 3.1: trước khi insert, `.take()` `Child::stdout` để background task own stream; child trong map KHÔNG còn stdout.
8. Spawn background tokio task để stream stdout vào log file (append) — reuse helper từ Story 3.1 (`services::sessions::stream_subprocess_stdout` hoặc tương đương). Background task này KHÔNG cần parse session ID (đã có sẵn), chỉ stream + signal exit cho Story 3.2 monitor.
9. Background exit monitor (Story 3.2 logic) tự động take over từ đây — không cần story 3.3 spawn thêm monitor mới.
10. Comment text được pipe vào subprocess **stdin** sau spawn (xem AC-3 cho contract chính xác per agent).
11. Response **`200 OK`** với body:
```json
{
  "sessionPk": "<uuid của session row>",
  "taskId": "OMNI-001",
  "sessionId": "cli-sess-uuid-aaa",
  "status": "running",
  "runId": "<uuid của run row mới>",
  "runNumber": 2,
  "commentId": "<uuid của comment row mới>",
  "commentSent": true,
  "startedAt": "<iso8601>"
}
```
- `commentSent: true` vì AC-1 luôn có comment. Trường hợp resume không có comment xem AC-2 (`commentId: null`, `commentSent: null`).
- `runNumber` là `MAX(run_number) + 1` đối với session đó — Story 3.1 đã insert run #1 lúc start.

**Side effects được verify:**
- Subprocess `claude` đang chạy, stdout đang được stream vào `log_path`.
- DB có đầy đủ 4 mutations atomic (comment + run + session + task) — nếu spawn fail thì toàn bộ DB rollback (xem AC-10).

---

**AC-2 — Resume KHÔNG có comment → `Run.input = "retry"`:**

**Given** task `OMNI-001` ở status `Paused` (hoặc `Failed`), session đã có `session_id` từ Story 3.1
**When** client gửi `POST .../sessions/resume` với body rỗng `{}` HOẶC body có `"comment"` là `null` HOẶC body không có field `comment`
**Then** backend KHÔNG insert comment row mới (bảng `comments` không có row mới cho call này).
**And** insert `runs` row với `input = "retry"` (literal string — KHÔNG `NULL`, KHÔNG empty string `""`).
**And** spawn command vẫn được build qua `strategy.resume_command(session_id, None)` — agent CLI nhận resume command không stdin (xem AC-3 per agent contract).
**And** response body có `commentId: null`, `commentSent: null` (JSON null cho cả 2), `runNumber` tăng đúng, `runInput: "retry"`:
```json
{
  "sessionPk": "<uuid>",
  "taskId": "OMNI-001",
  "sessionId": "cli-sess-uuid-aaa",
  "status": "running",
  "runId": "<uuid>",
  "runNumber": 3,
  "runInput": "retry",
  "commentId": null,
  "commentSent": null,
  "startedAt": "<iso8601>"
}
```

**Edge: body có `"comment": ""`:**
**Then** treat như có comment empty → return `400 Bad Request` với envelope `{"error":"empty_comment","message":"Comment cannot be empty"}` (theo AC-6 — comment empty không bao giờ được lưu hoặc gửi, dù qua route nào).

**Edge: body có `"comment": "   "` (chỉ whitespace):**
**Then** sau `.trim()` thành rỗng → cũng return `400 empty_comment`. Validation: `comment.as_ref().map(|c| c.trim().is_empty()).unwrap_or(false)` — nếu provided AND trim empty → reject.

**Lưu ý:** nếu `comment` field absent (không có trong body) thì KHÔNG validate empty — đó là valid "no comment" case (= "retry").

---

**AC-3 — Per-agent resume command qua `AgentStrategy::resume_command`:**

**Given** module `agent/` đã có `AgentStrategy` trait từ Story 3.1 với method `resume_command(&self, session_id: &str, comment: Option<&str>) -> tokio::process::Command`
**When** Story 3.3 wire actual usage trong `services::sessions::resume_session`
**Then** `ClaudeStrategy::resume_command("cli-sess-uuid", Some("hello"))` phải build `Command`:
- Program: `claude` (hoặc env override `OMNI_AGENT_CLAUDE_BIN`).
- Args: `["--continue", "--session-id", "cli-sess-uuid"]`.
- `.stdin(Stdio::piped())` — caller (services/sessions) ghi `"hello"` + newline vào stdin sau spawn rồi close stdin.
- `.stdout(Stdio::piped())`, `.stderr(Stdio::piped())` (hoặc merge stderr→stdout — chọn pattern Story 3.1 đã dùng).
- `.kill_on_drop(true)`.
- `.current_dir(<task.cwd or backend cwd>)` — same convention Story 3.1.

**And** `ClaudeStrategy::resume_command("cli-sess-uuid", None)` build command identical NHƯNG `.stdin(Stdio::null())` (no stdin pipe) — caller skip write stdin step.

**And** `CodexStrategy::resume_command("cli-sess-uuid", Some("hello"))` build:
- Program: `codex` (hoặc env override `OMNI_AGENT_CODEX_BIN`).
- Args: `["resume", "cli-sess-uuid"]`.
- `.stdin(Stdio::piped())`. Caller pipe comment text + newline + close stdin.
- Stdio/cwd/kill_on_drop giống Claude.

**And** `CodexStrategy::resume_command("cli-sess-uuid", None)` → tương tự Claude `None` case (`.stdin(Stdio::null())`).

**Implementation contract trong `services::sessions::resume_session` (sau spawn):**
```rust
let mut cmd = strategy.resume_command(&session_id, comment.as_deref());
let mut child = cmd.spawn().map_err(|e| match e.kind() {
    std::io::ErrorKind::NotFound => AppError::BadRequest {
        code: "agent_not_found",
        message: "Agent binary not found on PATH".to_string(),
    },
    _ => AppError::Internal(anyhow::anyhow!("Failed to spawn agent: {}", e)),
})?;

// Pipe comment vào stdin nếu có
if let Some(text) = comment.as_deref() {
    if let Some(mut stdin) = child.stdin.take() {
        use tokio::io::AsyncWriteExt;
        // Best-effort: nếu write fail thì log warn nhưng KHÔNG fail toàn bộ resume — subprocess đã spawn, comment record vẫn marked sent.
        if let Err(e) = stdin.write_all(text.as_bytes()).await {
            tracing::warn!(error = %e, "failed to write comment to agent stdin");
        }
        if let Err(e) = stdin.write_all(b"\n").await {
            tracing::warn!(error = %e, "failed to write newline to agent stdin");
        }
        // Drop stdin → close stdin pipe (signal EOF cho agent).
    }
}

// Take stdout TRƯỚC khi insert child vào subprocess_map (pattern Story 3.1).
let stdout = child.stdout.take()
    .ok_or_else(|| AppError::Internal(anyhow::anyhow!("subprocess stdout missing")))?;
```

**Hard rule:** `match agent { "claude" => ... }` ONLY tồn tại trong `agent/mod.rs::strategy_for`. `services::sessions::resume_session` chỉ gọi qua trait — KHÔNG có branching theo `agent` string.

---

**AC-4 — Resume khi task `Running` → `409 Conflict`:**

**Given** task `OMNI-001` đang ở status `Running` (subprocess vẫn alive trong `subprocess_map`)
**When** client gửi `POST .../sessions/resume` với bất kỳ body nào
**Then** backend KHÔNG spawn subprocess mới, KHÔNG insert run mới, KHÔNG insert comment mới, KHÔNG đổi DB state.
**And** response `409 Conflict` với body:
```json
{
  "error": "session_already_active",
  "message": "Cannot resume a running session. Cancel it first or wait for it to pause."
}
```

**Implementation:** check `task.status == "Running"` AND `subprocess_map.contains_key(&task_id)` trước khi tạo bất kỳ resource nào. Nếu chỉ `task.status == "Running"` mà map không có entry (edge case bất nhất state — đã có job đang exit-detect chạy), vẫn return 409 vì task chưa được transition xong. KHÔNG self-heal trong handler resume — đó là responsibility của Story 3.2 monitor.

---

**AC-5 — Resume khi task `Done` hoặc `Cancelled` → `400 Bad Request`:**

**Given** task `OMNI-001` ở status `Done` HOẶC `Cancelled` (terminal states)
**When** client gửi `POST .../sessions/resume`
**Then** response `400 Bad Request` với body:
```json
{
  "error": "task_not_resumable",
  "message": "Cannot resume a task in 'done' (or 'cancelled') state"
}
```
(message includes lowercased current status để frontend hiển thị toast rõ ràng.)

**Given** task `OMNI-001` ở status `Draft`, `Ready`, `Assigned`, `NeedsReview`, `ChangesRequested`
**Then** cũng return `400` `task_not_resumable` với message phù hợp ("Cannot resume a task in '<status_lowercase>' state — only paused or failed tasks can be resumed").

**Lý do dùng 400 thay vì 409:** epics §3.3 phân biệt rõ — terminal states là precondition violation (client gửi sai), không phải temporary conflict.

**Edge: task không tồn tại:** return `404 Not Found` với `{"error":"task_not_found","message":"Task '<task_id>' not found in project '<project_id>'"}` (theo convention Story 2.x).

**Edge: project không tồn tại:** return `404` `project_not_found` (convention Story 2.x).

---

**AC-6 — `POST /api/projects/{project_id}/tasks/{task_id}/comments` với content rỗng → `400`:**

**Given** route mới `POST /api/projects/{project_id}/tasks/{task_id}/comments` (mount trong `main.rs::api_router`)
**When** client gửi body `{"content":""}` HOẶC body `{"content":"   "}` (chỉ whitespace) HOẶC body `{}` (thiếu field `content`) HOẶC body `{"content":null}`
**Then** response `400 Bad Request`:
```json
{ "error": "empty_comment", "message": "Comment cannot be empty" }
```
**And** **KHÔNG có row mới được insert vào `comments`** (verify qua SELECT COUNT trong test).
**And** task status KHÔNG đổi.

**Validation rule:** `content` phải `Some(s)` với `s.trim().len() > 0`. Caller có thể truyền content có whitespace ở đầu/cuối nội dung, **giữ nguyên** (KHÔNG `.trim()` lưu vào DB — chỉ trim cho mục đích validation empty-check). Lý do: agent có thể cần whitespace có nghĩa (e.g. multi-line block code).

**Happy path:**
**Given** body `{"content":"Pending instruction for next resume"}`
**When** POST comments
**Then** insert `comments` row với `id = <uuid>`, `task_id = <task_id>`, `content = "Pending instruction for next resume"` (giữ nguyên), `sent = 0`, `created_at = <now>`.
**And** response `201 Created` với body:
```json
{
  "id": "<uuid>",
  "taskId": "<task_id>",
  "content": "Pending instruction for next resume",
  "sent": false,
  "createdAt": "<iso8601>"
}
```

**JSON serialization rule:** `sent` được serialize là `boolean` ở wire (`true`/`false`), nhưng DB lưu `INTEGER` (`0`/`1`). Model `Comment` cần serde convert hoặc dùng method explicit (xem Dev Notes §"Comment model conversion").

**Edge: task không tồn tại / project không tồn tại / task ở status terminal (`Done`/`Cancelled`):** 404 (task/project not found) hoặc 409 `task_terminal` (`{"error":"task_terminal","message":"Cannot add comment to a task in '<status>' state"}`). Lý do: business invariant — Comments chỉ có ý nghĩa nếu task có thể resume trong tương lai.

---

**AC-7 — Comment đã `sent = 1` KHÔNG được resend ở lần resume sau:**

**Given** task `OMNI-001` ở `Paused`, session đã có 2 comment rows trong DB:
- Comment A: `id = c1, content = "First instruction", sent = 1, created_at = T1`
- Comment B: `id = c2, content = "Second instruction", sent = 0, created_at = T2 > T1`
**When** client gửi `POST .../sessions/resume` với body `{"comment":"Third instruction (live)"}`
**Then** backend:
1. INSERT comment row C mới: `id = c3, content = "Third instruction (live)", sent = 1, created_at = T3`.
2. Pipe **chỉ** `"Third instruction (live)"` vào subprocess stdin — KHÔNG combine với comment A/B.
3. Comment B (`sent = 0`) **giữ nguyên** `sent = 0` — KHÔNG flip về 1.
4. Run row D mới có `input = "Third instruction (live)"` (input field chỉ chứa comment vừa gửi).

**Given** task `OMNI-001` ở `Paused`, có comment B (pending: `content = "Second instruction", sent = 0`)
**When** client gửi `POST .../sessions/resume` với body rỗng `{}` (no live comment)
**Then** business decision (story 3.3 scope):
- **KHÔNG auto-flush pending comments** vào agent stdin ở Story 3.3. Pending comments được preserve nguyên `sent = 0`.
- Run row có `input = "retry"` (AC-2).
- Lý do: Summary Tab Story 3.5a sẽ design UX cho user explicitly send pending comments. Story 3.3 chỉ owns: live comment (qua resume body) HOẶC retry.

**Nếu sau này (story 3.5a) muốn "send pending comments khi resume no-live-comment"** → cần update AC riêng + UPDATE `comments SET sent = 1 WHERE task_id = ? AND sent = 0` trong service. Out-of-scope 3.3.

**Verification trong test:**
- After resume with live comment: `SELECT COUNT(*) FROM comments WHERE task_id = ? AND sent = 0` → vẫn đếm được B (1).
- After resume no comment: `SELECT COUNT(*) FROM comments WHERE task_id = ? AND sent = 0` → vẫn 1 (B chưa flush).

---

**AC-8 — Resume khi `sessions.session_id IS NULL` → `409 Conflict`:**

**Given** task `OMNI-001` ở `Paused` (e.g. exit detect đã chạy từ Story 3.2) NHƯNG `sessions.session_id IS NULL` (Story 3.1 capture timeout, user chưa nhập thủ công — manual input PATCH endpoint là Story 3.5a, không có ở 3.3)
**When** client gửi `POST .../sessions/resume`
**Then** response `409 Conflict`:
```json
{
  "error": "session_id_missing",
  "message": "Cannot resume — session_id was not captured. Provide it manually first."
}
```
**And** KHÔNG spawn subprocess, KHÔNG insert run/comment, DB không đổi.

**Lý do:** resume command yêu cầu valid CLI session UUID. Spawn `claude --continue --session-id <empty>` sẽ fail không xác định ở binary level. Fail fast tốt hơn.

**Implementation:** trong `services::sessions::resume_session`, sau khi load session row, check `session.session_id.is_none()` → return `Conflict` ngay (trước bất kỳ DB write nào).

---

**AC-9 — `run_number` atomic increment per session:**

**Given** session có 3 runs hiện tại (run_number 1, 2, 3)
**When** 2 concurrent resume requests cùng đến (cùng task, race condition)
**Then** chỉ **một** request thành công insert `run_number = 4`; request thứ hai phải:
- Hoặc nhận `409` (vì sau request 1 thành công, task transition `Paused → Running` → request 2 thấy task đang `Running` → AC-4 trả 409).
- Hoặc nếu được "schedule" trong cùng tx window thì request 2 atomic compute `MAX + 1 = 5`.

**Implementation:** dùng cùng pattern `BEGIN IMMEDIATE` như `create_task` (Story 1.x → `services/tasks.rs`):
```rust
let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
let next_run_number: i64 = sqlx::query_scalar(
    "SELECT COALESCE(MAX(run_number), 0) + 1 FROM runs WHERE session_id = ?"
)
.bind(&session_pk)
.fetch_one(&mut *tx)
.await?;
// ... insert comment (if any), insert run with run_number = next_run_number, update sessions/tasks
tx.commit().await?;
```

`BEGIN IMMEDIATE` acquires SQLite write lock upfront, preventing concurrent insert race.

**No duplicate run_number:** unique constraint **không cần** thêm vào schema (out-of-scope migration). Atomic tx đủ — chỉ 1 writer tại 1 thời điểm với `BEGIN IMMEDIATE`.

---

**AC-10 — Rollback toàn bộ DB write nếu spawn subprocess fail:**

**Given** task `OMNI-001` ở `Paused`, body có valid comment
**And** binary agent KHÔNG tồn tại (env override path bad / binary missing trên PATH)
**When** client gửi `POST .../sessions/resume`
**Then** sequence trong service:
1. Validate input + load task/session/comment (read-only) → OK.
2. Build resume `Command` via strategy → OK (chưa spawn).
3. Try `.spawn()` → fail với `io::ErrorKind::NotFound`.
4. **KHÔNG insert** comment row, **KHÔNG insert** run row, **KHÔNG update** session/task status.
5. Return `400 Bad Request`:
```json
{
  "error": "agent_not_found",
  "message": "Agent binary not found on PATH"
}
```

**Order chính xác:** spawn TRƯỚC khi commit tx. Nếu spawn OK → write DB → commit. Nếu spawn fail → return error trước khi commit.

```rust
// pseudocode trong services::sessions::resume_session
let strategy = strategy_for(&session.agent)?;
let mut cmd = strategy.resume_command(session_id_str, comment.as_deref());

// Spawn TRƯỚC khi commit tx
let mut child = cmd.spawn().map_err(|e| match e.kind() {
    std::io::ErrorKind::NotFound => AppError::BadRequest {
        code: "agent_not_found",
        message: "Agent binary not found on PATH".to_string(),
    },
    _ => AppError::Internal(anyhow::anyhow!("Failed to spawn: {}", e)),
})?;

// Pipe stdin (best-effort, warn-on-fail)
if let Some(text) = comment.as_deref() {
    // ... write stdin (theo AC-3)
}

let stdout = child.stdout.take().ok_or_else(|| ...)?;

// BÂY GIỜ mới mở tx và write DB
let mut tx = state.db.begin_with("BEGIN IMMEDIATE").await?;
// insert comment if any, insert run, update sessions, update tasks
tx.commit().await?;

// Sau commit OK → insert child vào subprocess_map + spawn background streaming task
state.subprocess_map.lock().await.insert(task_id.clone(), child);
tokio::spawn(stream_subprocess_stdout(stdout, state.clone(), ...));
```

**Edge: tx commit fail sau khi spawn:** child handle đã tồn tại. Rollback discipline:
- Kill child (`child.start_kill()` hoặc `child.kill().await`).
- KHÔNG insert vào `subprocess_map`.
- Return `AppError::Internal(...)`.

**Edge: subprocess_map insert fail (collision — shouldn't happen vì AC-4 đã check trước):** kill child + log error + return 500.

---

**AC-11 — Frontend: Resume Session button + Comment textarea wiring:**

**Scope frontend giới hạn cho 3.3:**
- Wire `ActionBar` trong `TaskDetailPanel.tsx` để render Resume button cho task ở status `paused` / `failed`.
- Optional: inline comment textarea trong `ActionBar` cho minimal UX. Full Summary Tab + live status feed defer cho Story 3.5a.
- API client `frontend/src/api/sessions.ts` thêm function `resumeSession(projectId, taskId, comment?: string)`.
- API client mới `frontend/src/api/comments.ts` với function `addComment(projectId, taskId, content)`.
- Hook `useResumeSession(projectId, taskId)` trong `frontend/src/hooks/useSessionMutation.ts` — pattern theo `useStartSession` Story 3.1.

**Given** task ở status `paused` hoặc `failed`
**When** user click "Resume Session" button (live textarea empty)
**Then** call `POST /api/projects/<pid>/tasks/<tid>/sessions/resume` với body `{}` (no comment).
**And** show toast success "Session resumed for <task_id>" on 200 OK.
**And** invalidate query `["tasks", projectId]` (cache key Story 2.3) + `["task", projectId, taskId]` (Story 3.5a placeholder, no-op nếu chưa có).
**And** không optimistic update task status local (defer Story 3.5a).

**Given** task ở status `paused` hoặc `failed`
**When** user nhập comment vào textarea + click "Resume Session"
**Then** call `POST .../sessions/resume` với body `{"comment":"<text>"}`.
**And** sau 200 OK: clear textarea, show toast "Resumed with comment".
**And** invalidate queries như trên.

**Error handling:**
- `400 agent_not_found` → toast error "Agent binary not found on PATH" (dùng `ApiError.message`).
- `400 empty_comment` → toast error "Comment cannot be empty" (nếu somehow client gửi empty — guard: frontend disable submit khi textarea trim empty AND user click "Resume with comment"; nhưng nếu textarea empty thì submit no-comment hợp lệ).
- `400 task_not_resumable` → toast error theo message từ API.
- `409 session_already_active` → toast warning "Session is already running".
- `409 session_id_missing` → toast warning "Session ID not yet captured — wait or enter manually" (manual input UI defer 3.5a).
- Network error → toast "Failed to resume session".

**Test (Vitest):**
- Click Resume no-comment → mutation gọi `resumeSession(projectId, taskId, undefined)`.
- Click Resume with comment text → mutation gọi `resumeSession(projectId, taskId, "hello")`.
- Sau success → toast success + textarea cleared.
- Error mapping cho mỗi error code → toast variant đúng (success/warning/error).
- Button disabled khi mutation pending.

**KHÔNG SCOPE FRONTEND CHO 3.3:**
- Summary Tab live status feed (Story 3.5a).
- Comments Tab hiển thị thread + pending comments (Story 3.5b).
- Manual session ID input modal (Story 3.5a).
- Optimistic status update (Story 3.5a).

---

**AC-12 — Regression: routes Story 1.x / 2.x / 3.1 / 3.2 KHÔNG bị thay đổi:**

**Given** tất cả route đã mount ở Story 1.x (projects, tasks CRUD), Story 2.x (assign_agent, tasks), Story 3.1 (sessions/start), Story 3.2 (sessions/cancel + shutdown handler)
**When** Story 3.3 thêm 2 route mới:
- `POST /api/projects/{project_id}/tasks/{task_id}/sessions/resume`
- `POST /api/projects/{project_id}/tasks/{task_id}/comments`
**Then** không có route nào bị xóa hoặc đổi path/method/behavior.
**And** `backend/tests/projects_test.rs`, `backend/tests/tasks_test.rs`, `backend/tests/sessions_test.rs` (Story 3.1+3.2 tests) all passing.
**And** frontend existing tests (TaskBoard, TaskDetail, etc) all passing.

---

## Tasks / Subtasks

### A. Backend: Comment model + service + handler

- [ ] **Task A.1 — Tạo `backend/src/models/comment.rs`** (AC: 6, 7)
  - [ ] A.1.1 Define `Comment` struct với `serde(rename_all = "camelCase")` + `FromRow`:
    ```rust
    use serde::{Deserialize, Serialize};
    use sqlx::FromRow;

    #[derive(Debug, Clone, FromRow)]
    pub struct Comment {
        pub id: String,
        pub task_id: String,
        pub content: String,
        pub sent: i64,  // DB lưu INTEGER 0/1
        pub created_at: String,
    }

    impl Serialize for Comment {
        fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
            #[derive(Serialize)]
            #[serde(rename_all = "camelCase")]
            struct CommentWire<'a> {
                id: &'a str,
                task_id: &'a str,
                content: &'a str,
                sent: bool,
                created_at: &'a str,
            }
            CommentWire {
                id: &self.id,
                task_id: &self.task_id,
                content: &self.content,
                sent: self.sent != 0,
                created_at: &self.created_at,
            }
            .serialize(serializer)
        }
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct CreateCommentRequest {
        pub content: Option<String>,
    }
    ```
  - [ ] A.1.2 Đăng ký `pub mod comment;` trong `backend/src/models/mod.rs`.

- [ ] **Task A.2 — Tạo `backend/src/services/comments.rs`** (AC: 6, 7)
  - [ ] A.2.1 Implement:
    ```rust
    use crate::{error::AppError, models::comment::Comment};
    use chrono::Utc;
    use sqlx::SqlitePool;
    use uuid::Uuid;

    pub fn validate_content_non_empty(content: &Option<String>) -> Result<&str, AppError> {
        let s = content.as_deref().ok_or_else(|| AppError::BadRequest {
            code: "empty_comment",
            message: "Comment cannot be empty".to_string(),
        })?;
        if s.trim().is_empty() {
            return Err(AppError::BadRequest {
                code: "empty_comment",
                message: "Comment cannot be empty".to_string(),
            });
        }
        Ok(s)
    }

    pub async fn create_comment(
        pool: &SqlitePool,
        project_id: &str,
        task_id: &str,
        content: &str,
        sent: bool,
    ) -> Result<Comment, AppError> {
        // Verify task exists trong project (re-fetch để tránh stale)
        let exists: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM tasks WHERE id = ? AND project_id = ?",
        )
        .bind(task_id)
        .bind(project_id)
        .fetch_optional(pool)
        .await?;
        if exists.is_none() {
            return Err(AppError::NotFound {
                code: "task_not_found",
                message: format!("Task '{}' not found in project '{}'", task_id, project_id),
            });
        }

        let id = Uuid::new_v4().to_string();
        let created_at = Utc::now().to_rfc3339();
        sqlx::query(
            "INSERT INTO comments (id, task_id, content, sent, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(task_id)
        .bind(content)
        .bind(if sent { 1_i64 } else { 0_i64 })
        .bind(&created_at)
        .execute(pool)
        .await?;

        Ok(Comment {
            id,
            task_id: task_id.to_string(),
            content: content.to_string(),
            sent: if sent { 1 } else { 0 },
            created_at,
        })
    }

    /// Helper variant cho dùng trong tx (resume flow) — không re-fetch task, không acquire pool.
    pub async fn insert_comment_in_tx<'c>(
        tx: &mut sqlx::Transaction<'c, sqlx::Sqlite>,
        task_id: &str,
        content: &str,
        sent: bool,
    ) -> Result<Comment, AppError> {
        let id = Uuid::new_v4().to_string();
        let created_at = Utc::now().to_rfc3339();
        sqlx::query(
            "INSERT INTO comments (id, task_id, content, sent, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(task_id)
        .bind(content)
        .bind(if sent { 1_i64 } else { 0_i64 })
        .bind(&created_at)
        .execute(&mut **tx)
        .await?;
        Ok(Comment {
            id,
            task_id: task_id.to_string(),
            content: content.to_string(),
            sent: if sent { 1 } else { 0 },
            created_at,
        })
    }
    ```
  - [ ] A.2.2 Đăng ký `pub mod comments;` trong `backend/src/services/mod.rs`.

- [ ] **Task A.3 — Tạo `backend/src/handlers/comments.rs`** (AC: 6)
  - [ ] A.3.1 Implement handler `add_comment`:
    ```rust
    use std::sync::Arc;
    use axum::{Json, extract::{Path, State}, http::StatusCode};
    use crate::{
        error::AppError,
        models::comment::{Comment, CreateCommentRequest},
        services, state::AppState,
    };

    pub async fn add_comment(
        State(state): State<Arc<AppState>>,
        Path((project_id, task_id)): Path<(String, String)>,
        Json(req): Json<CreateCommentRequest>,
    ) -> Result<(StatusCode, Json<Comment>), AppError> {
        let content = services::comments::validate_content_non_empty(&req.content)?;

        // Verify task không ở terminal state
        let task = services::tasks::get_task(&state.db, &project_id, &task_id).await?;
        if task.status == "Done" || task.status == "Cancelled" {
            return Err(AppError::Conflict {
                code: "task_terminal",
                message: format!(
                    "Cannot add comment to a task in '{}' state",
                    task.status.to_lowercase()
                ),
            });
        }

        let comment = services::comments::create_comment(
            &state.db,
            &project_id,
            &task_id,
            content,
            false,  // sent = 0 (pending)
        )
        .await?;
        Ok((StatusCode::CREATED, Json(comment)))
    }
    ```
  - [ ] A.3.2 Đăng ký `pub mod comments;` trong `backend/src/handlers/mod.rs`.

### B. Backend: Sessions resume handler + service

- [ ] **Task B.1 — Mở rộng `backend/src/services/sessions.rs`** (AC: 1, 2, 3, 4, 5, 7, 8, 9, 10)
  - [ ] B.1.1 Story 3.1 đã tạo file này (hoặc Story 3.2 đã thêm `mark_session_paused`, `mark_session_closed`). Story 3.3 thêm function chính:
    ```rust
    use crate::{
        error::AppError,
        models::comment::Comment,
        services, state::AppState,
    };
    use std::sync::Arc;
    use chrono::Utc;
    use uuid::Uuid;
    use std::process::Stdio;
    use tokio::io::AsyncWriteExt;

    pub struct ResumeOutcome {
        pub session_pk: String,
        pub task_id: String,
        pub session_id: String,
        pub run_id: String,
        pub run_number: i64,
        pub run_input: String,  // "retry" hoặc comment text
        pub comment: Option<Comment>,
        pub started_at: String,
    }

    pub async fn resume_session(
        state: Arc<AppState>,
        project_id: &str,
        task_id: &str,
        comment: Option<String>,
    ) -> Result<ResumeOutcome, AppError> {
        // 1. Validate comment empty-check (chỉ khi field provided)
        if let Some(ref text) = comment {
            if text.trim().is_empty() {
                return Err(AppError::BadRequest {
                    code: "empty_comment",
                    message: "Comment cannot be empty".to_string(),
                });
            }
        }

        // 2. Load task + verify project/task exist
        let task = services::tasks::get_task(&state.db, project_id, task_id).await?;

        // 3. AC-4 / AC-5: check task status
        match task.status.as_str() {
            "Paused" | "Failed" => {} // OK to resume
            "Running" => {
                return Err(AppError::Conflict {
                    code: "session_already_active",
                    message: "Cannot resume a running session. Cancel it first or wait for it to pause.".to_string(),
                });
            }
            other => {
                return Err(AppError::BadRequest {
                    code: "task_not_resumable",
                    message: format!(
                        "Cannot resume a task in '{}' state — only paused or failed tasks can be resumed",
                        other.to_lowercase()
                    ),
                });
            }
        }

        // 4. Load session row
        let session = sqlx::query_as::<_, (String, String, Option<String>, String)>(
            "SELECT id, agent, session_id, status FROM sessions WHERE task_id = ?",
        )
        .bind(task_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound {
            code: "session_not_found",
            message: format!("No session exists for task '{}'", task_id),
        })?;
        let (session_pk, agent, session_id_opt, _session_status) = session;

        // 5. AC-8: session_id null → 409
        let session_id_str = session_id_opt.ok_or_else(|| AppError::Conflict {
            code: "session_id_missing",
            message: "Cannot resume — session_id was not captured. Provide it manually first.".to_string(),
        })?;

        // 6. AC-4 secondary check: subprocess_map collision
        if state.subprocess_map.lock().await.contains_key(task_id) {
            return Err(AppError::Conflict {
                code: "session_already_active",
                message: "Cannot resume a running session. Cancel it first or wait for it to pause.".to_string(),
            });
        }

        // 7. Build resume command via strategy
        let strategy = crate::agent::strategy_for(&agent)?;
        let mut cmd = strategy.resume_command(&session_id_str, comment.as_deref());

        // 8. AC-10: Spawn TRƯỚC khi commit DB
        let mut child = cmd.spawn().map_err(|e| match e.kind() {
            std::io::ErrorKind::NotFound => AppError::BadRequest {
                code: "agent_not_found",
                message: "Agent binary not found on PATH".to_string(),
            },
            _ => AppError::Internal(anyhow::anyhow!("Failed to spawn agent subprocess: {}", e)),
        })?;

        // 9. Pipe stdin (best-effort)
        if let Some(text) = comment.as_deref() {
            if let Some(mut stdin) = child.stdin.take() {
                if let Err(e) = stdin.write_all(text.as_bytes()).await {
                    tracing::warn!(error = %e, "failed to write comment to stdin");
                }
                if let Err(e) = stdin.write_all(b"\n").await {
                    tracing::warn!(error = %e, "failed to write newline to stdin");
                }
                // stdin dropped here → close pipe
            }
        }

        // 10. Take stdout TRƯỚC khi child vào map
        let stdout = child.stdout.take().ok_or_else(|| {
            AppError::Internal(anyhow::anyhow!("subprocess stdout missing"))
        })?;

        // 11. Build log_path + ensure dir exists
        let run_id = Uuid::new_v4().to_string();
        let log_path = resolve_log_path(task_id, &run_id);
        if let Some(parent) = std::path::Path::new(&log_path).parent() {
            let _ = tokio::fs::create_dir_all(parent).await;
        }

        let now = Utc::now().to_rfc3339();
        let run_input_value: String = match comment.as_deref() {
            Some(text) => text.to_string(),
            None => "retry".to_string(),
        };

        // 12. Open tx (BEGIN IMMEDIATE)
        let mut tx = state.db.begin_with("BEGIN IMMEDIATE").await.map_err(|e| {
            AppError::Internal(anyhow::anyhow!("Failed to begin tx: {}", e))
        })?;

        // 12a. AC-9: compute next run_number atomic
        let next_run_number: i64 = sqlx::query_scalar(
            "SELECT COALESCE(MAX(run_number), 0) + 1 FROM runs WHERE session_id = ?",
        )
        .bind(&session_pk)
        .fetch_one(&mut *tx)
        .await?;

        // 12b. Insert comment if any (sent = 1)
        let comment_row: Option<Comment> = match comment.as_deref() {
            Some(text) => Some(
                services::comments::insert_comment_in_tx(&mut tx, task_id, text, true).await?
            ),
            None => None,
        };

        // 12c. Insert run
        sqlx::query(
            "INSERT INTO runs (id, session_id, run_number, input, exit_code, log_path, log_tail, started_at, ended_at)
             VALUES (?, ?, ?, ?, NULL, ?, NULL, ?, NULL)",
        )
        .bind(&run_id)
        .bind(&session_pk)
        .bind(next_run_number)
        .bind(&run_input_value)
        .bind(&log_path)
        .bind(&now)
        .execute(&mut *tx)
        .await?;

        // 12d. Update session status → running, last_active = now
        sqlx::query(
            "UPDATE sessions SET status = 'running', last_active = ? WHERE id = ?",
        )
        .bind(&now)
        .bind(&session_pk)
        .execute(&mut *tx)
        .await?;

        // 12e. Update task status → Running (via services/tasks helper)
        // Pattern: gọi inside tx hoặc qua function nhận &mut tx — chọn function mới:
        services::tasks::transition_to_running_in_tx(&mut tx, task_id).await?;

        // 12f. Commit
        tx.commit().await.map_err(|e| {
            // Rollback discipline: kill child nếu commit fail
            tokio::spawn(async move {
                let _ = child.start_kill();
            });
            AppError::Internal(anyhow::anyhow!("Failed to commit resume tx: {}", e))
        })?;

        // 13. Insert child vào subprocess_map + spawn background streaming task
        state.subprocess_map.lock().await.insert(task_id.to_string(), child);

        // Background streaming task — reuse helper từ Story 3.1.
        // Pattern: chỉ stream stdout vào log file. Story 3.2 monitor (đã spawn permanently)
        // sẽ detect khi stdout EOF + child exit.
        let state_for_bg = Arc::clone(&state);
        let task_id_for_bg = task_id.to_string();
        let session_pk_for_bg = session_pk.clone();
        let run_id_for_bg = run_id.clone();
        let log_path_for_bg = log_path.clone();
        tokio::spawn(async move {
            services::sessions::stream_subprocess_stdout(
                stdout,
                state_for_bg,
                task_id_for_bg,
                session_pk_for_bg,
                run_id_for_bg,
                log_path_for_bg,
            ).await;
        });

        Ok(ResumeOutcome {
            session_pk,
            task_id: task_id.to_string(),
            session_id: session_id_str,
            run_id,
            run_number: next_run_number,
            run_input: run_input_value,
            comment: comment_row,
            started_at: now,
        })
    }

    fn resolve_log_path(task_id: &str, run_id: &str) -> String {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        format!("{}/.omni-agent/logs/{}/{}.log", home, task_id, run_id)
    }
    ```
  - [ ] B.1.2 Nếu Story 3.1 chưa tạo `stream_subprocess_stdout` như shared helper, refactor Story 3.1's inline background closure thành named `pub async fn stream_subprocess_stdout(...)` để 3.3 reuse. Mục tiêu DRY: 3.1 dùng cho start, 3.3 dùng cho resume. KHÔNG duplicate logic. Nếu Story 3.1 đã có sẵn (theo 3.1's Dev Notes có refer "background streaming task helper") → reuse trực tiếp.

- [ ] **Task B.2 — Mở rộng `services/tasks.rs` với `transition_to_running_in_tx`** (AC: 1, 7)
  - [ ] B.2.1 Story 3.1 đã có `transition_to_running` (pool-based, từ `Assigned → Running`). Story 3.2 đã có `transition_to_paused` / `transition_to_failed`. Story 3.3 thêm:
    ```rust
    pub async fn transition_to_running_in_tx<'c>(
        tx: &mut sqlx::Transaction<'c, sqlx::Sqlite>,
        task_id: &str,
    ) -> Result<(), AppError> {
        let now = chrono::Utc::now().to_rfc3339();
        // Accept Paused HOẶC Failed (3.3 resume case)
        let result = sqlx::query(
            "UPDATE tasks SET status = 'Running', updated_at = ? WHERE id = ? AND status IN ('Paused','Failed')",
        )
        .bind(&now)
        .bind(task_id)
        .execute(&mut **tx)
        .await?;

        if result.rows_affected() == 0 {
            return Err(AppError::Conflict {
                code: "task_status_changed",
                message: format!(
                    "Task '{}' is no longer in Paused/Failed state",
                    task_id
                ),
            });
        }
        Ok(())
    }
    ```
  - [ ] B.2.2 Function này nhận `&mut Transaction` (KHÔNG nhận `&SqlitePool`) — phải gọi trong tx context (để cùng commit/rollback với resume flow).
  - [ ] B.2.3 Race guard: `rows_affected() == 0` nghĩa task status đã đổi giữa lúc load (step B.1.1 step 2) và step 12e — return Conflict để spawn rollback bị handle ở caller (AC-10 trường hợp tx commit fail tương đương). Tuy nhiên implementation **không** kill child ở đây vì spawn đã thành công — caller (`resume_session`) phải catch Conflict, kill child, return error. Pattern an toàn:
    ```rust
    // Trong resume_session sau step 12e:
    if let Err(e) = services::tasks::transition_to_running_in_tx(&mut tx, task_id).await {
        // tx will rollback on drop. Kill child to clean up.
        let _ = child.start_kill();  // hoặc tokio::spawn(...)
        return Err(e);
    }
    ```
    **Implementation lưu ý:** sau khi spawn child + take stdout, `child` ownership đã pass cho biến local. Để cancel-on-error, dùng pattern guard struct hoặc explicit kill trước mọi early-return từ step 11 trở đi. Khuyến nghị: wrap step 11→13 trong inner `async { ... }.await` rồi handle Err sau (xem code pseudocode AC-10).

- [ ] **Task B.3 — Tạo `backend/src/handlers/sessions.rs::resume_session` handler** (AC: 1, 2, 4, 5, 8)
  - [ ] B.3.1 Story 3.1 đã tạo file này (cho `start_session`); Story 3.2 đã thêm `cancel_session`. Story 3.3 thêm thêm:
    ```rust
    use std::sync::Arc;
    use axum::{Json, extract::{Path, State}};
    use serde::Deserialize;
    use crate::{error::AppError, services, state::AppState};

    #[derive(Debug, Deserialize, Default)]
    #[serde(rename_all = "camelCase", default)]
    pub struct ResumeSessionRequest {
        pub comment: Option<String>,
    }

    pub async fn resume_session(
        State(state): State<Arc<AppState>>,
        Path((project_id, task_id)): Path<(String, String)>,
        // Body có thể rỗng — dùng Option<Json<...>> pattern để chấp nhận Content-Length: 0:
        body: Option<Json<ResumeSessionRequest>>,
    ) -> Result<Json<serde_json::Value>, AppError> {
        let comment = body
            .map(|Json(b)| b.comment)
            .unwrap_or(None);

        let outcome = services::sessions::resume_session(
            state.clone(),
            &project_id,
            &task_id,
            comment,
        )
        .await?;

        // Build response body (camelCase keys)
        let response = serde_json::json!({
            "sessionPk": outcome.session_pk,
            "taskId": outcome.task_id,
            "sessionId": outcome.session_id,
            "status": "running",
            "runId": outcome.run_id,
            "runNumber": outcome.run_number,
            "runInput": outcome.run_input,
            "commentId": outcome.comment.as_ref().map(|c| c.id.clone()),
            "commentSent": outcome.comment.as_ref().map(|_| true),
            "startedAt": outcome.started_at,
        });
        Ok(Json(response))
    }
    ```
  - [ ] B.3.2 **Lưu ý JSON deserialize:** `Option<Json<ResumeSessionRequest>>` xử lý cả Content-Length: 0 (body rỗng) và `{}` (struct rỗng — `comment: None` vì `#[serde(default)]`). Test cả 2 cases.

### C. Backend: Route mount + main.rs

- [ ] **Task C.1 — Thêm 2 route mới trong `backend/src/main.rs`** (AC: 1, 6, 12)
  - [ ] C.1.1 Thêm vào `api_router` (sau các route Story 3.1 + 3.2):
    ```rust
    .route(
        "/projects/{project_id}/tasks/{task_id}/sessions/resume",
        axum::routing::post(handlers::sessions::resume_session),
    )
    .route(
        "/projects/{project_id}/tasks/{task_id}/comments",
        axum::routing::post(handlers::comments::add_comment),
    )
    ```
  - [ ] C.1.2 KHÔNG xóa hoặc đổi route khác (AC-12 regression).
  - [ ] C.1.3 Đảm bảo `handlers::comments` được declare trong `mod` block của `main.rs` (theo pattern hiện tại).

### D. Backend: Agent strategy resume_command implementation

- [ ] **Task D.1 — Verify `ClaudeStrategy::resume_command` từ Story 3.1** (AC: 3)
  - [ ] D.1.1 Story 3.1 đã định nghĩa trait method `resume_command(&self, session_id: &str, comment: Option<&str>) -> Command`. Story 3.1 stub trả basic Command nhưng KHÔNG có handler dùng → có thể chưa fully tested.
  - [ ] D.1.2 Story 3.3 cần verify implementation match AC-3 contract:
    - Claude: program `claude` (env override `OMNI_AGENT_CLAUDE_BIN`), args `["--continue", "--session-id", session_id]`.
    - Codex: program `codex` (env override `OMNI_AGENT_CODEX_BIN`), args `["resume", session_id]`.
    - Stdio: `.stdin(piped)` nếu `comment.is_some()`, else `.stdin(null)`.
    - `.stdout(piped)`, `.stderr(...)`, `.kill_on_drop(true)`, `.current_dir(...)`.
  - [ ] D.1.3 Nếu Story 3.1's implementation thiếu hoặc khác → update `backend/src/agent/claude.rs` và `backend/src/agent/codex.rs`. Reuse Story 3.1's `spawn_command` helper / binary-resolution pattern (env override → fallback PATH).

- [ ] **Task D.2 — Unit tests cho `resume_command`** (AC: 3)
  - [ ] D.2.1 Trong `backend/src/agent/claude.rs` thêm `#[cfg(test)] mod tests`:
    ```rust
    #[tokio::test]
    async fn resume_command_with_comment_has_stdin_piped() {
        let s = ClaudeStrategy::default();
        // Set env override để không depend on PATH
        unsafe { std::env::set_var("OMNI_AGENT_CLAUDE_BIN", "/tmp/mock-claude-test"); }
        let cmd = s.resume_command("sess-uuid", Some("hello"));
        let std_cmd = cmd.as_std();
        assert_eq!(std_cmd.get_program(), "/tmp/mock-claude-test");
        let args: Vec<&str> = std_cmd
            .get_args()
            .map(|a| a.to_str().unwrap())
            .collect();
        assert_eq!(args, vec!["--continue", "--session-id", "sess-uuid"]);
    }

    #[tokio::test]
    async fn resume_command_without_comment_has_stdin_null() {
        // Note: tokio::process::Command không expose stdio enum trực tiếp,
        // test bằng cách spawn mock binary + thử pipe write (Err) hoặc dùng strategy-internal accessor.
        // Simpler test: spawn real Command (mock binary), verify stdin handle behavior.
    }
    ```
  - [ ] D.2.2 Tương tự cho `backend/src/agent/codex.rs`.

### E. Backend: Integration tests

- [ ] **Task E.1 — Setup helper `setup_app_with_paused_task` trong `backend/tests/sessions_test.rs`** (AC: 1–10)
  - [ ] E.1.1 Reuse `build_test_app_with_pool` từ Story 3.1/3.2. Thêm helper:
    ```rust
    async fn setup_app_with_paused_task(
        agent: &str,
        session_id_value: Option<&str>, // None = NULL session_id (test AC-8)
    ) -> (Router, SqlitePool, Arc<AppState>, String /*project_id*/, String /*task_id*/, String /*session_pk*/, PathBuf /*tmp_home*/) {
        // 1. Build pool + app (with subprocess_map).
        // 2. Insert project + task.
        // 3. Assign agent.
        // 4. Transition task to Running, then Paused (mimic Story 3.2 flow).
        // 5. Insert sessions row with session_id_value.
        // 6. Insert runs row run_number=1 (already done by start).
        // 7. Override HOME env var to tmp dir.
    }
    ```
    Implementation: thay vì gọi API chain (start → kill → wait paused), insert DB rows trực tiếp để test cô lập (faster, no flake).

- [ ] **Task E.2 — Test: resume happy path với comment (Claude)** (AC: 1, 3, 9, 10)
  - [ ] E.2.1 Set `OMNI_AGENT_CLAUDE_BIN` → mock script (giống Story 3.1 D.2). Mock script đọc stdin (`cat`), in echo back ra stdout, sleep.
  - [ ] E.2.2 Setup task Paused với `session_id = "cli-sess-aaa"`, `agent = "claude"`.
  - [ ] E.2.3 POST `/api/projects/<pid>/tasks/<tid>/sessions/resume` body `{"comment":"hello world"}`.
  - [ ] E.2.4 Assert response 200, body có `taskId`, `sessionId = "cli-sess-aaa"`, `runNumber = 2`, `runInput = "hello world"`, `commentId` not null, `commentSent = true`.
  - [ ] E.2.5 SELECT từ DB:
    - `tasks.status = "Running"`.
    - `sessions.status = "running"`, `last_active` updated.
    - `runs WHERE run_number = 2` exists, `input = "hello world"`, `log_path` not null, `exit_code` null.
    - `comments` có row mới, `content = "hello world"`, `sent = 1`.
  - [ ] E.2.6 Verify subprocess_map có entry cho task_id.
  - [ ] E.2.7 Sleep 500ms + verify log file tồn tại + chứa text agent đã echo (proof stdin → subprocess hoạt động).
  - [ ] E.2.8 Cleanup: kill subprocess via state.subprocess_map.

- [ ] **Task E.3 — Test: resume happy path KHÔNG có comment** (AC: 2, 10)
  - [ ] E.3.1 Setup task Paused, mock binary giống E.2 nhưng KHÔNG cần đọc stdin.
  - [ ] E.3.2 POST resume body `{}`.
  - [ ] E.3.3 Assert response 200, `runInput = "retry"`, `commentId = null`, `commentSent = null`.
  - [ ] E.3.4 SELECT `runs` → `input = "retry"`. SELECT `comments` cho task → no new row (count chưa đổi).

- [ ] **Task E.4 — Test: resume body Content-Length: 0** (AC: 2)
  - [ ] E.4.1 POST resume với empty body (không Content-Type, không body). Expect 200 + behavior giống E.3 (no comment, run_input = "retry").

- [ ] **Task E.5 — Test: resume body `{"comment":""}` → 400** (AC: 2 edge, 6)
  - [ ] E.5.1 POST resume body `{"comment":""}`. Expect 400, error envelope `{"error":"empty_comment","message":"Comment cannot be empty"}`. KHÔNG insert comment/run. Task status vẫn `Paused`.
  - [ ] E.5.2 Tương tự body `{"comment":"   "}` (whitespace only) → 400 empty_comment.

- [ ] **Task E.6 — Test: resume khi task Running → 409** (AC: 4)
  - [ ] E.6.1 Setup task ở Running (insert trực tiếp DB + có entry trong subprocess_map fake).
  - [ ] E.6.2 POST resume → 409 `session_already_active`. KHÔNG insert run mới.

- [ ] **Task E.7 — Test: resume khi task Done/Cancelled → 400** (AC: 5)
  - [ ] E.7.1 Setup task Done. POST resume → 400 `task_not_resumable`, message chứa `'done'`.
  - [ ] E.7.2 Setup task Cancelled. POST resume → 400 `task_not_resumable`, message chứa `'cancelled'`.

- [ ] **Task E.8 — Test: resume khi task Draft/Ready/Assigned → 400** (AC: 5)
  - [ ] E.8.1 Setup task Assigned (status sau create + assign agent, chưa start). POST resume → 400 `task_not_resumable`.

- [ ] **Task E.9 — Test: resume khi session_id NULL → 409** (AC: 8)
  - [ ] E.9.1 Setup task Paused với `session_id = NULL`. POST resume → 409 `session_id_missing`. KHÔNG insert run/comment, task vẫn Paused.

- [ ] **Task E.10 — Test: resume rollback khi agent binary missing → 400** (AC: 10)
  - [ ] E.10.1 KHÔNG set `OMNI_AGENT_CLAUDE_BIN` (hoặc set tới `/nonexistent/path`).
  - [ ] E.10.2 POST resume body `{"comment":"x"}` → 400 `agent_not_found`.
  - [ ] E.10.3 Verify DB không thay đổi: `runs` count cho session vẫn 1 (chỉ run từ start), `comments` count cho task vẫn 0 (chưa có), `tasks.status` vẫn `Paused`, `sessions.status` vẫn `paused`.

- [ ] **Task E.11 — Test: pending comment KHÔNG được flush khi resume no-comment** (AC: 7)
  - [ ] E.11.1 Setup task Paused. Insert sẵn comment row: `content = "pending instruction", sent = 0`.
  - [ ] E.11.2 POST resume body `{}` (no live comment) → 200 OK.
  - [ ] E.11.3 SELECT `comments WHERE task_id = ? AND sent = 0` → vẫn 1 row (pending B chưa flush).
  - [ ] E.11.4 SELECT `runs WHERE run_number = 2` → `input = "retry"` (KHÔNG là "pending instruction").

- [ ] **Task E.12 — Test: pending comment vẫn pending sau resume CÓ live comment** (AC: 7)
  - [ ] E.12.1 Setup giống E.11. POST resume body `{"comment":"live"}` → 200 OK.
  - [ ] E.12.2 SELECT comments → 2 rows. Pending row vẫn `sent = 0`. Live row mới có `content = "live", sent = 1`.

- [ ] **Task E.13 — Test: `POST .../comments` empty content → 400** (AC: 6)
  - [ ] E.13.1 Setup task ở bất kỳ status non-terminal nào (e.g. Assigned). POST `/api/projects/<pid>/tasks/<tid>/comments` body `{"content":""}` → 400 `empty_comment`. SELECT comments → no new row.
  - [ ] E.13.2 Variant body `{}` (missing content) → 400 `empty_comment`.
  - [ ] E.13.3 Variant body `{"content":"   "}` (whitespace only) → 400 `empty_comment`.

- [ ] **Task E.14 — Test: `POST .../comments` happy path** (AC: 6)
  - [ ] E.14.1 Setup task Assigned. POST comments body `{"content":"   pending text   "}` → 201 Created. Response body có `content = "   pending text   "` (whitespace preserved), `sent = false`, `taskId`, `id`, `createdAt`.
  - [ ] E.14.2 SELECT comments → 1 row, `content = "   pending text   "`, `sent = 0`.

- [ ] **Task E.15 — Test: `POST .../comments` task Done/Cancelled → 409** (AC: 6)
  - [ ] E.15.1 Setup task Done. POST comments body `{"content":"x"}` → 409 `task_terminal`, message chứa `'done'`.
  - [ ] E.15.2 Setup task Cancelled. → 409 `task_terminal`, message chứa `'cancelled'`.

- [ ] **Task E.16 — Test: 404 task/project not found** (AC: 5, 6)
  - [ ] E.16.1 POST resume `/api/projects/UNKNOWN/tasks/UNKNOWN-001/sessions/resume` → 404 `project_not_found` hoặc `task_not_found` (theo behavior của `services::tasks::get_task`).
  - [ ] E.16.2 Tương tự `POST .../comments` → 404.

- [ ] **Task E.17 — Test: regression — toàn bộ Story 3.1 + 3.2 tests + Story 1.x/2.x tests vẫn pass** (AC: 12)
  - [ ] E.17.1 `cd backend && cargo test --workspace` — all green. Số test mới (E.2–E.16): ~16 tests. Existing tests: phải còn đúng số như trước story 3.3.

### F. Frontend: API client + hook + ActionBar wiring

- [ ] **Task F.1 — Tạo `frontend/src/api/comments.ts`** (AC: 6)
  - [ ] F.1.1 Implement:
    ```ts
    import { apiClient } from "./client";

    export interface Comment {
      id: string;
      taskId: string;
      content: string;
      sent: boolean;
      createdAt: string;
    }

    export async function addComment(
      projectId: string,
      taskId: string,
      content: string,
    ): Promise<Comment> {
      return apiClient.post<Comment>(
        `/api/projects/${projectId}/tasks/${taskId}/comments`,
        { content },
      );
    }
    ```
  - [ ] F.1.2 Pattern theo `frontend/src/api/tasks.ts` từ Story 2.x.

- [ ] **Task F.2 — Mở rộng `frontend/src/api/sessions.ts`** (AC: 1, 2, 11)
  - [ ] F.2.1 Story 3.1 đã tạo file này với `startSession`. Story 3.3 thêm:
    ```ts
    export interface ResumeSessionResponse {
      sessionPk: string;
      taskId: string;
      sessionId: string;
      status: "running";
      runId: string;
      runNumber: number;
      runInput: string;
      commentId: string | null;
      commentSent: boolean | null;
      startedAt: string;
    }

    export async function resumeSession(
      projectId: string,
      taskId: string,
      comment?: string,
    ): Promise<ResumeSessionResponse> {
      const body: Record<string, string> = {};
      if (comment !== undefined) body.comment = comment;
      return apiClient.post<ResumeSessionResponse>(
        `/api/projects/${projectId}/tasks/${taskId}/sessions/resume`,
        body,
      );
    }
    ```

- [ ] **Task F.3 — Mở rộng `frontend/src/hooks/useSessionMutation.ts`** (AC: 11)
  - [ ] F.3.1 Story 3.1 đã có `useStartSession`. Story 3.3 thêm:
    ```ts
    export function useResumeSession(projectId: string, taskId: string) {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (comment?: string) => resumeSession(projectId, taskId, comment),
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["tasks", projectId] });
          qc.invalidateQueries({ queryKey: ["task", projectId, taskId] });
        },
      });
    }
    ```
  - [ ] F.3.2 KHÔNG implement optimistic update — defer Story 3.5a (theo AC-11 outscope).

- [ ] **Task F.4 — Wire Resume Session button trong `ActionBar.tsx`** (AC: 11)
  - [ ] F.4.1 Mở rộng `frontend/src/features/detail/TaskDetailPanel.tsx` (hoặc ActionBar component file):
    ```tsx
    function ActionBar({ projectId, task }: { projectId: string; task: Task }) {
      const { showToast } = useToast();
      const startMut = useStartSession(projectId, task.id);
      const resumeMut = useResumeSession(projectId, task.id);
      const [commentText, setCommentText] = useState("");

      const handleResume = () => {
        const c = commentText.trim() ? commentText : undefined;
        resumeMut.mutate(c, {
          onSuccess: () => {
            setCommentText("");
            showToast({
              variant: "success",
              message: c
                ? `Resumed ${task.id} with comment`
                : `Session resumed for ${task.id}`,
            });
          },
          onError: (err) => {
            const msg = err instanceof ApiError ? err.message : "Failed to resume session";
            const variant = err instanceof ApiError && err.code === "session_already_active"
              ? "warning"
              : "error";
            showToast({ variant, message: msg });
          },
        });
      };

      if (task.status === "assigned") {
        // Story 3.1 wiring (Start Session button) — KHÔNG đổi
      }

      if (task.status === "paused" || task.status === "failed") {
        return (
          <div className="task-detail-panel__action-bar">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment or instruction for the agent…"
              rows={2}
            />
            <Button
              variant="primary"
              size="md"
              onClick={handleResume}
              disabled={resumeMut.isPending}
            >
              Resume Session
            </Button>
          </div>
        );
      }

      // Các status khác giữ stub theo Story 3.1.
    }
    ```
  - [ ] F.4.2 KHÔNG implement Mark Done button (defer story sau). KHÔNG implement Cancel button (Story 3.2 đã wire).
  - [ ] F.4.3 Textarea autosave to localStorage — defer Story 3.5a (KHÔNG scope 3.3).

- [ ] **Task F.5 — Frontend tests** (AC: 11)
  - [ ] F.5.1 Mở rộng `frontend/src/features/detail/TaskDetailPanel.test.tsx`:
    - Mock `../../api/sessions` (giống Story 3.1 test).
    - **Test:** task ở `paused` → render textarea + Resume button.
    - **Test:** task ở `failed` → render textarea + Resume button.
    - **Test:** task ở `running` → KHÔNG render Resume button.
    - **Test:** click Resume textarea empty → mutation gọi `resumeSession(projectId, taskId, undefined)`.
    - **Test:** click Resume với text "hello" → mutation gọi `resumeSession(projectId, taskId, "hello")`. Textarea clear sau success. Toast success message chứa "with comment".
    - **Test:** error `ApiError(400, "agent_not_found", "...")` → toast error variant.
    - **Test:** error `ApiError(409, "session_already_active", "...")` → toast warning variant.
    - **Test:** button disabled khi `resumeMut.isPending`.

### G. Validation, regression, harness

- [ ] **Task G.1 — Backend test suite + lint** (AC: All backend ACs, AC-12)
  - [ ] G.1.1 `cd backend && cargo build` — exit 0.
  - [ ] G.1.2 `cd backend && cargo test` — toàn bộ test pass. Tests mới (E.2–E.16): ~16. Story 3.1 + 3.2 tests + Story 1.x/2.x: 0 regression.
  - [ ] G.1.3 `cd backend && cargo fmt --check && cargo clippy --all-targets -- -D warnings` (nếu repo có lint config; verify) — exit 0.

- [ ] **Task G.2 — Frontend test + typecheck + build** (AC: 11)
  - [ ] G.2.1 `cd frontend && npx tsc --noEmit` — exit 0.
  - [ ] G.2.2 `cd frontend && npm test` — Story 3.1 tests + Story 3.3 tests pass.
  - [ ] G.2.3 `cd frontend && npm run build` — exit 0.

- [ ] **Task G.3 — Manual smoke check** (AC: 1, 2, 11)
  - [ ] G.3.1 Tạo mock binary `/tmp/mock-claude.sh`:
    ```bash
    #!/usr/bin/env bash
    if [ "$1" = "--continue" ]; then
      # resume mode: read stdin (comment), echo back
      echo "Resuming session $3"
      cat
    else
      # start mode: print JSON session_id + sleep
      echo '{"session_id":"manual-test-uuid","type":"start"}'
    fi
    sleep 30
    ```
  - [ ] G.3.2 Set env: `OMNI_AGENT_CLAUDE_BIN=/tmp/mock-claude.sh`. Chạy backend + frontend.
  - [ ] G.3.3 Tạo project + task, assign claude, click Start Session → task → Running.
  - [ ] G.3.4 Kill subprocess manual (Cancel button — Story 3.2) hoặc dùng SIGKILL ngoài để task transition Paused.
  - [ ] G.3.5 Click Resume Session với comment "test comment" → toast success, task lại Running.
  - [ ] G.3.6 Open `~/.omni-agent/logs/<task_id>/<latest_run_id>.log` → verify chứa "Resuming session manual-test-uuid" + "test comment" (echo từ mock).
  - [ ] G.3.7 Inspect DB (`sqlite3 ~/.omni-agent/omni-agent.db`):
    - `SELECT * FROM runs WHERE session_id = ...;` → 2 runs, run #2 có input = "test comment".
    - `SELECT * FROM comments WHERE task_id = ...;` → 1 comment, sent = 1.

- [ ] **Task G.4 — Cleanup test** (AC: All)
  - [ ] G.4.1 Sau toàn bộ test suite, không có subprocess zombie. Verify `ps aux | grep mock-` → no leftover.

---

## Dev Notes

### Architecture & patterns phải tuân theo

- **Task status machine:** tất cả transition (`Paused/Failed → Running`) chỉ trong `services/tasks.rs`. Handler/service khác KHÔNG đụng `tasks.status` trực tiếp.
- **Comment lifecycle invariant (`sent` flag):**
  - `sent = 0`: pending — user thêm qua `POST .../comments`, chưa được gửi vào agent.
  - `sent = 1`: đã được gửi vào agent stdin trong một lần resume. **KHÔNG bao giờ flip ngược.**
  - Story 3.3 chỉ flip `0 → 1` qua route resume (live comment). KHÔNG auto-flush pending comments — đó là Story 3.5a UX.
- **Subprocess ownership:** giống Story 3.1/3.2. `AppState.subprocess_map: Arc<Mutex<HashMap<TaskId, Child>>>` là single source of truth. Resume insert child sau spawn + take stdout.
- **Error handling:** `thiserror` cho `AppError`, `anyhow` cho internal. Production code path KHÔNG `unwrap()`/`expect()`.
- **JSON conventions:** `camelCase` (serde `rename_all = "camelCase"`). Error envelope: `{"error":"<code>","message":"<text>"}`. Task status wire lowercase, DB PascalCase.
- **SQLite:** `BEGIN IMMEDIATE` cho mọi tx có write — pattern Story 1.x. `rows_affected()` check sau UPDATE để guard race.

### Resume flow ordering (critical)

```
┌─ POST /api/.../sessions/resume ──────────────────────────┐
│                                                            │
│  1. Validate body (comment empty-check nếu provided)      │
│  2. Load task → verify status ∈ {Paused, Failed}          │
│  3. Load session → verify session_id NOT NULL             │
│  4. Check subprocess_map collision (defensive)            │
│  5. Build resume Command via AgentStrategy                │
│  6. SPAWN subprocess (Command.spawn()) ─────┐             │
│     ↳ Error → return early (AC-10 rollback) │             │
│  7. Pipe stdin (best-effort, warn-on-fail)  │             │
│  8. Take stdout                              │             │
│                                              ▼             │
│  9. BEGIN IMMEDIATE tx ────────────────────────────────┐  │
│  10. SELECT MAX(run_number) + 1                        │  │
│  11. Insert comment (if any, sent=1)                   │  │
│  12. Insert run (input = comment OR "retry")           │  │
│  13. UPDATE sessions → running                         │  │
│  14. UPDATE tasks → Running (services/tasks tx fn)     │  │
│     ↳ Error → kill child, rollback (tx drops)          │  │
│  15. COMMIT ───────────────────────────────────────────┘  │
│     ↳ Error → kill child, return 500                       │
│                                                            │
│  16. INSERT child vào subprocess_map                       │
│  17. SPAWN background streaming task (stdout → log)        │
│  18. Response 200 OK                                       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Key invariant:** spawn TRƯỚC tx commit. Nếu spawn fail → KHÔNG có DB write. Nếu DB tx fail sau spawn → kill subprocess. **Không có state nửa-nửa.**

### Per-agent resume contract (chi tiết)

| Agent  | Program (env override)               | Args                                       | Stdin                  |
|--------|--------------------------------------|--------------------------------------------|------------------------|
| claude | `claude` (`OMNI_AGENT_CLAUDE_BIN`)   | `--continue --session-id <uuid>`           | comment + `\n` (if any)|
| codex  | `codex` (`OMNI_AGENT_CODEX_BIN`)     | `resume <uuid>`                            | comment + `\n` (if any)|

**Common stdio:**
- `.stdin(Stdio::piped())` if comment, else `.stdin(Stdio::null())`.
- `.stdout(Stdio::piped())`.
- `.stderr(...)` — match Story 3.1 pattern (merge to stdout hoặc piped separate).
- `.kill_on_drop(true)`.
- `.current_dir(<backend cwd>)`.

**KHÔNG dùng:**
- API HTTP đến anthropic.com / openai.com (project-context.md: "Gọi Codex/Claude qua API" là hard NO).
- Background polling cho session ID (resume reuse session ID đã capture từ start).

### Comment model conversion (DB ↔ wire)

DB `comments.sent` là `INTEGER` (`0`/`1`). Wire JSON `sent` là `boolean`. Custom `impl Serialize for Comment` chuyển `i64 → bool` (xem A.1.1). **KHÔNG dùng derive `Serialize`** trên struct trực tiếp — sẽ leak integer ra wire.

Alternative: dùng newtype `pub struct CommentRow { ... sent: i64 }` cho DB, `pub struct CommentDto { ... sent: bool }` cho wire, convert qua `From`. Cả 2 pattern OK — chọn impl Serialize ngắn hơn.

### Run number atomic computation

```rust
let next_run_number: i64 = sqlx::query_scalar(
    "SELECT COALESCE(MAX(run_number), 0) + 1 FROM runs WHERE session_id = ?",
)
.bind(&session_pk)
.fetch_one(&mut *tx)
.await?;
```

Trong `BEGIN IMMEDIATE` tx, SQLite write-lock đã acquired → SELECT này thấy committed state + tx-local state, không race với concurrent INSERT từ tx khác.

### Edge cases và xử lý

| Case | Behavior | AC |
|------|----------|----|
| Body Content-Length: 0 (empty) | Treat as no comment → "retry" | AC-2 |
| Body `{}` | No comment → "retry" | AC-2 |
| Body `{"comment": null}` | No comment → "retry" | AC-2 |
| Body `{"comment": ""}` | 400 empty_comment | AC-2 edge |
| Body `{"comment": "   "}` | 400 empty_comment | AC-2 edge |
| Task Running | 409 session_already_active | AC-4 |
| Task Done/Cancelled | 400 task_not_resumable | AC-5 |
| Task Draft/Ready/Assigned/NeedsReview/ChangesRequested | 400 task_not_resumable | AC-5 |
| Session session_id NULL | 409 session_id_missing | AC-8 |
| Agent binary missing | 400 agent_not_found, DB không đổi | AC-10 |
| Task không tồn tại | 404 task_not_found | AC-5 edge |
| Concurrent resume (2 requests cùng task) | 1 thành công, 1 nhận 409 | AC-9 |
| Pending comments tồn tại trước resume | KHÔNG flush — vẫn pending sau resume | AC-7 |
| Comment có whitespace ngoài rìa | Giữ nguyên trong DB, trim chỉ để empty-check | AC-6 |

### State machine: Task statuses Story 3.3 cares about

| DB value | Wire (lowercase) | Story 3.3 action on POST /sessions/resume |
|---|---|---|
| `Draft` | `draft` | 400 `task_not_resumable` |
| `Ready` | `ready` | 400 `task_not_resumable` |
| `Assigned` | `assigned` | 400 `task_not_resumable` |
| `Running` | `running` | 409 `session_already_active` |
| `Paused` | `paused` | **Happy path** → `Running` |
| `Failed` | `failed` | **Happy path** → `Running` |
| `NeedsReview` | `needs-review` | 400 `task_not_resumable` |
| `ChangesRequested` | `changes-requested` | 400 `task_not_resumable` |
| `Done` | `done` | 400 `task_not_resumable` |
| `Cancelled` | `cancelled` | 400 `task_not_resumable` |

### File locations (UPDATE vs NEW)

| File | Action | Notes |
|------|--------|-------|
| `backend/src/main.rs` | UPDATE | Thêm 2 routes mới (resume + comments) |
| `backend/src/services/sessions.rs` | UPDATE (from 3.1/3.2) | Add `resume_session` |
| `backend/src/services/tasks.rs` | UPDATE | Add `transition_to_running_in_tx` |
| `backend/src/services/comments.rs` | NEW | `validate_content_non_empty`, `create_comment`, `insert_comment_in_tx` |
| `backend/src/services/mod.rs` | UPDATE | Add `pub mod comments;` |
| `backend/src/handlers/sessions.rs` | UPDATE (from 3.1/3.2) | Add `resume_session` handler |
| `backend/src/handlers/comments.rs` | NEW | `add_comment` handler |
| `backend/src/handlers/mod.rs` | UPDATE | Add `pub mod comments;` |
| `backend/src/models/comment.rs` | NEW | `Comment`, `CreateCommentRequest` |
| `backend/src/models/mod.rs` | UPDATE | Add `pub mod comment;` |
| `backend/src/agent/claude.rs` | UPDATE (from 3.1) | Verify `resume_command` matches AC-3 contract |
| `backend/src/agent/codex.rs` | UPDATE (from 3.1) | Verify `resume_command` matches AC-3 contract |
| `backend/tests/sessions_test.rs` | UPDATE (from 3.1/3.2) | Add ~14 resume tests |
| `backend/tests/comments_test.rs` | NEW | 3 comments tests (E.13–E.15) OR put trong sessions_test.rs |
| `frontend/src/api/sessions.ts` | UPDATE (from 3.1) | Add `resumeSession` |
| `frontend/src/api/comments.ts` | NEW | `addComment`, `Comment` interface |
| `frontend/src/hooks/useSessionMutation.ts` | UPDATE (from 3.1) | Add `useResumeSession` |
| `frontend/src/features/detail/TaskDetailPanel.tsx` | UPDATE (from 3.1) | Wire Resume button + textarea cho status `paused`/`failed` |
| `frontend/src/features/detail/TaskDetailPanel.test.tsx` | UPDATE (from 3.1) | Add resume tests |

### Previous Story Intelligence (Story 3.1 + 3.2)

**Từ Story 3.1:**
- `AgentStrategy` trait đã có `resume_command(&self, session_id: &str, comment: Option<&str>) -> Command` — Story 3.1 stub, Story 3.3 first real use.
- `subprocess_map` key = `task_id: String`, value = `Child`.
- Pattern take stdout TRƯỚC khi insert child vào map → child trong map KHÔNG có stdout.
- `services/tasks.rs` dùng `BEGIN IMMEDIATE` + `rows_affected()` check.
- Session PK = UUID nội bộ (`sessions.id`), khác CLI session ID (`sessions.session_id`).
- Run ID = UUID. Log path `~/.omni-agent/logs/{task_id}/{run_id}.log`.
- Mock binary = shell script trong `backend/tests/fixtures/`. Tests dùng `serial_test::serial` cho env-var isolation.
- `kill_on_drop(true)` safety net.

**Từ Story 3.2:**
- Background monitor task tự động detect subprocess exit và update status (`Running → Paused/Failed`). Story 3.3 KHÔNG cần spawn monitor mới — chỉ spawn streaming task (stdout → log) reuse helper, monitor đã chạy permanently.
- `services/tasks::transition_to_paused` / `transition_to_failed` accepts `&SqlitePool` (pool-based). Story 3.3's `transition_to_running_in_tx` differs: accepts `&mut Transaction` (tx-based) vì resume cần atomic 4-write tx.
- Exit code conventions: `0 → Paused`, `≠0 → Failed`, `-1 → Cancelled` (force-kill), `-2 → Graceful shutdown kill`. Story 3.3 KHÔNG đặt exit_code lúc resume — exit code chỉ set khi run kết thúc (Story 3.2 monitor).
- Race condition: nếu user resume trong khi background monitor đang process exit → BEGIN IMMEDIATE lock đảm bảo chỉ 1 winner. Loser nhận `Conflict` (`task_status_changed` từ `transition_to_running_in_tx`).

### Cache invalidation (frontend)

Story 2.3 dùng key `["tasks", projectId]` cho Task Board (5s polling khi có Running).
Story 3.1 thêm `useStartSession` invalidate cùng key.
Story 3.3 `useResumeSession` cũng invalidate cùng key.

Per-task query (`["task", projectId, taskId]`) chưa tồn tại trong Story 2.x/3.1 — Story 3.5a sẽ giới thiệu. Story 3.3 invalidate key này preemptive (no-op nếu không có cache).

### Dependencies (Cargo.toml)

Story 3.3 KHÔNG cần thêm crate mới. Tất cả từ Story 3.1/3.2:
- `tokio` (process, io, fs, sync)
- `sqlx` (sqlite, runtime-tokio)
- `chrono`
- `uuid`
- `serde`, `serde_json`
- `anyhow`, `thiserror`
- `tracing`

### Frontend deps (package.json)

Story 3.3 KHÔNG cần thêm npm dep mới. Reuse từ Story 2.x/3.1:
- `@tanstack/react-query`
- `react-router-dom`

### Test discipline

- **Integration tests env-var:** dùng `serial_test::serial` (đã có từ Story 3.1) cho tests set `OMNI_AGENT_CLAUDE_BIN` / `OMNI_AGENT_CODEX_BIN`.
- **HOME env isolation:** mỗi test override `HOME` thành tmp dir (giống Story 3.1) để log files không leak.
- **Subprocess cleanup:** mỗi test phải explicitly kill subprocess via `state.subprocess_map.lock().await.remove(&task_id).map(|mut c| c.start_kill())` ở cuối, hoặc rely on `kill_on_drop(true)` khi Child drop. Verify với `ps aux` không có zombie.
- **Race tests (AC-9 concurrent resume):** dùng `tokio::join!` để fire 2 resume requests cùng lúc, verify 1 thành công + 1 nhận 409. Có thể flake nếu timing — chấp nhận retry 1-2 lần.

### Out-of-scope reminders

| Item | Defer story |
|---|---|
| Summary Tab live status feed | 3.5a |
| Optimistic UI status update (running ngay khi click) | 3.5a |
| Manual session ID input modal (cho session_id missing case) | 3.5a |
| Comments Tab UI (thread + pending) | 3.5b |
| Auto-flush pending comments khi resume no-comment | 3.5a (UX decision) |
| Comment edit / delete | future story (không có trong epic) |
| Run log tail save (Run.log_tail) on exit | 3.4 (Story 3.2 đã placeholder, 3.4 finalize) |
| Mark Done button wiring | future story |
| Multi-comment per resume (batch) | future story |

### Project Structure Notes

- Alignment: khớp hoàn toàn architecture directory structure. `services/comments.rs`, `handlers/comments.rs`, `models/comment.rs` đều là files MỚI nhưng đã planned trong architecture §"Project Structure" (dòng 502, 508).
- `frontend/src/api/comments.ts` cũng đã planned (architecture dòng 438).
- KHÔNG tạo module ngoài architecture's directory tree.
- KHÔNG cần migration mới — bảng `comments` đã tồn tại trong `1_init.sql`.

---

## References

- Epics: `_bmad-output/planning-artifacts/epics.md` §"Epic 3" Story 3.3 (dòng 612–650)
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
  - §"API & Communication Patterns" (route `/sessions/resume`, `/comments`)
  - §"Architectural Boundaries" (AgentStrategy + subprocess_map invariants)
  - §"Gap 1 — DB Schema" (sessions + runs + comments tables)
  - §"Cross-Cutting Concerns" (per-agent resume abstraction, comment "sent" tracking)
- PRD / FR: epics §"Functional Requirements" FR-7 (Resume), FR-9 (Comment as input), FR-10 (Comment lifecycle)
- Project context: `_bmad-output/project-context.md`
  - §"Critical Don't-Miss Rules" — "Tạo session mới khi Resume" là hard NO
  - §"Business logic quan trọng" — comment "sent" tracking
  - §"Development Workflow Rules" — Claude/Codex resume command format
  - §"Edge cases phải xử lý" — resume không có comment → "retry"
- UX design: `_bmad-output/planning-artifacts/ux-design-specification.md`
  - §5.3 Action Bar (Resume Session button per status)
  - §"Tab: Comments" (thread-style, sent badge — defer 3.5b)
- Previous stories:
  - `_bmad-output/implementation-artifacts/3-1-agentstrategy-trait-and-start-session.md` — AgentStrategy trait, subprocess_map, background streaming, mock binary, test patterns
  - `_bmad-output/implementation-artifacts/3-2-session-exit-detection-and-graceful-shutdown.md` — exit monitor, services/tasks transitions, exit code conventions, cancel flow
- Existing code (READ before editing):
  - `backend/src/main.rs` — route mounting pattern
  - `backend/src/state.rs` — `AppState.subprocess_map` definition
  - `backend/src/services/tasks.rs` — `BEGIN IMMEDIATE`, `rows_affected()` patterns, existing transitions
  - `backend/src/services/sessions.rs` (from 3.1+3.2) — session lifecycle helpers
  - `backend/src/handlers/sessions.rs` (from 3.1+3.2) — `start_session`, `cancel_session` patterns
  - `backend/src/agent/{claude,codex}.rs` (from 3.1) — strategy stubs cho `resume_command`
  - `backend/src/db/migrations/1_init.sql` — `comments` table schema
  - `backend/tests/fixtures/mock-agent.sh` (from 3.1) — mock binary pattern
  - `frontend/src/api/sessions.ts` (from 3.1) — `startSession` pattern
  - `frontend/src/hooks/useSessionMutation.ts` (from 3.1) — `useStartSession` pattern
  - `frontend/src/features/detail/TaskDetailPanel.tsx` (from 3.1) — ActionBar wiring pattern

---

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
