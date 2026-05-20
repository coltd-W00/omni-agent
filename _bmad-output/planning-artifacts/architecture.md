---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-05-21'
inputDocuments:
  - "_bmad-output/planning-artifacts/prds/prd-omni-agent-2026-05-20/prd.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
  - "docs/US-omni-agent.md"
  - "_bmad-output/project-context.md"
workflowType: 'architecture'
project_name: 'omni-agent'
user_name: 'Loc'
date: '2026-05-20'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

12 FRs chia thành 4 feature group:

| Group | FRs | Ý nghĩa kiến trúc |
|---|---|---|
| Project Management (FR-0) | 1 | CRUD đơn giản, scoped task ID per project |
| Task Management (FR-1–4) | 4 | Kanban 8 trạng thái, state machine chặt chẽ |
| Session Lifecycle (FR-5–8) | 4 | **Core complexity** — subprocess, session ID capture, run log |
| Comment & Detail (FR-9–12) | 4 | Comment-as-input, session panel, per-state action buttons |

**Non-Functional Requirements:**

| NFR | Nguồn | Tác động kiến trúc |
|---|---|---|
| Subprocess sống độc lập với HTTP request | FR-6, project-context | Backend là process owner, không thể dùng request-scoped lifecycle |
| Session ID phải capture được sau spawn | FR-5 | Cần output-parsing layer và fallback scan `~/.codex/sessions/` |
| Log dual-storage: file + DB tail | FR-8 | File I/O async + DB write không được block nhau |
| Resume command khác nhau per-agent | FR-7 | Per-agent config abstraction (AgentStrategy hoặc enum dispatch) |
| Flush Running → Paused trước shutdown | FR-6 | Graceful shutdown handler bắt buộc |
| WCAG 2.1 AA | UX Spec §responsive-accessibility | Semantic HTML, aria-live, focus trap, contrast 4.5:1 |
| Resume ≤ 30 giây từ click đến subprocess | SM-3 | UI optimistic state update, không chờ API round-trip |
| Status update in-place, không reload board | UX §8.8 | Frontend polling hoặc SSE, không full-page refresh |

**Scale & Complexity:**

- Primary domain: Local full-stack (Rust backend + React frontend)
- Complexity level: **Medium** — không có multi-tenancy, không cloud, không realtime streaming MVP
- Estimated architectural components: ~8 backend modules, ~15 frontend components

---

### Technical Constraints & Dependencies

1. **No realtime streaming MVP** — FR-8 ghi rõ out of scope. Nhưng UX spec yêu cầu "live timeline auto-refresh 5s" → cần **polling endpoint** (không SSE/WebSocket cho MVP).
2. **Subprocess không qua API** — Codex/Claude chỉ được gọi qua `tokio::process::Command::spawn`. Không gọi qua HTTP.
3. **SQLite single-file** — source of truth duy nhất, không sync, connection pool bắt buộc (không single connection).
4. **Local only, single-user** — không có auth layer, không có multi-tenant concern.
5. **Per-agent resume format khác nhau** — Claude: `claude --continue --session-id <uuid>` + stdin; Codex: `codex resume <uuid>` + stdin/prompt. Cần abstraction.
6. **Session ID capture không đảm bảo** — phải có timeout, warning log, và manual input fallback.
7. **Backend shutdown safety** — tất cả subprocess Running phải flush → Paused trước khi process exit.

---

### Cross-Cutting Concerns Identified

| Concern | Ảnh hưởng tới |
|---|---|
| **Process ownership** | Subprocess không gắn với HTTP request hay browser session — backend quản lý toàn bộ lifecycle |
| **State machine enforcement** — 8 trạng thái, transition chặt | DB layer + API validation + Frontend render logic |
| **Optimistic UI** — status đổi ngay khi action, revert nếu fail | Frontend state + error toast pattern |
| **Async I/O** — subprocess spawn, file write, DB write phải non-blocking | Toàn bộ Rust async layer |
| **Per-agent config abstraction** | Spawn logic, resume logic, session ID parser |
| **Log lifecycle** — file tồn tại kể cả khi app đóng/mở lại | File path lưu trong DB Run record |
| **Comment "sent" tracking** — comment đã dùng không gửi lại | DB flag + UI display |
| **Graceful shutdown** | Tokio signal handler, flush DB trước exit |
| **Accessibility** — WCAG AA, focus trap, aria-live, keyboard nav | Toàn bộ React component layer |

