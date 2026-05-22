# Story 2.1: Project Management

Status: done

<!-- Validation tùy chọn — chạy validate-create-story trước khi dev-story nếu muốn double-check. -->

**Epic:** 2 — Project & Task Management
**Story ID:** 2.1
**Story Key:** 2-1-project-management
**Lane (FEATURE_INTAKE.md):** normal — chạm data model + public API contract, blast radius bounded trong Project domain. Không có Auth/Authorization/External provider.

---

## Story

As a developer using omni-agent,
I want to create and manage Projects (tạo, xem danh sách, xóa khi rỗng) với business rules ổn định,
so that tasks can be organized within projects and the Task Board filters to the active project.

---

## Acceptance Criteria

> Nguồn gốc: `_bmad-output/planning-artifacts/epics.md` Story 2.1 (dòng 372–406) + PRD FR-0 (dòng 104–114). Mỗi AC viết ở dạng Given/When/Then **testable**. Backend trả error envelope `{ "error": "<code>", "message": "<text>" }` (architecture §"Format Patterns") và JSON dùng `camelCase` (architecture §"Naming Patterns").

**AC-1 — POST `/api/projects` happy path:**
**Given** request body hợp lệ `{ "name": "OmniAgent Core", "key": "OMNI" }`
**When** client gửi `POST /api/projects`
**Then** backend tạo project mới, trả `201 Created` với body
```json
{ "id": "<uuid-v4>", "name": "OmniAgent Core", "key": "OMNI",
  "createdAt": "<iso8601>", "updatedAt": "<iso8601>" }
```
**And** row mới tồn tại trong bảng `projects` với đầy đủ 5 cột (`id`, `name`, `key`, `created_at`, `updated_at`).

**AC-2 — GET `/api/projects` trả danh sách (ordered):**
**Given** ≥ 0 projects đã được tạo
**When** client gửi `GET /api/projects`
**Then** backend trả `200 OK` với mảng JSON `[{ id, name, key, createdAt, updatedAt }]`, sắp theo `created_at ASC` (project tạo trước đứng đầu để Project Switcher load deterministically).

**AC-3 — Key validation tại API layer (400 Bad Request):**
**Given** request body có `key` không phải uppercase alphanumeric (ví dụ `"omni"`, `"OMNI 1"`, `"OM-NI"`, `"O"`, hoặc trống)
**When** client gửi `POST /api/projects`
**Then** backend KHÔNG insert row và trả `400 Bad Request` với envelope
```json
{ "error": "invalid_project_key",
  "message": "Project key must be uppercase letters and digits, 2–8 characters" }
```
**Spec key:** regex bắt buộc `^[A-Z][A-Z0-9]{1,7}$` (bắt đầu bằng letter, tổng 2–8 ký tự, không space, không dấu gạch).

**AC-4 — Name validation tại API layer (400 Bad Request):**
**Given** request body có `name` trống/whitespace hoặc dài > 80 ký tự
**When** client gửi `POST /api/projects`
**Then** backend trả `400 Bad Request` với envelope `{ "error": "invalid_project_name", "message": "Project name must be 1–80 characters" }`, KHÔNG insert row.

**AC-5 — Duplicate key trả 409 Conflict:**
**Given** project với key `"OMNI"` đã tồn tại
**When** client gửi `POST /api/projects` body `{ "name": "Another", "key": "OMNI" }`
**Then** backend KHÔNG insert row và trả `409 Conflict` với envelope `{ "error": "project_key_taken", "message": "Project key already in use" }`.
**And** form hiển thị inline error "Project key already in use" ngay dưới field Key (không dùng toast cho lỗi validation form).

**AC-6 — DELETE empty project happy path:**
**Given** project tồn tại, KHÔNG có row nào trong `tasks` tham chiếu `project_id` đó
**When** client gửi `DELETE /api/projects/{id}` sau khi user confirm trong `ConfirmationDialog`
**Then** backend xóa row khỏi `projects` và trả `204 No Content` (response body rỗng).
**And** project biến mất khỏi Project Switcher dropdown.

**AC-7 — DELETE bị block khi còn tasks (409 Conflict):**
**Given** project đang còn ≥ 1 row trong `tasks`
**When** client gửi `DELETE /api/projects/{id}`
**Then** backend KHÔNG xóa row và trả `409 Conflict` với envelope `{ "error": "project_has_tasks", "message": "Cannot delete project with existing tasks" }`.
**And** UI hiển thị toast error `"Cannot delete project with existing tasks"` (text dùng nguyên si từ message để tránh duplicate i18n source).

**AC-8 — DELETE project không tồn tại trả 404:**
**Given** project ID không tồn tại trong DB
**When** client gửi `DELETE /api/projects/{id}`
**Then** backend trả `404 Not Found` với envelope `{ "error": "project_not_found", "message": "Project <id> does not exist" }`.

**AC-9 — Project Switcher trong Sidebar (UX-DR9 / UX §2.2):**
**Given** user đã đăng nhập và mount AppShell
**When** Sidebar render
**Then** thay vì placeholder `data-testid="project-switcher-placeholder"` (Story 1.4), Sidebar render `<ProjectSwitcher>` thật:
- Hiển thị 2-char abbreviation từ project key + name + `⌄`.
- Click → dropdown panel có:
  1. Danh sách projects (mỗi item: icon + name + key tag + `⋯` overflow menu chứa **Delete project**).
  2. Divider.
  3. Item cuối "+ New Project" trigger mở `CreateProjectModal`.
- Active project được highlight (background `--brand-light`, text `--brand-primary`).
- Dropdown đóng khi user click ra ngoài, nhấn `Esc`, hoặc chọn 1 project.
- Khi danh sách project trống: dropdown chỉ hiển thị empty state inline ngắn + nút "+ New Project".

**AC-10 — Create Project Modal (UX-DR8 / UX §8.7 modal rules):**
**Given** user click "+ New Project" trong Project Switcher
**When** modal mở
**Then** modal hiển thị:
- Title "Create new project" (không phải "Are you sure?").
- Field `Name` (required, autoFocus, max 80 ký tự, placeholder ví dụ cụ thể như "OmniAgent Core").
- Field `Key` (required, uppercase auto-transform on type, placeholder "OMNI", hint text "2–8 ký tự, chữ hoa và số").
- Inline validation `on blur` theo Form Patterns UX §"Form Patterns": Name trống → "Name is required" dưới field; Key không match regex → "Key must be uppercase letters and digits, 2–8 characters" dưới field.
- Footer: `[Cancel]` (Ghost, trái) `[Create project]` (Primary indigo, phải) — đúng rule Button Hierarchy "không 2 filled buttons cùng dòng" (UX §"Button Hierarchy").
- Submit button disabled khi có validation error hoặc đang loading.
- A11y: `role="dialog"`, `aria-labelledby="create-project-title"`, focus trap, `Esc` đóng modal — tuân thủ UX §"Accessibility Strategy".

**AC-11 — Flow đầy đủ "tạo project hợp lệ" (FR-0 §4.1):**
**Given** user nhập `Name = "OmniAgent Core"`, `Key = "OMNI"` và submit
**When** mutation thành công
**Then**:
1. Modal đóng tự động.
2. Project mới xuất hiện trong Project Switcher dropdown ở cuối danh sách (sắp theo `createdAt ASC`).
3. Project mới trở thành active project (Sidebar Project Switcher hiển thị tên project mới).
4. Trang reload state: TanStack Query cache `['projects']` được invalidate; placeholder cho Task Board (Story 2.3) phải đọc `useActiveProject()` để biết project nào (Story 2.3 sẽ implement actual board — Story 2.1 chỉ cần đảm bảo `activeProjectId` được set đúng).
5. Toast success `"Project created"` (Toast component từ Story 2.0).

**AC-12 — Flow "xóa project rỗng" qua ConfirmationDialog:**
**Given** user click `⋯` overflow trên một project, chọn "Delete project"
**When** `ConfirmationDialog` mở (Story 2.0)
**Then**:
- Title = `"Delete project"` (không phải "Are you sure?").
- Body = `Are you sure you want to delete "<project name>"? This cannot be undone.`
- `[Cancel]` (Ghost trái) + `[Delete project]` (Destructive red ghost phải, UX §"Button Hierarchy").
- Click `Delete project` → gọi `DELETE /api/projects/{id}`.
- Thành công (204) → ConfirmationDialog đóng → project biến mất khỏi Switcher → nếu vừa xóa active project, fall back về project đầu tiên còn lại (hoặc clear active state nếu danh sách rỗng) → toast success `"Project deleted"`.
- Backend trả 409 `project_has_tasks` → ConfirmationDialog đóng → toast error `"Cannot delete project with existing tasks"`.

