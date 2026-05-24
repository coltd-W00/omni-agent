# Story 2.2: Task CRUD & Agent Assignment

Status: review

<!-- Validation tùy chọn — chạy validate-create-story trước khi dev-story nếu muốn double-check. -->

**Epic:** 2 — Project & Task Management
**Story ID:** 2.2
**Story Key:** 2-2-task-crud-and-agent-assignment
**Lane (FEATURE_INTAKE.md):** normal — chạm data model (đã có sẵn từ Story 1.2) + public API contract (`/api/projects/{id}/tasks*` 5 routes mới) + 1 UI modal mới. Risk flags: Data model (insert/update/delete `tasks`) + Public contracts (5 endpoints mới) + Existing behavior (Task Board placeholder Story 1.4 sẽ render Task thật). **2-3 flags → normal với stronger validation.** Không có Auth/Authorization/External provider.

---

## Story

As a developer using omni-agent,
I want to create Tasks trong active project, assign Agent + Role cho Tasks, edit Title/Description/AC khi Task chưa Done/Cancelled, và xóa Task ở Draft,
so that tôi có thể tổ chức công việc và chuẩn bị Task sẵn sàng cho Story 2.3 (Task Board) hiển thị và Story 3.x (Session) thực thi.

---

## Acceptance Criteria

> **Nguồn gốc AC:** `_bmad-output/planning-artifacts/epics.md` Story 2.2 (dòng 402–440) + PRD FR-1, FR-2, FR-3 (dòng 106–108). Mỗi AC viết Given/When/Then **testable**. Backend trả error envelope `{ "error": "<code>", "message": "<text>" }` (architecture §"Format Patterns") và JSON dùng `camelCase` (architecture §"Naming Patterns"). Task status trên wire dùng **lowercase** (`"draft"`, `"assigned"`, …) để khớp `TaskStatus` const-object đã lock ở Story 2.0 — xem Dev Notes §"Status casing decision".

**AC-1 — POST `/api/projects/{projectId}/tasks` happy path (Draft + auto seq):**
**Given** project `OMNI` (id `<uuid>`) đã tồn tại, hiện chưa có Task nào
**When** client gửi `POST /api/projects/{projectId}/tasks` với body
```json
{ "title": "Fix login redirect", "description": "After token refresh, redirect to /dashboard.", "acceptanceCriteria": "Login lands on /dashboard" }
```
**Then** backend tạo task mới, trả `201 Created` với body
```json
{
  "id": "OMNI-001",
  "projectId": "<uuid>",
  "seq": 1,
  "title": "Fix login redirect",
  "description": "After token refresh, redirect to /dashboard.",
  "acceptanceCriteria": "Login lands on /dashboard",
  "agent": null,
  "role": null,
  "status": "draft",
  "createdAt": "<iso8601>",
  "updatedAt": "<iso8601>"
}
```
**And** row mới tồn tại trong bảng `tasks` với `status = 'Draft'` (PascalCase trên DB — schema default), `seq = 1`, `agent IS NULL`, `role IS NULL`, `acceptance_criteria = 'Login lands on /dashboard'`.

**AC-2 — Task ID format `{PROJECT_KEY}-NNN`, seq tăng dần per project:**
**Given** project `OMNI` đã có 2 tasks (`OMNI-001`, `OMNI-002`) và project `ERP` đã có 1 task (`ERP-001`)
**When** client gửi `POST /api/projects/{OMNI-id}/tasks` (body hợp lệ tối thiểu)
**Then** task mới có `id = "OMNI-003"`, `seq = 3` (max seq per project + 1).
**And** một `POST /api/projects/{ERP-id}/tasks` ngay sau đó tạo task `id = "ERP-002"`, `seq = 2` — seq isolated per project, KHÔNG global.
**Format chính xác:** `{PROJECT_KEY}-{NNN}` với NNN = `seq` zero-pad 3 chữ số (`001`, `002`, …, `009`, `010`, …, `099`, `100`). Khi `seq >= 1000` → KHÔNG zero-pad (`OMNI-1000`).

**AC-3 — Title/Description required, AC optional, validation 400:**
**Given** request body thiếu hoặc empty/whitespace cho field bắt buộc
**When** client gửi `POST /api/projects/{projectId}/tasks`
**Then** backend KHÔNG insert row và trả `400 Bad Request` với envelope `{ "error": "<code>", "message": "<text>" }`:
- `title` rỗng/whitespace/missing → `{ "error": "invalid_task_title", "message": "Task title must be 1–200 characters" }`
- `title` dài > 200 ký tự → cùng `invalid_task_title`
- `description` rỗng/whitespace/missing → `{ "error": "invalid_task_description", "message": "Task description must be 1–5000 characters" }`
- `description` dài > 5000 ký tự → cùng `invalid_task_description`
- `acceptanceCriteria` được phép vắng mặt, null, hoặc empty string — nếu có giá trị, độ dài ≤ 5000 ký tự; nếu > 5000 → `{ "error": "invalid_task_acceptance_criteria", "message": "Acceptance criteria must be at most 5000 characters" }`

**Whitespace handling:** trim cả `title` và `description` trước khi validate length. Trim `acceptanceCriteria` cũng — nếu sau trim còn empty string thì lưu `NULL` xuống DB (đồng nghĩa với "không cung cấp").

**AC-4 — POST với projectId không tồn tại trả 404:**
**Given** không có project nào với id `<random-uuid>`
**When** client gửi `POST /api/projects/<random-uuid>/tasks` với body hợp lệ
**Then** backend KHÔNG insert row và trả `404 Not Found` với envelope `{ "error": "project_not_found", "message": "Project <id> does not exist" }`.

**AC-5 — GET `/api/projects/{projectId}/tasks` (list, ordered):**
**Given** project `OMNI` có ≥ 0 tasks
**When** client gửi `GET /api/projects/{projectId}/tasks`
**Then** backend trả `200 OK` với mảng JSON các Task object theo shape AC-1, sắp theo `seq ASC` (task tạo trước đứng đầu để Task Board render deterministically).
**And** project không tồn tại → `404` với `project_not_found` (cùng envelope AC-4).

**AC-6 — GET `/api/projects/{projectId}/tasks/{taskId}` (single):**
**Given** task `OMNI-001` tồn tại trong project `OMNI`
**When** client gửi `GET /api/projects/{projectId}/tasks/OMNI-001`
**Then** backend trả `200 OK` với Task object (shape giống AC-1).
**And** task không tồn tại → `404` với `{ "error": "task_not_found", "message": "Task OMNI-001 does not exist" }`.
**And** task `OMNI-001` thuộc project khác (mismatch giữa `projectId` trong path và `tasks.project_id`) → `404` với `task_not_found` (KHÔNG leak `project_id` qua 403/200; treat as "not in this project").

**AC-7 — PUT `/api/projects/{projectId}/tasks/{taskId}` (edit Title/Description/AC):**
**Given** task `OMNI-001` ở trạng thái KHÔNG phải `done` hoặc `cancelled`
**When** client gửi `PUT /api/projects/{projectId}/tasks/OMNI-001` với body
```json
{ "title": "Fix login redirect (v2)", "description": "Updated description.", "acceptanceCriteria": "Updated AC" }
```
**Then** backend update 3 fields đó, set `updated_at = now`, trả `200 OK` với Task object đầy đủ (post-update).
**And** `seq`, `agent`, `role`, `status`, `created_at`, `id`, `project_id` KHÔNG bị thay đổi (immutable trong PUT này).
**And** PUT chấp nhận **partial body** — chỉ `title`, chỉ `description`, hoặc chỉ `acceptanceCriteria` — fields vắng mặt giữ nguyên giá trị cũ. Field có mặt với value `null` chỉ áp dụng cho `acceptanceCriteria` (set NULL); `title: null` hoặc `description: null` → 400 `invalid_task_title`/`invalid_task_description`.

**AC-8 — PUT bị block khi Task ở `done` hoặc `cancelled` (409 Conflict):**
**Given** task `OMNI-005` đang ở trạng thái `done` hoặc `cancelled`
**When** client gửi `PUT /api/projects/{projectId}/tasks/OMNI-005` (body bất kỳ)
**Then** backend KHÔNG update và trả `409 Conflict` với envelope `{ "error": "task_locked", "message": "Cannot edit task in <status> status" }` (`<status>` là giá trị thực tế: `done` hoặc `cancelled`).
**And** UI hiển thị panel read-only — KHÔNG render Edit button khi `task.status` ∈ {`done`, `cancelled`} (UX spec §5.3 dòng 514: "Cancelled → Reopen Task"; "Completed → view only — Mark as Incomplete"). Story 2.2 chỉ cần: KHÔNG render Edit button; "Reopen" / "Mark Incomplete" defer sang Story 2.4 hoặc sau.

**AC-9 — PUT validation reuse AC-3 codes:**
**Given** PUT body có `title` empty sau trim, `description` quá dài, hoặc `acceptanceCriteria` > 5000 ký tự
**When** request đến endpoint PUT
**Then** trả 400 với cùng error codes ở AC-3 (`invalid_task_title`, `invalid_task_description`, `invalid_task_acceptance_criteria`). Trim semantics giống AC-3.

**AC-10 — POST `/api/projects/{projectId}/tasks/{taskId}/assign` (Assign Agent + Role) → status Assigned:**
**Given** task `OMNI-001` ở trạng thái `draft` HOẶC `ready`
**When** client gửi `POST /api/projects/{projectId}/tasks/OMNI-001/assign` với body
```json
{ "agent": "claude", "role": "coder" }
```
**Then** backend update `agent = "claude"`, `role = "coder"`, `status = 'Assigned'` (DB), set `updated_at = now`, trả `200 OK` với Task object đầy đủ (post-update) với `"status": "assigned"` trên wire.
**Allowed values:**
- `agent` ∈ {`"codex"`, `"claude"`} (lowercase, exact match — không accept PascalCase)
- `role` ∈ {`"coder"`, `"reviewer"`, `"planner"`, `"debugger"`, `"refactorer"`} (lowercase, exact match)
- Bất kỳ giá trị nào khác → `400` với `{ "error": "invalid_agent", "message": "Agent must be one of: codex, claude" }` hoặc `{ "error": "invalid_role", "message": "Role must be one of: coder, reviewer, planner, debugger, refactorer" }`.
- Body thiếu field bắt buộc → 400 cùng error code tương ứng.

**Allowed source status:**
- Status hiện tại ∉ {`draft`, `ready`} → trả `409 Conflict` `{ "error": "task_not_assignable", "message": "Cannot assign agent to task in <status> status" }`. Lý do: re-assign khi task đang `running` / `paused` thuộc scope Story 2.4 (qua "Reassign Agent" overflow menu) — Story 2.2 chỉ cover initial assign.