---

## Starter Template Evaluation

### Primary Technology Domain

**Full-stack local app**: React + TypeScript frontend (SPA) + Rust backend (REST API). Không có full-stack Rust+React starter nào phù hợp — Leptos/Yew là Rust-first frontend, không phải React. Approach đúng: **monorepo thủ công với hai sub-project độc lập**.

### Starter Options Considered

| Option | Mô tả | Lý do bỏ |
|---|---|---|
| Leptos/start-axum | Full-stack Rust | Frontend không phải React — không đúng stack |
| template-axum-solidjs-spa | Axum + SolidJS | SolidJS, không phải React |
| create-vite react-ts | Frontend only | ✅ Đúng, dùng cho frontend |
| Cargo new + thủ công | Backend Rust | ✅ Đúng, standard approach cho Rust |

### Selected Approach: Manual Monorepo

**Rationale:** Không có maintained starter nào kết hợp đúng React + Vite + Rust + Axum + SQLite. Tự setup từng phần đảm bảo kiểm soát hoàn toàn cấu trúc.

#### Frontend — Initialization Command

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

**Vite version:** 9.0.7 (latest, verified 2026-05-20)

#### Backend — Initialization Command

```bash
cargo new backend
cd backend
# Thêm dependencies vào Cargo.toml
```

**Axum version:** 0.8.x (latest stable, announced 2025-01-01 bởi Tokio team)

### Architectural Decisions Provided by Starters

#### Frontend (create-vite react-ts)

| Category | Decision |
|---|---|
| Language | TypeScript strict mode |
| Build tool | Vite 9 (esbuild + Rollup) |
| UI library | React 19 |
| Module system | ESM native |
| Dev server | Vite HMR trên localhost |
| Test framework | Vitest + React Testing Library (thêm thủ công) |
| Styling | CSS variables thuần theo UX spec (không Tailwind) |

**Cần thêm thủ công:** Vitest + React Testing Library, CSS design tokens, fetch wrapper.

#### Backend (Cargo new)

| Category | Decision |
|---|---|
| Language | Rust stable |
| Async runtime | Tokio 1.x |
| Web framework | Axum 0.8 |
| Database | SQLx 0.8 với SQLite feature |
| Error handling | `thiserror` + `anyhow` |
| Serialization | `serde` + `serde_json` |
| UUID | `uuid` crate v4 feature |

#### Monorepo Structure

```
omni-agent/
├── frontend/          ← Vite React TS SPA
│   ├── src/
│   └── package.json
├── backend/           ← Rust Axum server
│   ├── src/
│   └── Cargo.toml
├── data/              ← SQLite file (runtime, gitignored)
├── logs/              ← Run log files (runtime, gitignored)
└── README.md
```

**Note:** Backend serve frontend static files khi production build. Dev mode: Vite dev server + `cargo run` chạy song song. Project initialization là story đầu tiên trong implementation.

---

## Core Architectural Decisions

### Decision Priority Analysis

**Critical (block implementation):** DB migration strategy · API route structure · Frontend-backend communication pattern · Log file location

**Important (shape architecture):** State management · Routing · Error envelope · Validation layer split

**Deferred (post-MVP):** SSE/WebSocket realtime · Export/import · Auth layer

---

### Data Architecture

| Decision | Choice | Rationale |
|---|---|---|
| DB migrations | `sqlx::migrate!()` — auto-run on startup | Local app, không cần manual migration step |
| Validation | API layer (Axum extractors + serde) cho request shape; service layer cho business rules | Separation of concerns: request validity vs domain validity |
| Log file location | `~/.omni-agent/logs/{task-id}/{run-id}.log` | Tách khỏi project directory, tồn tại khi app reinstall |

