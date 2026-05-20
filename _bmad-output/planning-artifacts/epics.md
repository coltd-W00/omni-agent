---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - "_bmad-output/planning-artifacts/prds/prd-omni-agent-2026-05-20/prd.md"
  - "_bmad-output/planning-artifacts/architecture.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
  - "_bmad-output/project-context.md"
---

# omni-agent - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for omni-agent, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-0: Project CRUD — Người dùng có thể tạo Project với tên và key viết tắt (unique, chỉ chữ in hoa và số), đổi tên, xóa Project rỗng. Task Board lọc theo Project active. Xóa Project có Task bị block với error rõ ràng.

FR-1: Tạo Task — Người dùng có thể tạo Task mới trong Project với Title (bắt buộc), Description (bắt buộc), Acceptance Criteria (tùy chọn). Task mới ở trạng thái Draft, ID theo format `{PROJECT_KEY}-NNN`.

FR-2: Assign Agent cho Task — Người dùng có thể assign Agent (Codex, Claude) và Role (Coder, Reviewer, Planner, Debugger, Refactorer) cho Task ở Draft hoặc Ready. Sau khi assign → trạng thái Assigned.

FR-3: Cập nhật và xóa Task — Người dùng có thể chỉnh sửa Title/Description/AC của Task ở mọi trạng thái trừ Done/Cancelled. Xóa Task chỉ ở Draft.

FR-4: Task Board (Kanban View) — Task Board hiển thị tất cả Task theo trạng thái dạng kanban. Mỗi card có Task ID, Title, Agent, Session status, thời gian hoạt động gần nhất. Mỗi task xuất hiện đúng một cột.

FR-5: Start Session — App spawn CLI agent subprocess với task description làm input, capture Session ID (UUID). Claude: parse từ `session_id` JSON field. Codex: parse JSON output, fallback scan `~/.codex/sessions/`. Task → Running. Timeout 10s → warning, cho phép nhập thủ công.

FR-6: Phát hiện Session kết thúc — App phát hiện subprocess exit. Exit code 0 → Task Paused. Exit code ≠ 0 → Task Failed. Backend là process owner — subprocess không bị kill khi đóng browser. Kill chỉ khi: Cancel, backend shutdown, timeout policy. Backend shutdown → flush Running → Paused trước khi exit.

FR-7: Resume Session — Resume cho Task Paused hoặc Failed với Comment tùy chọn. Claude: `claude --continue --session-id <uuid>` + comment stdin. Codex: `codex resume <uuid>` + comment stdin. Comment đã gửi đánh dấu "sent". Không có comment → ghi "retry" vào Run log.

FR-8: Lưu Run Log và Output — Mỗi Run lưu: timestamp, input, exit code. Full output ghi ra file log tại `~/.omni-agent/logs/{task_id}/{run_id}.log`. DB lưu tail last 100 lines / 10KB. UI hiển thị tail mặc định + nút view full log + download.

FR-9: Thêm Comment — Người dùng thêm Comment vào Task ở mọi trạng thái trừ Cancelled. Comment lưu với timestamp và text. Comment rỗng không được lưu.

FR-10: Comment làm input cho Resume — Khi Resume, comment mới nhất trở thành input gửi vào agent. Comment đã dùng đánh dấu "sent" trong UI.

FR-11: Task Detail View — Task Detail hiển thị: Title, Description, AC, Agent/Role, Session Panel, Comments, Runs, action buttons phù hợp với trạng thái. Assigned → "Start Session"; Running → không có action; Paused/Failed → Resume/Mark Done/Cancel; Done/Cancelled → chỉ xem.

FR-12: Session Panel — Session Panel hiển thị Agent type, Session ID (ẩn mặc định, có toggle "Show ID"), Session Status, thời gian tạo, lần resume cuối. Chỉ hiện khi Task đã có Session.

### NonFunctional Requirements

NFR-1: Subprocess lifecycle independence — Subprocess sống độc lập với HTTP request và browser session. Đóng browser không kill subprocess. Backend là process owner.

NFR-2: Session ID capture reliability — Session ID phải có cơ chế capture primary + fallback. Timeout 10s, sau đó warning log và manual input fallback.

NFR-3: Log dual-storage — Full output ra file, DB chỉ lưu tail (last 100 lines / 10KB). File log tồn tại khi app đóng/mở lại. I/O async, không block nhau.

NFR-4: Per-agent resume format abstraction — Resume command format khác nhau per-agent (Claude vs Codex). Phải có abstraction layer (`AgentStrategy` trait).

NFR-5: Graceful shutdown — Flush tất cả task Running → Paused xuống DB trước khi backend exit. Bắt SIGINT/SIGTERM.

NFR-6: WCAG 2.1 AA accessibility — Semantic HTML, aria-live, focus trap, contrast 4.5:1+, keyboard navigation, screen reader support. Không dựa vào màu đơn độc.

NFR-7: Resume performance — Từ click "Resume" đến subprocess chạy ≤ 30 giây. Optimistic UI update (không chờ API round-trip).

NFR-8: Realtime status update — Status task cập nhật in-place không reload board. Client polling 5s khi task đang Running (TanStack Query `refetchInterval`).

### Additional Requirements (Architecture)