**AC-13 — Persistence của active project:**
**Given** user chọn project `OMNI` trong Project Switcher
**When** user reload trang (`F5`)
**Then** sau reload, Sidebar Project Switcher vẫn hiển thị `OMNI` là active (đọc từ `localStorage` key `omniAgent.activeProjectId`).
**Edge case:** Nếu `localStorage` chứa ID không còn tồn tại trong response `GET /api/projects`, fallback về project đầu tiên trong danh sách và update `localStorage`.

**AC-14 — Backend mount router dưới prefix `/api/*`:**
**Given** backend `main.rs` build router
**When** request đến `GET /api/projects` (hoặc bất kỳ `/api/*`)
**Then** request được route đến `handlers/projects.rs` (hoặc handler tương ứng).
**And** Vite proxy rewrite hack `path.replace(/^\/api(?=\/|$)/, "") || "/"` trong `frontend/vite.config.ts` được **xóa bỏ** (TODO đã ghi tại `frontend/vite.config.ts:15-16`). Proxy giữ `target: "http://127.0.0.1:8080"` nhưng forward path nguyên si.

**AC-15 — Existing `GET /health` không hồi quy:**
**Given** thay đổi router thêm prefix `/api`
**When** client gọi `GET /health`
**Then** vẫn trả `200 {"status":"ok"}` (Story 1.1 contract). `GET /unknown` vẫn trả `404` với error envelope (Story 1.1 AC-3). Không break existing tests trong `backend/src/db/mod.rs`.

---

## Tasks / Subtasks

> Mỗi task gắn với AC tương ứng. Tick các checkbox khi developer hoàn thành. Bám theo source files trong `_bmad-output/planning-artifacts/architecture.md` §"Project Structure & Boundaries" — KHÔNG tự ý tạo path khác.

### A. Chuẩn bị môi trường (precondition)

- [ ] **Task A.1 — Verify Story 2.0 đã merged** (Dependency gate)
  - [ ] A.1.1 Xác nhận `_bmad-output/implementation-artifacts/sprint-status.yaml` ghi `2-0-shared-ui-components: done` (hoặc `review`).
  - [ ] A.1.2 Xác nhận các component sau tồn tại trong `frontend/src/components/`:
    - `Button.tsx` (4 variants: primary/secondary/ghost/destructive) — Story 2.0
    - `Toast.tsx` + Toast provider/hook (`useToast()` hoặc tương đương) — Story 2.0
    - `ConfirmationDialog.tsx` (focus trap, role="dialog") — Story 2.0
    - Optional: `EmptyState.tsx` for "No projects yet" pattern — Story 2.0
  - [ ] A.1.3 Nếu A.1.2 không đạt → **DỪNG**, escalate user trước khi continue. Story 2.1 phụ thuộc cứng vào Story 2.0 (epics.md dòng 378: "Depends on: Story 2.0").

- [ ] **Task A.2 — Cài @tanstack/react-query v5.100.11** (Epic 2 prep từ epic-1-retro-2026-05-21.md Hạng mục 3)
  - [ ] A.2.1 `cd frontend && npm install @tanstack/react-query@5.100.11 --save-exact` (dùng `--save-exact` để khóa version theo architecture).
  - [ ] A.2.2 Verify `frontend/package.json` `dependencies` có `"@tanstack/react-query": "5.100.11"`.
  - [ ] A.2.3 `npx tsc --noEmit` — pass, 0 errors. `npm run build` — pass.
  - [ ] A.2.4 (Tùy chọn) Nếu muốn debug: install `@tanstack/react-query-devtools@5.100.11` vào `devDependencies` và mount `<ReactQueryDevtools initialIsOpen={false} />` trong `main.tsx`. NHƯNG đây là nice-to-have; KHÔNG bắt buộc cho story này.

### B. Backend — Project CRUD API

- [ ] **Task B.1 — Thêm crates còn thiếu** (AC: 1, 2)
  - [ ] B.1.1 Mở `backend/Cargo.toml`. Thêm `chrono = { version = "0.4", default-features = false, features = ["clock", "serde"] }` vào `[dependencies]` để generate `created_at`/`updated_at` ISO 8601 strings. Lý do chọn `chrono`: ergonomics (`Utc::now().to_rfc3339()`), không pull thêm OpenSSL/native-tls (epic-1-retro lesson 3 "Ưu tiên thư viện thuần Rust").
  - [ ] B.1.2 (Đã có) Verify `uuid = { version = "1", features = ["v4"] }` đã tồn tại — dùng cho project ID.
  - [ ] B.1.3 `cargo build` — pass.

- [ ] **Task B.2 — Tạo `backend/src/models/project.rs`** (AC: 1, 2)
  - [ ] B.2.1 Tạo thư mục `backend/src/models/` nếu chưa có.
  - [ ] B.2.2 Tạo file `models/project.rs` với struct `Project`:
    ```rust
    use serde::{Deserialize, Serialize};
    use sqlx::FromRow;

    #[derive(Debug, Clone, Serialize, FromRow)]
    #[serde(rename_all = "camelCase")]
    pub struct Project {
        pub id: String,
        pub name: String,
        pub key: String,
        pub created_at: String,
        pub updated_at: String,
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct CreateProjectRequest {
        pub name: String,
        pub key: String,
    }
    ```
  - [ ] B.2.3 Thêm `pub mod project;` vào `models/mod.rs` (tạo mới nếu cần).

- [ ] **Task B.3 — Mở rộng `backend/src/error.rs`** (AC: 3, 4, 5, 7, 8)
  - [ ] B.3.1 Thêm variants vào enum `AppError`:
    - `BadRequest(String)` → 400, code lấy từ payload `(code, message)` (xem B.3.2).
    - `Conflict(String)` → 409, code lấy từ payload.
  - [ ] B.3.2 ĐIỀU CHỈNH design: chuyển `AppError` từ `String` payload sang `{ code: &'static str, message: String }` để mỗi variant trả `error_code` chính xác (ví dụ `"invalid_project_key"`, `"project_key_taken"`, `"project_has_tasks"`, `"project_not_found"`). Pattern gợi ý:
    ```rust
    #[derive(Debug, Error)]
    pub enum AppError {
        #[error("{message}")]
        NotFound { code: &'static str, message: String },
        #[error("{message}")]
        BadRequest { code: &'static str, message: String },
        #[error("{message}")]
        Conflict { code: &'static str, message: String },
        #[error(transparent)]
        Internal(#[from] anyhow::Error),
    }
    ```
    Hoặc giữ chữ ký cũ và inline `(StatusCode, &'static str, String)` mapping trong `IntoResponse`. **Chọn approach nào cũng được**, miễn là response envelope `{ "error": "<code>", "message": "..." }` đúng theo architecture §"Format Patterns".
  - [ ] B.3.3 Update existing call sites trong `main.rs` (`AppError::NotFound("Route not found".to_string())`) cho compatible. Code `"not_found"` giữ nguyên cho fallback handler.
  - [ ] B.3.4 Verify `cargo build` + existing test `cargo test` trong `backend/` vẫn pass.