---

### API & Communication Patterns

| Decision | Choice | Version | Rationale |
|---|---|---|---|
| Route structure | Nested REST: `/api/projects/{id}/tasks/{id}/...` | — | Phản ánh đúng domain — Task scoped theo Project |
| Realtime updates | Client polling mỗi 5s (GET task/session khi Running) | — | Đủ cho local MVP, đơn giản hơn SSE |
| Error envelope | `{ "error": "<code>", "message": "<human text>" }` | — | Consistent, dễ handle ở frontend |
| CORS/proxy | Vite proxy `/api` → `localhost:8080` trong dev | — | Không cần CORS config trên backend |

**API Route Structure:**

```
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

---

### Frontend Architecture

| Decision | Choice | Version | Rationale |
|---|---|---|---|
| State management | TanStack Query v5 cho server state; `useState`/`useContext` cho UI state | 5.100.11 | Polling, caching, optimistic updates built-in — tránh boilerplate cho app nặng về server state |
| Routing | React Router v7 (declarative, client-side SPA) | 7.15.1 | Standard, maintained, đủ cho SPA không cần SSR |
| Styling | CSS variables thuần (design tokens từ UX spec) | — | Không thêm Tailwind, nhất quán với token system đã định nghĩa |

**TanStack Query polling pattern (task đang Running):**
```ts
useQuery({
  queryKey: ['task', taskId],
  queryFn: () => fetchTask(taskId),
  refetchInterval: (query) =>
    query.state.data?.status === 'Running' ? 5000 : false,
})
```

---

### Infrastructure & Deployment

| Decision | Choice | Rationale |
|---|---|---|
| Dev workflow | Vite dev server (port 5173) + `cargo run` (port 8080) song song | Vite proxy `/api` forward đến backend |
| Production | Backend serve `frontend/dist/` dưới dạng static files | Single process, single port |
| Log location | `~/.omni-agent/logs/{task_id}/{run_id}.log` | Tách khỏi project dir, persistent qua reinstall |
| SQLite location | `~/.omni-agent/omni-agent.db` | Cùng thư mục với logs, dễ backup |

---

### Decision Impact Analysis

**Implementation sequence:**
1. Backend: DB schema + migrations (`sqlx::migrate!()`)
2. Backend: Project + Task CRUD routes
3. Backend: Session spawn/resume/lifecycle + subprocess ownership
4. Backend: Run log dual-write (file + DB tail)
5. Frontend: Vite scaffold + React Router v7 routes
6. Frontend: TanStack Query setup + API client
7. Frontend: Task Board + Task Detail + Resume flow
8. Frontend: Polling integration cho Running state

**Cross-component dependencies:**
- Polling interval phụ thuộc vào task status — TanStack Query `refetchInterval` là nơi duy nhất kiểm soát
- Vite proxy config phải match port backend — cần thống nhất port trước khi implement (đề xuất: `8080`)
- Log file path convention phải nhất quán giữa backend (ghi) và frontend (display path)

---

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database — snake_case toàn bộ:**

| Category | Pattern | Ví dụ |
|---|---|---|
| Table | `snake_case` số nhiều | `projects`, `tasks`, `sessions`, `runs`, `comments` |
| Column | `snake_case` | `task_id`, `project_key`, `created_at` |
| FK | `{table_singular}_id` | `project_id`, `task_id`, `session_id` |
| Index | `idx_{table}_{column}` | `idx_tasks_project_id` |
| Timestamps | `TEXT` ISO string | `created_at`, `updated_at` |

**API Endpoints:**

| Pattern | Ví dụ |
|---|---|
| Plural nouns, nested | `/api/projects/{project_id}/tasks/{task_id}` |
| Actions dùng path verb | `/api/.../sessions/start`, `/api/.../sessions/resume` |
| Path params | `{snake_case_id}` |
| Query params | `snake_case` — `?status=running` |

**JSON fields: `camelCase`** (serde `rename_all = "camelCase"`):

```json
{ "taskId": "OMNI-001", "projectKey": "OMNI", "sessionStatus": "running", "createdAt": "2026-05-20T16:30:00Z" }
```

**Rust:** `snake_case` functions/variables, `PascalCase` types/structs/enums.

**React/TS:** `PascalCase` components + file names (`TaskCard.tsx`), `camelCase` functions/variables, `kebab-case` CSS variables (`--bg-app`).

---

### Structure Patterns

**Backend:**

```
backend/src/
├── main.rs              ← Axum setup, router, shutdown handler
├── db/
│   ├── mod.rs
│   └── migrations/      ← V1__init.sql, V2__...
├── models/              ← DTOs + domain types (serde)
├── services/            ← Business logic, subprocess management
├── handlers/            ← Thin Axum handlers (delegate to services)
├── agent/               ← Per-agent: spawn cmd, resume cmd, session ID parser
└── error.rs             ← AppError (thiserror) + IntoResponse
```

**Frontend:**

```
frontend/src/
├── main.tsx             ← React root, QueryClient, Router
├── api/                 ← Fetch wrappers per resource (tasks.ts, projects.ts)
├── components/          ← Shared components (StatusBadge, TaskCard, ...)
├── features/            ← Feature-scoped (board/, task-detail/, dashboard/)
├── hooks/               ← Custom hooks (useTaskPolling, useSessionState)
├── routes/              ← React Router route components
├── types/               ← TypeScript interfaces matching API shapes
└── styles/              ← tokens.css (CSS variables), global.css
```

**Tests:** Rust unit tests trong cùng file (`#[cfg(test)]`), integration trong `backend/tests/`. React tests cạnh component (`ComponentName.test.tsx`).