- **Monorepo thủ công** — `omni-agent/frontend/` (Vite React TS) + `omni-agent/backend/` (Rust Axum). Không dùng full-stack starter có sẵn.
- **Khởi tạo frontend**: `npm create vite@latest frontend -- --template react-ts` (Vite 9.0.7, React 19, TypeScript strict).
- **Khởi tạo backend**: `cargo new backend` với Axum 0.8, Tokio 1.x, SQLx 0.8 (SQLite feature).
- **DB migrations**: `sqlx::migrate!()` auto-run on startup. File: `~/.omni-agent/omni-agent.db`.
- **DB schema**: 5 tables — `projects`, `tasks`, `sessions`, `runs`, `comments` (xem schema đầy đủ trong architecture.md Gap 1).
- **API route structure**: Nested REST `/api/projects/{id}/tasks/{task_id}/...`. Actions: `.../sessions/start`, `.../sessions/resume`, `.../sessions/cancel`.
- **Vite proxy**: `/api` → `http://localhost:8080` (dev). Backend port: 8080.
- **State management frontend**: TanStack Query v5 (5.100.11) cho server state; useState/useContext cho UI state.
- **Routing frontend**: React Router v7 (7.15.1).
- **AgentStrategy trait**: Module `agent/` là abstraction duy nhất cho per-agent CLI format. Services chỉ gọi qua trait.
- **Subprocess map**: `Arc<Mutex<HashMap<TaskId, Child>>>` trong AppState — single source of truth cho subprocess ownership.
- **JSON serialization**: `camelCase` cho tất cả JSON fields (serde `rename_all = "camelCase"`).
- **Error envelope**: `{ "error": "<code>", "message": "<human text>" }`.
- **Log file location**: `~/.omni-agent/logs/{task_id}/{run_id}.log`.
- **SQLite location**: `~/.omni-agent/omni-agent.db`.
- **Task status machine**: Chỉ trong `services/tasks.rs`, không handler nào touch `task.status` trực tiếp.
- **Graceful shutdown handler**: Tokio signal handler `ctrl_c()` → kill children → flush DB → exit.
- **Production**: Backend serve `frontend/dist/` làm static files. Dev: Vite port 5173 + cargo run port 8080.

### UX Design Requirements