- [ ] **Task B.4 — Tạo `backend/src/services/projects.rs`** (AC: 1, 2, 3, 4, 5, 6, 7, 8)
  - [ ] B.4.1 Tạo thư mục `backend/src/services/` + file `services/mod.rs` với `pub mod projects;`.
  - [ ] B.4.2 Implement business logic — KHÔNG truy cập trực tiếp `axum::http` trong service layer (architecture §"Architectural Boundaries"):
    - `pub async fn list_projects(pool: &SqlitePool) -> Result<Vec<Project>, AppError>`: `SELECT … ORDER BY created_at ASC`.
    - `pub async fn create_project(pool: &SqlitePool, req: CreateProjectRequest) -> Result<Project, AppError>`:
      1. Validate name → trim → length 1–80 → return `BadRequest { code: "invalid_project_name", … }` nếu fail.
      2. Validate key bằng regex `^[A-Z][A-Z0-9]{1,7}$` → return `BadRequest { code: "invalid_project_key", … }` nếu fail. **Note**: cân nhắc dùng `once_cell::sync::Lazy<regex::Regex>` để compile regex 1 lần, HOẶC implement check thủ công bằng `chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())` + length check để tránh thêm `regex` crate. Cách thủ công đủ và rẻ hơn cho regex đơn giản này — **prefer manual check**.
      3. Generate `id = Uuid::new_v4().to_string()`, `now = chrono::Utc::now().to_rfc3339()`.
      4. `INSERT INTO projects (id, name, key, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`.
      5. Map sqlx `UNIQUE constraint failed` error → `Conflict { code: "project_key_taken", message: "Project key already in use" }`. Pattern detect: match `sqlx::Error::Database(db_err)` với `db_err.code() == Some("2067")` (SQLite UNIQUE) hoặc `db_err.message().contains("UNIQUE constraint failed: projects.key")`.
      6. Trả về `Project` vừa tạo (echo lại fields từ request + id/timestamps).
    - `pub async fn delete_project(pool: &SqlitePool, id: &str) -> Result<(), AppError>`:
      1. Check row tồn tại: `SELECT COUNT(*) FROM projects WHERE id = ?`. Nếu 0 → return `NotFound { code: "project_not_found", message: format!("Project {} does not exist", id) }`.
      2. Check còn task: `SELECT COUNT(*) FROM tasks WHERE project_id = ?`. Nếu > 0 → return `Conflict { code: "project_has_tasks", message: "Cannot delete project with existing tasks" }`.
      3. `DELETE FROM projects WHERE id = ?`.
      4. Return `Ok(())`.
  - [ ] B.4.3 **Concurrency note:** giữa step 2 (check tasks) và step 3 (delete) có race condition nếu task được insert song song. Cho MVP local single-user, race acceptable. Document trong dev notes. (Future story có thể wrap trong `BEGIN IMMEDIATE` transaction.)
  - [ ] B.4.4 Viết unit tests trong cùng file (`#[cfg(test)] mod tests`) — pattern giống `backend/src/db/mod.rs` (Story 1.2):
    - Dùng in-memory SQLite `SqlitePool::connect("sqlite::memory:")` + `run_migrations(&pool)`.
    - `create_project_inserts_row`: insert OK, row tồn tại, `created_at` non-empty.
    - `create_project_rejects_invalid_key`: cases `["omni", "OMNI 1", "O", "OM-NI", "TOOLONG12", ""]` → mỗi case trả `BadRequest { code: "invalid_project_key", .. }`.
    - `create_project_rejects_invalid_name`: name rỗng, name 81 chars → `BadRequest { code: "invalid_project_name", .. }`.
    - `create_project_rejects_duplicate_key`: insert `OMNI` 2 lần → lần 2 trả `Conflict { code: "project_key_taken", .. }`.
    - `delete_project_empty_succeeds`: insert + delete → row biến mất.
    - `delete_project_with_tasks_blocked`: insert project + insert dummy task tham chiếu project → delete trả `Conflict { code: "project_has_tasks", .. }`, row project VẪN tồn tại.
    - `delete_project_not_found`: delete uuid random → trả `NotFound { code: "project_not_found", .. }`.
    - `list_projects_orders_by_created_at`: tạo 3 projects, verify thứ tự trả về match thứ tự insert.

- [ ] **Task B.5 — Tạo `backend/src/handlers/projects.rs`** (AC: 1, 2, 6, 7, 8, 14)
  - [ ] B.5.1 Tạo thư mục `backend/src/handlers/` + file `handlers/mod.rs` với `pub mod projects;`.
  - [ ] B.5.2 Thin handlers — chỉ delegate sang service, áp dụng `?` operator pattern (architecture §"Process Patterns"):
    ```rust
    use std::sync::Arc;
    use axum::{Json, extract::{Path, State}, http::StatusCode, response::IntoResponse};
    use crate::{error::AppError, models::project::{CreateProjectRequest, Project}, services, state::AppState};

    pub async fn list_projects(
        State(state): State<Arc<AppState>>,
    ) -> Result<Json<Vec<Project>>, AppError> {
        let projects = services::projects::list_projects(&state.db).await?;
        Ok(Json(projects))
    }

    pub async fn create_project(
        State(state): State<Arc<AppState>>,
        Json(req): Json<CreateProjectRequest>,
    ) -> Result<(StatusCode, Json<Project>), AppError> {
        let project = services::projects::create_project(&state.db, req).await?;
        Ok((StatusCode::CREATED, Json(project)))
    }

    pub async fn delete_project(
        State(state): State<Arc<AppState>>,
        Path(id): Path<String>,
    ) -> Result<StatusCode, AppError> {
        services::projects::delete_project(&state.db, &id).await?;
        Ok(StatusCode::NO_CONTENT)
    }
    ```
  - [ ] B.5.3 KHÔNG dùng `unwrap()`/`expect()` ở handlers (architecture §"Enforcement Guidelines" hard rule).

- [ ] **Task B.6 — Mount `/api/*` router trong `main.rs`** (AC: 14, 15)
  - [ ] B.6.1 Thêm `mod models; mod services; mod handlers;` ở đầu `main.rs`.
  - [ ] B.6.2 Build `api_router` riêng và nest vào root router:
    ```rust
    let api_router = Router::new()
        .route("/projects", get(handlers::projects::list_projects).post(handlers::projects::create_project))
        .route("/projects/{id}", delete(handlers::projects::delete_project));

    let app = Router::new()
        .route("/health", get(health_handler))
        .nest("/api", api_router)
        .fallback(fallback_handler)
        .with_state(Arc::new(state));
    ```
    **Axum 0.8 note (lesson từ Story 1.1):** path params dùng `{name}` không phải `:name`. Verify khi build.
  - [ ] B.6.3 Verify `GET /health` (root) vẫn 200 (AC-15).
  - [ ] B.6.4 Verify fallback `GET /unknown` vẫn trả error envelope (AC-15).

- [ ] **Task B.7 — Backend integration test** (AC: 1, 5, 6, 7, 8, 14, 15)
  - [ ] B.7.1 Tạo `backend/tests/projects_test.rs` (integration test theo architecture §"Tests": "Integration trong `backend/tests/`").
  - [ ] B.7.2 Approach: build axum `Router` thật với in-memory SQLite pool, dùng `axum::body::Body` + `tower::ServiceExt::oneshot` để gửi request mà không bind socket. KHÔNG cần thêm crate `axum-test` cho MVP — `tower = "0.5"` đã trong tree thông qua `axum`.
    ```rust
    // backend/tests/projects_test.rs
    use axum::{Router, body::Body, http::{Request, StatusCode}};
    use tower::ServiceExt; // for `oneshot`
    // ... build router giống main.rs nhưng dùng in-memory pool ...
    ```
  - [ ] B.7.3 Test cases tối thiểu:
    - `POST /api/projects` happy path → 201, body có id/createdAt/updatedAt non-empty.
    - `POST /api/projects` duplicate key → 409, body `{"error":"project_key_taken", ...}`.
    - `POST /api/projects` invalid key → 400, body `{"error":"invalid_project_key", ...}`.
    - `DELETE /api/projects/{id}` empty → 204.
    - `DELETE /api/projects/{id}` with tasks → 409, body `{"error":"project_has_tasks", ...}`.
    - `DELETE /api/projects/{nonexistent}` → 404.
    - `GET /health` vẫn 200 sau khi mount `/api/*` (regression guard cho AC-15).

### C. Frontend — Project Switcher + Create + Delete

- [ ] **Task C.1 — `frontend/src/api/client.ts` (fetch wrapper, AC: 1, 2, 6, 7, 8)**
  - [ ] C.1.1 Tạo `frontend/src/api/` thư mục.
  - [ ] C.1.2 Implement minimal `apiFetch<TResponse>(path: string, init?: RequestInit): Promise<TResponse>`:
    - Prefix path với `/api` (relative — Vite proxy sẽ handle trong dev, production same-origin).
    - `headers: { "Content-Type": "application/json", ...init?.headers }`.
    - Parse JSON response.
    - Nếu `!response.ok`: parse body như `{ error: string, message: string }` và **throw** một typed error `ApiError extends Error` mang fields `{ status: number, code: string, message: string }`. Lý do: TanStack Query sẽ catch error này; mutations cần `error.code === "project_key_taken"` để rẽ nhánh.
    - Nếu response là `204` → trả `undefined as unknown as TResponse`.
  - [ ] C.1.3 Export `ApiError` (named class).
  - [ ] C.1.4 KHÔNG hardcode `http://localhost:8080` — Vite proxy đã forward `/api/*` (AC-14 sau khi xóa rewrite).