---

### Format Patterns

**Success response:** Object trực tiếp, không wrapper `{ data: ... }`.

**Error response:**
```json
{ "error": "task_not_found", "message": "Task OMNI-001 does not exist" }
```

**HTTP status codes:** `200` OK · `201` Created · `400` Validation · `404` Not found · `409` Conflict · `500` Internal.

**Date/time:** ISO 8601 string trong tất cả JSON (`"2026-05-20T16:30:00Z"`).

---

### Process Patterns

**Backend error handling — handler dùng `?` operator:**
```rust
async fn get_task(Path(id): Path<String>, State(db): State<DbPool>) -> Result<Json<Task>, AppError> {
    let task = services::get_task(&db, &id).await?;
    Ok(Json(task))
}
```

**Frontend error handling — TanStack Query:**
```ts
const { data, error } = useQuery({ queryKey: ['task', id], queryFn: () => api.getTask(id) });
// error → toast, không crash page
```

**Optimistic update (Resume/Start):**
```ts
const mutation = useMutation({
  mutationFn: api.resumeSession,
  onMutate: () => queryClient.setQueryData(['task', id], old => ({ ...old, status: 'Running' })),
  onError:  () => queryClient.invalidateQueries({ queryKey: ['task', id] }),
})
```

**Subprocess ownership:**
- Tất cả subprocess handles lưu trong `Arc<Mutex<HashMap<TaskId, Child>>>` trong Axum app state
- Graceful shutdown: `tokio::signal::ctrl_c()` → kill children → flush DB status → exit

---

### Enforcement Guidelines

**Tất cả AI agents PHẢI:**
- Dùng `camelCase` cho tất cả JSON fields (serde `rename_all = "camelCase"`)
- Return `AppError` từ handlers — không `unwrap()`/`expect()` trong handler/service
- Register subprocess handle vào app state map ngay sau spawn
- Task status transition chỉ được thực hiện trong `services/` layer
- Reject comment rỗng ở API layer trước khi chạm service
- Chỉ dùng CSS variables đã định nghĩa, không hardcode hex

**KHÔNG làm (hard rules từ project-context):**
- ❌ Tạo session mới khi Resume
- ❌ Lưu full log vào DB
- ❌ Gọi Codex/Claude qua API
- ❌ Hiển thị Session ID mặc định trong UI
- ❌ `unwrap()`/`expect()` trong production code path