UX-DR1: **Design Token CSS Variables** — Implement toàn bộ CSS token system: neutrals (bg-app, bg-card, bg-hover, border, border-strong, text-primary, text-secondary, text-disabled), brand (brand-primary #4F46E5, brand-hover, brand-light), 9 status color triples (bg/text/border cho Draft/Ready/Assigned/Running/NeedsReview/ChangesRequested/Completed/Failed/Cancelled), severity colors (Critical/High/Medium/Low/Info), spacing scale (4px base), border-radius (sm/md/lg/xl), shadow (sm/md/lg/focus). Font stack: `Inter, Geist, -apple-system, ...`.

UX-DR2: **StatusBadge Component** — Component với 9 variants (Draft/Ready/Assigned/Running/Paused-Resumable/NeedsReview/ChangesRequested/Completed/Blocked-Failed/Cancelled), 3 sizes (sm/md/lg). Running variant có pulse animation. Text label bắt buộc, không chỉ màu. `aria-label="Status: Running"`.

UX-DR3: **TaskCard Component** — Component cho Kanban column: Project tag pill + Agent chip (AgentAvatar với initials/color), Title (2 lines max ellipsis), RuntimeBadge + SessionBadge, Footer (comments count, findings count amber nếu > 0, last activity time). States: default/hover (shadow-md)/selected (brand border)/completed (opacity 0.7).

UX-DR4: **AgentAvatar Component** — Circle với initials từ agent name, màu nền từ name hash. Runtime overlay badge (⚙ Codex / ✦ Claude). Sizes: 20/28/36px.

UX-DR5: **SessionBadge Component** — 4 variants: No session (dashed gray) / Active (violet pulse) / Resumable (blue) / Closed (muted green). `aria-label` bắt buộc.

UX-DR6: **Button Component System** — 4 variants: Primary (indigo filled) / Secondary (outlined) / Ghost / Destructive (red). Sizes sm/md/lg. Loading state: spinner trong button, text giữ nguyên. Disabled: opacity 40%, tooltip. Rule: không 2 filled buttons cùng dòng.

UX-DR7: **ToastNotification Component** — Position bottom-right, slide in từ dưới, auto-dismiss 4s (error không auto-dismiss). Stack tối đa 3. Variants: Success/Warning/Error/Info với icon.

UX-DR8: **ConfirmationDialog Component** — Title = tên action cụ thể (không "Are you sure?"). Cancel trái ghost, Confirm phải destructive. Focus trap. Dùng cho: Delete task/project, Force close session, Mark Done với unresolved findings, Reassign agent khi Running.

UX-DR9: **AppShell Layout** — TopBar (52px sticky) + Sidebar (220px fixed, collapsible icon-only ≤1280px) + Main Work Area (flex-grow, padding 24px) + Detail Panel (420px slide-in từ phải). CSS: `transform: translateX(100%)` → `translateX(0)` 200ms ease-out.

UX-DR10: **Task Board (Kanban View)** — 8 columns (280px each, horizontal scroll): Backlog/Ready/Assigned/Running/NeedsReview/ChangesRequested/Completed/Blocked. Column header: status dot + name + count. Running column có pulse dot. Filter chips khi active.

UX-DR11: **Task Detail Panel (Slide-in)** — 420px từ phải. Header: Task ID + Title + StatusBadge + Agent/Project info + Session line. Sticky Action Bar thay đổi buttons theo trạng thái (xem FR-11). Tabs: Summary / Comments / Runs / Artifacts / Logs / Settings. Default tab: Summary.

UX-DR12: **Summary Tab** — Current Status (human-readable) + Last Agent Summary (Run #N + thời gian) + Next Suggested Action block + Acceptance Criteria checklist (user có thể check/uncheck) + Recent Updates feed. Comment textarea + Resume button inline trong tab này (không cần switch tab).

UX-DR13: **Comments Tab** — Thread-style, comment "Sent to agent ✓" label. Pending comment hiển thị "will be sent on next Resume". Input với placeholder cụ thể.

UX-DR14: **Runs Tab** — List runs với expand: input, output summary, duration, exit code, links "View Timeline" + "View Logs".

UX-DR15: **RunTimeline Component** — Vertical timeline với steps: dot (green/violet-pulse/red/gray) + label (human-readable từ Event Label Mapping) + timestamp. Expandable step: chi tiết files/tests. Raw output ẩn sau "View raw →". Live mode: auto-refresh 5s khi Running, `aria-live="polite"`.

UX-DR16: **Logs Tab** — Disclaimer khi mở. Controls: Run filter, Level filter, Search, Download. Monospace 13px, dark/light background. Raw output cho kỹ thuật.

UX-DR17: **Dashboard (Morning Briefing)** — Greeting + date. Sections theo priority: Needs Your Review → Failed & Blocked → Running Sessions → Ready to Assign → Recent Agent Activity → Completed Recently. Stats bar (optional). Section cards với CTA buttons phù hợp.

UX-DR18: **Empty States** — 10+ empty state screens với icon 48px, heading, description, CTA button. Không dùng "No data found". Các states: No projects / No tasks / No agents / Review Queue empty / No sessions / No logs / No artifacts / No comments / Search no results.

UX-DR19: **Keyboard Shortcuts & Accessibility** — Skip link, focus ring (--shadow-focus, 3px Indigo), focus trap trong Detail Panel/Modal, Tab order: Sidebar → Topbar → Main → Detail Panel. Screen reader: aria-label trên icon buttons, aria-live trên timeline, role="dialog" + aria-labelledby trên modals. Shortcuts: ⌘K (search), ⌘N (new task), R (resume), Esc (close).

UX-DR20: **Responsive Breakpoints** — Desktop L ≥1440px: Detail Panel push layout. Desktop M 1280–1439px: Detail Panel overlay. Desktop S 1024–1279px: Sidebar icon-only. Tablet 768–1023px: Sidebar drawer, Detail Panel full-width. Mobile <768px: out of scope (hiển thị message).

### FR Coverage Map

FR-0:   Epic 2 — Project CRUD (tạo, đổi tên, xóa project)
FR-1:   Epic 2 — Tạo Task mới trong Project
FR-2:   Epic 2 — Assign Agent cho Task
FR-3:   Epic 2 — Cập nhật và xóa Task
FR-4:   Epic 2 — Task Board Kanban view
FR-5:   Epic 3 — Start Session (spawn subprocess + capture session ID)
FR-6:   Epic 3 — Phát hiện Session kết thúc (exit code → Paused/Failed)
FR-7:   Epic 3 — Resume Session với comment
FR-8:   Epic 3 — Lưu Run Log (file + DB tail)
FR-9:   Epic 3 — Thêm Comment vào Task
FR-10:  Epic 3 — Comment làm input cho Resume
FR-11:  Epic 2 — Task Detail View (action buttons per status)
FR-12:  Epic 2 — Session Panel (ẩn/hiện Session ID)

NFR-1:  Epic 3 — Subprocess independence (process owner pattern)
NFR-2:  Epic 3 — Session ID capture reliability + manual fallback
NFR-3:  Epic 3 — Log dual-storage (file + DB tail)
NFR-4:  Epic 3 — AgentStrategy trait abstraction
NFR-5:  Epic 3 — Graceful shutdown handler
NFR-6:  Epic 4 — WCAG 2.1 AA (consolidated accessibility pass)
NFR-7:  Epic 3 — Resume performance ≤30s (optimistic UI)
NFR-8:  Epic 2/3 — Realtime polling (TanStack Query refetchInterval)

UX-DR1:  Epic 1 — Design Token CSS Variables
UX-DR2:  Epic 2 — StatusBadge Component (Story 2.0)
UX-DR3:  Epic 2 — TaskCard Component (Story 2.0)
UX-DR4:  Epic 2 — AgentAvatar Component (Story 2.0)
UX-DR5:  Epic 2 — SessionBadge Component (Story 2.0)
UX-DR6:  Epic 2 — Button Component System (Story 2.0)
UX-DR7:  Epic 2 — ToastNotification Component (Story 2.0)
UX-DR8:  Epic 2 — ConfirmationDialog Component (Story 2.0)
UX-DR9:  Epic 1 — AppShell Layout
UX-DR10: Epic 2 — Task Board Kanban View
UX-DR11: Epic 2 — Task Detail Panel
UX-DR12: Epic 3 — Summary Tab (Story 3.5a)
UX-DR13: Epic 3 — Comments Tab (Story 3.5b)
UX-DR14: Epic 3 — Runs Tab (Story 3.5b)
UX-DR15: Epic 3 — RunTimeline Component (Story 3.5b)
UX-DR16: Epic 3 — Logs Tab (Story 3.5b)
UX-DR17: Epic 4 — Dashboard (Morning Briefing)
UX-DR18: Epic 2 — Empty States (Story 2.0)
UX-DR19: Epic 4 — Keyboard Shortcuts & Accessibility pass
UX-DR20: Epic 4 — Responsive Breakpoints

## Epic List

### Epic 1: Project Foundation & Infrastructure
Loc có thể khởi chạy app lần đầu: monorepo được setup, DB schema tạo tự động, frontend/backend kết nối, Vite proxy hoạt động. App shell hiển thị với sidebar, topbar, routing cơ bản — sẵn sàng cho feature development.
**FRs covered:** Architecture requirements (monorepo, DB schema, API scaffold, dev workflow)
**UX-DRs covered:** UX-DR1 (Design Tokens), UX-DR9 (AppShell Layout)

### Epic 2: Project & Task Management
Loc có thể tạo Projects và Tasks, xem Task Board dạng kanban, và mở Task Detail để xem/chỉnh sửa task. Core workflow hoàn chỉnh: tạo task → assign agent → xem board. Toàn bộ shared UI components và empty states sẵn sàng.
**FRs covered:** FR-0, FR-1, FR-2, FR-3, FR-4, FR-11, FR-12
**Stories:** 2.0 (Shared UI), 2.1 (Project CRUD), 2.2 (Task CRUD & Agent Assignment), 2.3 (Task Board), 2.4 (Task Detail Panel)
**UX-DRs covered:** UX-DR2, UX-DR3, UX-DR4, UX-DR5, UX-DR6, UX-DR7, UX-DR8, UX-DR10, UX-DR11, UX-DR18

### Epic 3: Session Lifecycle & Agent Execution
Loc có thể start session giao task cho agent, app tự detect khi agent xong (Paused/Failed), resume đúng session cũ với comment mới, và xem run log. Core value của sản phẩm.
**FRs covered:** FR-5, FR-6, FR-7, FR-8, FR-9, FR-10
**NFRs covered:** NFR-1, NFR-2, NFR-3, NFR-4, NFR-5, NFR-7
**UX-DRs covered:** UX-DR12, UX-DR13, UX-DR14, UX-DR15, UX-DR16

### Epic 4: Dashboard & Operational Visibility
Loc mở app và trong 3–5 giây biết ngay: task nào đang chạy, task nào blocked. Dashboard là "morning briefing" — situational awareness không cần click vào từng task.
**FRs covered:** — (aggregation/polish của all FRs)
**NFRs covered:** NFR-6
**UX-DRs covered:** UX-DR17, UX-DR19, UX-DR20

---

## Epic 1: Project Foundation & Infrastructure

Loc có thể khởi chạy app lần đầu: monorepo được setup, DB schema tạo tự động, frontend/backend kết nối, Vite proxy hoạt động. AppShell hiển thị với sidebar, topbar, routing cơ bản — toàn bộ design tokens và layout sẵn sàng cho feature development.

### Story 1.1: Monorepo Setup & Backend Scaffold

As a developer,
I want a working monorepo with a Rust Axum backend that starts successfully,
So that the project has a runnable foundation for all subsequent features.

**Acceptance Criteria:**

**Given** the repository is cloned
**When** `cargo run` is executed in `backend/`
**Then** Axum server starts on `http://127.0.0.1:8080`
**And** `GET /health` returns `200 OK` with body `{"status":"ok"}`

**Given** the backend is running
**When** an unknown route is requested
**Then** the server returns a `404` with error envelope `{"error":"not_found","message":"..."}`

**Given** the project directory
**When** inspecting the structure
**Then** `omni-agent/frontend/` and `omni-agent/backend/` both exist
**And** `omni-agent/data/` and `omni-agent/logs/` are listed in `.gitignore`
**And** `backend/src/` contains `main.rs`, `error.rs`, `state.rs`

### Story 1.2: Database Schema & Migrations

As a developer,
I want the SQLite database to be created automatically on startup with all required tables,
So that the app has persistent storage ready without manual setup.

**Acceptance Criteria:**

**Given** `~/.omni-agent/` directory does not exist
**When** the backend starts for the first time
**Then** `~/.omni-agent/omni-agent.db` is created automatically
**And** all 5 tables exist: `projects`, `tasks`, `sessions`, `runs`, `comments`

**Given** the database already exists
**When** the backend starts again
**Then** migrations are skipped (idempotent) and no error is thrown

**Given** the `tasks` table
**When** inspecting the schema
**Then** columns include: `id` (TEXT PK, format `{KEY}-NNN`), `project_id` (FK), `seq` (INTEGER), `title`, `description`, `acceptance_criteria`, `agent`, `role`, `status` DEFAULT 'Draft', `created_at`, `updated_at`

**Given** the `sessions` table
**When** inspecting the schema
**Then** `task_id` has a UNIQUE constraint (max one session per task)

**Given** the `comments` table
**When** inspecting the schema
**Then** `sent` column is INTEGER DEFAULT 0 (0=pending, 1=sent)

### Story 1.3: Frontend Scaffold & Design Tokens

As a developer,
I want a Vite React TypeScript app with design tokens and API proxy configured,
So that the frontend can communicate with the backend and all components share a consistent visual foundation.

**Acceptance Criteria:**

**Given** the frontend project
**When** `npm run dev` is executed in `frontend/`
**Then** Vite dev server starts on `http://localhost:5173`
**And** TypeScript strict mode is enabled in `tsconfig.json`

**Given** the Vite dev server is running
**When** a request is made to `/api/health`
**Then** the request is proxied to `http://localhost:8080/health` and returns `200 OK`

**Given** the `frontend/src/styles/tokens.css` file
**When** inspecting the CSS variables
**Then** all neutrals are defined: `--bg-app: #F4F5F7`, `--bg-card: #FFFFFF`, `--bg-hover: #F0F1F3`, `--border: #E4E5E7`, `--border-strong: #D1D2D4`, `--text-primary: #111827`, `--text-secondary: #6B7280`, `--text-disabled: #9CA3AF`, `--text-inverse: #FFFFFF`
**And** brand tokens defined: `--brand-primary: #4F46E5`, `--brand-hover: #4338CA`, `--brand-light: #EEF2FF`
**And** all 9 status color triples defined (bg/text/border cho Draft/Ready/Assigned/Running/Paused/NeedsReview/ChangesRequested/Completed/Failed/Cancelled)
**And** spacing, radius, shadow, font tokens defined

**Given** `tokens.css` is imported in `main.tsx`
**When** any component uses a CSS variable like `var(--brand-primary)`
**Then** the correct color is applied

### Story 1.4: AppShell Layout & Routing

As a developer,
I want an AppShell layout with sidebar, topbar, main area, and client-side routing,
So that all views share a consistent navigation structure.

**Acceptance Criteria:**

**Given** the app loads in the browser
**When** inspecting the layout
**Then** TopBar is 52px height, sticky, full width, `--bg-card` background with bottom border
**And** Sidebar is 220px wide, fixed left, `--bg-card` background with right border
**And** Main Work Area is `flex-grow`, `--bg-app` background, 24px padding, scrollable

**Given** the sidebar
**When** rendered
**Then** displays: logo/app name, Project Switcher placeholder, nav items (Dashboard, All Tasks), and bottom user avatar placeholder
**And** active nav item has `--brand-light` background and `--brand-primary` text

**Given** React Router is configured
**When** navigating to `/dashboard`
**Then** Dashboard placeholder page renders in Main Work Area
**And** URL updates correctly without full page reload

**Given** navigating to `/board`
**When** the route renders
**Then** Board placeholder page renders in Main Work Area

**Given** an unknown route
**When** accessed
**Then** a 404 page renders within the AppShell (sidebar and topbar remain visible)

---

## Epic 2: Project & Task Management

Loc có thể tạo Projects và Tasks, xem Task Board dạng kanban, và mở Task Detail để xem/chỉnh sửa task. Core workflow hoàn chỉnh: tạo task → assign agent → xem board. Toàn bộ shared UI components và empty states sẵn sàng.

### Story 2.0: Shared UI Components

As a developer using omni-agent,
I want shared UI components (Button, Toast, ConfirmationDialog, StatusBadge, AgentAvatar, SessionBadge, TaskCard, Empty States) available,
So that all views have a consistent, accessible UI foundation before feature stories are built.

**Depends on:** Story 1.3 (Design Tokens), Story 1.4 (AppShell Layout)

**Acceptance Criteria:**

**Given** any action button (Primary/Secondary/Ghost/Destructive)
**When** rendered
**Then** correct variant styles apply using CSS token variables (no hardcoded hex)
**And** loading state shows inline spinner with text unchanged
**And** disabled state shows opacity 40% with `cursor: not-allowed`

**Given** a Toast notification
**When** triggered (success/warning/error/info)
**Then** it appears bottom-right, slides in from bottom, auto-dismisses after 4s (error toasts do not auto-dismiss)
**And** at most 3 toasts stack simultaneously

**Given** a ConfirmationDialog
**When** opened
**Then** focus is trapped inside, title is the specific action name, Cancel is left ghost, Confirm is right destructive red
**And** `Escape` key closes the dialog

**Given** a StatusBadge component
**When** rendered with any of the 9 status variants (Draft/Ready/Assigned/Running/Paused/NeedsReview/ChangesRequested/Completed/Failed/Cancelled)
**Then** correct background/text/border token colors apply
**And** Running variant shows pulse dot animation
**And** `aria-label="Status: {StatusName}"` is present

**Given** an AgentAvatar component
**When** rendered with an agent name
**Then** it shows initials in a circle, background color derived from name hash, and a runtime overlay badge (⚙ Codex / ✦ Claude)

**Given** a SessionBadge component
**When** rendered in each of 4 states (No session / Active / Resumable / Closed)
**Then** correct styles and `aria-label` are applied per variant

**Given** a TaskCard component
**When** rendered with task data
**Then** it shows: Project tag pill, AgentAvatar chip, Title (2 lines max, ellipsis), SessionBadge, footer (comments count, last activity time)
**And** hover state upgrades shadow from `--shadow-sm` to `--shadow-md`

**Given** any empty state screen (No projects / No tasks / No comments / Search no results / etc.)
**When** rendered
**Then** icon (48px), heading, description, and optional CTA button are shown
**And** text never reads "No data found"

### Story 2.1: Project Management

As a developer using omni-agent,
I want to create and manage Projects,
So that tasks can be organized within projects and the Task Board filters to the active project.

**Depends on:** Story 2.0 (Shared UI Components)

**Acceptance Criteria:**

**Given** the sidebar Project Switcher
**When** clicking "New Project"
**Then** a modal opens with fields: Name (required) and Key (required, uppercase alphanumeric, no spaces)

**Given** the New Project form
**When** submitting with a valid name and key
**Then** `POST /api/projects` is called, project appears in Project Switcher dropdown, and Task Board switches to the new project

**Given** a project key that already exists
**When** submitting the form
**Then** the API returns `409 Conflict` and the form displays an inline error "Project key already in use"

**Given** a project with no tasks
**When** clicking delete in Project settings
**Then** a ConfirmationDialog appears; on confirm, the project is deleted via `DELETE /api/projects/{id}` and removed from the switcher

**Given** a project that still has tasks
**When** attempting to delete
**Then** the API returns an error and the UI displays "Cannot delete project with existing tasks"

### Story 2.2: Task CRUD & Agent Assignment

As a developer using omni-agent,
I want to create tasks, assign agents and roles, edit task details, and delete draft tasks,
So that I can organize work and prepare tasks for agent execution.

**Acceptance Criteria:**

**Given** clicking "+ New Task" in the topbar
**When** the modal opens
**Then** fields shown: Title (required), Description (required), Acceptance Criteria (optional)
**And** Submit is disabled until Title and Description are filled

**Given** a valid task form submission
**When** saved
**Then** `POST /api/projects/{id}/tasks` creates the task with status `Draft` and ID format `{PROJECT_KEY}-NNN`
**And** the new task appears on the Task Board in the Draft column
**And** the new TaskCard is scrolled into view and highlighted briefly

**Given** a Task in Draft or Ready status
**When** clicking "Assign Agent" in the Action Bar
**Then** a dropdown shows: Agent (Codex, Claude) and Role (Coder, Reviewer, Planner, Debugger, Refactorer)
**And** on confirm, `PUT /api/projects/{id}/tasks/{task_id}` updates the task and status transitions to `Assigned`

**Given** a Task not in Done or Cancelled status
**When** editing Title/Description/AC and saving
**Then** `PUT /api/projects/{id}/tasks/{task_id}` updates the task immediately

**Given** a Task in Done or Cancelled status
**When** viewing the Task Detail Panel
**Then** no Edit button is shown and fields are read-only

**Given** a Task in Draft status
**When** clicking Delete in the `···` overflow menu and confirming
**Then** `DELETE /api/projects/{id}/tasks/{task_id}` removes the task from the board

**Given** creating a task with an empty Title
**When** submitting
**Then** inline validation error appears under the Title field and form is not submitted

### Story 2.3: Task Board (Kanban View)

As a developer using omni-agent,
I want to see all tasks organized in a kanban board by status,
So that I can instantly see the state of all work in the active project.

**Acceptance Criteria:**

**Given** the `/board` route with an active project
**When** the board loads
**Then** 8 columns render (Draft/Ready/Assigned/Running/Paused/NeedsReview/ChangesRequested/Completed/Failed/Cancelled — visible columns per spec) each with status dot, name, and task count

**Given** tasks exist in the active project
**When** rendered on the board
**Then** each task appears in exactly one column matching its current status
**And** each TaskCard shows: Project tag pill, Agent chip (AgentAvatar with initials + runtime overlay), Title (2 lines max, ellipsis), SessionBadge, footer (comments count, last activity time)

**Given** a TaskCard
**When** hovered
**Then** shadow upgrades from `--shadow-sm` to `--shadow-md` and border to `--border-strong`

**Given** a task with status `Running`
**When** displayed
**Then** the Running column has a pulse violet dot and the task's SessionBadge shows "● Active" with pulse animation

**Given** the board is displayed with a task in `Running` status
**When** TanStack Query polls every 5s
**Then** task status updates in-place without full board reload

**Given** no tasks in the active project
**When** the board loads
**Then** each column shows the "No tasks here" inline empty state

**Given** no active project exists
**When** the board loads
**Then** full-page empty state shows: icon, "No projects yet", "Create your first project" CTA button

### Story 2.4: Task Detail Panel

As a developer using omni-agent,
I want to open a task detail panel to view full task info, see the correct action buttons for the current status, and view the session panel,
So that I can understand a task's state at a glance and take the right action.

**Acceptance Criteria:**

**Given** clicking any TaskCard on the board
**When** the panel opens
**Then** it slides in from the right (420px width, 200ms ease-out, `transform: translateX(0)`)
**And** clicking outside the panel or pressing `Esc` closes it

**Given** the Task Detail Panel header
**When** rendered
**Then** shows: Task ID (caption, `--text-secondary`), Title (Heading M, weight 600), StatusBadge (lg size), project name, agent/role info, session summary line

**Given** a task in `Assigned` status
**When** the Action Bar renders
**Then** only "Start Session" (Primary) is shown

**Given** a task in `Running` status
**When** the Action Bar renders
**Then** no primary action button is shown (view-only state)

**Given** a task in `Paused` or `Failed` status
**When** the Action Bar renders
**Then** "Resume Session" (Primary), "Mark Done" (Secondary), and "Cancel" (Ghost) buttons are shown

**Given** a task in `Done` or `Cancelled` status
**When** the Action Bar renders
**Then** no action buttons are shown (read-only view)

**Given** a task that has a Session (status Running or later)
**When** the Session Panel renders
**Then** it shows: Agent type, Session Status badge, created time, last active time
**And** Session ID is hidden by default with a "Show ID" toggle

**Given** clicking "Show ID" toggle in Session Panel
**When** toggled on
**Then** the Session ID UUID string is revealed
**And** toggling off hides it again

**Given** the Task Detail Panel
**When** rendered
**Then** tabs are shown: Summary / Comments / Runs / Logs / Settings
**And** Summary tab is active by default
**And** active tab has 2px underline in `--brand-primary`

**Given** a task with no comments yet (Comments tab)
**When** the tab is viewed
**Then** empty state shows: "💬 No comments yet" with description (no CTA needed, input is below)

---

## Epic 3: Session Lifecycle & Agent Execution

Loc có thể start session giao task cho agent, app tự detect khi agent xong (Paused/Failed), resume đúng session cũ với comment mới, và xem run log. Đây là core value của sản phẩm — không bao giờ mất track session.

### Story 3.1: AgentStrategy Trait & Start Session

As a developer using omni-agent,
I want to start an agent session for an Assigned task,
So that the CLI agent begins processing the task and I can track its progress.

**Acceptance Criteria:**

**Given** the `agent/` module
**When** inspecting the code
**Then** an `AgentStrategy` trait exists with methods: `spawn_command(task: &Task) -> Command` and `resume_command(session_id: &str, comment: Option<&str>) -> Command`
**And** `agent/claude.rs` and `agent/codex.rs` each implement this trait

**Given** a task in `Assigned` status
**When** `POST /api/projects/{id}/tasks/{task_id}/sessions/start` is called
**Then** the correct CLI subprocess is spawned via `tokio::process::Command::spawn` (non-blocking)
**And** the subprocess handle is registered in `AppState.subprocess_map: Arc<Mutex<HashMap<TaskId, Child>>>`
**And** task status transitions to `Running` (only in `services/tasks.rs`)
**And** a new `Session` record and `Run` record are created in DB

**Given** session ID capture for Claude
**When** subprocess stdout is read
**Then** `session_id` field is parsed from JSON output and stored in the `sessions` table

**Given** session ID capture for Codex
**When** subprocess stdout is read (primary path fails)
**Then** fallback scans `~/.codex/sessions/` filtered by cwd and recent modified time

**Given** session ID is not captured within 10 seconds
**When** timeout expires
**Then** a warning is logged, response returns with `session_id: null`
**And** the task remains in `Running` status (subprocess still alive)
**And** frontend receives `sessionIdMissing: true` flag to show manual input UI

**Given** CLI binary is not found on PATH
**When** `POST .../sessions/start` is called
**Then** the API returns `400` with `{"error":"agent_not_found","message":"Agent binary not found on PATH"}`
**And** task status remains `Assigned`

### Story 3.2: Session Exit Detection & Graceful Shutdown

As a developer using omni-agent,
I want the app to automatically detect when an agent session ends and update the task status,
So that task status always reflects reality without me having to manually check.

**Acceptance Criteria:**

**Given** a subprocess in `subprocess_map` that exits with code `0`
**When** the exit is detected by the backend monitor task
**Then** the task status transitions to `Paused` via `services/tasks.rs`
**And** the `Session.status` updates to `paused`
**And** the `Run.exit_code` is set to `0` and `Run.ended_at` is recorded

**Given** a subprocess that exits with a non-zero exit code
**When** the exit is detected
**Then** task status transitions to `Failed`
**And** `Session.status` updates to `paused` (resumable)
**And** `Run.exit_code` records the actual exit code

**Given** the browser tab or browser is closed
**When** the backend continues running
**Then** the subprocess is NOT killed (backend is process owner, not browser)

**Given** the user clicks "Cancel" on a Running task
**When** `POST .../sessions/cancel` is called
**Then** the subprocess is killed via `subprocess_map`
**And** task status transitions to `Cancelled`
**And** the subprocess handle is removed from `subprocess_map`

**Given** the backend receives SIGINT or SIGTERM (graceful shutdown)
**When** the shutdown handler runs (`tokio::signal::ctrl_c()`)
**Then** all subprocess handles in `subprocess_map` are killed
**And** all tasks with `Running` status are flushed to `Paused` in DB before process exit

### Story 3.3: Resume Session & Comment Tracking

As a developer using omni-agent,
I want to resume a paused or failed agent session with an optional comment,
So that the agent continues from the same context without me having to re-explain the task.

**Acceptance Criteria:**

**Given** a task in `Paused` or `Failed` status
**When** `POST .../sessions/resume` is called with an optional `comment` body
**Then** the correct resume command is spawned:
- Claude: `claude --continue --session-id <uuid>` with comment as stdin
- Codex: `codex resume <uuid>` with comment as stdin/prompt

**Given** a resume call with a comment
**When** the new Run is created
**Then** `Run.input` is set to the comment text
**And** the comment record's `sent` field is updated to `1`

**Given** a resume call with no comment
**When** the new Run is created
**Then** `Run.input` is set to `"retry"` (not null, not empty string)

**Given** a task in `Running` status
**When** `POST .../sessions/resume` is called
**Then** the API returns `409 Conflict` — cannot resume a running session

**Given** a task in `Done` or `Cancelled` status
**When** `POST .../sessions/resume` is called
**Then** the API returns `400 Bad Request`

**Given** a comment added via `POST .../comments` with empty content
**When** the API receives the request
**Then** it returns `400` with `{"error":"empty_comment","message":"Comment cannot be empty"}`
**And** no comment record is saved to DB

**Given** a comment that has `sent = 1`
**When** the next resume is triggered
**Then** that comment is NOT sent again to the agent

### Story 3.4: Run Log Dual-Storage

As a developer using omni-agent,
I want agent run output to be stored in both a log file and a DB tail,
So that I can always access the full output even after restarting the app.

**Acceptance Criteria:**

**Given** a session Run starts
**When** the subprocess begins producing stdout/stderr
**Then** all output is written asynchronously to `~/.omni-agent/logs/{task_id}/{run_id}.log`
**And** the file path is stored in `Run.log_path`

**Given** a Run that completes
**When** the log tail is saved to DB
**Then** `Run.log_tail` contains the last 100 lines OR last 10KB of output (whichever is smaller)

**Given** the app is restarted after a previous run
**When** the Runs tab is viewed for a task
**Then** previous run data (input, exit code, tail, log path) is still accessible from DB

**Given** `GET /api/projects/{id}/tasks/{task_id}/runs/{run_id}`
**When** called
**Then** the response includes: `id`, `runNumber`, `input`, `exitCode`, `logPath`, `logTail`, `startedAt`, `endedAt`

**Given** file write and DB write for the same run
**When** both operations occur
**Then** they are non-blocking (async) and do not block each other or the HTTP handler

### Story 3.5a: Session Summary Tab & Optimistic Resume UI

As a developer using omni-agent,
I want to see live session status and resume sessions with an inline comment in the Summary Tab,
So that I can manage the active session lifecycle without leaving the Task Detail Panel.

**Depends on:** Stories 3.1, 3.2, 3.3

**Acceptance Criteria:**

**Given** the Summary Tab for a task in `Paused` or `Failed` status
**When** rendered
**Then** shows: Current Status (human-readable, not raw exit code), Last Agent Summary block (Run #N + timestamp), Next Suggested Action block with "Resume Session" (Primary) button
**And** a comment textarea with placeholder "Add instructions for next run…" is visible without switching tabs
**And** the Resume button label is "Resume Session" when textarea is empty

**Given** the user types a comment in the Summary Tab textarea
**When** clicking "Resume Session"
**Then** the comment is submitted along with the resume request in one action
**And** task status badge updates to Running immediately (optimistic update)
**And** if the API call fails, status reverts and an error toast is shown

**Given** a task transitions to `Running`
**When** the Summary Tab is open
**Then** a live status feed appears showing human-readable steps: "Starting session…", "Sending comment to agent", "Agent running…"
**And** the status feed auto-refreshes every 5s (`aria-live="polite"`) using TanStack Query polling
**And** links to the full RunTimeline are shown in the Runs Tab (Story 3.5b)

### Story 3.5b: Comments, Runs & Logs Tabs + RunTimeline

As a developer using omni-agent,
I want to view comment history, run history, and raw logs — all within the Task Detail Panel,
So that I have full visibility into what was sent to the agent and what the agent produced.

**Depends on:** Stories 3.3, 3.4, 3.5a, 2.4 (tab container)

**Acceptance Criteria:**

**Given** the Comments Tab
**When** opened
**Then** existing comments show in chronological order with: author avatar, timestamp, text
**And** comments with `sent = 1` show a "Sent to agent ✓" label
**And** comments with `sent = 0` show "Pending · will be sent on next Resume"

**Given** adding a new comment via the Comments Tab input
**When** submitted
**Then** `POST .../comments` is called with the comment text
**And** the comment appears in the thread immediately

**Given** the Runs Tab
**When** opened
**Then** all runs for the task are listed in reverse chronological order
**And** each run shows: Run #N, agent, status (Running/Completed/Failed), start time
**And** clicking a run expands it to show: input, output summary from `log_tail`, duration, exit code

**Given** the Logs Tab
**When** opened
**Then** a disclaimer renders first: "This tab contains raw technical output. For a human-readable summary, see the Summary tab."
**And** log content is displayed in monospace 13px font with Download button

**Given** a RunTimeline rendered for a completed run
**When** inspecting the steps
**Then** each step shows: colored dot (green=completed, red=failed, gray=pending), human-readable label from Event Label Mapping, timestamp
**And** steps with details are expandable (▶)
**And** raw output is never shown inline — only accessible via "View raw →" link opening Logs tab

---

## Epic 4: Dashboard & Operational Visibility

Loc mở app và trong 3–5 giây biết ngay: task nào đang chạy, task nào blocked, task nào cần review. Dashboard là "morning briefing" — situational awareness không cần click vào từng task. Accessibility và responsive layout hoàn chỉnh.

### Story 4.1: Morning Dashboard

As a developer using omni-agent,
I want a dashboard that immediately shows me which tasks need my attention,
So that I know exactly what to do next within 5 seconds of opening the app.

**Acceptance Criteria:**

**Given** navigating to `/dashboard`
**When** the page loads
**Then** a greeting renders: "Good morning, Loc 👋" with the current date

**Given** the dashboard page
**When** rendered
**Then** sections appear in this priority order (non-empty sections only):
1. "Needs Your Review" — tasks in NeedsReview/ChangesRequested status
2. "Failed & Blocked" — tasks in Failed status
3. "Running Sessions" — tasks in Running status
4. "Ready to Assign" — tasks in Assigned/Ready status
5. "Recent Agent Activity" — last N run events (plain language)
6. "Completed Recently" — tasks completed in last 24h

**Given** the "Needs Your Review" section
**When** tasks exist
**Then** each card shows: StatusBadge, task title, project/agent info, time since completion, "Open Review" (Primary) and "Dismiss" (Ghost) buttons

**Given** the "Running Sessions" section
**When** a task is Running
**Then** the card shows a violet pulse dot, task title, agent info, elapsed time, and "View Progress" button

**Given** the "Failed & Blocked" section
**When** a task is Failed
**Then** the card shows a human-readable reason ("Session terminated unexpectedly") — NOT exit code or stack trace
**And** "Resume Session" (Primary) and "View Details" (Secondary) buttons are shown

**Given** the "Ready to Assign" section
**When** tasks exist
**Then** each item renders as a compact list row (48px) with task title, project, and "Assign Agent →" link button

**Given** a stats bar above the sections
**When** rendered
**Then** 4 stat cards show: Active Tasks count, Needs Review count, Running Agents count, Completed Today count

**Given** all sections are empty
**When** the dashboard renders
**Then** the "🎉 You're all caught up!" empty state is shown with "Go to Board" CTA

### Story 4.2: Accessibility & Keyboard Shortcuts

As a developer using omni-agent,
I want the app to be fully keyboard navigable with proper accessibility attributes,
So that the app meets WCAG 2.1 AA standards and I can work efficiently without a mouse.

**Acceptance Criteria:**

**Given** any interactive element in the app
**When** tabbing through the page
**Then** focus indicator is always visible: 2px Indigo ring matching `--shadow-focus: 0 0 0 3px rgba(79,70,229,0.25)`
**And** `outline: none` is never applied without a custom focus style replacement

**Given** the Task Detail Panel or any modal
**When** opened
**Then** focus is trapped inside the overlay (Tab cycles only within)
**And** `Escape` closes the panel/modal and returns focus to the triggering element

**Given** a screen reader user
**When** navigating StatusBadge components
**Then** each badge has `aria-label="Status: {StatusName}"` (e.g. "Status: Running")

**Given** a screen reader user
**When** the live RunTimeline updates
**Then** `aria-live="polite"` announces new steps without interrupting current speech

**Given** any modal dialog
**When** opened
**Then** `role="dialog"`, `aria-labelledby` pointing to the title, and focus moves to the heading on open

**Given** all icon-only buttons (close X, Show ID toggle, ··· overflow)
**When** inspected
**Then** each has a descriptive `aria-label`

**Given** the page loads
**When** the first Tab key is pressed
**Then** a visually hidden "Skip to main content" link becomes visible and functional

**Given** the user presses `⌘K` (or `Ctrl+K`)
**When** not focused in an input
**Then** the search overlay opens

**Given** the user presses `⌘N` (or `Ctrl+N`)
**When** not focused in an input
**Then** the New Task modal opens

**Given** the Task Detail Panel is open and focused
**When** the user presses `R`
**Then** Resume Session is triggered (if the current task status allows it)

**Given** any status color used in the UI
**When** checked for contrast
**Then** text/background contrast ratio is ≥ 4.5:1 for normal text and ≥ 3:1 for large text (WCAG AA)

### Story 4.3: Responsive Layout

As a developer using omni-agent,
I want the app layout to adapt gracefully to different screen sizes,
So that the app works well from large desktop monitors down to smaller laptop screens.

**Acceptance Criteria:**

**Given** a viewport ≥ 1440px (Desktop L)
**When** the Task Detail Panel is open
**Then** the panel pushes the main content area (main area shrinks to accommodate the 420px panel)
**And** sidebar remains full width (220px)

**Given** a viewport between 1280px and 1439px (Desktop M)
**When** the Task Detail Panel is open
**Then** the panel overlays the main content with a 30% opacity backdrop
**And** sidebar remains full width (220px)

**Given** a viewport between 1024px and 1279px (Desktop S)
**When** the page loads
**Then** sidebar collapses to icon-only mode (48px wide) by default
**And** hovering/clicking a sidebar icon shows a tooltip with the nav item label
**And** Task Detail Panel overlays the main content

**Given** a viewport between 768px and 1023px (Tablet)
**When** the page loads
**Then** the sidebar is hidden and accessible via a hamburger menu that opens a drawer
**And** the Task Detail Panel renders as full-width overlay

**Given** a viewport < 768px (Mobile)
**When** the page loads
**Then** a message renders: "OmniAgent works best on desktop. Mobile support coming soon."

**Given** the Kanban board at Desktop S or smaller
**When** rendered
**Then** columns scroll horizontally with each column min-width 240px
**And** the board does not wrap columns to a new row

**Given** the Dashboard sections
**When** rendered at any breakpoint ≥ 768px
**Then** section cards reflow using `grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))`