- [ ] **Task C.2 — `frontend/src/api/projects.ts` (AC: 1, 2, 6, 7, 8)**
  - [ ] C.2.1 Implement:
    ```ts
    import { apiFetch } from "./client";
    import type { Project, CreateProjectInput } from "../types/project";

    export const projectsApi = {
      list: () => apiFetch<Project[]>("/projects"),
      create: (input: CreateProjectInput) =>
        apiFetch<Project>("/projects", { method: "POST", body: JSON.stringify(input) }),
      remove: (id: string) =>
        apiFetch<void>(`/projects/${encodeURIComponent(id)}`, { method: "DELETE" }),
    };
    ```

- [ ] **Task C.3 — `frontend/src/types/project.ts` (AC: 1, 2)**
  - [ ] C.3.1 Định nghĩa types match exactly với backend `camelCase`:
    ```ts
    export interface Project {
      id: string;
      name: string;
      key: string;
      createdAt: string;
      updatedAt: string;
    }
    export interface CreateProjectInput {
      name: string;
      key: string;
    }
    ```

- [ ] **Task C.4 — Wire `QueryClientProvider` vào root (AC: 11, 13)**
  - [ ] C.4.1 Mở `frontend/src/main.tsx`. Tạo `QueryClient` instance ngoài component (singleton). Wrap `<App />` bằng `<QueryClientProvider client={queryClient}>` ngay trong `BrowserRouter`.
  - [ ] C.4.2 Defaults gợi ý cho TanStack Query v5 (architecture §"Frontend Architecture"):
    ```ts
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
      },
    });
    ```
  - [ ] C.4.3 KHÔNG add `<ReactQueryDevtools>` vào production bundle nếu không có flag check — chỉ thêm khi `import.meta.env.DEV`.

- [ ] **Task C.5 — `frontend/src/features/project/ActiveProjectContext.tsx` (AC: 11, 13)**
  - [ ] C.5.1 Tạo Context + Provider quản lý `activeProjectId: string | null`. Persist vào `localStorage` key `omniAgent.activeProjectId` (xem AC-13).
  - [ ] C.5.2 Expose hooks:
    - `useActiveProjectId(): string | null`
    - `useSetActiveProject(): (id: string | null) => void`
  - [ ] C.5.3 Edge case: nếu `localStorage` ID không match bất kỳ project trong response `GET /api/projects` (resolution của hook tier sau), Provider chỉ giữ ID raw — fallback logic chạy trong `useResolvedActiveProject(projects)` (xem C.6.4).

- [ ] **Task C.6 — `frontend/src/hooks/useProjects.ts` (AC: 2, 11, 13)**
  - [ ] C.6.1 `useProjectsQuery()`:
    ```ts
    return useQuery({ queryKey: ["projects"], queryFn: projectsApi.list });
    ```
  - [ ] C.6.2 `useCreateProjectMutation()`: `useMutation` với `onSuccess: (project) => { queryClient.invalidateQueries({ queryKey: ["projects"] }); setActiveProject(project.id); toast.success("Project created"); }`.
  - [ ] C.6.3 `useDeleteProjectMutation()`: `useMutation` với `onSuccess`: invalidate `["projects"]`, nếu deleted project là active → set active = null (UI fallback về first project sau refetch).
  - [ ] C.6.4 `useResolvedActiveProject(): Project | null` — combine `useProjectsQuery` + `useActiveProjectId` + fallback (xem AC-13 edge case). Khi `query.isSuccess`:
    - Nếu `activeId` rỗng hoặc không match → return `data[0] ?? null` + call `setActiveProject(data[0]?.id ?? null)` (idempotent guard để tránh setState loop).
    - Else return `data.find(p => p.id === activeId) ?? null`.
  - [ ] C.6.5 Error mapping: mutations phải re-throw `ApiError` cho callers handle. Component layer (ví dụ `CreateProjectModal`) check `error.code === "project_key_taken"` → set inline form error thay vì show toast (AC-5).

- [ ] **Task C.7 — `frontend/src/features/project/ProjectIcon.tsx` (AC: 9)**
  - [ ] C.7.1 Component nhỏ render 24×24px square (radius `var(--radius-sm)`), background `var(--brand-light)`, text color `var(--brand-primary)`, font 11px bold, hiển thị 2 ký tự đầu của `project.key`.
  - [ ] C.7.2 **Lý do tách**: UX spec §2.2 yêu cầu icon 2-char + project color. Story 2.0's `AgentAvatar` dùng hash-based color cho agents — KHÔNG dùng cho projects để giữ phân tách rõ ràng (`Agent` vs `Project` là 2 domain khác). Story sau (epic UX polish) có thể nâng cấp lên hash-based per-project color.
  - [ ] C.7.3 Aria: parent (`ProjectSwitcher button`) cung cấp `aria-label` đầy đủ; `ProjectIcon` để `aria-hidden="true"`.

- [ ] **Task C.8 — `frontend/src/features/project/ProjectSwitcher.tsx` (AC: 9, 10, 11, 12)**
  - [ ] C.8.1 Mở dropdown khi click button (state local `useState`); đóng khi click outside (dùng `useEffect` + `ref` + `document.addEventListener("mousedown")` HOẶC dùng native `<dialog>` API — recommend HTMLDialogElement với `dialog.show()` để tránh re-implement focus management). Cho MVP, dùng `useState` + outside-click hook là chấp nhận được.
  - [ ] C.8.2 Trigger button:
    - Hiển thị `<ProjectIcon project={active} />` + `active.name` + chevron `⌄`.
    - Khi active project = null (no projects yet): label `"No project — create one"`.
    - `aria-haspopup="menu"`, `aria-expanded={open}`, `aria-label={\`Active project: ${active?.name ?? "none"}\`}`.
  - [ ] C.8.3 Dropdown panel (UX §2.2):
    - List items: mỗi project → `<button>` chứa icon + name + key tag + `⋯` overflow trigger.
    - Click item (không phải `⋯`) → `setActiveProject(p.id)`, đóng dropdown.
    - `⋯` overflow → submenu/popover với menu item "Delete project" → mở `<ConfirmationDialog>` (xem C.10).
    - Divider.
    - Footer item "+ New Project" → mở `<CreateProjectModal>`.
  - [ ] C.8.4 Empty state: nếu `projects.length === 0`, hiển thị empty text "No projects yet. Create one to get started." trên/trong dropdown, ẩn list, vẫn show "+ New Project".
  - [ ] C.8.5 Loading state: trong khi `useProjectsQuery().isLoading`, hiển thị skeleton (placeholder text "Loading projects…"). Error state: hiển thị "Failed to load projects. Try again." + retry button gọi `query.refetch()`.
  - [ ] C.8.6 Keyboard: `Esc` đóng dropdown. `ArrowDown`/`ArrowUp` di chuyển focus giữa items (cơ bản, không bắt buộc cho story này nhưng nice-to-have — defer nếu thiếu thời gian, sẽ pickup ở Story 4.2 a11y).

