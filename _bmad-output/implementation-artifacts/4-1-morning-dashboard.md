# Story 4.1: Morning Dashboard

Status: ready-for-dev

<!-- Validation tùy chọn — chạy validate-create-story trước khi dev-story nếu muốn double-check. -->

**Epic:** 4 — Dashboard & Operational Visibility
**Story ID:** 4.1
**Story Key:** 4-1-morning-dashboard
**Lane:** normal — frontend-only, KHÔNG thêm public API contract mới, KHÔNG đổi DB schema. Consume `Task[]` data đã có (Story 2.2) + `Project[]` data đã có (Story 2.1) qua các endpoint hiện hữu. Blast radius: `frontend/src/routes/DashboardRoute.tsx` (replace placeholder), thêm mới `frontend/src/features/dashboard/` (Dashboard.tsx + DashboardSection.tsx + section components), thêm hook `useAggregatedTasks`. Risk flags: 1 (Existing route entry — App.tsx index redirects `/` → `/dashboard`; DashboardRoute hiện chỉ là placeholder, replace toàn bộ nội dung). **1 flag → normal.**

**Depends on:**
- Story 2.1 (Project Management) — phải hoàn thành (status `done`); story 4.1 reuse `projectsApi.list()` + `useProjectsQuery` hook + `Project` type.
- Story 2.2 (Task CRUD & Agent Assignment) — phải hoàn thành (status `done`); story 4.1 reuse `listTasks(projectId)` API client + `Task` type (`status`, `agent`, `role`, `updatedAt`, `createdAt`).
- Story 2.3 (Task Board Kanban) — đã hoàn thành (status `done`); story 4.1 reuse status keys (`"needs-review"`, `"changes-requested"`, `"completed"`, `"failed"` …) đúng theo bảng định nghĩa `TaskStatus` ở `frontend/src/types/task.ts`. **KHÔNG redefine status keys.**
- Story 2.4 (Task Detail Panel) — đã hoàn thành (status `done`); story 4.1 reuse `useTaskDetail()` context + `openTask(task, project)` để mở Detail Panel khi user click "View Progress" / "View Details" / "Open Review" / TaskCard. **KHÔNG mở route mới** — giữ pattern Detail Panel của Story 2.4.

**Out of scope (defer to follow-up):**
- "Recent Agent Activity" feed — depends on `GET /api/.../runs` endpoint (Story 3.4 — chưa merged). Story 4.1 implement section container như placeholder + hide hoặc render EmptyState khi runs API chưa available, KHÔNG block 4.1.
- Keyboard shortcuts (⌘K, ⌘N, R, Esc global) — defer Story 4.2 (Accessibility & Keyboard Shortcuts).
- Responsive layout (drawer sidebar < 1024px, full-width Detail Panel) — defer Story 4.3 (Responsive Layout).
- Dashboard auto-refresh polling (TanStack Query `refetchInterval` cho dashboard data) — defer cho đến khi epic 3 implementation done (lúc đó polling pattern đã consolidated).

---

## Story

As a developer using omni-agent,
I want a dashboard that immediately shows me which tasks need my attention,
So that I know exactly what to do next within 5 seconds of opening the app.

---

## Acceptance Criteria

> **Nguồn gốc AC:** `_bmad-output/planning-artifacts/epics.md` Story 4.1 (dòng 753–798) + Epic 4 framing (dòng 192–196, 749–751) + UX-DR17 (dòng 119) + NFR-6 (dòng 58). `_bmad-output/planning-artifacts/ux-design-specification.md` §3 "Morning Dashboard" (dòng 248–371), §"DashboardSection" custom component (dòng 1676–1679), §"Implementation Roadmap Phase 3" (dòng 1689–1690), §"Implementation Guidelines" `<section aria-labelledby>` (dòng 1855). `_bmad-output/planning-artifacts/architecture.md` §"Project Directory Structure" (dòng 460–463, 479) — `features/dashboard/` + `routes/DashboardRoute.tsx` đã pre-allocate. `_bmad-output/project-context.md` §"React — Layout" (Task Detail panel pattern), §"Naming". Conventions: kebab-case status keys (theo `TaskStatus` ở `frontend/src/types/task.ts`), CSS variables (`--brand-primary`, `--status-*`, `--space-*` — KHÔNG hardcode hex), TanStack Query v5 caching (queryKeys ổn định, parallel fetches dùng `useQueries`).

---

**AC-1 — Route & greeting header:**

**Given** user navigate đến `/dashboard` (hoặc mở app vì `App.tsx` index redirect `/` → `/dashboard`)
**When** page mount
**Then** Dashboard component render với header chứa:
- Greeting heading (h1, `font-size-heading-l`): `"Good morning, {user_name} 👋"` — `user_name` lấy literal từ `_bmad/bmm/config.yaml::user_name` (= `"Loc"`); KHÔNG hardcode string "Loc" trong component, dùng constant export `DASHBOARD_GREETING_NAME = "Loc"` ở `frontend/src/features/dashboard/Dashboard.tsx` để dễ đổi sau.
- Greeting suffix lấy theo giờ system của user (`new Date().getHours()`): `"Good morning"` (5–11h), `"Good afternoon"` (12–17h), `"Good evening"` (18–4h). Test với `vi.setSystemTime()` để deterministic.
- Date subheading (caption, `--text-secondary`): format `"{Weekday}, {Month} {DayOfMonth}"` theo `Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" })` (UX spec dòng 260 ví dụ: `"Wednesday, May 20"`).

**And** root container có `data-testid="dashboard-route"` và `aria-labelledby="dashboard-heading"` (`<section>` semantic — thay placeholder của `DashboardRoute.tsx` hiện hữu).

---

**AC-2 — Stats bar (4 stat cards):**

**Given** dashboard render xong (tasks data đã load)
**When** stats bar render dưới greeting
**Then** hiển thị đúng **4 stat cards** theo thứ tự trái → phải:
1. **Active Tasks** — count tasks có status ∈ `{"assigned", "running", "paused", "needs-review", "changes-requested"}` (i.e. mọi task đang "in-flight" — KHÔNG đếm `draft`, `ready`, `completed`, `failed`, `cancelled`).
2. **Needs Review** — count tasks có status ∈ `{"needs-review", "changes-requested"}`.
3. **Running Agents** — count tasks có status = `"running"`.
4. **Completed Today** — count tasks có status = `"completed"` **VÀ** `updatedAt` ≥ start-of-today (local time, `new Date().setHours(0,0,0,0)`).

**And** mỗi stat card có:
- Label (caption, `--text-secondary`): "Active Tasks" / "Needs Review" / "Running Agents" / "Completed Today" (UX spec dòng 274–278 với padding rộng cho heading 2 dòng).
- Count (heading l hoặc h2, font-weight 600).
- Border `--border`, no shadow, padding `--space-4`, background `--bg-card`, radius `--radius-md`.

**And** stats bar render trong `<dl>` element (hoặc `<ul role="list">`), mỗi card là `<div role="status">` với `aria-label="{label}: {count}"`.

**And** khi tasks data đang loading (TanStack Query `isPending`) → stats bar render skeleton (4 cards với placeholder text "—" hoặc dimmed background), KHÔNG hide bar.

---

**AC-3 — Section priority order (only render non-empty sections):**

**Given** dashboard render với task data đã load
**When** sections render dưới stats bar
**Then** sections xuất hiện theo thứ tự ưu tiên (KHÔNG đổi order):
1. **"Needs Your Review"** — tasks ∈ `{"needs-review", "changes-requested"}`. Render khi count > 0.
2. **"Failed & Blocked"** — tasks status = `"failed"`. Render khi count > 0.
3. **"Running Sessions"** — tasks status = `"running"`. Render khi count > 0.
4. **"Ready to Assign"** — tasks status ∈ `{"assigned", "ready"}` (i.e. có agent assigned chưa start, hoặc đã ready chưa assign agent). Render khi count > 0.
5. **"Recent Agent Activity"** — (defer scope: render placeholder section nếu không có run data — xem AC-9).
6. **"Completed Recently"** — tasks status = `"completed"` AND `updatedAt` trong 24h gần nhất (now − 86400000 ms). Render khi count > 0.

**And** mỗi section render trong `<section aria-labelledby="dashboard-section-{slug}">` (UX spec dòng 1855), heading `<h2 id="dashboard-section-{slug}">` (font-size-heading-m, font-weight 600).