---

## Project Structure & Boundaries

### Complete Project Directory Structure

```
omni-agent/
├── README.md
├── .gitignore                    ← exclude: target/, node_modules/, *.db, logs/
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json             ← strict: true
│   ├── vite.config.ts            ← proxy /api → localhost:8080
│   ├── index.html
│   └── src/
│       ├── main.tsx              ← React root, QueryClient, BrowserRouter
│       ├── App.tsx               ← Route definitions
│       ├── api/
│       │   ├── client.ts         ← fetch wrapper, base URL, error parsing
│       │   ├── projects.ts
│       │   ├── tasks.ts
│       │   ├── sessions.ts       ← start, resume, cancel
│       │   ├── runs.ts
│       │   └── comments.ts
│       ├── types/
│       │   ├── project.ts
│       │   ├── task.ts           ← Task, TaskStatus enum
│       │   ├── session.ts        ← Session, SessionStatus enum
│       │   ├── run.ts
│       │   └── comment.ts
│       ├── hooks/
│       │   ├── useTask.ts        ← useQuery + refetchInterval polling
│       │   ├── useTaskList.ts
│       │   ├── useSessionMutation.ts  ← optimistic start/resume/cancel
│       │   └── useProjectList.ts
│       ├── components/
│       │   ├── StatusBadge.tsx
│       │   ├── StatusBadge.test.tsx
│       │   ├── SessionBadge.tsx
│       │   ├── AgentAvatar.tsx
│       │   ├── TaskCard.tsx
│       │   ├── TaskCard.test.tsx
│       │   ├── RunTimeline.tsx
│       │   ├── Toast.tsx
│       │   └── ConfirmationDialog.tsx
│       ├── features/
│       │   ├── dashboard/
│       │   │   ├── Dashboard.tsx
│       │   │   └── DashboardSection.tsx
│       │   ├── board/
│       │   │   ├── TaskBoard.tsx
│       │   │   └── KanbanColumn.tsx
│       │   ├── task-detail/
│       │   │   ├── TaskDetailPanel.tsx
│       │   │   ├── TaskDetailPanel.test.tsx
│       │   │   ├── ActionBar.tsx        ← buttons per status
│       │   │   ├── SessionPanel.tsx
│       │   │   ├── CommentTab.tsx
│       │   │   ├── RunsTab.tsx
│       │   │   └── LogsTab.tsx
│       │   └── project/
│       │       ├── ProjectSwitcher.tsx
│       │       └── CreateProjectModal.tsx
│       ├── routes/
│       │   ├── DashboardRoute.tsx
│       │   ├── BoardRoute.tsx
│       │   └── TaskRoute.tsx
│       └── styles/
│           ├── tokens.css               ← CSS variables từ UX spec
│           └── global.css
│
└── backend/
    ├── Cargo.toml
    ├── Cargo.lock
    └── src/
        ├── main.rs               ← Axum router, state init, shutdown handler
        ├── error.rs              ← AppError (thiserror) + IntoResponse
        ├── state.rs              ← AppState: DbPool + subprocess_map
        ├── db/
        │   ├── mod.rs            ← pool init, sqlx::migrate!()
        │   └── migrations/
        │       └── V1__init.sql  ← projects, tasks, sessions, runs, comments
        ├── models/
        │   ├── project.rs
        │   ├── task.rs           ← Task, TaskStatus enum
        │   ├── session.rs        ← Session, SessionStatus enum
        │   ├── run.rs
        │   └── comment.rs
        ├── handlers/             ← Thin Axum handlers, delegate to services
        │   ├── projects.rs
        │   ├── tasks.rs
        │   ├── sessions.rs
        │   ├── runs.rs
        │   └── comments.rs
        ├── services/             ← Business logic + state machine
        │   ├── projects.rs
        │   ├── tasks.rs          ← status transition enforcement
        │   ├── sessions.rs       ← subprocess spawn/resume/kill + log dual-write
        │   └── runs.rs
        ├── agent/                ← Per-agent strategy (single abstraction point)
        │   ├── mod.rs            ← AgentStrategy trait
        │   ├── claude.rs         ← spawn cmd, resume cmd, session ID parser
        │   └── codex.rs          ← spawn cmd, resume cmd, session ID parser + fallback scan
        └── tests/
            ├── projects_test.rs
            ├── tasks_test.rs
            └── sessions_test.rs
```