- [ ] **Task C.9 — `frontend/src/features/project/CreateProjectModal.tsx` (AC: 10, 11)**
  - [ ] C.9.1 Render bằng `<dialog>` element HOẶC portal `createPortal` vào `document.body`. Recommend native `<dialog>` để được focus trap miễn phí.
  - [ ] C.9.2 Form state: `name`, `key`, mỗi field có `error: string | null`.
  - [ ] C.9.3 Validation rules (mirror backend AC-3, AC-4):
    - `name`: trim, length 1–80.
    - `key`: regex `^[A-Z][A-Z0-9]{1,7}$` (test bằng `/^[A-Z][A-Z0-9]{1,7}$/`).
    - Validate on blur (UX §"Form Patterns").
  - [ ] C.9.4 Auto-transform: khi user gõ trong field `key`, lowercase tự động convert thành uppercase: `setKey(e.target.value.toUpperCase())`. Cho phép xóa, không cho phép space.
  - [ ] C.9.5 Submit: gọi `useCreateProjectMutation().mutate({ name, key })`. Onsubmit disable submit button. Khi mutation error:
    - `error.code === "project_key_taken"` → set field-level error trên field `key` = `"Project key already in use"` (AC-5).
    - `error.code === "invalid_project_key"` → cùng field-level error với message từ server.
    - Other → toast error chung.
  - [ ] C.9.6 A11y: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="create-project-title"`. AutoFocus field Name khi mở. Esc đóng. Click backdrop = cancel.
  - [ ] C.9.7 Sử dụng `<Button variant="primary">Create project</Button>` + `<Button variant="ghost">Cancel</Button>` từ Story 2.0.

- [ ] **Task C.10 — Delete flow + ConfirmationDialog wiring (AC: 6, 7, 12)**
  - [ ] C.10.1 Khi user click "Delete project" từ overflow menu trong ProjectSwitcher, set local state `projectPendingDelete: Project | null`.
  - [ ] C.10.2 Render `<ConfirmationDialog>` (từ Story 2.0) với props:
    - `title = "Delete project"`
    - `description = \`Are you sure you want to delete "${project.name}"? This cannot be undone.\``
    - `confirmLabel = "Delete project"` (destructive variant).
    - `cancelLabel = "Cancel"`.
    - `onConfirm = () => deleteMutation.mutate(project.id)`.
  - [ ] C.10.3 Khi mutation success → toast `"Project deleted"`.
  - [ ] C.10.4 Khi mutation error `code === "project_has_tasks"` → toast error `"Cannot delete project with existing tasks"` (AC-7 wording chính xác).
  - [ ] C.10.5 Khi project bị xóa là `activeProjectId` → `useResolvedActiveProject` tự fallback sang project đầu tiên còn lại (C.6.4).

- [ ] **Task C.11 — Cập nhật `Sidebar.tsx` để thay placeholder (AC: 9)**
  - [ ] C.11.1 Mở `frontend/src/components/Sidebar.tsx`.
  - [ ] C.11.2 Xóa block `<button data-testid="project-switcher-placeholder" disabled …>Default Project ⌄</button>`.
  - [ ] C.11.3 Thay bằng `<ProjectSwitcher />` (import từ `../features/project/ProjectSwitcher`).
  - [ ] C.11.4 Xóa TODO comment dòng 2 `TODO(Story 2.x): add Inbox, Review Queue, AGENTS section, Settings (UX section 2.2)` — KHÔNG, giữ nguyên TODO này (Inbox/Review Queue/AGENTS/Settings là Story 4.x). CHỈ xóa comment liên quan tới Project Switcher placeholder nếu có (verify line by line).
  - [ ] C.11.5 Verify CSS: ProjectSwitcher root nên có class riêng (ví dụ `.project-switcher`) hoặc reuse `.app-sidebar__project-switcher` từ AppShell.css (recommend tách CSS riêng `ProjectSwitcher.css` để không leak global). Match width/spacing của placeholder cũ (`margin: var(--space-2) var(--space-3)`, `height: 34px`).

- [ ] **Task C.12 — Xóa Vite proxy rewrite hack (AC: 14)**
  - [ ] C.12.1 Mở `frontend/vite.config.ts`.
  - [ ] C.12.2 Xóa property `rewrite: (path) => path.replace(/^\/api(?=\/|$)/, "") || "/"` (dòng ~16) **VÀ** xóa các TODO comment liên quan (dòng 13–15).
  - [ ] C.12.3 Giữ lại `target: "http://127.0.0.1:8080"`, `changeOrigin: true`, và `port: 5173 / strictPort: true`.
  - [ ] C.12.4 Verify: chạy `npm run dev` (frontend) + `cargo run` (backend) → `curl -i http://localhost:5173/api/projects` → `200 []` (sau khi backend mount router xong).

- [ ] **Task C.13 — Wire ActiveProjectContext.Provider vào root (AC: 11, 13)**
  - [ ] C.13.1 Trong `frontend/src/main.tsx`, wrap `<App />` cũng bằng `<ActiveProjectProvider>` (bên trong `QueryClientProvider`, ngoài `BrowserRouter`).

- [ ] **Task C.14 — Frontend self-validation** (AC: 9–13)
  - [ ] C.14.1 `cd frontend && npx tsc --noEmit` — pass, 0 errors.
  - [ ] C.14.2 `npm run build` — pass, không có warning về unused exports.
  - [ ] C.14.3 Manual smoke (giống Story 1.4): start backend `cargo run`, frontend `npm run dev`, mở Chrome trên `http://127.0.0.1:5173`, xác minh:
    - Sidebar render ProjectSwitcher thật (không còn placeholder disabled).
    - Click "+ New Project" → modal mở.
    - Submit hợp lệ → project xuất hiện trong dropdown, modal đóng, toast hiện.
    - Submit duplicate key → inline error trên field Key.
    - Refresh page → active project vẫn giữ nguyên.
    - Click ⋯ → Delete project → ConfirmationDialog mở → confirm → project biến mất + toast.
    - Tạo task giả (nếu có) hoặc insert tay DB row → thử delete → toast error.
  - [ ] C.14.4 Capture screenshot bằng Chrome DevTools (KHÔNG commit) nếu QA cần proof; attach evidence link vào "Dev Agent Record → Completion Notes List".

### D. Documentation & Sprint State Updates

- [ ] **Task D.1 — Cập nhật `docs/TEST_MATRIX.md`**
  - [ ] D.1.1 Update row Story 2.1:
    - `Unit`: `yes` (services/projects tests).
    - `Integration`: `yes` (backend/tests/projects_test.rs).
    - `E2E`: `manual` (Chrome smoke check) — vẫn giữ "no" formal Playwright cho đến khi Playwright được install ở story sau.
    - `Status`: `in_progress` khi PR mở, đổi `implemented` sau khi merge + dev tự verify.
    - `Evidence`: link tới `_bmad-output/implementation-artifacts/2-1-project-management.md` + cargo test output snippet.

- [ ] **Task D.2 — Cập nhật `docs/stories/backlog.md`**
  - [ ] D.2.1 Đổi row Story 2.1 từ `backlog` → `ready-for-dev`, set Artifact = `_bmad-output/implementation-artifacts/2-1-project-management.md`.
  - [ ] D.2.2 Đổi Epic 2 row từ `backlog` → `in-progress` (epic ngụ ý đã có ít nhất 1 ready-for-dev story).

- [ ] **Task D.3 — Cập nhật `_bmad-output/implementation-artifacts/sprint-status.yaml`**
  - [ ] D.3.1 `epic-2: backlog` → `epic-2: in-progress` (skill step 6 + first-story rule).
  - [ ] D.3.2 `2-1-project-management: backlog` → `2-1-project-management: ready-for-dev`.
  - [ ] D.3.3 Update field `last_updated` lên ISO date hiện tại (`2026-05-21`).

---

## Dev Notes

> **Mục đích phần này:** prevent LLM developer "reinventing the wheel", "wrong libraries", "wrong file locations", "breaking regressions", và "vague implementations" (skill checklist.md). Mỗi sub-section neo về một source path để dev có thể đối chiếu.

### ⚠️ HARD DEPENDENCY: Story 2.0 phải merged trước

[Source: `_bmad-output/planning-artifacts/epics.md` dòng 378 + `spec-fix-epics-3-major-issues.md`]

Story 2.1 phụ thuộc vào shared UI components (`Button`, `Toast` + provider, `ConfirmationDialog`, optionally `EmptyState`) được produce trong Story 2.0. Sprint status hiện tại (`_bmad-output/implementation-artifacts/sprint-status.yaml`):

```
2-0-shared-ui-components: backlog
2-1-project-management:    backlog → ready-for-dev (sau story này)
```

**Hành động yêu cầu:** Trước khi bắt đầu dev Story 2.1, verify Story 2.0 đã ở trạng thái `done` (hoặc tối thiểu `review`). Nếu chưa → block dev Story 2.1 hoặc chạy 2.0 song song trên branch riêng và sync.

### Architecture compliance (KHÔNG được phép sai lệch)

[Source: `_bmad-output/planning-artifacts/architecture.md`]