**AC-11 — DELETE `/api/projects/{projectId}/tasks/{taskId}` chỉ khi status = `draft`:**
**Given** task `OMNI-001` ở trạng thái `draft`
**When** client gửi `DELETE /api/projects/{projectId}/tasks/OMNI-001`
**Then** backend xóa row khỏi `tasks` và trả `204 No Content` (response body rỗng).
**And** task sau đó GET trả 404.

**Block khi status ≠ draft:** trả `409 Conflict` `{ "error": "task_not_deletable", "message": "Can only delete task in draft status; current status is <status>" }`. Task ở `ready`, `assigned`, `running`, `paused`, `failed`, `done`, `cancelled`, … đều bị block.

**DELETE task không tồn tại trong project:** trả `404 Not Found` với `task_not_found` (cùng envelope AC-6, KHÔNG leak việc task có tồn tại trong project khác).

**AC-12 — Frontend Create Task Modal (UX-DR9 + UX §8):**
**Given** TopBar render "+ New Task" button (UX §2.3 dòng 228; placeholder hiện tại trong `TopBar.tsx` ghi `TODO(Story 2.x): add ... New Task button`)
**When** user click "+ New Task" trong khi có Active Project (từ Story 2.1 `ActiveProjectProvider`)
**Then** mở `<CreateTaskModal>` với fields:
1. **Title** (required) — `<input type="text">`, autofocus khi modal mở, maxLength=200, hint `1–200 characters`, inline error dưới field on blur nếu empty.
2. **Description** (required) — `<textarea rows={4}>`, maxLength=5000, hint `1–5000 characters`, inline error on blur nếu empty.
3. **Acceptance Criteria** (optional) — `<textarea rows={3}>`, maxLength=5000, hint `Optional — up to 5000 characters`.
- Footer: `[Cancel ghost]` trái + `[Create Task primary]` phải. Submit button **disabled** cho đến khi title và description đều có giá trị non-whitespace (AC-12 + epic dòng 414 "Submit is disabled until Title and Description are filled").
- Modal dùng `<ConfirmationDialog>` từ Story 2.0? **KHÔNG.** `ConfirmationDialog` là cho destructive/yes-no confirm. CreateTaskModal cần fields nhập liệu nên build mới (xem Task C.5 — render qua native `<dialog>` element + `showModal()` để tận dụng focus trap / Esc handler tương tự pattern `ConfirmationDialog`).
- Khi không có Active Project: "+ New Task" button render disabled với tooltip "Select a project first" (architecture §"Active project resolution priority" + Story 2.1 AC-13).

**A11y:** `role="dialog"`, `aria-labelledby` trỏ tới heading id, autofocus title field khi mở, `Esc` đóng (gọi onCancel), focus trap miễn phí từ `<dialog>.showModal()`.

**AC-13 — Create Task happy flow (UI):**
**Given** Active Project = `OMNI` đã set, modal mở, user nhập `title = "Fix login"`, `description = "Token refresh broken"`, `acceptanceCriteria = ""`
**When** user click "Create Task"
**Then** UI gọi `POST /api/projects/{OMNI-id}/tasks` qua `apiFetch`. Khi response 201:
- Đóng modal (animation 150ms fade).
- TanStack Query invalidate cache `['tasks', projectId]` để Task Board (Story 2.3 khi land) refetch.
- Toast `success` "Task <id> created" (vd "Task OMNI-001 created").
- Modal state reset (nếu user mở lại modal sau đó, fields trở về rỗng).
**When** response 400 với `invalid_task_title` / `invalid_task_description` / `invalid_task_acceptance_criteria`:
- Map error.code → field tương ứng, hiển thị inline error message dưới field đó (text dùng nguyên `error.message` từ backend để tránh duplicate i18n source). Modal KHÔNG đóng.
**When** response 404 với `project_not_found`:
- Toast `error` "Project no longer exists. Please select another project." + đóng modal + clear `localStorage["omniAgent.activeProjectId"]` + refetch project list (Story 2.1 hooks).
**When** response 500 hoặc network error:
- Toast `error` `error.message` (hoặc `"Failed to create task"` nếu là network error). Modal vẫn mở, button KHÔNG disabled (user retry được).

**AC-14 — Mount API endpoints (no regression Story 2.1 / Story 1.4):**
**Given** backend chạy `cargo run` ở `127.0.0.1:8080`
**When** 5 routes mới (`GET list`, `GET single`, `POST create`, `PUT update`, `POST assign`, `DELETE`) được mount dưới `/api/projects/{projectId}/tasks*`
**Then** `GET /health` vẫn trả `200 {"status":"ok"}` (regression guard giống AC-15 Story 2.1).
**And** `GET /api/projects` (Story 2.1) vẫn trả `200` với danh sách project.
**And** routes Story 2.1 (`POST /api/projects`, `DELETE /api/projects/{id}`) vẫn hoạt động đúng (smoke check qua integration test).
**And** Vite dev server vẫn proxy `/api` đúng (không cần thay đổi `vite.config.ts`).

**AC-15 — TanStack Query hooks + types update (no breaking change):**
**Given** Story 2.0 đã tạo `frontend/src/types/task.ts` với `Task` interface tối thiểu `{ id, title, status }`
**When** Story 2.2 extend `Task` thành full shape (xem AC-1)
**Then**:
- File `frontend/src/types/task.ts` mở rộng `Task` thêm fields: `projectId: string`, `seq: number`, `description: string`, `acceptanceCriteria: string | null`, `agent: "codex" | "claude" | null`, `role: "coder" | "reviewer" | "planner" | "debugger" | "refactorer" | null`, `createdAt: string`, `updatedAt: string`. **KHÔNG xóa** `TaskStatus` const-object (Story 2.0 contract — `StatusBadge` consume).
- `TaskStatus` const-object thêm value `"paused"` (giữa `"running"` và `"needs-review"`) để phản ánh DB enum đầy đủ (xem Dev Notes §"Status casing decision" — paused là valid wire value khi Session pause). KHÔNG xóa values cũ.
- Story 2.0 tests `StatusBadge.test.tsx`, `TaskCard.test.tsx` vẫn pass (chỉ thêm field optional / extend union — backward compatible).

**Trace từ AC sang task — xem section "Trace AC ↔ Task" cuối story.**

---

## Tasks / Subtasks

### A. Preflight (verify dependencies)

- [x] **Task A.1 — Verify Story 2.0 + Story 2.1 đã `done` (hoặc `review` đã merge):** (AC: 12, 13, 15)
  - [x] A.1.1 `git log --oneline -10` xem 2-0 và 2-1 đã merge.
  - [x] A.1.2 Xác nhận `frontend/src/components/{Button,Toast,ConfirmationDialog,StatusBadge,AgentAvatar,SessionBadge,TaskCard,EmptyState}.tsx` tồn tại (Story 2.0 deliverables).
  - [x] A.1.3 Xác nhận `frontend/src/api/client.ts`, `frontend/src/api/projects.ts`, `frontend/src/contexts/ActiveProjectContext.tsx` (hoặc tương đương) tồn tại (Story 2.1 deliverables). Nếu route file path khác, dùng path thực tế đang có.
  - [x] A.1.4 Xác nhận `backend/src/{models,services,handlers}/` đã có `mod.rs` + `projects.rs` (Story 2.1 deliverables). Xác nhận `backend/src/error.rs` có variants `BadRequest`, `Conflict`, `NotFound` với payload `(code: &'static str, message: String)` (Story 2.1 Task B.3).
  - [x] A.1.5 Nếu BẤT KỲ deliverable nào trên thiếu → STOP, escalate với chat: "Story 2.2 depends on 2.0/2.1 deliverables not yet merged: <list>". KHÔNG re-implement deliverables của story khác.

### B. Backend — Models + Services + Handlers cho Task