### Architectural Boundaries

**API routing:**
```
/api/projects/**                              → handlers/projects.rs
/api/projects/{id}/tasks/**                   → handlers/tasks.rs
/api/projects/{id}/tasks/{id}/sessions/**     → handlers/sessions.rs
/api/projects/{id}/tasks/{id}/runs/**         → handlers/runs.rs
/api/projects/{id}/tasks/{id}/comments        → handlers/comments.rs
/*  (production)                              → static files frontend/dist/
```

**Key boundaries:**
- **Task status machine** — lives exclusively in `services/tasks.rs`. No handler touches `task.status` directly.
- **Agent abstraction** — `agent/` is the only module aware of per-agent CLI format. Services call `AgentStrategy` trait only.
- **Subprocess ownership** — `AppState.subprocess_map: Arc<Mutex<HashMap<TaskId, Child>>>` is the single source of truth. Shutdown handler is the only place that iterates and kills.

### Requirements → Structure Mapping

| FR | Backend | Frontend |
|---|---|---|
| FR-0 Project CRUD | `handlers/projects` + `services/projects` | `features/project/` |
| FR-1–3 Task CRUD | `handlers/tasks` + `services/tasks` | `features/task-detail/` |
| FR-4 Task Board | `handlers/tasks` (list) | `features/board/` |
| FR-5 Start Session | `handlers/sessions` + `services/sessions` + `agent/` | `hooks/useSessionMutation` |
| FR-6 Exit detection | `services/sessions` (monitor) | polling via `hooks/useTask` |
| FR-7 Resume | `handlers/sessions` + `agent/` | `features/task-detail/ActionBar` |
| FR-8 Run log | `services/sessions` (dual-write) | `features/task-detail/LogsTab` |
| FR-9–10 Comment | `handlers/comments` | `features/task-detail/CommentTab` |
| FR-11–12 Detail/Panel | — | `features/task-detail/TaskDetailPanel` + `SessionPanel` |

### Data Flow

```
User click "Resume"
  → ActionBar → useSessionMutation (optimistic: status → Running)
  → POST /api/.../sessions/resume
  → handlers/sessions → services/sessions
  → agent/{codex|claude}: build resume command
  → tokio::process::Command::spawn → register in subprocess_map
  → write Run record to DB → response 200
  → TanStack Query invalidate ['task', id]
  → useTask polling (5s) reflects Running state
  → subprocess exits → services detect exit code → update status (Paused/Failed)
  → next poll reflects final status in UI
```

---

## Architecture Validation Results

### Coherence Validation ✅

| Check | Kết quả |
|---|---|
| Axum 0.8 + Tokio 1.x + SQLx 0.8 | ✅ Stack chuẩn 2025, không conflict |
| React Router 7.15.1 + TanStack Query 5.100.11 + React 19 + Vite 9 | ✅ Không có dependency conflict |
| Vite proxy + Axum (no CORS needed in dev) | ✅ |
| Polling 5s + TanStack Query `refetchInterval` | ✅ Built-in pattern |
| `~/.omni-agent/` cho DB + logs | ✅ Nhất quán |
| `camelCase` JSON ↔ serde `rename_all` | ✅ |
| Task status machine chỉ trong `services/tasks.rs` | ✅ Boundary rõ ràng |

### Requirements Coverage Validation ✅

Tất cả 12 FR và 8 NFR đã được cover đầy đủ bởi architectural decisions, patterns, và project structure (xem Requirements → Structure Mapping ở trên).

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Gap Analysis & Resolutions