**And** mỗi section header có subtitle nhỏ (caption, `--text-secondary`): `"{N} task{s} ..."` (e.g. `"2 tasks waiting for your decision"`, `"1 task needs attention"`) — text mapping per section trong Dev Notes §"Section subtitle mapping".

**And** section nào count = 0 (sau filter) → KHÔNG render section đó (KHÔNG render empty container, KHÔNG render EmptyState bên trong section — section bị skip hoàn toàn).

---

**AC-4 — Section "Needs Your Review" — Review Card:**

**Given** section "Needs Your Review" render
**When** section content render
**Then** mỗi task render là một **Review Card** width 320px (UX spec dòng 288–301), horizontal scroll trong section nếu nhiều card. Card structure:
- StatusBadge size="md" (reuse component có sẵn) với label `"NEEDS REVIEW"` (status=`"needs-review"`) hoặc `"CHANGES REQUESTED"` (status=`"changes-requested"`).
- Task title (h3, font-weight 600, `--font-size-heading-s`).
- Meta row: `"{project.key} · {role ?? "—"} / {agentLabel}"` — `agentLabel` mapping: `"claude"` → `"Claude CLI"`, `"codex"` → `"Codex CLI"`, `null` → `"Unassigned"` (utility function `agentLabel` — xem Dev Notes §"Frontend formatting helpers").
- Activity line: `"Agent completed {relativeTime}"` (e.g. `"45 min ago"`) — dùng helper `formatRelativeTime(task.updatedAt)` reuse từ `frontend/src/features/board/taskToCardProps.ts`.
- Findings count line: deferred — không render trong 4.1 (cần ReviewFindingCard / review data từ epic 5 — KHÔNG có ở Epic 3/4 hiện tại).
- 2 buttons row:
  - **"Open Review"** (`Button` variant=`primary`, size=`sm`) — onClick gọi `openTask(task, project)` để mở Task Detail Panel.
  - **"Dismiss"** (`Button` variant=`ghost`, size=`sm`) — onClick là no-op stub trong 4.1 (sẽ wire vào dismissal logic ở epic 5). Render với `aria-label="Dismiss review for {task.title}"`.

**And** card có `role="article"` + `tabIndex={0}` + click toàn bộ card cũng → `openTask` (giống TaskCard pattern Story 2.3).

---

**AC-5 — Section "Failed & Blocked" — Failed Card:**