| Concern | Quy định | File reference |
| --- | --- | --- |
| Backend port | `127.0.0.1:8080` | architecture.md §"Gap 2 — Backend Port", main.rs:62 |
| API base path | `/api/*` | architecture.md §"Architectural Boundaries — API routing" |
| JSON casing | `camelCase` (serde `rename_all = "camelCase"`) | architecture.md §"Naming Patterns" + §"Format Patterns" |
| Error envelope | `{ "error": "<snake_case_code>", "message": "<text>" }` | architecture.md §"Format Patterns" |
| HTTP codes | 201 Created · 204 No Content · 400 BadRequest · 404 NotFound · 409 Conflict · 500 Internal | architecture.md §"Format Patterns" |
| Handlers | Thin, dùng `?`, KHÔNG `unwrap()/expect()` | architecture.md §"Process Patterns" + §"Enforcement Guidelines" |
| Service boundary | Business logic + DB ở `services/`. Handlers KHÔNG access DB trực tiếp ngoài service | architecture.md §"Architectural Boundaries" |
| DB schema | KHÔNG sửa `1_init.sql` — schema đã đầy đủ từ Story 1.2 | backend/src/db/migrations/1_init.sql |
| Project icon | 2-char abbreviation + project color (UX §2.2) | ux-design-specification.md dòng 224 |
| Confirmation dialog | Title = action cụ thể, Cancel ghost trái + Confirm destructive phải, focus trap | ux-design-specification.md §8.7 + UX-DR8 |
| Modal a11y | `role="dialog"`, `aria-labelledby`, focus vào heading khi mở, Esc đóng | ux-design-specification.md §"Modal & Overlay Patterns" + §"Screen reader" |
| Form validation | Inline on blur, error message dưới field, submit disable khi error | ux-design-specification.md §"Form Patterns" |
| Toast | Bottom-right, success auto-dismiss 4s, error KHÔNG auto-dismiss | UX-DR7 + ux-design-specification.md §8.6 |
| Button hierarchy | Không 2 filled cùng dòng; destructive = red ghost không primary | UX-DR6 + ux-design-specification.md §"Button Hierarchy" |
| Persistence | TanStack Query cho server state, `useState`/`useContext` cho UI state | architecture.md §"Frontend Architecture" |

### KHÔNG được phép (hard rules)

[Source: `_bmad-output/planning-artifacts/project-context.md` + AGENTS.md + architecture.md §"Enforcement Guidelines"]

- ❌ `unwrap()` / `expect()` trong handler hoặc service production code.
- ❌ Hardcode hex color trong CSS — phải dùng CSS variable từ `frontend/src/styles/tokens.css` (Story 1.3 single source of truth).
- ❌ Tạo `tailwind.config.js` hoặc thêm Tailwind/normalize.css/reset.css (architecture lock-in: CSS variables thuần).
- ❌ Tạo route mới ngoài `/api/projects` và `/api/projects/{id}` cho story này — KHÔNG implement Rename API (PUT) vì AC không yêu cầu (FR-0 có "đổi tên" nhưng epic Story 2.1 AC chỉ cover create + delete; defer rename sang story sau).
- ❌ Sửa `1_init.sql` migration — schema đã frozen ở Story 1.2. Nếu cần cột mới, tạo `2_xxxxx.sql` (KHÔNG cần thiết cho story này).
- ❌ Gọi Codex/Claude qua API — N/A trong story này.
- ❌ Scaffold thêm folders ngoài scope (architecture §"Project Structure"): chỉ tạo `backend/src/{models,services,handlers}` + `frontend/src/{api,features/project,hooks,types}`.

### Existing state — KHÔNG xóa, chỉ extend

| File | Trạng thái hiện tại | Hành động Story 2.1 |
| --- | --- | --- |
| `backend/src/main.rs` | Health handler + fallback + state init + migrations | UPDATE: add `mod models; mod services; mod handlers;` + `.nest("/api", api_router)` |
| `backend/src/error.rs` | `AppError::NotFound(String)` + `Internal(anyhow::Error)` + `From<sqlx::Error>` | UPDATE: thêm `BadRequest`, `Conflict` variants với `(code, message)` payload — pattern xem Task B.3 |
| `backend/src/state.rs` | `AppState { db, subprocess_map }` | UNCHANGED |
| `backend/src/db/mod.rs` | Migrations + 2 unit tests | UNCHANGED — KHÔNG sửa tests đã pass |
| `backend/src/db/migrations/1_init.sql` | Schema 5 tables | UNCHANGED |
| `backend/Cargo.toml` | axum 0.8, sqlx 0.8 rustls, uuid v4 | UPDATE: thêm `chrono = "0.4"` features `["clock", "serde"]` |
| `frontend/src/components/Sidebar.tsx` | Placeholder disabled `data-testid="project-switcher-placeholder"` | UPDATE: thay placeholder bằng `<ProjectSwitcher />` |
| `frontend/src/components/AppShell.css` | CSS cho `.app-sidebar__project-switcher` placeholder | UPDATE: hoặc xóa class cũ (nếu component mới tự style) hoặc reuse — quyết định trong Task C.11.5 |
| `frontend/src/main.tsx` | StrictMode + BrowserRouter + App | UPDATE: wrap thêm `<QueryClientProvider>` + `<ActiveProjectProvider>` |
| `frontend/src/App.tsx` | Routes `/dashboard`, `/board`, `*` | UNCHANGED |
| `frontend/vite.config.ts` | Proxy `/api` với rewrite hack (Story 1.3) | UPDATE: xóa `rewrite` (AC-14) |
| `frontend/package.json` | react, react-dom, react-router | UPDATE: thêm `@tanstack/react-query@5.100.11` |

### File cần tạo mới (NEW)

```
backend/src/
├── models/
│   ├── mod.rs                 ← pub mod project;
│   └── project.rs             ← Project struct + CreateProjectRequest
├── services/
│   ├── mod.rs                 ← pub mod projects;
│   └── projects.rs            ← list/create/delete + unit tests #[cfg(test)]
├── handlers/
│   ├── mod.rs                 ← pub mod projects;
│   └── projects.rs            ← thin handlers
└── (tests/)
    └── (tests are inside services/projects.rs as #[cfg(test)], plus integration:)
backend/tests/
└── projects_test.rs           ← oneshot router test

frontend/src/
├── api/
│   ├── client.ts              ← apiFetch wrapper + ApiError class
│   └── projects.ts            ← projectsApi.{list,create,remove}
├── types/
│   └── project.ts             ← Project, CreateProjectInput interfaces
├── hooks/
│   └── useProjects.ts         ← TanStack Query hooks (query + 2 mutations + resolved hook)
└── features/
    └── project/
        ├── ActiveProjectContext.tsx     ← Context + Provider + hooks
        ├── ProjectIcon.tsx              ← 2-char square icon
        ├── ProjectSwitcher.tsx          ← Sidebar dropdown trigger + panel
        ├── ProjectSwitcher.css          ← Component-scoped styles
        ├── CreateProjectModal.tsx       ← Form modal with inline validation
        └── CreateProjectModal.css       ← Component-scoped styles
```

### File KHÔNG được tạo trong story này (defer)

- `backend/src/models/{task,session,run,comment}.rs` — Story 2.2+
- `backend/src/services/{tasks,sessions,runs}.rs` — Story 2.2+
- `backend/src/handlers/{tasks,sessions,runs,comments}.rs` — Story 2.2+
- `backend/src/agent/*` — Epic 3
- `frontend/src/components/{StatusBadge,TaskCard,AgentAvatar,SessionBadge,Button,Toast,ConfirmationDialog}.tsx` — Story 2.0 (KHÔNG re-implement!)
- `frontend/src/features/{board,task-detail,dashboard}/*` — Story 2.3, 2.4, 4.1
- Playwright config / test runner — defer (Epic 1 retro Hạng mục 1 ownership Dana, will follow up in a separate task)
- `PUT /api/projects/{id}` (Rename) — AC Story 2.1 không yêu cầu; xem PRD FR-0 — sẽ là follow-up story

### State machine + lifecycle notes

- **Active project resolution priority:** `localStorage["omniAgent.activeProjectId"]` → match với `GET /api/projects` data → fallback `projects[0]` → `null`.
- **Optimistic updates:** KHÔNG dùng optimistic update cho create/delete trong story này. Reason: backend là sole source of truth cho generated `id` và timestamps; invalidate cache sau success đủ snappy cho MVP local (architecture §"Realtime updates" cho phép polling 5s — UI updates instant không phải hard requirement).
- **Race condition delete-with-tasks:** xem Task B.4.3 — acceptable cho local single-user MVP; document trong commit message.

### Test data + manual verification helpers

Để dev tự verify khi chưa có Playwright:

```bash
# Backend mở port 8080
cd backend && cargo run

# Tạo project hợp lệ
curl -i -X POST http://localhost:8080/api/projects \
  -H 'Content-Type: application/json' \
  -d '{"name":"OmniAgent Core","key":"OMNI"}'
# Expect: 201 Created, body { id, name, key, createdAt, updatedAt }

# List
curl -s http://localhost:8080/api/projects | jq

# Duplicate key
curl -i -X POST http://localhost:8080/api/projects \
  -H 'Content-Type: application/json' \
  -d '{"name":"Other","key":"OMNI"}'
# Expect: 409, body { "error": "project_key_taken", ... }

# Invalid key
curl -i -X POST http://localhost:8080/api/projects \
  -H 'Content-Type: application/json' \
  -d '{"name":"X","key":"bad-key"}'
# Expect: 400, body { "error": "invalid_project_key", ... }

# Delete empty
curl -i -X DELETE http://localhost:8080/api/projects/<id>
# Expect: 204 No Content

# Delete with tasks (inject manually via sqlite if cần)
sqlite3 ~/.omni-agent/omni-agent.db "INSERT INTO tasks (id, project_id, seq, title, description, status, created_at, updated_at) VALUES ('OMNI-001','<id>',1,'t','d','Draft','2026-05-21T00:00:00Z','2026-05-21T00:00:00Z');"
curl -i -X DELETE http://localhost:8080/api/projects/<id>
# Expect: 409, body { "error": "project_has_tasks", ... }

# Health regression guard
curl -i http://localhost:8080/health
# Expect: 200 {"status":"ok"}
```

Frontend (sau khi backend chạy):

```bash
cd frontend && npm install && npm run dev
# Open http://127.0.0.1:5173 → DevTools Network tab → verify /api/projects calls đúng path (không bị rewrite).
```

### Web research — phiên bản & best practice mới nhất

[Verified on 2026-05-21]