**Gap 1 — DB Schema: RESOLVED ✅**

`backend/src/db/migrations/V1__init.sql`:

```sql
CREATE TABLE projects (
    id          TEXT PRIMARY KEY,           -- UUID
    name        TEXT NOT NULL,
    key         TEXT NOT NULL UNIQUE,       -- uppercase alphanumeric, e.g. "OMNI"
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE tasks (
    id          TEXT PRIMARY KEY,           -- "{KEY}-NNN", e.g. "OMNI-001"
    project_id  TEXT NOT NULL REFERENCES projects(id),
    seq         INTEGER NOT NULL,           -- auto-increment per project
    title       TEXT NOT NULL,
    description TEXT NOT NULL,
    acceptance_criteria TEXT,
    agent       TEXT,                       -- "claude" | "codex" | NULL
    role        TEXT,                       -- "coder" | "reviewer" | "planner" | "debugger" | "refactorer" | NULL
    status      TEXT NOT NULL DEFAULT 'Draft',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);

CREATE TABLE sessions (
    id          TEXT PRIMARY KEY,           -- UUID (internal)
    task_id     TEXT NOT NULL UNIQUE REFERENCES tasks(id),  -- max one active session per task
    agent       TEXT NOT NULL,
    session_id  TEXT,                       -- CLI session UUID (nullable until captured)
    status      TEXT NOT NULL DEFAULT 'none',  -- "none"|"running"|"paused"|"closed"
    created_at  TEXT NOT NULL,
    last_active TEXT NOT NULL
);

CREATE TABLE runs (
    id          TEXT PRIMARY KEY,           -- UUID
    session_id  TEXT NOT NULL REFERENCES sessions(id),
    run_number  INTEGER NOT NULL,
    input       TEXT,                       -- comment text sent, or NULL for first run
    exit_code   INTEGER,                    -- NULL while running
    log_path    TEXT,                       -- ~/.omni-agent/logs/{task_id}/{run_id}.log
    log_tail    TEXT,                       -- last ~100 lines / 10KB
    started_at  TEXT NOT NULL,
    ended_at    TEXT
);
CREATE INDEX idx_runs_session_id ON runs(session_id);

CREATE TABLE comments (
    id          TEXT PRIMARY KEY,           -- UUID
    task_id     TEXT NOT NULL REFERENCES tasks(id),
    content     TEXT NOT NULL,
    sent        INTEGER NOT NULL DEFAULT 0, -- 0 = pending, 1 = sent to agent
    created_at  TEXT NOT NULL
);
CREATE INDEX idx_comments_task_id ON comments(task_id);
```

**Gap 2 — Backend Port: RESOLVED ✅**

Backend Axum server chạy trên **port 8080**.

```toml
# backend: bind address
# main.rs: TcpListener::bind("127.0.0.1:8080")
```

```ts
// frontend/vite.config.ts
server: {
  proxy: {
    '/api': 'http://localhost:8080'
  }
}
```

**Gap 3 — Session ID Capture Timeout: RESOLVED ✅**

- Timeout: **10 giây** sau khi subprocess spawn
- Nếu không capture được session ID trong 10s → log warning → trả về response với `session_id: null`
- Frontend hiển thị toast "Session ID not detected — enter manually" + input field
- User nhập thủ công → PATCH `/api/.../sessions/session-id` để lưu vào DB
- Subprocess tiếp tục chạy bất kể có capture được session ID hay không

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION** ✅

**Confidence Level: High**

**Key Strengths:**
- `AgentStrategy` trait → thêm agent mới chỉ cần tạo file trong `agent/`
- `subprocess_map` trong AppState → không thể có subprocess leak
- Task status machine tập trung → không thể implement sai transition
- TanStack Query polling → UI logic tách hoàn toàn khỏi session lifecycle

**Areas for Future Enhancement (post-MVP):**
- SSE thay polling khi cần realtime tốt hơn
- Dark theme via CSS variable overrides
- Gemini CLI support (chỉ cần thêm `agent/gemini.rs`)