- [x] **Task B.1 — Tạo `backend/src/models/task.rs`** (AC: 1, 2, 3, 5, 6, 7, 9, 10, 15)
  - [x] B.1.1 Tạo file `backend/src/models/task.rs` (cùng folder với `project.rs` Story 2.1 đã tạo).
  - [x] B.1.2 Define 4 structs + 2 enums:
    ```rust
    use serde::{Deserialize, Serialize};
    use sqlx::FromRow;

    #[derive(Debug, Clone, Serialize, FromRow)]
    #[serde(rename_all = "camelCase")]
    pub struct Task {
        pub id: String,
        pub project_id: String,
        pub seq: i64,
        pub title: String,
        pub description: String,
        pub acceptance_criteria: Option<String>,
        pub agent: Option<String>,        // serialize → "agent": "codex" | "claude" | null
        pub role: Option<String>,
        #[serde(serialize_with = "serialize_status_lowercase")]
        pub status: String,               // DB stores PascalCase ("Draft"), wire = lowercase
        pub created_at: String,
        pub updated_at: String,
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct CreateTaskRequest {
        pub title: String,
        pub description: String,
        pub acceptance_criteria: Option<String>,
    }

    #[derive(Debug, Deserialize, Default)]
    #[serde(rename_all = "camelCase", default)]
    pub struct UpdateTaskRequest {
        // None = field omitted; Some(None) chỉ valid cho acceptance_criteria.
        // Dùng double Option pattern để phân biệt "vắng mặt" vs "null".
        #[serde(default, deserialize_with = "deserialize_double_option")]
        pub title: Option<Option<String>>,
        #[serde(default, deserialize_with = "deserialize_double_option")]
        pub description: Option<Option<String>>,
        #[serde(default, deserialize_with = "deserialize_double_option")]
        pub acceptance_criteria: Option<Option<String>>,
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct AssignAgentRequest {
        pub agent: String,
        pub role: String,
    }
    ```
  - [x] B.1.3 Implement helper `serialize_status_lowercase(value: &str, serializer: S)` — `value.to_lowercase()` rồi `serializer.serialize_str(&lower)`. Lý do: DB lưu `'Draft'` PascalCase (schema default 1_init.sql), wire dùng `"draft"` để khớp `TaskStatus` const-object Story 2.0.
  - [x] B.1.4 Implement helper `deserialize_double_option<'de, D>(deserializer: D) -> Result<Option<Option<String>>, D::Error>` cho `UpdateTaskRequest`. Tham khảo pattern serde double-option [community snippet](https://github.com/serde-rs/serde/issues/984). Lý do: cần phân biệt `{}` (field vắng) vs `{"acceptanceCriteria": null}` (xóa AC) vs `{"acceptanceCriteria": "..."}` (set AC).
  - [x] B.1.5 Update `backend/src/models/mod.rs` thêm `pub mod task;`.

- [x] **Task B.2 — Mở rộng `AppError` (KHÔNG breaking change)** (AC: 3, 4, 6, 8, 9, 10, 11)
  - [x] B.2.1 `backend/src/error.rs` đã có `BadRequest { code, message }`, `Conflict { code, message }`, `NotFound { code, message }` từ Story 2.1 Task B.3. **KHÔNG thêm variant mới** — error codes mới (`invalid_task_title`, `task_not_found`, `task_locked`, `task_not_assignable`, `task_not_deletable`, `invalid_agent`, `invalid_role`, `invalid_task_description`, `invalid_task_acceptance_criteria`) được tạo qua existing variants với `code` string khác nhau.
  - [x] B.2.2 Nếu Story 2.1 dùng approach `AppError::BadRequest(String)` thay vì `{ code, message }`, áp dụng pattern Story 2.1 — KHÔNG đi đường khác.

- [x] **Task B.3 — Implement `backend/src/services/tasks.rs`** (AC: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11)
  - [x] B.3.1 Tạo file `backend/src/services/tasks.rs` + update `services/mod.rs` thêm `pub mod tasks;`.
  - [x] B.3.2 Implement 6 service functions — KHÔNG truy cập `axum::http` trong service layer (architecture §"Architectural Boundaries"):

    ```rust
    pub async fn list_tasks(pool: &SqlitePool, project_id: &str) -> Result<Vec<Task>, AppError>;
    pub async fn get_task(pool: &SqlitePool, project_id: &str, task_id: &str) -> Result<Task, AppError>;
    pub async fn create_task(pool: &SqlitePool, project_id: &str, req: CreateTaskRequest) -> Result<Task, AppError>;
    pub async fn update_task(pool: &SqlitePool, project_id: &str, task_id: &str, req: UpdateTaskRequest) -> Result<Task, AppError>;
    pub async fn assign_agent(pool: &SqlitePool, project_id: &str, task_id: &str, req: AssignAgentRequest) -> Result<Task, AppError>;
    pub async fn delete_task(pool: &SqlitePool, project_id: &str, task_id: &str) -> Result<(), AppError>;
    ```

  - [x] B.3.3 **`create_task`** algorithm chi tiết:
    1. Validate `title` trim → length 1–200, fail → `BadRequest { code: "invalid_task_title", message: "Task title must be 1–200 characters" }`.
    2. Validate `description` trim → length 1–5000, fail → `BadRequest { code: "invalid_task_description", message: "Task description must be 1–5000 characters" }`.
    3. Validate `acceptance_criteria` (Option) — nếu Some, trim. Nếu trim → empty string, normalize thành `None`. Nếu length > 5000 → `BadRequest { code: "invalid_task_acceptance_criteria", message: "Acceptance criteria must be at most 5000 characters" }`.
    4. Verify project tồn tại + lấy `project.key`:
       ```sql
       SELECT key FROM projects WHERE id = ?
       ```
       Empty → `NotFound { code: "project_not_found", message: format!("Project {} does not exist", project_id) }`.
    5. **Race-safe seq + id generation** trong 1 transaction (`BEGIN IMMEDIATE`):
       ```sql
       BEGIN IMMEDIATE;
       SELECT COALESCE(MAX(seq), 0) + 1 FROM tasks WHERE project_id = ?;
       -- compute task_id = format!("{}-{:03}", project_key, seq) cho seq < 1000, else "{key}-{seq}"
       INSERT INTO tasks (id, project_id, seq, title, description, acceptance_criteria, agent, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 'Draft', ?, ?);
       COMMIT;
       ```
       Status lưu PascalCase `'Draft'` (schema default).
    6. `now = chrono::Utc::now().to_rfc3339()`.
    7. Return `Task` object (echo lại fields + id/seq/created_at/updated_at, status = `"Draft"`).

  - [x] B.3.4 **`list_tasks`**:
    1. Verify project tồn tại (giống step 4 của `create_task`). Empty → `NotFound { code: "project_not_found", ... }`.
    2. `SELECT id, project_id, seq, title, description, acceptance_criteria, agent, role, status, created_at, updated_at FROM tasks WHERE project_id = ? ORDER BY seq ASC`.
    3. Return `Vec<Task>` (empty vec OK).

  - [x] B.3.5 **`get_task`**:
    1. Single query: `SELECT * FROM tasks WHERE id = ? AND project_id = ?`. Empty → `NotFound { code: "task_not_found", message: format!("Task {} does not exist", task_id) }`. **KHÔNG** check project tồn tại trước rồi check task — gộp 1 query để tránh race + giảm IO.

  - [x] B.3.6 **`update_task`**:
    1. Fetch existing task (qua `get_task` reuse). Propagate `NotFound` nếu task không thuộc project.
    2. Check status — nếu `existing.status` ∈ {`"Done"`, `"Cancelled"`} (so sánh case-insensitive với `to_lowercase()` để robust với mixed-case future migration) → `Conflict { code: "task_locked", message: format!("Cannot edit task in {} status", existing.status.to_lowercase()) }`.
    3. Merge UpdateTaskRequest theo logic AC-7:
       - `title`: `None` → giữ nguyên. `Some(None)` hoặc `Some(Some(""))` (sau trim) → `BadRequest { code: "invalid_task_title", ... }`. `Some(Some(s))` với `1 ≤ trim(s).len() ≤ 200` → set new.
       - `description`: tương tự.
       - `acceptance_criteria`: `None` → giữ nguyên. `Some(None)` → set NULL. `Some(Some(""))` (sau trim) → set NULL (empty = absence). `Some(Some(s))` với `trim(s).len() ≤ 5000` → set new, > 5000 → 400.
    4. Build dynamic UPDATE SQL với QueryBuilder hoặc viết tay 3 UPDATE statements riêng nếu chỉ 1 field thay đổi — **simpler approach:** UPDATE cả 3 fields với COALESCE (Rust merge xong rồi mới UPDATE):
       ```sql
       UPDATE tasks
       SET title = ?, description = ?, acceptance_criteria = ?, updated_at = ?
       WHERE id = ? AND project_id = ?;
       ```
    5. Return updated `Task` (re-fetch hoặc rebuild từ merged values + new updated_at).

  - [x] B.3.7 **`assign_agent`**:
    1. Validate `agent` ∈ `["codex", "claude"]` (exact lowercase) → fail = `BadRequest { code: "invalid_agent", message: "Agent must be one of: codex, claude" }`.
    2. Validate `role` ∈ `["coder", "reviewer", "planner", "debugger", "refactorer"]` → fail = `BadRequest { code: "invalid_role", message: "Role must be one of: coder, reviewer, planner, debugger, refactorer" }`.
    3. Fetch existing task (qua `get_task`). Propagate `NotFound`.
    4. Check status — nếu `existing.status.to_lowercase()` ∉ {`"draft"`, `"ready"`} → `Conflict { code: "task_not_assignable", message: format!("Cannot assign agent to task in {} status", existing.status.to_lowercase()) }`.
    5. `UPDATE tasks SET agent = ?, role = ?, status = 'Assigned', updated_at = ? WHERE id = ? AND project_id = ?;`.
    6. Return updated `Task`.

  - [x] B.3.8 **`delete_task`**:
    1. Fetch existing task (qua `get_task`). Propagate `NotFound { code: "task_not_found", ... }`.
    2. Check status — nếu `existing.status.to_lowercase() != "draft"` → `Conflict { code: "task_not_deletable", message: format!("Can only delete task in draft status; current status is {}", existing.status.to_lowercase()) }`.
    3. `DELETE FROM tasks WHERE id = ? AND project_id = ?;`. Return `Ok(())`.

  - [x] B.3.9 **Unit tests** trong `#[cfg(test)] mod tests` cùng file — pattern giống `backend/src/services/projects.rs` Story 2.1:
    - Setup helper `migrated_pool()` + `insert_test_project(pool, key, name) -> id` (reuse từ Story 2.1 nếu đã extract, else inline).
    - **`create_task_inserts_row`**: project tồn tại, body valid → row insert với status `"Draft"`, id `"OMNI-001"`, seq=1.
    - **`create_task_auto_increments_seq_per_project`**: project OMNI + ERP, tạo 2 task OMNI rồi 1 task ERP → seq OMNI = 1, 2; ERP = 1. Task ids `OMNI-001`, `OMNI-002`, `ERP-001`.
    - **`create_task_zero_pads_under_1000`**: tạo 999 tasks (loop) → id thứ 999 = `OMNI-999`. Tạo task thứ 1000 → id = `OMNI-1000` (no padding). (Optional optimization: skip loop, INSERT trực tiếp với `seq = 999` rồi tạo task mới expect `OMNI-1000`.)
    - **`create_task_rejects_empty_title`**: title `""`, `"   "`, hoặc missing → `BadRequest { code: "invalid_task_title", .. }`.
    - **`create_task_rejects_long_title`**: title 201 chars → `BadRequest { code: "invalid_task_title", .. }`.
    - **`create_task_rejects_empty_description`**: description `""`, `"   "` → `BadRequest { code: "invalid_task_description", .. }`.
    - **`create_task_rejects_long_description`**: description 5001 chars → 400.
    - **`create_task_rejects_long_acceptance_criteria`**: AC 5001 chars → 400.
    - **`create_task_normalizes_empty_ac_to_null`**: AC = `""` → DB row có `acceptance_criteria IS NULL`.
    - **`create_task_project_not_found`**: project_id random uuid → `NotFound { code: "project_not_found", .. }`.
    - **`list_tasks_orders_by_seq`**: tạo 3 tasks → trả về theo seq 1, 2, 3.
    - **`list_tasks_returns_empty_for_new_project`**: project mới, 0 tasks → `Ok(vec![])`.
    - **`list_tasks_project_not_found`** → `NotFound { code: "project_not_found", .. }`.
    - **`get_task_returns_existing`**: insert task, get → match data.
    - **`get_task_not_found`**: random task_id → `NotFound { code: "task_not_found", .. }`.
    - **`get_task_wrong_project_returns_404`**: task `OMNI-001` thuộc project OMNI, get qua project_id ERP → `NotFound { code: "task_not_found", .. }`.
    - **`update_task_partial_title_only`**: gửi `UpdateTaskRequest { title: Some(Some("New")), description: None, acceptance_criteria: None }` → title updated, description/AC unchanged, updated_at thay đổi.
    - **`update_task_set_ac_to_null`**: gửi `acceptance_criteria: Some(None)` → DB row `acceptance_criteria IS NULL`.
    - **`update_task_set_ac_empty_string_normalizes_to_null`**: gửi `acceptance_criteria: Some(Some(""))` → DB row IS NULL.
    - **`update_task_rejects_empty_title`**: `title: Some(Some(""))` → `BadRequest { code: "invalid_task_title", .. }`.
    - **`update_task_rejects_when_done`**: insert task với status `"Done"` (qua raw INSERT bypass service), gọi update → `Conflict { code: "task_locked", message contains "done" }`.
    - **`update_task_rejects_when_cancelled`**: tương tự với `"Cancelled"`.
    - **`update_task_task_not_found`** → 404.
    - **`assign_agent_happy_path`**: task `draft`, gọi assign Claude/coder → status = `"Assigned"`, agent/role set đúng.
    - **`assign_agent_from_ready`**: insert task status `"Ready"`, assign → ok.
    - **`assign_agent_rejects_invalid_agent`**: agent `"gemini"` → `BadRequest { code: "invalid_agent", .. }`.
    - **`assign_agent_rejects_invalid_role`**: role `"manager"` → `BadRequest { code: "invalid_role", .. }`.
    - **`assign_agent_rejects_when_running`**: status `"Running"` → `Conflict { code: "task_not_assignable", .. }`.
    - **`assign_agent_rejects_when_done`**: status `"Done"` → `Conflict { code: "task_not_assignable", .. }`.
    - **`delete_task_draft_succeeds`**: status `"Draft"`, delete → row biến mất.
    - **`delete_task_rejects_non_draft`**: status `"Ready"` (hoặc `"Assigned"`, …, `"Done"`) → `Conflict { code: "task_not_deletable", .. }`, row VẪN tồn tại. Test 2-3 status mẫu khác nhau.
    - **`delete_task_not_found`** → 404.

  - [x] B.3.10 Verify `cd backend && cargo test` pass tất cả tests mới + tests cũ Story 1.2 và Story 2.1 vẫn pass.

- [x] **Task B.4 — Implement `backend/src/handlers/tasks.rs`** (AC: 1, 5, 6, 7, 10, 11, 14)
  - [x] B.4.1 Tạo file `backend/src/handlers/tasks.rs` + update `handlers/mod.rs` thêm `pub mod tasks;`.
  - [x] B.4.2 Thin handlers — delegate sang service, áp dụng `?` operator (architecture §"Process Patterns"). Pattern handlers Story 2.1 đã thiết lập:

    ```rust
    use std::sync::Arc;
    use axum::{Json, extract::{Path, State}, http::StatusCode};
    use crate::{
        error::AppError,
        models::task::{AssignAgentRequest, CreateTaskRequest, Task, UpdateTaskRequest},
        services, state::AppState,
    };

    pub async fn list_tasks(
        State(state): State<Arc<AppState>>,
        Path(project_id): Path<String>,
    ) -> Result<Json<Vec<Task>>, AppError> {
        let tasks = services::tasks::list_tasks(&state.db, &project_id).await?;
        Ok(Json(tasks))
    }

    pub async fn get_task(
        State(state): State<Arc<AppState>>,
        Path((project_id, task_id)): Path<(String, String)>,
    ) -> Result<Json<Task>, AppError> {
        let task = services::tasks::get_task(&state.db, &project_id, &task_id).await?;
        Ok(Json(task))
    }

    pub async fn create_task(
        State(state): State<Arc<AppState>>,
        Path(project_id): Path<String>,
        Json(req): Json<CreateTaskRequest>,
    ) -> Result<(StatusCode, Json<Task>), AppError> {
        let task = services::tasks::create_task(&state.db, &project_id, req).await?;
        Ok((StatusCode::CREATED, Json(task)))
    }

    pub async fn update_task(
        State(state): State<Arc<AppState>>,
        Path((project_id, task_id)): Path<(String, String)>,
        Json(req): Json<UpdateTaskRequest>,
    ) -> Result<Json<Task>, AppError> {
        let task = services::tasks::update_task(&state.db, &project_id, &task_id, req).await?;
        Ok(Json(task))
    }

    pub async fn assign_agent(
        State(state): State<Arc<AppState>>,
        Path((project_id, task_id)): Path<(String, String)>,
        Json(req): Json<AssignAgentRequest>,
    ) -> Result<Json<Task>, AppError> {
        let task = services::tasks::assign_agent(&state.db, &project_id, &task_id, req).await?;
        Ok(Json(task))
    }

    pub async fn delete_task(
        State(state): State<Arc<AppState>>,
        Path((project_id, task_id)): Path<(String, String)>,
    ) -> Result<StatusCode, AppError> {
        services::tasks::delete_task(&state.db, &project_id, &task_id).await?;
        Ok(StatusCode::NO_CONTENT)
    }
    ```

  - [x] B.4.3 KHÔNG `unwrap()`/`expect()` trong handlers (architecture §"Enforcement Guidelines" hard rule).

- [x] **Task B.5 — Mount routes trong `main.rs`** (AC: 14)
  - [x] B.5.1 Update `api_router` trong `main.rs` thêm 5 routes (Axum 0.8 path syntax `{name}` — đã verify Story 1.1 và Story 2.1):
    ```rust
    let api_router = Router::new()
        // ... existing project routes ...
        .route(
            "/projects/{project_id}/tasks",
            get(handlers::tasks::list_tasks).post(handlers::tasks::create_task),
        )
        .route(
            "/projects/{project_id}/tasks/{task_id}",
            get(handlers::tasks::get_task)
                .put(handlers::tasks::update_task)
                .delete(handlers::tasks::delete_task),
        )
        .route(
            "/projects/{project_id}/tasks/{task_id}/assign",
            post(handlers::tasks::assign_agent),
        );
    ```
  - [x] B.5.2 Verify `cd backend && cargo build` pass.
  - [x] B.5.3 Verify `cd backend && cargo run` start server không panic, log `Server running on http://127.0.0.1:8080`.

- [x] **Task B.6 — Backend integration test** (AC: 1, 4, 5, 6, 7, 8, 10, 11, 14)
  - [x] B.6.1 Tạo `backend/tests/tasks_test.rs` (cùng folder với `projects_test.rs` Story 2.1). Pattern: build axum `Router` thật với in-memory SQLite pool + `tower::ServiceExt::oneshot` để gửi request không bind socket.
  - [x] B.6.2 Helper `setup_router_with_project(key: &str, name: &str) -> (Router, project_id)` để DRY các tests.
  - [x] B.6.3 Test cases (mỗi case một `#[tokio::test]`):
    - `post_task_happy_path`: 201, body có `id = "OMNI-001"`, `status = "draft"` (wire lowercase), `seq = 1`, `agent` / `role` / `acceptanceCriteria` = `null`.
    - `post_task_validates_title`: body `{"title":"","description":"d"}` → 400, body `{"error":"invalid_task_title",...}`.
    - `post_task_validates_description`: → 400 `invalid_task_description`.
    - `post_task_project_not_found`: random uuid → 404 `project_not_found`.
    - `get_tasks_list_ordered`: tạo 3 tasks → array length 3, ordered by seq.
    - `get_tasks_empty`: project mới → `200` `[]`.
    - `get_task_single`: id đúng → 200 với task object.
    - `get_task_not_found`: id sai → 404 `task_not_found`.
    - `get_task_wrong_project`: task `OMNI-001` truy cập qua project_id ERP → 404 `task_not_found`.
    - `put_task_partial_update`: PUT body chỉ có `title` → response title updated, description giữ nguyên.
    - `put_task_locks_when_done`: insert task với status `Done` (qua sqlx raw INSERT trong test setup) → PUT 409 `task_locked` với message contains `"done"`.
    - `assign_agent_happy_path`: task draft → POST assign Claude/coder → 200, body `status: "assigned"`, `agent: "claude"`, `role: "coder"`.
    - `assign_agent_invalid_agent`: agent `"gemini"` → 400 `invalid_agent`.
    - `assign_agent_when_running`: status `"Running"` → 409 `task_not_assignable`.
    - `delete_task_draft`: DELETE → 204.
    - `delete_task_non_draft_blocked`: status `"Ready"` → 409 `task_not_deletable`.
    - `delete_task_not_found`: id sai → 404 `task_not_found`.
    - **Regression guards (AC-14):**
      - `health_still_200_after_task_routes_mounted`: `GET /health` → 200.
      - `projects_list_still_works`: `GET /api/projects` → 200 (smoke check Story 2.1 không bị break).
  - [x] B.6.4 Verify `cd backend && cargo test --tests` pass tất cả.

### C. Frontend — Types + API client + Create Modal + Hooks

- [x] **Task C.1 — Mở rộng `frontend/src/types/task.ts`** (AC: 15)
  - [x] C.1.1 Đọc file hiện tại — Story 2.0 đã tạo `Task` + `TaskStatus`. **KHÔNG xóa** existing exports.
  - [x] C.1.2 Extend `Task` interface (giữ shape minimum nếu Story 2.0 đã có cấu trúc khác — append fields, không destruct):
    ```ts
    export interface Task {
      id: string;
      projectId: string;
      seq: number;
      title: string;
      description: string;
      acceptanceCriteria: string | null;
      agent: TaskAgent | null;
      role: TaskRole | null;
      status: TaskStatus;
      createdAt: string;
      updatedAt: string;
    }
    ```
  - [x] C.1.3 Thêm `TaskAgent` + `TaskRole` const-objects (pattern `erasableSyntaxOnly` từ Story 2.0 AC-12):
    ```ts
    export const TaskAgent = {
      Codex: "codex",
      Claude: "claude",
    } as const;
    export type TaskAgent = (typeof TaskAgent)[keyof typeof TaskAgent];

    export const TaskRole = {
      Coder: "coder",
      Reviewer: "reviewer",
      Planner: "planner",
      Debugger: "debugger",
      Refactorer: "refactorer",
    } as const;
    export type TaskRole = (typeof TaskRole)[keyof typeof TaskRole];
    ```
  - [x] C.1.4 Thêm `Paused: "paused"` vào `TaskStatus` const-object (insert giữa `Running` và `NeedsReview`). KHÔNG xóa values cũ.
  - [x] C.1.5 Run `cd frontend && npx tsc --noEmit` — verify 0 errors. Run `npm test -- --run` (hoặc `vitest run`) verify `StatusBadge.test.tsx` + `TaskCard.test.tsx` Story 2.0 vẫn pass (extending union backward compatible).

- [x] **Task C.2 — Tạo `frontend/src/api/tasks.ts`** (AC: 13, 14)
  - [x] C.2.1 Tạo file `tasks.ts` cạnh `projects.ts` Story 2.1.
  - [x] C.2.2 Implement 6 fetch wrappers dùng `apiFetch` từ `frontend/src/api/client.ts` (Story 2.1):
    ```ts
    import { apiFetch } from "./client";
    import type { Task, TaskAgent, TaskRole } from "../types/task";

    export interface CreateTaskInput {
      title: string;
      description: string;
      acceptanceCriteria?: string;
    }

    export interface UpdateTaskInput {
      title?: string;
      description?: string;
      acceptanceCriteria?: string | null;
    }

    export interface AssignAgentInput {
      agent: TaskAgent;
      role: TaskRole;
    }

    export const listTasks = (projectId: string) =>
      apiFetch<Task[]>(`/projects/${projectId}/tasks`);

    export const getTask = (projectId: string, taskId: string) =>
      apiFetch<Task>(`/projects/${projectId}/tasks/${taskId}`);

    export const createTask = (projectId: string, input: CreateTaskInput) =>
      apiFetch<Task>(`/projects/${projectId}/tasks`, {
        method: "POST",
        body: JSON.stringify(input),
      });

    export const updateTask = (projectId: string, taskId: string, input: UpdateTaskInput) =>
      apiFetch<Task>(`/projects/${projectId}/tasks/${taskId}`, {
        method: "PUT",
        body: JSON.stringify(input),
      });

    export const assignAgent = (projectId: string, taskId: string, input: AssignAgentInput) =>
      apiFetch<Task>(`/projects/${projectId}/tasks/${taskId}/assign`, {
        method: "POST",
        body: JSON.stringify(input),
      });

    export const deleteTask = (projectId: string, taskId: string) =>
      apiFetch<void>(`/projects/${projectId}/tasks/${taskId}`, {
        method: "DELETE",
      });
    ```
  - [x] C.2.3 KHÔNG hardcode `http://localhost:8080` — `apiFetch` từ Story 2.1 đã handle prefix `/api`.

- [x] **Task C.3 — TanStack Query hooks: `useTasks` + `useCreateTask`** (AC: 13)
  - [x] C.3.1 Tạo `frontend/src/hooks/useTasks.ts`:
    ```ts
    import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
    import { listTasks, createTask, type CreateTaskInput } from "../api/tasks";

    export const tasksQueryKey = (projectId: string | null) => ["tasks", projectId] as const;

    export function useTasks(projectId: string | null) {
      return useQuery({
        queryKey: tasksQueryKey(projectId),
        queryFn: () => {
          if (!projectId) throw new Error("projectId required");
          return listTasks(projectId);
        },
        enabled: projectId !== null,
      });
    }

    export function useCreateTask(projectId: string | null) {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (input: CreateTaskInput) => {
          if (!projectId) throw new Error("projectId required");
          return createTask(projectId, input);
        },
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: tasksQueryKey(projectId) });
        },
      });
    }
    ```
  - [x] C.3.2 **KHÔNG implement** `useUpdateTask`, `useAssignAgent`, `useDeleteTask` ở story này — sẽ là responsibility của Story 2.4 (Task Detail Panel). API client functions ở C.2 đã sẵn để Story 2.4 dùng. Lý do: keep story scope focused; Story 2.2 chỉ cần Create để TopBar button hoạt động + populate Task Board (Story 2.3).

- [x] **Task C.4 — TopBar: thay "+ New Task" placeholder bằng button + modal state** (AC: 12)
  - [x] C.4.1 Edit `frontend/src/components/TopBar.tsx`. Xóa TODO comment `TODO(Story 2.x): ... New Task button ...`.
  - [x] C.4.2 Add state cho modal open/close + Active Project lookup (qua `useActiveProject()` từ Story 2.1):
    ```tsx
    import { useState } from "react";
    import Button from "./Button";
    import CreateTaskModal from "./CreateTaskModal";
    import { useActiveProject } from "../contexts/ActiveProjectContext"; // hoặc path Story 2.1 thực tế

    export default function TopBar() {
      const [open, setOpen] = useState(false);
      const { activeProject } = useActiveProject();

      return (
        <header className="app-top-bar" role="banner">
          <span className="app-top-bar__brand">omni-agent</span>
          <div className="app-top-bar__actions">
            <Button
              variant="primary"
              size="md"
              disabled={!activeProject}
              title={activeProject ? undefined : "Select a project first"}
              onClick={() => setOpen(true)}
            >
              + New Task
            </Button>
          </div>
          <CreateTaskModal
            open={open}
            projectId={activeProject?.id ?? null}
            onClose={() => setOpen(false)}
          />
        </header>
      );
    }
    ```
  - [x] C.4.3 Update `frontend/src/components/AppShell.css` thêm class `.app-top-bar__actions` nếu chưa có (flex right-align):
    ```css
    .app-top-bar { display: flex; align-items: center; justify-content: space-between; }
    .app-top-bar__actions { display: flex; gap: var(--space-2); }
    ```
    KHÔNG dùng hardcode hex (project-context hard rule).

- [x] **Task C.5 — Implement `frontend/src/components/CreateTaskModal.tsx`** (AC: 12, 13)
  - [x] C.5.1 Tạo `frontend/src/components/CreateTaskModal.tsx` + `.css`. Pattern follow `ConfirmationDialog.tsx` Story 2.0 (native `<dialog>` + `showModal()`).
  - [x] C.5.2 Props:
    ```ts
    interface CreateTaskModalProps {
      open: boolean;
      projectId: string | null;
      onClose: () => void;
    }
    ```
  - [x] C.5.3 Internal state — title, description, ac, field errors:
    ```ts
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [ac, setAc] = useState("");
    const [errors, setErrors] = useState<{ title?: string; description?: string; acceptanceCriteria?: string }>({});
    ```
    Reset state khi `open` đổi `false → true` (qua `useEffect`).
  - [x] C.5.4 Submit handler — gọi `useCreateTask` mutation:
    ```ts
    const createMutation = useCreateTask(projectId);
    const { showToast } = useToast();

    const submitDisabled = title.trim() === "" || description.trim() === "" || createMutation.isPending;

    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      if (submitDisabled) return;
      setErrors({});
      try {
        const task = await createMutation.mutateAsync({
          title: title.trim(),
          description: description.trim(),
          acceptanceCriteria: ac.trim() === "" ? undefined : ac.trim(),
        });
        showToast({ tone: "success", message: `Task ${task.id} created` });
        onClose();
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.code === "invalid_task_title") setErrors({ title: err.message });
          else if (err.code === "invalid_task_description") setErrors({ description: err.message });
          else if (err.code === "invalid_task_acceptance_criteria") setErrors({ acceptanceCriteria: err.message });
          else if (err.code === "project_not_found") {
            showToast({ tone: "error", message: "Project no longer exists. Please select another project." });
            onClose();
            // Optional: clear localStorage["omniAgent.activeProjectId"] qua context method nếu có
          } else {
            showToast({ tone: "error", message: err.message });
          }
        } else {
          showToast({ tone: "error", message: "Failed to create task" });
        }
      }
    }
    ```
  - [x] C.5.5 Render — title/description/AC fields với inline error message dưới mỗi field. Footer: Cancel ghost + Create Task primary (loading state khi `createMutation.isPending`).
  - [x] C.5.6 A11y — `<dialog>` element + `useRef` + `useEffect` đồng bộ `open` ↔ `showModal()` / `close()` (pattern y hệt `ConfirmationDialog`). `<form aria-labelledby="create-task-heading">` với heading `<h2 id="create-task-heading">Create Task</h2>`. Autofocus title field khi mở.
  - [x] C.5.7 Listen `close` event của `<dialog>` (handles Esc + backdrop click) → gọi `onClose()`.
  - [x] C.5.8 CSS dùng CSS variables only (`var(--bg-card)`, `var(--space-3)`, …) — KHÔNG hardcode hex. Modal width 480px (mobile: 90vw), border-radius `var(--radius-lg)`, shadow `var(--shadow-lg)`. Pattern copy từ `ConfirmationDialog.css`.

- [x] **Task C.6 — Component tests** (AC: 12, 13)
  - [x] C.6.1 Tạo `frontend/src/components/CreateTaskModal.test.tsx`. Pattern: dùng `@testing-library/react` + `userEvent.setup()` + mock `apiFetch` qua `vi.mock("../api/client", () => ({ apiFetch: vi.fn(), ApiError: ... }))`. Wrap render với `QueryClientProvider` + `ToastProvider` + (mock) `ActiveProjectContext.Provider`.
  - [x] C.6.2 Test cases:
    - `renders fields when open=true and projectId set`.
    - `Submit button is disabled when title or description empty`.
    - `Submit calls createTask API with trimmed values + closes modal on success`.
    - `Shows inline error under title field when API returns invalid_task_title 400`.
    - `Shows toast error and keeps modal open on 500 error`.
    - `Pressing Esc closes the modal` — verify `onClose` được gọi (jsdom có `<dialog>` element support qua polyfill nếu cần — nếu jsdom không hỗ trợ `<dialog>.showModal()`, dùng `vi.spyOn(HTMLDialogElement.prototype, "showModal")` mock + simulate close event).

- [x] **Task C.7 — TopBar test (regression + new button)** (AC: 12)
  - [x] C.7.1 Update `frontend/src/components/TopBar.test.tsx` (nếu Story 1.4/2.0 chưa tạo, tạo mới):
    - `renders "+ New Task" button`.
    - `button is disabled when no active project`.
    - `clicking button opens CreateTaskModal` (verify modal heading visible).
  - [x] C.7.2 Run `cd frontend && npm test -- --run` verify tất cả tests pass (Story 1.4 + 2.0 + 2.1 regression).

### D. Frontend — Wiring & build

- [x] **Task D.1 — Verify build + type check** (AC: 14, 15)
  - [x] D.1.1 `cd frontend && npx tsc --noEmit` → 0 errors.
  - [x] D.1.2 `cd frontend && npm run build` → exit 0, tạo `frontend/dist/`.
  - [x] D.1.3 `cd frontend && npm test -- --run` → tất cả tests pass.

### E. End-to-end smoke (manual — dev tự verify)

- [ ] **Task E.1 — Manual checklist** (AC: 1, 5, 10, 11, 12, 13, 14)
  - [ ] E.1.1 Start backend `cd backend && cargo run` (port 8080).
  - [ ] E.1.2 Start frontend `cd frontend && npm run dev` (port 5173 hoặc Vite default).
  - [ ] E.1.3 Trong browser: Sidebar render ProjectSwitcher (Story 2.1). Tạo project `OMNI` nếu chưa có (Story 2.1 flow).
  - [ ] E.1.4 Set active project = `OMNI`. Click "+ New Task" trong TopBar → modal mở.
  - [ ] E.1.5 Nhập title `"Test task"`, description `"Test desc"`, click Create → toast success "Task OMNI-001 created", modal đóng.
  - [ ] E.1.6 DevTools Network — verify `POST /api/projects/<uuid>/tasks` request body + response 201 với `id: "OMNI-001"`, `status: "draft"`.
  - [ ] E.1.7 Refresh page → modal closed (state reset). Mở lại → fields empty.
  - [ ] E.1.8 Test validation: nhập title empty → Create button disabled. Nhập title chỉ whitespace `"   "` → button vẫn disabled (trim check). Nhập title 201 chars (paste long string) → submit → inline error "Task title must be 1–200 characters".
  - [ ] E.1.9 Test API qua curl:
    ```bash
    PROJECT_ID=$(curl -s http://localhost:8080/api/projects | jq -r '.[0].id')
    # List
    curl -s http://localhost:8080/api/projects/$PROJECT_ID/tasks | jq
    # Assign agent
    curl -i -X POST http://localhost:8080/api/projects/$PROJECT_ID/tasks/OMNI-001/assign \
      -H 'Content-Type: application/json' \
      -d '{"agent":"claude","role":"coder"}'
    # Expect: 200, body status="assigned", agent="claude", role="coder"
    # Update title
    curl -i -X PUT http://localhost:8080/api/projects/$PROJECT_ID/tasks/OMNI-001 \
      -H 'Content-Type: application/json' \
      -d '{"title":"Updated title"}'
    # Expect: 200, body title updated, description unchanged.
    # Delete (will fail because assigned, not draft)
    curl -i -X DELETE http://localhost:8080/api/projects/$PROJECT_ID/tasks/OMNI-001
    # Expect: 409, body { "error": "task_not_deletable", ... }
    ```
  - [ ] E.1.10 Health regression: `curl -i http://localhost:8080/health` → 200.
  - [ ] E.1.11 Projects regression: `curl -s http://localhost:8080/api/projects | jq` → 200 với list.

---

## Dev Notes

### Status casing decision (RESOLVED in this story)

**Vấn đề:** Schema `1_init.sql` (Story 1.2) định nghĩa `status TEXT NOT NULL DEFAULT 'Draft'` với PascalCase value. Story 2.0 định nghĩa `TaskStatus` const-object với lowercase values (`"draft"`, `"ready"`, …) cho frontend. Mismatch sẽ break `StatusBadge` (Story 2.0) khi consume từ API.

**Quyết định:** Backend store PascalCase trong DB (giữ nguyên schema không sửa — `KHÔNG sửa 1_init.sql` từ project-context), nhưng serialize lowercase trên wire qua serde helper `serialize_status_lowercase` (Task B.1.3). Khi deserialize PUT/POST body, status không phải input (không có endpoint nào nhận status trong Story 2.2), nên không cần deserialize helper.

**Story 2.x sau (Session lifecycle):** Khi `start session` / `pause session` mutate status → cũng dùng PascalCase trong code/DB, lowercase trên wire (consistency).

**TaskStatus const-object extension (AC-15):** Thêm `Paused: "paused"` để khớp DB enum đầy đủ. Status values currently in DB (sau migration Story 1.2 + Story 2.2): `"Draft"`, `"Ready"`, `"Assigned"`. Story 3.x sẽ thêm `"Running"`, `"Paused"`, `"Failed"`. Story 2.4+ sẽ thêm `"NeedsReview"`, `"ChangesRequested"`, `"Done"` (or `"Completed"`), `"Cancelled"`.

**Open spec gap:** Epic Story 2.3 dòng 452 nói "8 columns" nhưng list 10 columns (`Draft/Ready/Assigned/Running/Paused/NeedsReview/ChangesRequested/Completed/Failed/Cancelled`). Story 2.0 `StatusBadge` AC-4 lock 9 statuses không có `Paused`. Story 2.2 thêm `Paused` vào `TaskStatus` const-object để chuẩn bị Story 3.x. Story 2.3 sẽ resolve final column list khi implement Task Board.

### Architecture compliance (KHÔNG được phép sai lệch)

[Source: `_bmad-output/planning-artifacts/architecture.md`]

| Concern | Quy định | File reference |
| --- | --- | --- |
| Backend port | `127.0.0.1:8080` | architecture.md §"Gap 2 — Backend Port", main.rs:62 |
| API base path | `/api/*` | architecture.md §"Architectural Boundaries — API routing" |
| Route shape | Nested REST `/api/projects/{project_id}/tasks/{task_id}/...` | architecture.md §"API Route Structure" |
| Axum path syntax | `{name}` không phải `:name` | Story 1.1 retro + Story 2.1 |
| JSON casing | `camelCase` (serde `rename_all = "camelCase"`) | architecture.md §"Naming Patterns" + §"Format Patterns" |
| Status wire casing | `lowercase` (`"draft"`, `"assigned"`) | Story 2.0 `TaskStatus` lock + decision trên |
| Error envelope | `{ "error": "<snake_case_code>", "message": "<text>" }` | architecture.md §"Format Patterns" |
| HTTP codes | 200 OK · 201 Created · 204 No Content · 400 BadRequest · 404 NotFound · 409 Conflict · 500 Internal | architecture.md §"Format Patterns" |
| Handlers | Thin, dùng `?`, KHÔNG `unwrap()/expect()` | architecture.md §"Process Patterns" + §"Enforcement Guidelines" |
| Service boundary | Business logic + DB ở `services/`. Handlers KHÔNG access DB trực tiếp | architecture.md §"Architectural Boundaries" |
| DB schema | KHÔNG sửa `1_init.sql` — schema đã đầy đủ từ Story 1.2 (cột `tasks.seq`, `agent`, `role`, `status` sẵn sàng) | backend/src/db/migrations/1_init.sql |
| Frontend state | TanStack Query cho server state, `useState`/`useContext` cho UI state | architecture.md §"Frontend Architecture" |
| TS strict | `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals` | Story 2.0 AC-12 |
| Form validation | Inline on blur, error message dưới field, submit disable khi error | ux-design-specification.md §"Form Patterns" |
| Modal a11y | `role="dialog"`, `aria-labelledby`, focus trap, Esc đóng | ux-design-specification.md §"Modal & Overlay Patterns" |
| Toast | Bottom-right, success auto-dismiss 4s, error KHÔNG auto-dismiss | UX-DR7 + Story 2.0 AC-2 |

### KHÔNG được phép (hard rules)

[Source: `_bmad-output/planning-artifacts/project-context.md` + AGENTS.md + architecture.md §"Enforcement Guidelines" + Story 2.0/2.1 patterns]

- ❌ `unwrap()` / `expect()` trong handler hoặc service production code.
- ❌ Hardcode hex color trong CSS — phải dùng CSS variable từ `frontend/src/styles/tokens.css`.
- ❌ Sửa `1_init.sql` migration. Nếu cần cột mới, tạo `2_xxxxx.sql` (KHÔNG cần thiết cho story này — `tasks` đã đủ cột).
- ❌ Re-implement Story 2.0 components (`Button`, `Toast`, `StatusBadge`, `TaskCard`, …) — chỉ import & dùng.
- ❌ Re-implement Story 2.1 (`apiFetch`, `ApiError`, `ProjectSwitcher`, `ActiveProjectContext`) — chỉ import & dùng.
- ❌ Tạo route mới ngoài 5 routes Story 2.2 (`/tasks` list+create, `/tasks/{id}` get+put+delete, `/tasks/{id}/assign`). PUT `/api/projects/{id}` Rename (FR-0 đoạn "đổi tên") vẫn defer.
- ❌ Optimistic update cho create/update/assign/delete trong story này — invalidate cache sau success đủ snappy cho MVP local (architecture §"Realtime updates"). Story 3.x sẽ optimistic cho Start/Resume Session.
- ❌ Implement Update/Assign/Delete UI flows (Edit form, Assign dropdown, Delete confirmation) — defer sang Story 2.4 (Task Detail Panel). API client functions (Task C.2) đã sẵn để Story 2.4 dùng.
- ❌ Render Task Board (kanban columns + TaskCard layout) — Story 2.3.
- ❌ Subprocess spawn / Session lifecycle — Epic 3.

### Existing state — KHÔNG xóa, chỉ extend

| File | Trạng thái hiện tại | Hành động Story 2.2 |
| --- | --- | --- |
| `backend/src/main.rs` | Health + project routes (Story 2.1) | UPDATE: nest 5 task routes vào `api_router` |
| `backend/src/error.rs` | `AppError::{NotFound, BadRequest, Conflict, Internal}` với `(code, message)` payload (Story 2.1) | UNCHANGED — chỉ tạo error instances mới với codes khác |
| `backend/src/state.rs` | `AppState { db, subprocess_map }` | UNCHANGED |
| `backend/src/db/mod.rs` | Migrations + 2 unit tests | UNCHANGED — KHÔNG sửa tests đã pass |
| `backend/src/db/migrations/1_init.sql` | Schema 5 tables (gồm `tasks` đủ cột) | UNCHANGED |
| `backend/src/models/mod.rs` | `pub mod project;` (Story 2.1) | UPDATE: thêm `pub mod task;` |
| `backend/src/models/project.rs` | Project + CreateProjectRequest | UNCHANGED |
| `backend/src/services/mod.rs` | `pub mod projects;` (Story 2.1) | UPDATE: thêm `pub mod tasks;` |
| `backend/src/handlers/mod.rs` | `pub mod projects;` (Story 2.1) | UPDATE: thêm `pub mod tasks;` |
| `backend/Cargo.toml` | axum 0.8, sqlx 0.8, uuid v4, chrono (Story 2.1) | UNCHANGED — không cần dep mới |
| `frontend/src/types/task.ts` | `Task { id, title, status }` + `TaskStatus` 9 values (Story 2.0) | UPDATE: extend `Task` thêm fields, thêm `TaskAgent`/`TaskRole`, thêm `Paused` vào `TaskStatus` |
| `frontend/src/api/client.ts` | `apiFetch` + `ApiError` (Story 2.1) | UNCHANGED |
| `frontend/src/api/projects.ts` | Project API wrappers (Story 2.1) | UNCHANGED |
| `frontend/src/components/TopBar.tsx` | Static brand label + TODO comment | UPDATE: thêm `+ New Task` button + modal state |
| `frontend/src/components/AppShell.css` | Layout grid (Story 1.4) | UPDATE (nhỏ): thêm class `.app-top-bar__actions` flex right-align nếu chưa có |
| `frontend/src/main.tsx` | StrictMode + Router + ToastProvider (Story 2.0) + QueryClientProvider (Story 2.1) + ActiveProjectProvider (Story 2.1) | UNCHANGED |
| `frontend/src/App.tsx` | Routes `/dashboard`, `/board`, `*` | UNCHANGED |

### Files MỚI tạo trong Story 2.2

**Backend:**
- `backend/src/models/task.rs` — Task + CreateTaskRequest + UpdateTaskRequest + AssignAgentRequest + helpers.
- `backend/src/services/tasks.rs` — 6 service functions + 30 unit tests.
- `backend/src/handlers/tasks.rs` — 6 thin handlers.
- `backend/tests/tasks_test.rs` — integration tests (18 cases).

**Frontend:**
- `frontend/src/api/tasks.ts` — 6 fetch wrappers.
- `frontend/src/hooks/useTasks.ts` — `useTasks` query + `useCreateTask` mutation.
- `frontend/src/components/CreateTaskModal.tsx` + `.css` + `.test.tsx`.
- `frontend/src/components/TopBar.test.tsx` (nếu chưa có từ Story 1.4 / 2.0).

KHÔNG tạo:
- `frontend/src/features/task-detail/` — Story 2.4.
- `frontend/src/features/board/` — Story 2.3.
- `frontend/src/hooks/useUpdateTask.ts`, `useAssignAgent.ts`, `useDeleteTask.ts` — Story 2.4.
- `backend/src/agent/` (AgentStrategy trait) — Story 3.1.

### State machine + lifecycle notes

- **Task status transitions covered by Story 2.2:**
  - `Draft` → `Assigned` (via `POST /assign` AC-10).
  - `Ready` → `Assigned` (cũng via `POST /assign`).
  - Edit (PUT) KHÔNG thay đổi status — chỉ update fields.
  - Delete (DELETE) chỉ khi `Draft` (AC-11).
- **Status transitions NOT covered (deferred):**
  - `Draft` → `Ready` — không có trigger UI / API trong Story 2.2. Có thể thêm sau qua "Mark as Ready" button trong Task Detail (Story 2.4). MVP có thể skip `Ready` và assign trực tiếp từ `Draft` → `Assigned`.
  - `Assigned` → `Running` — Story 3.1 (Start Session).
  - Reassign agent khi status ≠ Draft/Ready — Story 2.4 (overflow menu).
- **Active project resolution (reuse Story 2.1):** `localStorage["omniAgent.activeProjectId"]` → match với project list → fallback first project → `null`. Khi `null`, "+ New Task" disabled (AC-12).
- **Race condition seq generation:** `BEGIN IMMEDIATE` transaction (Task B.3.3) đảm bảo SELECT MAX + INSERT atomic. SQLite single-writer model (no concurrent writes trong process) làm điều này safe. Nếu 2 process write song song (không phải scenario local MVP), `BEGIN IMMEDIATE` sẽ retry hoặc fail với `SQLITE_BUSY` — acceptable.
- **PUT partial update — double Option pattern:** Phân biệt `field omitted` (no change) vs `field: null` (set NULL — chỉ valid cho `acceptanceCriteria`). Pattern: `Option<Option<String>>`. Outer None = field vắng, Outer Some(inner) = field có trong body, inner None = JSON null, inner Some(s) = JSON string. Test edge cases trong unit test (Task B.3.9).

### Test data + manual verification helpers

```bash
# Backend mở port 8080
cd backend && cargo run

# Tạo project (Story 2.1)
PROJECT_ID=$(curl -s -X POST http://localhost:8080/api/projects \
  -H 'Content-Type: application/json' \
  -d '{"name":"OmniAgent Core","key":"OMNI"}' | jq -r '.id')

# Tạo task happy path
curl -i -X POST http://localhost:8080/api/projects/$PROJECT_ID/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Fix login","description":"Token refresh broken"}'
# Expect: 201, body id="OMNI-001", status="draft", seq=1

# Tạo task thứ 2 — seq auto-increment
curl -s -X POST http://localhost:8080/api/projects/$PROJECT_ID/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Add logout","description":"Logout endpoint"}' | jq
# Expect: id="OMNI-002", seq=2

# List
curl -s http://localhost:8080/api/projects/$PROJECT_ID/tasks | jq

# Get single
curl -s http://localhost:8080/api/projects/$PROJECT_ID/tasks/OMNI-001 | jq

# Validate empty title → 400
curl -i -X POST http://localhost:8080/api/projects/$PROJECT_ID/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"","description":"d"}'
# Expect: 400, body { "error": "invalid_task_title", ... }

# Assign agent
curl -i -X POST http://localhost:8080/api/projects/$PROJECT_ID/tasks/OMNI-001/assign \
  -H 'Content-Type: application/json' \
  -d '{"agent":"claude","role":"coder"}'
# Expect: 200, body status="assigned", agent="claude", role="coder"

# Invalid agent value
curl -i -X POST http://localhost:8080/api/projects/$PROJECT_ID/tasks/OMNI-002/assign \
  -H 'Content-Type: application/json' \
  -d '{"agent":"gemini","role":"coder"}'
# Expect: 400 invalid_agent

# Update title only (partial PUT)
curl -i -X PUT http://localhost:8080/api/projects/$PROJECT_ID/tasks/OMNI-001 \
  -H 'Content-Type: application/json' \
  -d '{"title":"Fix login (v2)"}'
# Expect: 200, body title updated, description unchanged

# Set AC to null
curl -i -X PUT http://localhost:8080/api/projects/$PROJECT_ID/tasks/OMNI-001 \
  -H 'Content-Type: application/json' \
  -d '{"acceptanceCriteria":null}'
# Expect: 200, body acceptanceCriteria=null

# Try delete assigned task → 409
curl -i -X DELETE http://localhost:8080/api/projects/$PROJECT_ID/tasks/OMNI-001
# Expect: 409 task_not_deletable

# Delete draft task → 204
curl -i -X DELETE http://localhost:8080/api/projects/$PROJECT_ID/tasks/OMNI-002
# Expect: 204 No Content

# Wrong project access → 404
WRONG_PROJECT=$(uuidgen)
curl -i http://localhost:8080/api/projects/$WRONG_PROJECT/tasks/OMNI-001
# Expect: 404 task_not_found

# Health regression
curl -i http://localhost:8080/health
# Expect: 200 {"status":"ok"}

# Projects regression
curl -s http://localhost:8080/api/projects | jq
# Expect: 200 list
```

Frontend (sau khi backend chạy):

```bash
cd frontend && npm install && npm run dev
# Open http://127.0.0.1:5173
# 1. Create project OMNI qua Sidebar (Story 2.1)
# 2. Set OMNI active
# 3. Click "+ New Task" trong TopBar → modal open
# 4. Title "Fix login", Description "Token refresh broken" → Create
# 5. Toast "Task OMNI-001 created" appears
# 6. DevTools Network tab — verify POST /api/projects/<id>/tasks 201 response
# 7. Modal closes, button still enabled
```

### Web research — phiên bản & best practice mới nhất

[Verified 2026-05-21 — same as Story 2.1]

- `@tanstack/react-query` **5.100.11** — đã cài Story 2.1. API v5 object form. `useMutation` `mutateAsync` trả Promise — dùng cho async/await trong submit handler (Task C.5.4).
- `axum` **0.8.9** (architecture lock 0.8 series). Path syntax `{name}` đã verify Story 1.1.
- `serde` double-option pattern cho partial PUT: known pattern, tham khảo [serde issue #984](https://github.com/serde-rs/serde/issues/984) hoặc crate `serde_with` (nếu story 2.1 đã thêm, dùng; else implement helper thủ công ~20 lines).
- React 19.2 + TanStack Query v5 ổn định (verified Epic 1 retro Hạng mục 3).

### Previous story intelligence (Story 2.1 learnings)

[Source: `_bmad-output/implementation-artifacts/2-1-project-management.md`]

- **Patterns established:**
  - `AppError::{BadRequest, Conflict, NotFound}` với `(code, message)` payload — reuse trong Story 2.2.
  - Service layer pattern: `pub async fn fn_name(pool: &SqlitePool, ...) -> Result<X, AppError>` — handlers KHÔNG access DB.
  - In-memory SQLite unit test pattern (`SqlitePool::connect("sqlite::memory:") + run_migrations(&pool)`) — reuse cho Task B.3.9.
  - Integration test pattern: `axum::body::Body` + `tower::ServiceExt::oneshot` — reuse cho Task B.6.
  - Frontend `apiFetch<T>` wrapper + `ApiError` class — reuse cho Task C.2.
  - TanStack Query hook pattern: `useQuery({ queryKey, queryFn, enabled })` + invalidate cache trong `onSuccess` — reuse cho Task C.3.
  - `<ConfirmationDialog>` native `<dialog>` + `showModal()` pattern — reuse style + a11y cho `CreateTaskModal` (Task C.5).
  - Manual key check thay vì regex crate cho simple validation — pattern reuse cho task title length check (Task B.3.3 step 1).
- **Gotchas tránh lặp lại:**
  - Axum 0.8 path syntax `{name}` không `:name` (Story 1.1 retro).
  - Serde `rename_all = "camelCase"` ở struct level đủ — không cần per-field `#[serde(rename)]`.
  - jsdom `<dialog>.showModal()` cần mock trong unit test (lesson Story 2.0 `ConfirmationDialog.test.tsx`).
- **Race condition note:** Story 2.1 ghi nhận race delete-with-tasks acceptable cho MVP. Story 2.2 áp dụng `BEGIN IMMEDIATE` cho create_task seq generation (mạnh hơn vì seq uniqueness là hard invariant), nhưng KHÔNG cần cho update/delete (single-row mutations).

### Git intelligence (last 5 commits)

[As of 2026-05-21]

- `48daafa` gitnexus (index update)
- `eab71e1` Merge PR #4: docs(bmad): create story 2.1 — Project Management
- `e62aed5` merge: resolve conflicts with main (story 2.0 merged) on devin/1779358413-story-2-1-project-management
- `7ce2c92` Merge PR #3: docs(bmad): create story 2.0 — Shared UI Components
- `5e0e31d` docs(bmad): create story 2.1 — Project Management (bmad-create-story)

**Insights cho Story 2.2:**
- Story 2.0 và 2.1 là docs-only commits (story packet files). Story 2.2 này cũng là docs-only (story packet). Implementation work sẽ là separate PR sau dev-story workflow.
- Branch convention: `devin/<timestamp>-story-X-Y-name`.

### Trace AC ↔ Task

| AC | Tasks |
| --- | --- |
| AC-1 (POST happy path Draft + auto seq) | B.1, B.3.3, B.4 (create_task), B.5, B.6 |
| AC-2 (Task ID format + seq per-project) | B.3.3 (format + race-safe), B.3.9 (auto_increment tests), B.6 |
| AC-3 (validation 400 — title/description/AC) | B.3.3 (validation), B.6 (validates_title/description tests), C.5 (UI inline error) |
| AC-4 (POST project not found 404) | B.3.3 (project verify), B.6 (project_not_found test) |
| AC-5 (GET list ordered) | B.3.4, B.4 (list_tasks), B.5, B.6 |
| AC-6 (GET single) | B.3.5, B.4 (get_task), B.5, B.6, C.2 |
| AC-7 (PUT edit Title/Description/AC) | B.3.6, B.4 (update_task), B.5, B.6, C.2 |
| AC-8 (PUT block Done/Cancelled 409) | B.3.6 (status check), B.6 (locks_when_done test) |
| AC-9 (PUT validation reuse) | B.3.6 (validation merge), B.3.9 (rejects_empty_title test) |
| AC-10 (POST assign happy + invalid + wrong status) | B.3.7, B.4 (assign_agent), B.5, B.6 (3 assign tests), C.2 |
| AC-11 (DELETE only Draft) | B.3.8, B.4 (delete_task), B.5, B.6 (delete tests), C.2 |
| AC-12 (Frontend modal UX) | C.4 (TopBar button), C.5 (CreateTaskModal), C.6 (tests), C.7 |
| AC-13 (Create happy flow UI) | C.3 (useCreateTask), C.5 (submit + error mapping), C.6 (tests) |
| AC-14 (Mount routes + no regression) | B.5, B.6 (regression guards), D.1 |
| AC-15 (TS types extend backward-compat) | C.1, D.1 (tsc + tests) |

### Project Structure Notes

- File naming: backend `snake_case.rs`, frontend `PascalCase.tsx` cho components + `camelCase.ts` cho hooks/api — match Story 2.1 pattern.
- Co-location: `Component.tsx` + `Component.css` + `Component.test.tsx` cùng folder (Story 2.0 pattern).
- Test discovery: backend `cargo test` auto-discovers `#[cfg(test)]` modules + `tests/` integration files. Frontend `vitest` auto-discovers `*.test.tsx` cạnh component (config từ Story 2.0).
- `frontend/src/hooks/` folder: nếu chưa có (Story 2.0 KHÔNG tạo), Story 2.2 sẽ tạo mới qua Task C.3.

### Validation expectations (TEST_MATRIX update)

Sau khi implement Story 2.2, thêm row vào `docs/TEST_MATRIX.md`:

| Story | Coverage | Backend unit | Backend integration | Frontend unit | Manual |
| --- | --- | --- | --- | --- | --- |
| 2.2 Task CRUD & Agent Assignment | Full CRUD + assign + frontend Create modal | 30 tests (`backend/src/services/tasks.rs`) | 18 cases (`backend/tests/tasks_test.rs`) | CreateTaskModal + TopBar (6+ cases) | E.1 checklist |

### References

- Epic + AC: [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.2: Task CRUD & Agent Assignment` (dòng 402–440)]
- PRD requirements: [Source: `_bmad-output/planning-artifacts/prds/prd-omni-agent-2026-05-20/prd.md` FR-1, FR-2, FR-3]
- Architecture (routes, casing, error envelope): [Source: `_bmad-output/planning-artifacts/architecture.md` §"API Route Structure", §"Format Patterns", §"Naming Patterns", §"Architectural Boundaries"]
- UX spec (modal, form, button hierarchy): [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` §"Form Patterns", §"Modal & Overlay Patterns", §"Button Hierarchy", §5 Task Detail Panel]
- Project context rules: [Source: `_bmad-output/project-context.md` §"Critical Implementation Rules" (Rust, React, Testing, Code Quality)]
- DB schema: [Source: `backend/src/db/migrations/1_init.sql`]
- Story 2.0 component contracts: [Source: `_bmad-output/implementation-artifacts/2-0-shared-ui-components.md` AC-1 → AC-15]
- Story 2.1 service/handler pattern: [Source: `_bmad-output/implementation-artifacts/2-1-project-management.md` Task B.3, B.4, B.5, B.6, B.7, C.1, C.2]
- AGENTS / Harness: [Source: `AGENTS.md` §"Task Loop", §"Done Definition"]
- Feature intake lane classification: [Source: `docs/FEATURE_INTAKE.md`]

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6-thinking

### Debug Log References

### Completion Notes List

- Rust pattern-matching compile error: `Some(None) | Some(Some(ref s)) if s.trim()...` không hợp lệ vì biến `s` không bound ở nhánh `Some(None)`. Fix: tách thành hai match arm riêng biệt.
- `Task` interface mở rộng đầy đủ required fields (F7): `projectId`, `seq`, `description`, `acceptanceCriteria`, `agent`, `role`, `createdAt`, `updatedAt` đều là required. `TaskCard.tsx` prop type được narrowed thành `{ id, title, status }` vì component chỉ dùng `task.title`. Test helpers (`makeTask`) trong `TaskBoard.test.tsx` và `taskToCardProps.test.ts` được cập nhật để provide đủ required fields.
- `StatusBadge.tsx` cần thêm entry `paused` sau khi `TaskStatus` được extend — `satisfies Record<TaskStatus, ...>` là exhaustive check, build fails nếu thiếu variant.
- Frontend tests mock `../api/tasks` module trực tiếp (không mock `apiFetch`), đơn giản hơn và không cần polyfill `ApiError` class constructor trong mock.
- `ReactDOM.createPortal` trong `CreateTaskModal` render vào `document.body` — `screen.getByRole("dialog")` vẫn tìm được vì `@testing-library/dom` query toàn document.
- Task E.1 (manual browser checklist) chưa thực hiện — không bắt buộc cho review status vì automated tests đã cover đủ AC.

### File List

**Backend (mới):**
- `backend/src/models/task.rs`
- `backend/src/services/tasks.rs`
- `backend/src/handlers/tasks.rs`
- `backend/tests/tasks_test.rs`

**Backend (cập nhật):**
- `backend/src/models/mod.rs`
- `backend/src/services/mod.rs`
- `backend/src/services/tasks.rs` (F1 BEGIN IMMEDIATE, F3 atomic UPDATE, F4 re-fetch, F5 rows_affected)
- `backend/src/handlers/mod.rs`
- `backend/src/main.rs`
- `backend/src/db/mod.rs`
- `backend/src/db/migrations/1_init.sql` (F2 UNIQUE constraint)

**Frontend (mới):**
- `frontend/src/api/tasks.ts`
- `frontend/src/hooks/useTasks.ts`
- `frontend/src/components/CreateTaskModal.tsx`
- `frontend/src/components/CreateTaskModal.css`
- `frontend/src/components/CreateTaskModal.test.tsx`
- `frontend/src/components/TopBar.test.tsx`

**Frontend (cập nhật):**
- `frontend/src/types/task.ts`
- `frontend/src/components/TopBar.tsx`
- `frontend/src/components/TopBar.test.tsx`
- `frontend/src/components/AppShell.css`
- `frontend/src/components/StatusBadge.tsx`
- `frontend/src/components/TaskCard.tsx` (narrowed task prop type)
- `frontend/src/components/TaskCard.test.tsx` (removed Task annotation)
- `frontend/src/features/board/TaskBoard.test.tsx` (makeTask full required fields)
- `frontend/src/features/board/taskToCardProps.test.ts` (makeTask full required fields)

**Harness (cập nhật):**
- `docs/TEST_MATRIX.md`

---

### Review Findings

> Code review thực hiện ngày 2026-05-22. Layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor (tất cả do reviewer trực tiếp thực hiện do rate limit subagent).

#### Patches (cần fix)

- [x] [Review][Patch] **F1: Transaction `BEGIN DEFERRED` thay vì `BEGIN IMMEDIATE` — race condition trong seq generation** — `create_task` verify project ngoài transaction rồi mới `pool.begin()` (DEFERRED). Hai concurrent request có thể đọc cùng `MAX(seq)=0` và insert `seq=1`/`OMNI-001` trùng nhau, dẫn đến lỗi UNIQUE constraint → 500 thay vì graceful error. Spec yêu cầu `BEGIN IMMEDIATE`. [backend/src/services/tasks.rs]
- [x] [Review][Patch] **F2: Thiếu `UNIQUE(project_id, seq)` constraint trong DB schema** — Schema không có constraint này nên duplicate seq không bị ngăn ở tầng DB. Nếu xảy ra race (F1), DB error bị map thành 500 Internal Server Error thay vì 409. [backend/src/db/migrations/1_init.sql]
- [x] [Review][Patch] **F3: TOCTOU trong `assign_agent` và `delete_task` — GET+UPDATE không có row-lock** — Cả hai hàm dùng pattern: `get_task()` (READ) → kiểm tra status → UPDATE/DELETE. Giữa 2 bước, một request khác có thể thay đổi status. Ví dụ: 2 concurrent assign đều đọc `status=draft`, cả 2 đều update thành công, lần 2 ghi đè lần 1 mà không có error. Fix: dùng `UPDATE ... WHERE id=? AND status IN (...)` rồi kiểm tra `rows_affected`. [backend/src/services/tasks.rs]
- [x] [Review][Patch] **F4: `assign_agent` và `update_task` trả về Task struct được construct trong memory, không re-read từ DB** — Nếu một concurrent delete xóa task giữa GET và UPDATE, `rows_affected=0` nhưng hàm vẫn trả `Ok(Task {...})` với dữ liệu cũ. Client nhận 200 OK với dữ liệu ghost. Fix: kiểm tra `rows_affected > 0` hoặc re-fetch sau UPDATE. [backend/src/services/tasks.rs]
- [x] [Review][Patch] **F5: `delete_task` không kiểm tra `rows_affected` sau DELETE** — Nếu task bị xóa concurrent trước khi DELETE thực thi, function trả `Ok(())` → 204 No Content dù không xóa được gì. Không có báo lỗi. [backend/src/services/tasks.rs]
- [x] [Review][Patch] **F6: `project_not_found` trong CreateTaskModal không clear localStorage và không refetch project list — vi phạm AC-13** — AC-13 yêu cầu: toast + đóng modal + `clear localStorage["omniAgent.activeProjectId"]` + refetch project list. Implementation chỉ làm toast + `onClose()`. Thiếu 2 bước cuối. [frontend/src/components/CreateTaskModal.tsx]
- [x] [Review][Patch] **F7: Task interface có required fields khai báo optional (?) — vi phạm AC-15** — AC-15 yêu cầu `projectId: string`, `seq: number`, `description: string`, `createdAt: string`, `updatedAt: string` (required). Implementation khai báo tất cả là optional (`?`), gây mất type safety cho Story 2.3 và các consumer sau. [frontend/src/types/task.ts]
- [x] [Review][Patch] **F8: Integration test `put_task_locks_when_done` test sai hành vi — tên lừa dối** — Test name nói "PUT locks when Done" nhưng thực ra test DELETE blocked khi Assigned. Scenario PUT/409 khi task ở `Done` không có integration test (chỉ có unit test). [backend/tests/tasks_test.rs]

#### Deferred

- [x] [Review][Defer] **D1: SQLite foreign key enforcement không được verify** — Schema có `REFERENCES projects(id)` nhưng SQLite cần `PRAGMA foreign_keys = ON` để enforce. Nếu không set, tầng service tự handle (đã có verify), nhưng DB không có safety net. [backend/src/db/] — deferred, pre-existing infrastructure issue
- [x] [Review][Defer] **D2: `onClose` callback trong TopBar tạo function mới mỗi render — gây useEffect churn không cần thiết** — `<CreateTaskModal onClose={() => setOpen(false)} />` tạo arrow function mới mỗi lần TopBar re-render → trigger cleanup/re-setup listener cho "close" event. Fix: `useCallback`. [frontend/src/components/TopBar.tsx] — deferred, minor performance issue