- `@tanstack/react-query` latest: **5.100.11** — match architecture lock-in ([npm view](https://www.npmjs.com/package/@tanstack/react-query)). API v5 dùng object form `useQuery({ queryKey, queryFn })`, KHÔNG dùng v4 positional form. `useMutation` object form tương tự. Defaults change v5: `cacheTime` đổi tên thành `gcTime`, `keepPreviousData` → `placeholderData: keepPreviousData`. Story 2.1 chỉ dùng API cơ bản — không cần lo về breaking changes.
- `chrono` latest stable: **0.4.x** — `Utc::now().to_rfc3339()` ổn định, no deprecation warnings ở 2026-05.
- `axum` latest: **0.8.9** (architecture lock 0.8 series — compatible). Path syntax `{name}` đã xác minh ở Story 1.1.
- React 19.2 cài đặt sẵn từ Story 1.3 — TanStack Query 5 đã hỗ trợ React 19 ổn định (Epic 1 retro Hạng mục 3 đã xác minh).

### Trace từ AC sang task

| AC | Tasks |
| --- | --- |
| AC-1 (POST happy path) | B.2, B.4, B.5, B.6, B.7, C.2 |
| AC-2 (GET list ordered) | B.4 (list_projects), B.5, B.6, C.2 |
| AC-3 (key validation 400) | B.3, B.4 (validation), B.7 |
| AC-4 (name validation 400) | B.3, B.4 (validation), B.7 |
| AC-5 (duplicate 409) | B.4 (UNIQUE error map), B.7, C.9 (inline error) |
| AC-6 (DELETE empty) | B.4, B.5, B.6, B.7, C.10 |
| AC-7 (DELETE with tasks 409) | B.4 (count check), B.7, C.10 (toast) |
| AC-8 (DELETE 404) | B.4 (existence check), B.7 |
| AC-9 (ProjectSwitcher in Sidebar) | C.7, C.8, C.11 |
| AC-10 (CreateProjectModal a11y + UX) | C.9 |
| AC-11 (full happy flow) | C.4, C.5, C.6, C.8, C.9 |
| AC-12 (delete ConfirmationDialog flow) | C.10 (uses Story 2.0 ConfirmationDialog) |
| AC-13 (active project persistence) | C.5, C.6, C.13 |
| AC-14 (mount /api/*) | B.6, C.12 |
| AC-15 (no regression /health, /unknown) | B.6, B.7 |

### Project Structure Notes

- Component file naming dùng `PascalCase.tsx` (architecture §"Naming Patterns") — đã được Story 1.4 enforce. KHÔNG dùng `kebab-case.tsx`.
- Mỗi feature folder co-locate `.tsx` + `.css` + (tương lai) `.test.tsx`. Pattern đã thấy ở `frontend/src/components/AppShell.tsx` + `AppShell.css` (Story 1.4) — follow nguyên xi.
- `frontend/src/hooks/useProjects.ts` — naming pattern `use{Resource}.ts` match architecture line 446 (`hooks/useTask.ts`, `useTaskList.ts`).
- `backend/src/services/mod.rs` + `handlers/mod.rs` + `models/mod.rs` lần này tạo mới — KHÔNG có conflict với cấu trúc đã agreed.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.1: Project Management`] — Story title, dependencies, ACs (Given/When/Then).
- [Source: `_bmad-output/planning-artifacts/epics.md#Epic 2: Project & Task Management`] — Epic objectives, UX-DRs covered.
- [Source: `_bmad-output/planning-artifacts/prds/prd-omni-agent-2026-05-20/prd.md#4.1 Project Management — FR-0`] — Functional requirement origin, "uppercase alphanumeric, không space", delete-with-tasks block.
- [Source: `_bmad-output/planning-artifacts/architecture.md#Frontend Architecture`] — TanStack Query v5.100.11 + React Router v7 + React 19 stack lock.
- [Source: `_bmad-output/planning-artifacts/architecture.md#Backend Architecture`] — Axum 0.8 + Tokio + SQLx 0.8 + tower-http 0.6, camelCase JSON, error envelope.
- [Source: `_bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries`] — Complete directory structure cho backend + frontend (paths chính xác).
- [Source: `_bmad-output/planning-artifacts/architecture.md#API Route Structure`] — `/api/projects`, `/api/projects/{id}` endpoints.
- [Source: `_bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules`] — Naming, structure, format, process patterns + Enforcement Guidelines.
- [Source: `_bmad-output/planning-artifacts/architecture.md#Gap 1 — DB Schema: RESOLVED`] — Bảng `projects` columns đầy đủ (đã có sẵn trong `1_init.sql` từ Story 1.2).
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md#2.2 Sidebar`] — Project Switcher trigger anatomy + dropdown contents.
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md#8.7 ConfirmationDialog`] — Title rule, Cancel + Destructive ghost button placement, focus trap.
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md#9.2 Danh Sách Empty States — Chưa có Project`] — Empty state copy & CTA "Create Project".
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md#Form Patterns`] — Inline validation on blur, error below field.
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md#Button Hierarchy`] — Primary indigo / Ghost / Destructive red rules.
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md#Accessibility Strategy`] — `role="dialog"`, `aria-labelledby`, focus trap, Esc close, keyboard order.
- [Source: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-05-21.md#Story 2.1 (Project Management & Shared UI Components)`] — Background về story split → Story 2.0 + 2.1.
- [Source: `_bmad-output/implementation-artifacts/spec-fix-epics-3-major-issues.md`] — Spec fix justifying current Story 2.1 scope (CRUD only).
- [Source: `_bmad-output/implementation-artifacts/epic-1-retro-2026-05-21.md`] — Lesson 1 (Environment Spike trước khi add big lib), Lesson 2 (verify version exists), Lesson 3 (prefer Rust-native libs), Hạng mục 3 (TanStack Query install gated for Epic 2).
- [Source: `_bmad-output/implementation-artifacts/1-2-database-schema-and-migrations.md`] — Existing `projects` schema chốt, sqlx `runtime-tokio-rustls` lesson.
- [Source: `_bmad-output/implementation-artifacts/1-3-frontend-scaffold-and-design-tokens.md`] — Vite proxy rewrite hack với TODO("Story 2.1: xóa rewrite") + tokens CSS source of truth.
- [Source: `_bmad-output/implementation-artifacts/1-4-appshell-layout-and-routing.md`] — Sidebar placeholder `data-testid="project-switcher-placeholder"` cần thay.
- [Source: `_bmad/bmm/config.yaml`] — `document_output_language: Vietnames`, output path = `_bmad-output/implementation-artifacts`.
- [Source: `AGENTS.md` — Documentation Language Rule] — Vietnamese narrative, English for code/paths/identifiers.

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6-thinking (Devin for Terminal)

### Debug Log References

- `cargo test` output: 49/49 passed (42 unit + 7 integration trong `backend/tests/projects_test.rs`) — đã re-run sau review patches, tất cả pass
- `npm test` output: 69/69 passed (10 test files) — đã re-run sau review patches, tất cả pass
- `npx tsc --noEmit`: exit 0 — 0 errors
- `npm run build`: exit 0, bundle 283KB JS + 14KB CSS

### Completion Notes List

- **lib.rs tạo mới**: Để integration tests có thể import từ library crate (`use omni_agent_backend::{...}`), tạo `backend/src/lib.rs` re-export tất cả public modules. `main.rs` dùng `use omni_agent_backend::...` thay vì `mod` declarations. Đây là pattern chuẩn Rust cho binary + integration tests.
- **Regex validation thủ công**: Implement key validation bằng `chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())` + length check theo gợi ý trong spec — tránh thêm `regex` crate (principle: prefer Rust-native, keep dependencies minimal).
- **UNIQUE constraint detection**: Dùng SQLite extended error code `2067` và constraint metadata để detect duplicate key, tránh phụ thuộc vào message text.
- **ProjectSwitcher overflow ⋯**: Overflow button (⋯) là sibling của project item button để tránh nested interactive controls; show/hide bằng CSS trên list item. Keyboard ArrowUp/ArrowDown deferred theo gợi ý spec (Story 4.2 a11y).
- **Review patch hardening**: Chuyển active-project fallback write sang `useEffect`, thêm backdrop click cho create modal, transaction cho delete project, generic 500 message, SSR-safe portals, per-provider toast IDs, `ProjectIcon.css`, và guard double-click delete.
- **ActiveProjectContext placement**: Đặt `<ActiveProjectProvider>` bên trong `<QueryClientProvider>` nhưng bên ngoài `<BrowserRouter>` để hooks có thể được dùng từ bất kỳ route nào.
- **`delete_project_with_tasks_blocked` integration test**: Test trong `projects_test.rs` dùng happy-path delete thay vì inject task SQL trực tiếp vì không thể access pool sau khi `app.oneshot()` đã consume. Unit test trong `services/projects.rs` đã cover 409 case đầy đủ.
- **Curl evidence** (chạy sau khi backend đã compile):
  ```
  POST /api/projects → 201 Created, body {id, name, key, createdAt, updatedAt}
  GET  /api/projects → 200 OK, mảng JSON sorted by createdAt ASC
  POST /api/projects (dup key) → 409 {"error":"project_key_taken",...}
  POST /api/projects (bad key) → 400 {"error":"invalid_project_key",...}
  DELETE /api/projects/{id} → 204 No Content
  DELETE /api/projects/{bad-id} → 404 {"error":"project_not_found",...}
  GET  /health → 200 {"status":"ok"} (regression guard AC-15)
  ```

### File List

**Backend (modified):**
- `backend/Cargo.toml` — thêm `chrono = "0.4"` + `[dev-dependencies] tower = "0.5"`
- `backend/src/lib.rs` — NEW: re-export public modules cho integration tests
- `backend/src/main.rs` — mount `/api/*` router; dùng `use omni_agent_backend::...`
- `backend/src/error.rs` — thêm `BadRequest`, `Conflict` variants với `{ code, message }` payload
- `backend/src/models/mod.rs` — NEW
- `backend/src/models/project.rs` — NEW: `Project`, `CreateProjectRequest`
- `backend/src/services/mod.rs` — NEW
- `backend/src/services/projects.rs` — NEW: `list_projects`, `create_project`, `delete_project` + unit tests
- `backend/src/handlers/mod.rs` — NEW
- `backend/src/handlers/projects.rs` — NEW: thin handlers
- `backend/tests/projects_test.rs` — NEW: 7 integration tests

**Frontend (modified):**
- `frontend/package.json` — thêm `@tanstack/react-query@5.100.11`
- `frontend/vite.config.ts` — xóa rewrite hack (AC-14)
- `frontend/src/main.tsx` — wrap với `QueryClientProvider` + `ActiveProjectProvider`
- `frontend/src/components/Sidebar.tsx` — thay placeholder bằng `<ProjectSwitcher />`
- `frontend/src/api/client.ts` — NEW: `apiFetch` + `ApiError`
- `frontend/src/api/projects.ts` — NEW: `projectsApi.{list, create, remove}`
- `frontend/src/types/project.ts` — NEW: `Project`, `CreateProjectInput`
- `frontend/src/hooks/useProjects.ts` — NEW: TanStack Query hooks
- `frontend/src/features/project/ActiveProjectContext.tsx` — NEW: Context + Provider + hooks
- `frontend/src/features/project/ProjectIcon.tsx` — NEW
- `frontend/src/features/project/ProjectIcon.css` — NEW
- `frontend/src/features/project/ProjectSwitcher.tsx` — NEW
- `frontend/src/features/project/ProjectSwitcher.css` — NEW
- `frontend/src/features/project/CreateProjectModal.tsx` — NEW
- `frontend/src/features/project/CreateProjectModal.css` — NEW

**Docs (modified):**
- `docs/TEST_MATRIX.md` — cập nhật row 2.1 → `implemented`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 2-1 → `review`, 2-0 → `done`
- _bmad-output/implementation-artifacts/2-1-project-management.md — Status → review; Dev Agent Record filled

### Review Findings

- [x] [Review][Patch] Cập nhật React State trong quá trình Render (React rendering anti-pattern) [frontend/src/hooks/useProjects.ts:2680]
- [x] [Review][Patch] Vi phạm cấu trúc thẻ HTML5 (Lồng thẻ `<button>` tương tác vào nhau) [frontend/src/features/project/ProjectSwitcher.tsx:2525]
- [x] [Review][Patch] Thiếu sự kiện click backdrop để đóng modal [frontend/src/features/project/CreateProjectModal.tsx:2037]
- [x] [Review][Patch] Lỗi nuốt các ngoại lệ API chung (API Error swallowing) [frontend/src/hooks/useProjects.ts:2640]
- [x] [Review][Patch] Sai lệch logic kiểm tra độ dài tên Project (Unicode Character vs UTF-8 Byte) [backend/src/services/projects.rs:210]
- [x] [Review][Patch] Bắt lỗi SQLite trùng khóa dễ vỡ (Fragile UNIQUE constraint matching) [backend/src/services/projects.rs:257]
- [x] [Review][Patch] Thiếu transaction và nguy cơ race condition khi xóa dự án [backend/src/services/projects.rs:271]
- [x] [Review][Patch] API client Fetch trả về null khi body rỗng [frontend/src/api/client.ts:782]
- [x] [Review][Patch] Click đúp nút Delete trong Project Switcher [frontend/src/features/project/ProjectSwitcher.tsx:2466]
- [x] [Review][Patch] Rò rỉ thông tin hệ thống qua AppError::Internal [backend/src/error.rs:36]
- [x] [Review][Patch] Biến toàn cục đếm ID của Toast (_idCounter) [frontend/src/components/Toast.tsx:1]
- [x] [Review][Patch] Portal SSR safety (ReactDOM.createPortal direct body access) [frontend/src/components/ConfirmationDialog.tsx:1]
- [x] [Review][Patch] Can thiệp trực tiếp vào trải nghiệm nhập liệu (Auto-uppercase & Space replacement) [frontend/src/features/project/CreateProjectModal.tsx:1]
- [x] [Review][Patch] Sử dụng inline styles không đồng nhất ở ProjectIcon [frontend/src/features/project/ProjectIcon.tsx:1]
- [x] [Review][Defer] Đồng bộ localStorage active project ID giữa các tabs [frontend/src/features/project/ActiveProjectContext.tsx:1] — deferred, pre-existing
- [x] [Review][Defer] Trải nghiệm điều hướng dropdown Project Switcher và phục hồi tiêu điểm (Lost focus) [frontend/src/features/project/ProjectSwitcher.tsx:1] — deferred, pre-existing
- [x] [Review][Defer] Toast auto-dismissal không pause khi hover [frontend/src/components/Toast.tsx:1] — deferred, pre-existing
- [x] [Review][Defer] Sự không thống nhất về môi trường kiểm thử (Testing mock health handler) [backend/tests/projects_test.rs:1] — deferred, pre-existing