**Given** section "Failed & Blocked" render
**When** section content render
**Then** mỗi task render là **Failed Card** width 320px (UX spec dòng 310–323):
- StatusBadge với label `"BLOCKED"` (theo UX spec dòng 313) — reuse `StatusBadge` của task status `"failed"` (gốc visual đỏ `--status-failed-*`), nhưng override display label thành `"BLOCKED"` (1 chỗ duy nhất — pass prop `labelOverride?: string` HOẶC tạo component wrapper `DashboardStatusBadge`. **Khuyến nghị:** chọn cách Wrapper component `<DashboardStatusBadge status="failed" labelOverride="BLOCKED" />` ở `frontend/src/features/dashboard/DashboardStatusBadge.tsx` để KHÔNG đụng vào `StatusBadge` core component (vẫn dùng "Failed" trên Kanban board).
- Task title (h3).
- Meta row: project key + role + agent label (cùng pattern AC-4).
- Reason line (`<p>` italic, `--text-secondary`, font-size-body-s): **HUMAN-READABLE** reason — chuỗi text cố định `"Session terminated unexpectedly"` (UX spec dòng 318). **KHÔNG hiển thị**: exit code, stack trace, raw stderr, command string. (Epic 4 narrative dòng 785 nhấn mạnh điều này.)
- Last active line: `"Last active: {formatRelativeTime(task.updatedAt)}"`.
- 2 buttons row:
  - **"Resume Session"** (`Button` variant=`primary`, size=`sm`) — onClick gọi `openTask(task, project)`. (Resume logic thực sự nằm ở ActionBar bên trong Detail Panel — Story 3.3 sẽ implement. Story 4.1 KHÔNG implement Resume; chỉ mở panel để user dùng action bên trong.)
  - **"View Details"** (`Button` variant=`secondary`, size=`sm`) — onClick cũng gọi `openTask(task, project)` (same target; UX có 2 buttons để user nhìn affordance khác nhau).

---

**AC-6 — Section "Running Sessions" — Running Card:**

**Given** section "Running Sessions" render
**When** section content render
**Then** mỗi task render là **Running Card** width 320px (UX spec dòng 330–340):
- StatusBadge với status=`"running"` (đã có pulse violet dot built-in).
- Task title (h3).
- Meta row: project key, sau đó hàng riêng `"{role ?? "—"} · {agentLabel}"`.
- Activity line: `"Started {formatRelativeTime(task.updatedAt)}"`.
  - **Step indicator** (UX spec dòng 337 `"Step: Editing files"`): **defer ra khỏi 4.1** — cần Run timeline events từ Story 3.5b. Nếu muốn placeholder, hiển thị literal text `"Step: —"` (no run data) HOẶC bỏ hẳn dòng "Step:" trong 4.1; **chọn bỏ hẳn** để tránh hiển thị placeholder text gây nhiễu.
- 1 button row:
  - **"View Progress"** (`Button` variant=`primary`, size=`sm`) — onClick gọi `openTask(task, project)`.

---

**AC-7 — Section "Ready to Assign" — Compact list rows:**

**Given** section "Ready to Assign" render
**When** section content render
**Then** mỗi task render là **compact list row** (UX spec dòng 347–352) — KHÔNG phải full card:
- Height fixed 48px, `display: flex`, `align-items: center`, `padding: 0 --space-4`.
- Border-bottom `1px solid --border` (rows trừ row cuối).
- Layout: `[● status-dot] [task title] [project.key] [→ Assign Agent → button]`.
- Status dot: `<span>` 8px circle (CSS `background: --status-{status}-text`).
- Task title: flex-grow 1, truncate với `text-overflow: ellipsis`.
- Project key: caption, `--text-secondary`, padding-right `--space-3`.
- **"Assign Agent →"** (`Button` variant=`ghost`, size=`sm`) — onClick gọi `openTask(task, project)` (action assign nằm trong Detail Panel — Story 2.4 hiện chưa có assign UI; user vào panel → ActionBar sẽ wire khi epic 3 hoàn thành, hoặc qua future "Assign Agent" modal). Aria-label: `"Assign agent to {task.title}"`.

**And** toàn bộ row là focusable (`role="button" tabIndex={0}`) + onClick = `openTask` — match TaskCard interaction pattern.

---

**AC-8 — Section "Completed Recently" — Compact list rows:**

**Given** section "Completed Recently" render
**When** section content render
**Then** mỗi task render là **compact list row** 48px (UX spec dòng 368–370):
- Layout: `[✓ icon] [task title] [project.key] [Completed {relativeTime}]`.
- Checkmark icon: `<span aria-hidden="true">✓</span>` với color `--status-completed-text`.
- Task title: flex-grow 1, truncate.
- Project key: caption, `--text-secondary`.
- Completed time text: caption, `--text-secondary`, format `"Completed {formatRelativeTime(task.updatedAt)}"`.
- Toàn bộ row focusable + onClick = `openTask`.

**And** row có `role="listitem"` bên trong `<ul role="list">` của section content area.

---

**AC-9 — Section "Recent Agent Activity" (deferred-scope placeholder):**

**Given** Story 3.4 (Run Log Dual-Storage) chưa merged → KHÔNG có `GET /api/projects/{id}/tasks/{tid}/runs` endpoint trong codebase
**When** dashboard render section "Recent Agent Activity"
**Then** section **KHÔNG render** (skip hoàn toàn — match AC-3 rule "section count = 0 → skip"). Dev agent decision rationale: trong 4.1 không có runs aggregation, treat count = 0.

**Given** future state: Story 3.4 merged + runs endpoint available
**When** dashboard render section "Recent Agent Activity"
**Then** *(out-of-scope cho 4.1 — defer cho story follow-up "4-1b-recent-agent-activity-feed" hoặc tích hợp khi epic 3 hoàn thành)*: section sẽ render activity feed theo UX spec dòng 357–363 với 24px AgentAvatar + plain-language activity text + relative time.

**And** Dev Notes phải clarify rõ: KHÔNG implement runs API client / hook trong 4.1; KHÔNG tạo `RecentActivitySection.tsx` placeholder file; chỉ document trong Dashboard.tsx comment ngắn dòng vị trí section sẽ insert (`/* Section: Recent Agent Activity — defer until runs API (Story 3.4) merged */`).

---

**AC-10 — Empty state "All caught up":**

**Given** sau khi load + filter, **không có section nào** có task (i.e. tất cả sections render skip vì count = 0)
**When** dashboard render
**Then** thay vì render zero sections (trắng), render **EmptyState component** với:
- Variant: `"full"`.
- Icon: `"🎉"` (emoji literal, UX spec dòng 1093).
- Heading: `"You're all caught up!"`.
- Description: `"No tasks need your attention right now."`.
- CTA button: label `"Go to Board"`, onClick navigate đến `/board` (dùng `useNavigate()` của React Router v7).

**And** stats bar VẪN render bình thường (có thể tất cả counts = 0 — hiển thị "0" trong cards, không hide stats bar).

**And** empty state KHÔNG render khi vẫn có ít nhất 1 section non-empty.

---

**AC-11 — Loading + error states:**

**Given** TanStack Query đang fetch (`isPending`) tasks hoặc projects
**When** dashboard render
**Then** hiển thị skeleton: header (greeting) + skeleton 4 stat cards + skeleton 3 section card placeholders. Skeleton tagged `aria-busy="true"` ở root section.

**Given** TanStack Query trả về `isError` (lỗi network hoặc 5xx) ở bất kỳ query nào (projects list hoặc bất kỳ project tasks fetch)
**When** dashboard render
**Then** hiển thị error region: `<div role="alert">` với heading `"Couldn't load dashboard"` + error message + **"Try again"** button (`Button` variant=`secondary`) gọi `refetch` trên các queries failed.

**And** error state KHÔNG block partial render: nếu projects load OK nhưng 1 trong N tasks-per-project fetch fail, render dashboard với tasks từ các project thành công và inline cảnh báo (toast hoặc subtle banner) `"Some projects' tasks couldn't be loaded — try again"`.

---

**AC-12 — Accessibility (NFR-6 partial — section-level, defer global keyboard shortcut tới 4.2):**

**Given** dashboard render
**When** screen reader navigate
**Then** structure đúng semantic HTML:
- `<main>` wrapper là từ `AppShell` đã có (KHÔNG thêm `<main>` mới).
- Page heading h1 với `id="dashboard-heading"` (tham chiếu từ `aria-labelledby` của root section).
- Mỗi section là `<section aria-labelledby="dashboard-section-{slug}">` với heading h2 (UX spec dòng 1855).
- Stats bar: dùng `<dl>` (definition list) hoặc `<ul role="list">`.
- Lists trong Ready/Completed sections: `<ul role="list">` với `<li>` con (semantically correct cho compact rows).
- Mỗi card / row có discernible name (visible text title đã đủ; KHÔNG cần thêm `aria-label` redundant).

**And** focus order: header → stats bar → section 1 buttons → section 2 buttons → ... → empty state CTA. Tab focus theo DOM order, KHÔNG dùng `tabIndex > 0`.

**And** contrast: tất cả text + UI dùng CSS variables đã verified WCAG AA (token system ở `frontend/src/styles/tokens.css`). KHÔNG hardcode hex.

**And** KHÔNG implement: global keyboard shortcuts (⌘K, ⌘N, R), skip link, focus trap (defer Story 4.2).

---

**AC-13 — Behavior khi không có project nào:**

**Given** user mở app lần đầu, `GET /api/projects` trả `[]` (empty list)
**When** dashboard render
**Then** hiển thị EmptyState đặc biệt (variant=`"full"`):
- Icon: `"📁"`.
- Heading: `"No projects yet"`.
- Description: `"Create your first project from the sidebar to start tracking tasks."`.
- CTA button: label `"Create your first project"`, onClick focus `[data-testid="project-switcher"]` (match pattern TaskBoard.tsx dòng 50–53).

**And** stats bar KHÔNG render (vì không có data context).

---

## Tasks / Subtasks

> **Quy ước:** Mỗi task root checkable. Subtasks indented. Tasks chia 5 nhóm: **A** (Hook + data aggregation), **B** (Section components), **C** (Dashboard composition + route wire), **D** (Tests), **E** (TypeScript + integration verification).

### A. Hook: aggregate tasks across all projects

- [ ] **Task A.1 — Tạo `frontend/src/hooks/useAggregatedTasks.ts`** (AC: 1, 2, 3, 11, 13)
  - [ ] A.1.1 Import `useQueries` từ `@tanstack/react-query`, `useProjectsQuery` từ `./useProjects`, `listTasks` từ `../api/tasks`, types `Project`, `Task`.
  - [ ] A.1.2 Export interface `AggregatedTasksResult`:
    ```ts
    export interface AggregatedTasksResult {
      tasks: Array<Task & { project: Project }>;  // tasks gắn project reference để render meta row
      projects: Project[];
      isPending: boolean;     // true khi projects HOẶC bất kỳ tasks query đang loading lần đầu
      isError: boolean;       // true khi projects fail HOẶC TẤT CẢ tasks query fail
      hasPartialError: boolean;  // true khi projects OK nhưng ≥ 1 (không phải tất cả) tasks query fail
      error: Error | null;
      refetch: () => void;    // gọi refetch trên tất cả failed queries
    }
    ```
  - [ ] A.1.3 Export hook `useAggregatedTasks(): AggregatedTasksResult`:
    ```ts
    export function useAggregatedTasks(): AggregatedTasksResult {
      const projectsQuery = useProjectsQuery();
      const projects = projectsQuery.data ?? [];
      const tasksQueries = useQueries({
        queries: projects.map((p) => ({
          queryKey: ["tasks", p.id] as const,
          queryFn: () => listTasks(p.id),
          enabled: projectsQuery.isSuccess,
        })),
      });
      // Compose result
      const isPending = projectsQuery.isPending
        || (projectsQuery.isSuccess && tasksQueries.some((q) => q.isPending && q.fetchStatus !== "idle"));
      const allTasksError = tasksQueries.length > 0 && tasksQueries.every((q) => q.isError);
      const isError = projectsQuery.isError || allTasksError;
      const someTasksError = tasksQueries.some((q) => q.isError);
      const hasPartialError = projectsQuery.isSuccess && !allTasksError && someTasksError;
      const error: Error | null = projectsQuery.error ?? tasksQueries.find((q) => q.error)?.error ?? null;
      // Flatten tasks + attach project
      const tasks: Array<Task & { project: Project }> = [];
      tasksQueries.forEach((q, i) => {
        if (q.data) {
          for (const t of q.data) tasks.push({ ...t, project: projects[i] });
        }
      });
      const refetch = () => {
        if (projectsQuery.isError) void projectsQuery.refetch();
        tasksQueries.forEach((q) => { if (q.isError) void q.refetch(); });
      };
      return { tasks, projects, isPending, isError, hasPartialError, error, refetch };
    }
    ```
  - [ ] A.1.4 **Chú ý queryKey reuse:** Reuse cùng queryKey `["tasks", projectId]` mà `useTasks(projectId)` đã dùng (`frontend/src/hooks/useTasks.ts` dòng 6–7). TanStack Query sẽ auto-dedup cache → mở TaskBoard sau Dashboard không refetch.
  - [ ] A.1.5 KHÔNG implement polling/`refetchInterval` trong 4.1 (defer Epic 3 polling consolidation).
  - [ ] A.1.6 KHÔNG implement runs aggregation (defer cho "Recent Agent Activity" section follow-up).

- [ ] **Task A.2 — Tạo `frontend/src/features/dashboard/taskClassification.ts`** (AC: 2, 3, 7, 8)
  - [ ] A.2.1 Pure utility module — không React, dễ unit test.
  - [ ] A.2.2 Export constants:
    ```ts
    export const ACTIVE_STATUSES: ReadonlySet<TaskStatus> = new Set([
      "assigned", "running", "paused", "needs-review", "changes-requested",
    ]);
    export const NEEDS_REVIEW_STATUSES: ReadonlySet<TaskStatus> = new Set([
      "needs-review", "changes-requested",
    ]);
    export const READY_TO_ASSIGN_STATUSES: ReadonlySet<TaskStatus> = new Set([
      "ready", "assigned",
    ]);
    ```
    Import `TaskStatus` từ `../../types/task`. **KHÔNG hardcode chuỗi rời rạc** — dùng `TaskStatus` const để tránh typo.
  - [ ] A.2.3 Export functions phân loại:
    ```ts
    export function countActive(tasks: Task[]): number { ... }
    export function countNeedsReview(tasks: Task[]): number { ... }
    export function countRunning(tasks: Task[]): number { ... }
    export function countCompletedToday(tasks: Task[], now: Date = new Date()): number { ... }
    export function tasksNeedsYourReview(tasks: Task[]): Task[] { ... }
    export function tasksFailedAndBlocked(tasks: Task[]): Task[] { ... }
    export function tasksRunningSessions(tasks: Task[]): Task[] { ... }
    export function tasksReadyToAssign(tasks: Task[]): Task[] { ... }
    export function tasksCompletedRecently(tasks: Task[], now: Date = new Date()): Task[] { ... }
    ```
  - [ ] A.2.4 `countCompletedToday`: filter `status === "completed"` AND `updatedAt >= startOfToday(now)`. Helper `startOfToday(now: Date): number` → `new Date(now).setHours(0,0,0,0)`.
  - [ ] A.2.5 `tasksCompletedRecently`: filter `status === "completed"` AND `now.getTime() - new Date(task.updatedAt).getTime() <= 24 * 3600 * 1000`. Sort desc by `updatedAt` (mới nhất lên đầu).
  - [ ] A.2.6 Mỗi function khác cũng sort desc by `updatedAt` (UX flow: task mới update gần đây hiện trước).

- [ ] **Task A.3 — Tạo `frontend/src/features/dashboard/formatters.ts`** (AC: 1, 4, 5, 6, 8)
  - [ ] A.3.1 Export `formatDashboardGreeting(now: Date = new Date()): string`:
    ```ts
    export function formatDashboardGreeting(now: Date = new Date()): string {
      const h = now.getHours();
      if (h >= 5 && h <= 11) return "Good morning";
      if (h >= 12 && h <= 17) return "Good afternoon";
      return "Good evening";
    }
    ```
  - [ ] A.3.2 Export `formatDashboardDate(now: Date = new Date()): string`:
    ```ts
    export function formatDashboardDate(now: Date = new Date()): string {
      return new Intl.DateTimeFormat("en-US", {
        weekday: "long", month: "long", day: "numeric",
      }).format(now);
    }
    ```
  - [ ] A.3.3 Export `agentLabel(agent: Task["agent"]): string`:
    ```ts
    export function agentLabel(agent: Task["agent"]): string {
      if (agent === "claude") return "Claude CLI";
      if (agent === "codex") return "Codex CLI";
      return "Unassigned";
    }
    ```
  - [ ] A.3.4 Export `formatRelativeTime` — **reuse** từ `frontend/src/features/board/taskToCardProps.ts`. **KHÔNG copy-paste**. Nếu cần, refactor: move helper sang `frontend/src/lib/formatRelativeTime.ts` rồi `board/taskToCardProps.ts` + dashboard module cùng import. **Khuyến nghị:** giữ helper ở `board/taskToCardProps.ts` (đã có), dashboard module re-export từ đó: `export { formatRelativeTime } from "../board/taskToCardProps";`. Tránh duplicate logic.
  - [ ] A.3.5 Export constant `DASHBOARD_GREETING_NAME = "Loc"` (AC-1) — single source để đổi tên user sau này.

### B. Section components

- [ ] **Task B.1 — Tạo `frontend/src/features/dashboard/DashboardSection.tsx` + `.css`** (AC: 3, 12)
  - [ ] B.1.1 Component shell tái sử dụng cho mọi section. Props:
    ```ts
    interface DashboardSectionProps {
      slug: string;           // dùng cho aria-labelledby (e.g. "needs-review")
      title: string;          // heading text (e.g. "Needs Your Review")
      subtitle: string;       // caption text (e.g. "2 tasks waiting for your decision")
      variant: "card-grid" | "compact-list";  // UX spec dòng 1679 (3 variants: card-grid / list / feed — 4.1 dùng 2: card-grid cho Review/Failed/Running, compact-list cho Ready/Completed)
      children: ReactNode;
    }
    ```
  - [ ] B.1.2 Render:
    ```tsx
    <section aria-labelledby={`dashboard-section-${slug}`} className={`dashboard-section dashboard-section--${variant}`}>
      <header className="dashboard-section__header">
        <h2 id={`dashboard-section-${slug}`}>{title}</h2>
        <p className="dashboard-section__subtitle">{subtitle}</p>
      </header>
      <div className="dashboard-section__content">{children}</div>
    </section>
    ```
  - [ ] B.1.3 CSS:
    - `.dashboard-section`: `margin-bottom: --space-8`.
    - `.dashboard-section__header`: `display: flex; justify-content: space-between; align-items: baseline; margin-bottom: --space-4`. (UX spec dòng 1678: "Header (title + subtitle + 'View all')" — 4.1 KHÔNG có "View all" link, defer.)
    - `.dashboard-section--card-grid .dashboard-section__content`: `display: flex; gap: --space-4; overflow-x: auto; padding-bottom: --space-2;` (horizontal scroll, UX spec dòng 288 "horizontal scroll row").
    - `.dashboard-section--compact-list .dashboard-section__content`: `display: flex; flex-direction: column;` (vertical list, no scroll).
    - Mobile/responsive: defer Story 4.3.

- [ ] **Task B.2 — Tạo `frontend/src/features/dashboard/NeedsReviewCard.tsx`** (AC: 4)
  - [ ] B.2.1 Props:
    ```ts
    interface NeedsReviewCardProps {
      task: Task & { project: Project };
      onOpen: () => void;     // mở Detail Panel
      onDismiss: () => void;  // stub no-op trong 4.1
    }
    ```
  - [ ] B.2.2 Render JSX theo AC-4. Reuse `<StatusBadge status={task.status} size="md" />` (status `needs-review` / `changes-requested` đã có).
  - [ ] B.2.3 2 buttons row: Button primary "Open Review" + Button ghost "Dismiss".
  - [ ] B.2.4 Wrapper `<article tabIndex={0} role="button" onClick={onOpen} onKeyDown={...}>` — match TaskCard keyboard handler pattern (Enter + Space) ở `frontend/src/components/TaskCard.tsx` dòng 29–43.
  - [ ] B.2.5 CSS class prefix `dashboard-needs-review-card`. Width 320px, padding `--space-4`, border, radius, gap.

- [ ] **Task B.3 — Tạo `frontend/src/features/dashboard/DashboardStatusBadge.tsx`** (AC: 5)
  - [ ] B.3.1 Wrapper component cho phép override label hiển thị mà KHÔNG đụng vào `frontend/src/components/StatusBadge.tsx` core (vẫn dùng "Failed" trên Kanban — KHÔNG đổi).
  - [ ] B.3.2 Props:
    ```ts
    interface DashboardStatusBadgeProps {
      status: TaskStatus;
      labelOverride?: string;  // e.g. "BLOCKED" cho dashboard
      size?: "sm" | "md" | "lg";
    }
    ```
  - [ ] B.3.3 Render: reuse classes của StatusBadge core (.app-status-badge--{status}, --size); nhưng inline render label theo `labelOverride ?? defaultLabel`.
    - **Hoặc đơn giản hơn:** import + render `<StatusBadge>` rồi dùng absolute positioned `<span>` over label — phức tạp + fragile. **Khuyến nghị:** copy 20 dòng StatusBadge logic (read `STATUS_DISPLAY` map qua import) + override label — ngắn gọn.
    - **Đề xuất cuối cùng:** **export `STATUS_DISPLAY` map từ `frontend/src/components/StatusBadge.tsx`** (1 dòng change), rồi DashboardStatusBadge import map đó + render với labelOverride. KHÔNG duplicate map.
  - [ ] B.3.4 aria-label vẫn `"Status: {labelOverride ?? defaultLabel}"`.

- [ ] **Task B.4 — Tạo `frontend/src/features/dashboard/FailedBlockedCard.tsx`** (AC: 5)
  - [ ] B.4.1 Props:
    ```ts
    interface FailedBlockedCardProps {
      task: Task & { project: Project };
      onResume: () => void;       // mở Detail Panel (Resume nằm trong ActionBar)
      onViewDetails: () => void;  // mở Detail Panel (same target)
    }
    ```
  - [ ] B.4.2 Render theo AC-5. Dùng `<DashboardStatusBadge status="failed" labelOverride="BLOCKED" />`.
  - [ ] B.4.3 Reason line: literal text `"Session terminated unexpectedly"` (hard-coded — KHÔNG show exit code / stack trace; rationale: UX spec dòng 325 + Epic 4 dòng 785).
  - [ ] B.4.4 CSS class prefix `dashboard-failed-card`. Width 320px.

- [ ] **Task B.5 — Tạo `frontend/src/features/dashboard/RunningSessionCard.tsx`** (AC: 6)
  - [ ] B.5.1 Props:
    ```ts
    interface RunningSessionCardProps {
      task: Task & { project: Project };
      onViewProgress: () => void;
    }
    ```
  - [ ] B.5.2 Render theo AC-6. Reuse `<StatusBadge status="running" />` (đã có pulse violet built-in CSS class `.app-status-badge--running` ở `frontend/src/components/StatusBadge.css`).
  - [ ] B.5.3 **KHÔNG render** dòng "Step: ..." — defer Story 3.5b RunTimeline.
  - [ ] B.5.4 CSS class prefix `dashboard-running-card`.

- [ ] **Task B.6 — Tạo `frontend/src/features/dashboard/ReadyToAssignRow.tsx` + `CompletedRecentlyRow.tsx`** (AC: 7, 8)
  - [ ] B.6.1 `ReadyToAssignRow` props: `{ task: Task & { project: Project }; onAssign: () => void; }`. Render row 48px theo AC-7. Status dot uses CSS variable `--status-{status}-text`.
  - [ ] B.6.2 `CompletedRecentlyRow` props: `{ task: Task & { project: Project }; onOpen: () => void; }`. Render row 48px theo AC-8. Checkmark dùng `color: var(--status-completed-text)`.
  - [ ] B.6.3 CSS shared file `dashboard-compact-row.css` với class `.dashboard-compact-row` + variants `.dashboard-compact-row--ready` / `.dashboard-compact-row--completed`. Height 48px, padding `0 --space-4`, border-bottom `--border`.
  - [ ] B.6.4 Click toàn row → `openTask`. Enter/Space cũng → `openTask` (cùng keyboard handler).

- [ ] **Task B.7 — Tạo `frontend/src/features/dashboard/DashboardStatsBar.tsx`** (AC: 2, 11)
  - [ ] B.7.1 Props:
    ```ts
    interface DashboardStatsBarProps {
      tasks: Task[];
      isLoading: boolean;
    }
    ```
  - [ ] B.7.2 Render 4 stat cards theo AC-2 (Active / Needs Review / Running / Completed Today).
  - [ ] B.7.3 Dùng `taskClassification` utilities (Task A.2) để compute counts.
  - [ ] B.7.4 Render `<dl className="dashboard-stats-bar">` với mỗi card là `<div className="dashboard-stat-card" role="status" aria-label={...}>`.
  - [ ] B.7.5 Loading: render counts là `"—"` (em dash) thay vì `0`, container `aria-busy="true"`.
  - [ ] B.7.6 CSS: 4 cards equal-width `display: grid; grid-template-columns: repeat(4, 1fr); gap: --space-3;`. Mỗi card: padding `--space-4`, border, radius, background `--bg-card`, no shadow.

### C. Dashboard composition + route wire

- [ ] **Task C.1 — Tạo `frontend/src/features/dashboard/Dashboard.tsx` + `.css`** (AC: 1, 3, 9, 10, 11, 12, 13)
  - [ ] C.1.1 Top-level component. Hook usage:
    ```tsx
    const { tasks, projects, isPending, isError, hasPartialError, error, refetch } = useAggregatedTasks();
    const { openTask } = useTaskDetail();
    const navigate = useNavigate();   // từ react-router
    const now = useMemo(() => new Date(), []);  // freeze "now" cho 1 render — tránh re-compute relative times
    ```
  - [ ] C.1.2 Loading branch (`isPending`): render skeleton structure (greeting placeholder + 4 stat cards skeleton + 3 section skeletons). Root `<section data-testid="dashboard-route" aria-busy="true" aria-labelledby="dashboard-heading">`.
  - [ ] C.1.3 Error branch (`isError`): render `<div role="alert">` với "Couldn't load dashboard" + error message + "Try again" button gọi `refetch()`.
  - [ ] C.1.4 No-projects branch (`projects.length === 0` AND not loading/error): render EmptyState `"No projects yet"` (AC-13).
  - [ ] C.1.5 Main render: greeting header (AC-1) + DashboardStatsBar + sequence of sections.
  - [ ] C.1.6 Section sequence pattern:
    ```tsx
    const needsReviewTasks = useMemo(() => tasksNeedsYourReview(tasks), [tasks]);
    const failedTasks = useMemo(() => tasksFailedAndBlocked(tasks), [tasks]);
    const runningTasks = useMemo(() => tasksRunningSessions(tasks), [tasks]);
    const readyTasks = useMemo(() => tasksReadyToAssign(tasks), [tasks]);
    const completedTasks = useMemo(() => tasksCompletedRecently(tasks, now), [tasks, now]);

    const hasAnySection = needsReviewTasks.length + failedTasks.length + runningTasks.length
      + readyTasks.length + completedTasks.length > 0;
    ```
  - [ ] C.1.7 Render sections trong `<div className="dashboard__sections">`. Mỗi section chỉ render khi count > 0 (AC-3). Order tuân thủ AC-3.
  - [ ] C.1.8 Recent Agent Activity: render JSX comment block:
    ```tsx
    {/* Section: Recent Agent Activity — defer until runs API (Story 3.4) merged */}
    ```
    KHÔNG render section. KHÔNG `<RecentActivitySection />`.
  - [ ] C.1.9 Empty state branch (`!hasAnySection`): render EmptyState "All caught up" (AC-10) sau stats bar. Stats bar vẫn render (counts có thể là 0).
  - [ ] C.1.10 Partial error (`hasPartialError`): render banner `<div role="status" className="dashboard__partial-error-banner">` text `"Some projects' tasks couldn't be loaded — try again"` + retry button. **KHÔNG dùng Toast** (toast là transient — banner inline cho dashboard error là persistent).
  - [ ] C.1.11 Subtitle mapping cho mỗi section (theo UX spec dòng 285, 307, vv.). Helper inline:
    ```ts
    const subtitle = (count: number, singular: string, plural: string) =>
      count === 1 ? `1 ${singular}` : `${count} ${plural}`;
    // Needs Review:    subtitle(n, "task waiting for your decision", "tasks waiting for your decision")
    // Failed & Blocked: subtitle(n, "task needs attention", "tasks need attention")
    // Running Sessions: subtitle(n, "session active", "sessions active")
    // Ready to Assign:  subtitle(n, "task ready to assign", "tasks ready to assign")
    // Completed Recently: subtitle(n, "task completed in last 24h", "tasks completed in last 24h")
    ```
  - [ ] C.1.12 `onOpen` / `onResume` / `onViewProgress` / `onAssign` handlers tất cả gọi `openTask(task, task.project)` (đã có `project` field nhờ aggregation Task A.1).
  - [ ] C.1.13 `onDismiss` (NeedsReviewCard) stub: `() => { /* TODO(epic-5): wire dismissal */ }`. Hoặc thay vì TODO inline, expose component prop nhưng truyền `() => {}` từ Dashboard.tsx. **Khuyến nghị truyền `() => {}` để TypeScript explicit.**
  - [ ] C.1.14 CSS class root `dashboard`. Layout:
    - `.dashboard__header`: padding-bottom `--space-4`, border-bottom `--border`.
    - `.dashboard__header-greeting`: font-size-heading-l, font-weight 600.
    - `.dashboard__header-date`: font-size-body-s, `--text-secondary`.
    - `.dashboard__stats-bar`: margin-top `--space-6`.
    - `.dashboard__sections`: margin-top `--space-8`, display flex column gap `--space-8`.
    - `.dashboard__partial-error-banner`: padding `--space-3 --space-4`, background `--status-failed-bg`, border `--status-failed-border`, color `--status-failed-text`, radius `--radius-md`, margin-bottom `--space-4`. Bao gồm "Try again" button.

- [ ] **Task C.2 — Update `frontend/src/routes/DashboardRoute.tsx`** (AC: 1)
  - [ ] C.2.1 Replace toàn bộ placeholder hiện hữu (10 dòng) bằng:
    ```tsx
    import Dashboard from "../features/dashboard/Dashboard";

    export default function DashboardRoute() {
      return <Dashboard />;
    }
    ```
  - [ ] C.2.2 KHÔNG đụng vào `App.tsx` (route đã wire sẵn `/dashboard` → `DashboardRoute`).

### D. Tests

> **Quy ước test:** Vitest + React Testing Library. Test file co-located. Mock API qua `vi.mock("../../../api/tasks", ...)` + `vi.mock("../../../api/projects", ...)`. Use `vi.setSystemTime(new Date("2026-05-26T10:00:00Z"))` để deterministic `formatRelativeTime` + `formatDashboardGreeting`.

- [ ] **Task D.1 — `frontend/src/features/dashboard/taskClassification.test.ts`** (AC: 2, 3, 7, 8)
  - [ ] D.1.1 Test `countActive`: tạo array tasks với mix statuses, expect đếm chỉ `assigned/running/paused/needs-review/changes-requested`.
  - [ ] D.1.2 Test `countNeedsReview`: chỉ count `needs-review` + `changes-requested`.
  - [ ] D.1.3 Test `countRunning`: chỉ count `running`.
  - [ ] D.1.4 Test `countCompletedToday`: 2 completed tasks — 1 hôm nay (updatedAt sau midnight), 1 hôm qua (updatedAt 25h trước). Expect count = 1. Mock `now`.
  - [ ] D.1.5 Test `tasksCompletedRecently`: 3 completed tasks — 1h trước, 23h trước, 25h trước. Expect 2 tasks (3rd loại). Sort desc by `updatedAt`.
  - [ ] D.1.6 Test mỗi `tasks*` function trả array sort desc by `updatedAt`.

- [ ] **Task D.2 — `frontend/src/features/dashboard/formatters.test.ts`** (AC: 1, 4, 5, 8)
  - [ ] D.2.1 Test `formatDashboardGreeting`: ranges 5h, 11h, 12h, 17h, 18h, 0h, 4h → expect correct greeting prefix.
  - [ ] D.2.2 Test `formatDashboardDate`: input `new Date("2026-05-20T10:00:00")` → expect `"Wednesday, May 20"`.
  - [ ] D.2.3 Test `agentLabel`: `"claude"` → `"Claude CLI"`, `"codex"` → `"Codex CLI"`, `null` → `"Unassigned"`.

- [ ] **Task D.3 — `frontend/src/hooks/useAggregatedTasks.test.tsx`** (AC: 11, 13)
  - [ ] D.3.1 Setup QueryClientProvider wrapper helper.
  - [ ] D.3.2 Test happy path: 2 projects, mỗi project 2 tasks → expect `tasks.length === 4`, mỗi task có `project` field gắn đúng id.
  - [ ] D.3.3 Test empty projects: projects = [] → expect `tasks = []`, `isPending = false`, `isError = false`.
  - [ ] D.3.4 Test partial error: 2 projects, project 1 tasks fetch OK, project 2 fail → expect `hasPartialError = true`, `tasks` chỉ chứa tasks của project 1.
  - [ ] D.3.5 Test full error: projects fetch fail → expect `isError = true`, `tasks = []`.
  - [ ] D.3.6 Test refetch: gọi `result.refetch()` → mock fetch được gọi lại.

- [ ] **Task D.4 — `frontend/src/features/dashboard/Dashboard.test.tsx`** (AC: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13)
  - [ ] D.4.1 Helper `renderDashboard(opts)` setup full provider stack: `QueryClientProvider`, `ActiveProjectContextProvider`, `TaskDetailProvider`, `MemoryRouter`. Mock API.
  - [ ] D.4.2 Test AC-1: render greeting `"Good morning, Loc 👋"` (mock time 10:00) + date heading.
  - [ ] D.4.3 Test AC-1 evening: mock time 20:00 → render `"Good evening, Loc 👋"`.
  - [ ] D.4.4 Test AC-2: 4 stat cards render với counts đúng. Snapshot count values theo input task array.
  - [ ] D.4.5 Test AC-3: tasks gồm 1 needs-review + 1 failed + 1 running + 1 assigned + 1 completed (updated 1h trước) → expect 5 sections render đúng order (DOM order assertion qua `getAllByRole("heading", { level: 2 })`).
  - [ ] D.4.6 Test AC-3 empty section skip: tasks chỉ có 1 running → expect KHÔNG có section "Needs Your Review" / "Failed" / "Ready" / "Completed".
  - [ ] D.4.7 Test AC-4 click "Open Review" → `openTask` mock được gọi với (task, project) đúng.
  - [ ] D.4.8 Test AC-5 reason text literal `"Session terminated unexpectedly"` render — KHÔNG render exit code / stack trace (assert `queryByText(/exit code/i)` = null).
  - [ ] D.4.9 Test AC-5 click "Resume Session" → `openTask` mock được gọi.
  - [ ] D.4.10 Test AC-6 click "View Progress" → `openTask` mock được gọi.
  - [ ] D.4.11 Test AC-6 KHÔNG render text "Step:" (assert `queryByText(/^Step:/i)` = null).
  - [ ] D.4.12 Test AC-7 row 48px focusable: query Ready row → expect `role="button"` + click → `openTask` được gọi.
  - [ ] D.4.13 Test AC-8 completed row focusable + relative time text render đúng.
  - [ ] D.4.14 Test AC-9 KHÔNG render section "Recent Agent Activity" (assert `queryByText(/Recent Agent Activity/i)` = null).
  - [ ] D.4.15 Test AC-10 all caught up: mock tasks = [] AND projects = [{...}] → expect EmptyState `"You're all caught up!"` render + CTA "Go to Board" click → navigate('/board') được gọi (mock `useNavigate`).
  - [ ] D.4.16 Test AC-11 loading: TanStack Query pending → expect skeleton + `aria-busy="true"`.
  - [ ] D.4.17 Test AC-11 error: mock fetch reject → expect `role="alert"` + "Try again" button click → refetch.
  - [ ] D.4.18 Test AC-13 no projects: projects = [] → expect `"No projects yet"` EmptyState + stats bar KHÔNG render.
  - [ ] D.4.19 Test AC-12 accessibility: assert root `<section>` có `aria-labelledby`, h1 có `id="dashboard-heading"`, mỗi section có `aria-labelledby="dashboard-section-{slug}"`.

- [ ] **Task D.5 — Component-level tests:** (optional — coverage gap)
  - [ ] D.5.1 `NeedsReviewCard.test.tsx`: render với task fixture, assert title + StatusBadge + 2 buttons; click buttons triggers props.
  - [ ] D.5.2 `FailedBlockedCard.test.tsx`: assert "BLOCKED" label (KHÔNG "Failed") + reason text fixed; click buttons.
  - [ ] D.5.3 `RunningSessionCard.test.tsx`: assert violet pulse dot + click "View Progress".
  - [ ] D.5.4 `DashboardStatsBar.test.tsx`: render với mix tasks fixture, assert 4 counts đúng. Test loading → `aria-busy` + "—".
  - [ ] D.5.5 `DashboardSection.test.tsx`: assert `<section aria-labelledby>` + h2 với id; assert variant class toggles.
  - [ ] D.5.6 `ReadyToAssignRow.test.tsx` + `CompletedRecentlyRow.test.tsx`: assert 48px height (via getComputedStyle / data attr — hoặc dùng `expect(row).toHaveClass("dashboard-compact-row")`); click → openTask.
  - [ ] D.5.7 **Khuyến nghị:** Implement D.4 + D.1 + D.2 + D.3 đầy đủ trước; D.5 chỉ thêm khi coverage chưa đủ với D.4.

### E. TypeScript + integration verification

- [ ] **Task E.1 — TypeScript strict pass** (AC: tất cả)
  - [ ] E.1.1 `cd frontend && npx tsc --noEmit` exit 0.
  - [ ] E.1.2 KHÔNG dùng `any` / `as any` trong code mới. Dùng `Task["agent"]` thay cho hardcode union.

- [ ] **Task E.2 — Full test suite pass**
  - [ ] E.2.1 `cd frontend && npm test` → tất cả test passes.
  - [ ] E.2.2 KHÔNG break existing tests (Kanban + TaskDetailPanel + StatusBadge etc.).

- [ ] **Task E.3 — Lint pass**
  - [ ] E.3.1 `cd frontend && npx eslint .` (hoặc `npm run lint` nếu defined) exit 0.

- [ ] **Task E.4 — Manual smoke test (optional)**
  - [ ] E.4.1 `cd backend && cargo run` + `cd frontend && npm run dev`.
  - [ ] E.4.2 Mở `http://localhost:5173/` → redirect `/dashboard`.
  - [ ] E.4.3 Tạo 2-3 projects + 3-5 tasks với mix statuses qua API (curl hoặc Task Board UI).
  - [ ] E.4.4 Verify: greeting + date đúng, stats counts đúng, sections render đúng order, click card → Detail Panel mở.
  - [ ] E.4.5 Test empty: delete all tasks → "All caught up" render.

- [ ] **Task E.5 — KHÔNG được thay đổi (regression guard)**
  - [ ] E.5.1 KHÔNG đổi `frontend/src/components/StatusBadge.tsx` core logic (chỉ export thêm `STATUS_DISPLAY` nếu Task B.3.3 chọn cách đó).
  - [ ] E.5.2 KHÔNG đổi `frontend/src/features/board/TaskBoard.tsx` (chỉ chạm via reuse queryKey).
  - [ ] E.5.3 KHÔNG đổi `frontend/src/components/AppShell.tsx` (DashboardRoute đã wire qua App.tsx).
  - [ ] E.5.4 KHÔNG thêm backend endpoint mới. KHÔNG đụng vào `backend/`.
  - [ ] E.5.5 KHÔNG implement keyboard shortcuts global (defer 4.2). KHÔNG implement responsive layout breakpoints (defer 4.3).

---

## Dev Notes

### Architecture compliance

**File locations (theo `_bmad-output/planning-artifacts/architecture.md` §"Project Directory Structure" dòng 460–463, 479):**

```
frontend/src/
├── features/dashboard/         ← NEW
│   ├── Dashboard.tsx           ← NEW (top-level dashboard composition)
│   ├── Dashboard.css           ← NEW
│   ├── Dashboard.test.tsx      ← NEW
│   ├── DashboardSection.tsx    ← NEW (reusable section wrapper)
│   ├── DashboardSection.css    ← NEW
│   ├── DashboardSection.test.tsx ← NEW (optional, D.5.5)
│   ├── DashboardStatsBar.tsx   ← NEW
│   ├── DashboardStatsBar.test.tsx ← NEW (optional, D.5.4)
│   ├── DashboardStatusBadge.tsx ← NEW (label-override wrapper)
│   ├── NeedsReviewCard.tsx     ← NEW
│   ├── NeedsReviewCard.test.tsx ← NEW (optional, D.5.1)
│   ├── FailedBlockedCard.tsx   ← NEW
│   ├── FailedBlockedCard.test.tsx ← NEW (optional, D.5.2)
│   ├── RunningSessionCard.tsx  ← NEW
│   ├── RunningSessionCard.test.tsx ← NEW (optional, D.5.3)
│   ├── ReadyToAssignRow.tsx    ← NEW
│   ├── CompletedRecentlyRow.tsx ← NEW
│   ├── dashboard-compact-row.css ← NEW (shared style cho 2 row variants)
│   ├── taskClassification.ts   ← NEW (pure utility)
│   ├── taskClassification.test.ts ← NEW
│   ├── formatters.ts           ← NEW (greeting/date/agentLabel helpers)
│   └── formatters.test.ts      ← NEW
├── hooks/
│   └── useAggregatedTasks.ts   ← NEW
│   └── useAggregatedTasks.test.tsx ← NEW
├── routes/
│   └── DashboardRoute.tsx      ← UPDATE (replace placeholder, 4 dòng)
└── components/
    └── StatusBadge.tsx         ← UPDATE (chỉ thêm `export const STATUS_DISPLAY` nếu chọn Task B.3.3 approach reuse map; nếu KHÔNG chọn, KHÔNG đụng)
```

**Tổng file mới: ~14–22 (tùy chọn D.5 optional tests). File update: 1–2.**

**Files KHÔNG đụng (regression guard):**
- `frontend/src/App.tsx` (route đã wire).
- `frontend/src/components/AppShell.tsx`.
- `frontend/src/features/board/*` (chỉ reuse `formatRelativeTime` qua import).
- `frontend/src/features/detail/TaskDetailPanel.tsx` (Detail Panel mở qua context — KHÔNG đổi panel).
- `frontend/src/api/*` (KHÔNG thêm endpoint).
- `backend/*` (KHÔNG đụng).

### Library/Framework requirements

| Library | Version (locked) | Dùng trong 4.1 |
|---|---|---|
| `@tanstack/react-query` | 5.100.11 (architecture dòng 234) | `useQueries` cho parallel tasks fetch |
| `react-router` | 7.15.1 (architecture dòng 235) | `useNavigate` cho "Go to Board" CTA |
| `react` | 19.x (project-context §"Technology Stack") | `useMemo`, `useState`, types |
| `vitest` + `@testing-library/react` | matches `frontend/package.json` (đã pinned) | Test |

**KHÔNG thêm dependency mới.**

### Status casing convention

- Task `status` trên wire là **kebab-case lowercase** từ TS perspective: `"needs-review"`, `"changes-requested"`, `"failed"`, `"running"`, etc. (xem `frontend/src/types/task.ts` const `TaskStatus`).
- Backend DB store PascalCase (`"NeedsReview"`, `"Failed"`...) và serialize wire qua `.to_lowercase()` (`backend/src/models/task.rs::serialize_status_lowercase`). **Hiện tại có wire-format gap:** `"NeedsReview".to_lowercase()` → `"needsreview"` (KHÔNG hyphen) ≠ frontend expect `"needs-review"`. **Tuy nhiên** không phải vấn đề của 4.1 vì:
  1. Hiện tại backend KHÔNG bao giờ ghi DB status = `'NeedsReview'` / `'ChangesRequested'` / `'Completed'` (Epic 3 implementation chưa làm transitions đó — sessions chỉ set `Running`, `Paused`, `Failed`, `Cancelled`, `Assigned`).
  2. Khi nào Epic 5 implement Review flow → backend transitions sẽ phải pick **kebab-case** trên wire (hoặc đổi serializer). Đây là deferred concern, KHÔNG phải scope 4.1.
- **Hành động cho dev agent 4.1:** Dùng `TaskStatus` enum keys (kebab-case) làm canonical reference. Nếu test fixture cần `needs-review` task, manually craft `task: { status: "needs-review" }` — KHÔNG đụng vào backend serializer.

### Section subtitle mapping

| Section | Subtitle template |
|---|---|
| Needs Your Review | `"{N} task{s} waiting for your decision"` |
| Failed & Blocked | `"{N} task{s} need{s} attention"` |
| Running Sessions | `"{N} session{s} active"` |
| Ready to Assign | `"{N} task{s} ready to assign"` |
| Completed Recently | `"{N} task{s} completed in last 24h"` |

Pluralization: count = 1 → singular form, > 1 → plural. Helper inline ở `Dashboard.tsx` — KHÔNG over-engineer i18n.

### Frontend formatting helpers

`formatRelativeTime` — **reuse** từ `frontend/src/features/board/taskToCardProps.ts` dòng 29–42. Output examples: `"just now"`, `"15m"`, `"3h"`, `"2d"`, `"3w"`, `"2026-05-20"`. **KHÔNG copy-paste** logic.

`formatDashboardGreeting(now)` + `formatDashboardDate(now)` — Task A.3.

`agentLabel(agent)` — Task A.3. Centralized — Story 3.5a sẽ có thêm hook reuse; nếu Story 3.5a đã merge khi 4.1 implement → dùng helper từ 3.5a thay vì tạo ở `formatters.ts`. Verify Story 3.5a's helper location (likely `frontend/src/lib/agentLabel.ts` hoặc gần `TaskDetailPanel.tsx`).

### State management

| State | Owner | Notes |
|---|---|---|
| `projects` data | TanStack Query `["projects"]` | Already managed by `useProjectsQuery` |
| `tasks` per project | TanStack Query `["tasks", projectId]` | Already managed by `useTasks(projectId)`; 4.1 reuse cùng queryKey via `useQueries` |
| `activeProject` | `ActiveProjectContext` | KHÔNG đụng — dashboard hiển thị aggregated cross-project, KHÔNG filter theo active |
| `selectedTask` (Detail Panel) | `TaskDetailContext` | Dashboard chỉ gọi `openTask` qua `useTaskDetail()` |
| `now` (relative time anchor) | `useMemo(() => new Date(), [])` | Freeze cho 1 render lifecycle; re-render nếu props/state khác đổi |

### Critical don't-miss rules

- ❌ **KHÔNG render exit code, stack trace, raw stderr** trong Failed card (AC-5). Reason text hard-coded `"Session terminated unexpectedly"`.
- ❌ **KHÔNG render Session ID** ở bất kỳ card nào (project-context §"Critical Don't-Miss Rules" "Hiển thị Session ID mặc định trong UI").
- ❌ **KHÔNG hardcode hex color** — bắt buộc CSS variables `--*` từ `frontend/src/styles/tokens.css`.
- ❌ **KHÔNG poll backend** trong dashboard (4.1 không có `refetchInterval`). Defer khi epic 3 polling pattern consolidated.
- ❌ **KHÔNG render section "Recent Agent Activity"** trong 4.1 (AC-9). Comment placeholder + skip.
- ❌ **KHÔNG đụng** `StatusBadge.tsx` core ngoài việc export `STATUS_DISPLAY` map (nếu chọn reuse approach). KHÔNG đổi visual ở Kanban board.
- ❌ **KHÔNG implement keyboard shortcuts global** (⌘K, ⌘N, R). Defer 4.2.
- ❌ **KHÔNG implement responsive breakpoint adaption** (defer 4.3). 4.1 chỉ desktop default ≥1280px.

### Critical implementation rules

**React (project-context §"Framework-Specific Rules"):**
- TypeScript strict mode — khai báo type rõ cho mọi prop, state, hook return.
- State management: dùng React built-in (`useState`, `useMemo`, `useContext`) cộng TanStack Query cho server state — KHÔNG thêm Redux/Zustand.

**CSS:**
- Bắt buộc dùng CSS variables: `--brand-primary`, `--bg-card`, `--border`, `--text-primary`, `--text-secondary`, `--status-*-bg/text/border`, `--space-*`, `--radius-*`, `--shadow-*`. List đầy đủ ở `frontend/src/styles/tokens.css`.
- KHÔNG hardcode `#hex`.

**Routing:**
- `DashboardRoute` đã wire trong `App.tsx` dòng 12. Index route `/` redirect tới `/dashboard`. KHÔNG đụng routes.

**Click handlers:**
- Tất cả `onOpen` / `onResume` / `onViewDetails` / `onViewProgress` / `onAssign` / row clicks → `openTask(task, task.project)` qua `useTaskDetail()` context. Detail Panel sẽ tự render (đã mount qua Story 2.4 AppShell integration).

### Previous story intelligence

**Từ Story 2.4 (done):**
- `TaskDetailContext` với `openTask(task, project)` đã có. Pattern: dashboard click bất kỳ → `openTask(task, project)` → panel mở. KHÔNG cần navigate route.
- StatusBadge `.app-status-badge--running` đã có pulse animation built-in. RunningSessionCard chỉ cần dùng `<StatusBadge status="running" />`.

**Từ Story 2.3 (done):**
- `formatRelativeTime` helper ở `frontend/src/features/board/taskToCardProps.ts` dòng 29 — reuse.
- TaskCard keyboard handler pattern (Enter + Space) ở `frontend/src/components/TaskCard.tsx` dòng 29–43 — copy pattern cho Dashboard cards/rows nhưng KHÔNG copy-paste; viết inline tương đương.
- Board status keys: `"draft" | "ready" | "assigned" | "running" | "needs-review" | "changes-requested" | "completed" | "failed"` ở `KanbanColumn.tsx` dòng 5. **KHÔNG redefine union — import `TaskStatus` từ `types/task.ts`.**

**Từ Story 2.2 (done):**
- `listTasks(projectId)` API client + `Task` type — reuse.
- Backend `status` wire format lowercase (PascalCase to_lowercase) — xem note ở §"Status casing convention".

**Từ Story 2.1 (done):**
- `projectsApi.list()` + `useProjectsQuery` + `useResolvedActiveProject` ở `frontend/src/hooks/useProjects.ts` — reuse `useProjectsQuery` (raw query) thay vì `useResolvedActiveProject` (dashboard cần TẤT CẢ projects, không chỉ active).

**Từ Stories 3.x (mostly ready-for-dev, chưa merged code):**
- KHÔNG dùng runs API / `useRunList` / `RunTimeline` trong 4.1. Defer.

### Git intelligence

**Recent commits:**
- `fe91262 Merge PR #12: 3-5b story doc` — Story 3.5b story file merged (chưa implement).
- `4b06bf4 docs(story): 3-5b-comments-runs-and-logs-tabs-and-runtimeline` — same.
- `52d8de3 docs(story): 3-5a-session-summary-tab-and-optimistic-resume-ui` — same.
- `ce70657 feat(session): implement cancel session functionality with graceful shutdown and exit detection` — Story 3.2 implementation merged.

**Patterns observed:**
- Story creation PRs chứa 2 files: story `.md` + `sprint-status.yaml` update.
- Implementation PRs (frontend-only) thường có 5–15 files (components + tests + types).
- Tests location consistent: frontend co-located `*.test.tsx` / `*.test.ts`.

### Latest technical specifics

Không có technical area nào yêu cầu research version mới cho 4.1:
- React 19.x + TanStack Query 5.100.x + React Router 7.15.x — đã pinned trong `frontend/package.json`, API stable.
- `useQueries` API (TanStack Query v5) — mature từ v4, KHÔNG breaking change.
- `Intl.DateTimeFormat` — standard Web API, browser support Chrome 24+ (architecture dòng 1859: "Chrome 120+ primary").

### Project Structure Notes

**Alignment với architecture.md (dòng 460–463, 479):** Cấu trúc `features/dashboard/Dashboard.tsx` + `DashboardSection.tsx` + `routes/DashboardRoute.tsx` đã được pre-allocate trong architecture. Story 4.1 expand bằng cách thêm các section component + helper modules trong cùng folder.

**Detected variance:** Architecture chỉ list 2 file (`Dashboard.tsx`, `DashboardSection.tsx`) — 4.1 expand thêm component-per-section (NeedsReviewCard, FailedBlockedCard, RunningSessionCard, ReadyToAssignRow, CompletedRecentlyRow, DashboardStatsBar, DashboardStatusBadge) + utility modules (taskClassification, formatters) + hook (useAggregatedTasks). **Rationale:** Single-file Dashboard sẽ quá dài (>500 dòng); split để dễ test isolated + match React composition pattern. KHÔNG conflict architecture's intent.

### References

- `_bmad-output/planning-artifacts/epics.md#Story 4.1: Morning Dashboard` (dòng 753–798) — Source AC-1 đến AC-13 (mapping: AC-1↔greeting AC, AC-2↔stats bar AC, AC-3↔priority order, AC-4↔Review section, AC-5↔Failed section, AC-6↔Running section, AC-7↔Ready section, AC-10↔empty state).
- `_bmad-output/planning-artifacts/epics.md#Epic 4 framing` (dòng 192–196, 749–751) — narrative + FRs/NFRs/UX-DRs.
- `_bmad-output/planning-artifacts/epics.md#UX-DR17` (dòng 119) — Dashboard spec summary.
- `_bmad-output/planning-artifacts/epics.md#NFR-6` (dòng 58) — accessibility baseline (section-level scope cho 4.1).
- `_bmad-output/planning-artifacts/ux-design-specification.md#3. Màn Hình: Morning Dashboard` (dòng 248–371) — full UX spec sections 3.1–3.8.
- `_bmad-output/planning-artifacts/ux-design-specification.md#DashboardSection custom component` (dòng 1676–1679).
- `_bmad-output/planning-artifacts/ux-design-specification.md#Implementation Roadmap Phase 3` (dòng 1689–1690) — DashboardSection + Stats bar in this phase.
- `_bmad-output/planning-artifacts/ux-design-specification.md#Accessibility Strategy` (dòng 1820–1845) — semantic HTML + aria-labelledby.
- `_bmad-output/planning-artifacts/architecture.md#Project Directory Structure` (dòng 460–463, 479).
- `_bmad-output/planning-artifacts/architecture.md#Frontend Architecture` (dòng 230–246) — TanStack Query pattern (refetchInterval defer cho 4.1).
- `_bmad-output/project-context.md#Critical Implementation Rules` — Language/Framework rules.
- `_bmad-output/project-context.md#Critical Don't-Miss Rules` (dòng 122–131) — Don't display Session ID, don't store full log, etc.
- `frontend/src/types/task.ts` — `TaskStatus` enum (canonical kebab-case keys).
- `frontend/src/components/StatusBadge.tsx` — STATUS_DISPLAY map (potentially export trong Task B.3).
- `frontend/src/features/board/taskToCardProps.ts` (dòng 29–42) — `formatRelativeTime` reuse.
- `frontend/src/features/board/TaskBoard.tsx` (dòng 88–101) — loading/empty/error pattern reference.
- `frontend/src/components/EmptyState.tsx` — EmptyState component cho AC-10 + AC-13.
- `frontend/src/contexts/TaskDetailContext.tsx` — `useTaskDetail()` + `openTask` API.

---

## Dev Agent Record

### Agent Model Used

_To be filled by dev agent_

### Debug Log References

_To be filled by dev agent_

### Completion Notes List

_To be filled by dev agent_

### File List

_To be filled by dev agent_
