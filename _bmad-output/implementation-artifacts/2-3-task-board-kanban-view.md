# Story 2.3: Task Board (Kanban View)

Status: review

<!-- Validation tùy chọn — chạy validate-create-story trước khi dev-story nếu muốn double-check. -->

**Epic:** 2 — Project & Task Management
**Story ID:** 2.3
**Story Key:** 2-3-task-board-kanban-view
**Lane (FEATURE_INTAKE.md):** normal — frontend-only, không chạm data model, không thêm public API contract (chỉ consume `GET /api/projects/{projectId}/tasks` đã design ở Story 2.2). Blast radius bounded trong route `/board` + 2 file mới trong `frontend/src/features/board/` + edit thin route placeholder. Risk flags: Existing behavior (BoardRoute placeholder Story 1.4 sẽ render board thật) + Public contract consumer (mới depend on Story 2.2 list endpoint shape). **2 flags → normal.** Không có Auth/Authorization/External provider.

---

## Story

As a developer using omni-agent,
I want to mở `/board` và thấy tất cả tasks của active project được sắp xếp vào 8 cột kanban theo status,
so that tôi có thể scan toàn cảnh pipeline công việc trong 3 giây, biết task nào đang chạy, task nào cần review, task nào bị block — không cần click vào từng task.

---

## Acceptance Criteria

> **Nguồn gốc AC:** `_bmad-output/planning-artifacts/epics.md` Story 2.3 (dòng 442–477) + PRD FR-4 + UX-DR10 (dòng 105) + UX spec §4 "Task Board (Kanban)" (dòng 374–462). Backend JSON dùng `camelCase` và task `status` trên wire dùng **lowercase** (Story 2.2 §"Status casing decision"). 8 cột hiển thị **chốt theo UX-DR10** (Backlog/Ready/Assigned/Running/NeedsReview/ChangesRequested/Completed/Blocked) — xem Dev Notes §"Status→Column mapping" để biết cách map TaskStatus enum (Story 2.0 — 9 values bao gồm `cancelled`) vào 8 cột này. Mỗi AC viết Given/When/Then **testable**.

**AC-1 — Route `/board` mount `<TaskBoard>` thay thế placeholder Story 1.4:**
**Given** user đã chọn active project (qua `useResolvedActiveProject()` từ Story 2.1) và navigate đến `/board`
**When** route render
**Then** `frontend/src/routes/BoardRoute.tsx` render `<TaskBoard />` thay vì paragraph placeholder hiện tại (`"Placeholder for kanban view (Story 2.3)."`).
**And** trang KHÔNG render `<h1>Task Board</h1>` ở route level nữa — heading hierarchy do `<TaskBoard>` đảm nhiệm (xem AC-2 cho structure thực tế).
**And** `<TaskBoard />` được mount BÊN TRONG `<AppShell>` (như Story 1.4 nested route) — TopBar + Sidebar KHÔNG re-mount khi navigate đến `/board`.

**AC-2 — Board layout: 8 cột kanban, horizontal scroll, mỗi cột 280px:**
**Given** active project tồn tại và `useTasks(projectId)` query đã success với ≥ 0 tasks
**When** `<TaskBoard>` render
**Then** render đúng **8 columns** theo thứ tự sau, mỗi column 280px width, layout `display: flex; gap: var(--space-4); overflow-x: auto`:

| # | TaskStatus value (wire) | Column label (UI) | Status dot color token |
| --- | --- | --- | --- |
| 1 | `draft` | Backlog | `var(--status-draft-text)` (gray) |
| 2 | `ready` | Ready | `var(--status-ready-text)` (blue) |
| 3 | `assigned` | Assigned | `var(--status-assigned-text)` (indigo) |
| 4 | `running` | Running | `var(--status-running-text)` (violet) — dot có pulse animation |
| 5 | `needs-review` | Needs Review | `var(--status-needs-review-text)` (amber) |
| 6 | `changes-requested` | Changes Requested | `var(--status-changes-requested-text)` (orange) |
| 7 | `completed` | Completed | `var(--status-completed-text)` (green) |
| 8 | `failed` | Blocked | `var(--status-failed-text)` (red) |

**And** mỗi column header là `<h2>` (heading hierarchy ở board level — board KHÔNG có `<h1>` riêng, vì TopBar đã có app brand `<h1>`; xem Dev Notes §"Heading hierarchy") với format: `<status-dot> <Column label> <count badge>`, height 40px, sticky-top trong column body.
**And** tasks với `status === "cancelled"` **KHÔNG render** trên board ở story này (xem AC-7 + Dev Notes §"Cancelled tasks").

**AC-3 — Mỗi task xuất hiện đúng MỘT cột theo `status`:**
**Given** project `OMNI` có 4 tasks với status lần lượt `["draft", "ready", "running", "completed"]`
**When** board render
**Then** column "Backlog" chứa đúng 1 task (status `draft`), column "Ready" chứa đúng 1 task (status `ready`), column "Running" chứa đúng 1 task (status `running`), column "Completed" chứa đúng 1 task (status `completed`).
**And** các column còn lại (Assigned, Needs Review, Changes Requested, Blocked) hiển thị inline empty state (xem AC-7).
**And** total số TaskCard render trên DOM = 4 (mỗi task xuất hiện đúng 1 lần). Verify bằng `screen.getAllByRole("article")` trả về array length 4.

**AC-4 — TaskCard render đúng fields từ Task object (Story 2.2 shape):**
**Given** task có shape `{ id: "OMNI-001", projectId, seq: 1, title: "Fix login redirect", description, acceptanceCriteria, agent: "claude", role: "coder", status: "running", createdAt, updatedAt }`
**When** task được render trong column Running
**Then** TaskCard (component từ Story 2.0) nhận đầy đủ props:
```ts
<TaskCard
  task={{ id: task.id, title: task.title, status: task.status }}
  project={{ key: activeProject.key }}
  agent={{ name: task.role ?? task.agent ?? "unassigned", runtime: task.agent ?? "codex" }}
  sessionState="no-session"   // session state thực sẽ wire ở Story 3.x — story này luôn pass "no-session"
  commentsCount={0}            // comments count wire ở Story 3.3 — story này luôn pass 0
  lastActivity={formatRelativeTime(task.updatedAt)}
  onClick={undefined}          // click handler wire ở Story 2.4 (open Task Detail Panel)
/>
```
**Mapping rules** (BẮT BUỘC, áp dụng trong `featureures/board/TaskBoard.tsx` adapter function `taskToCardProps`):
- `agent` prop value:
  - Nếu `task.role && task.agent` → `{ name: task.role, runtime: task.agent }` (role là human-readable label, runtime là CLI binary).
  - Nếu chỉ có `task.agent` (chưa assign role) → `{ name: task.agent, runtime: task.agent }`.
  - Nếu cả 2 đều null (status `draft`) → `{ name: "unassigned", runtime: "codex" }` (fallback runtime để AgentAvatar không crash — visually "unassigned" + grey-ish placeholder).
- `runtime` prop value của AgentAvatar chỉ chấp nhận `"codex" | "claude"`. Nếu `task.agent` là 1 giá trị khác (theoretically chỉ có 2 — Story 2.2 AC-10 enum lock `["codex", "claude"]`) → fallback `"codex"`.

**AC-5 — Hover state nâng shadow + border per UX spec:**
**Given** TaskCard render trong column (state default)
**When** user hover chuột lên card
**Then** card có CSS `:hover` state thay đổi shadow từ `var(--shadow-sm)` → `var(--shadow-md)` và border từ `1px solid var(--border)` → `1px solid var(--border-strong)`.
**And** behavior này đã được implement trong Story 2.0 `TaskCard.css` (xem AC-7 component contract) — Story 2.3 KHÔNG override/duplicate. Verify visually qua manual checklist E.1; KHÔNG cần Vitest test (pseudo-class `:hover` không reliably test được trong jsdom).

**AC-6 — Running column có pulse dot + tasks trong Running column có SessionBadge "Active":**
**Given** board hiển thị với ≥ 1 task ở status `running`
**When** column "Running" render
**Then** status dot ở column header có CSS animation `@keyframes app-running-pulse` (1.2s ease-in-out infinite alternate, scale 1 → 1.2, opacity 1 → 0.6) — define inline trong `TaskBoard.css` hoặc `KanbanColumn.css` với name **không trùng** keyframes của StatusBadge/SessionBadge (Story 2.0 §"keyframes scope" — mỗi component define riêng để tránh collision).
**Status casing note:** TaskStatus enum compare lowercase (`task.status === "running"`) — KHÔNG so sánh với `"Running"` (DB lưu PascalCase nhưng API trả lowercase qua serde — Story 2.2 §"Status casing decision").
**And** SessionBadge trong TaskCard ở column này nhận `sessionState="no-session"` ở story 2.3 (real session state wire ở Epic 3) — visually KHÔNG hiển thị "Active" pulse trong session badge ở story này. Pulse dot chỉ ở **column header**. Xem Dev Notes §"Why no Active SessionBadge yet".

**AC-7 — Empty state per cột (inline) khi cột không có task:**
**Given** active project có tasks nhưng MỘT cột không có task nào match status đó
**When** cột đó render
**Then** body của cột render `<EmptyState>` (component từ Story 2.0) với variant `"inline"`, props:
```tsx
<EmptyState
  icon=""                                  // inline variant + empty icon: KHÔNG render icon (xem Story 2.0 AC-10 EmptyState inline behavior)
  variant="inline"
  heading="No tasks here"
  description="Tasks will appear when they reach this stage."
  ctaLabel={undefined}                     // KHÔNG render CTA "+ Add task" trong story này — sẽ wire ở story sau khi modal Add-from-column tồn tại (out of scope)
/>
```
**Spec deviation note:** UX spec §9.2 mô tả empty state cho Backlog/Ready có CTA `[+ Add task]`. Story 2.3 KHÔNG implement CTA này vì:
1. Story 2.2 đã có `[+ New Task]` button trong TopBar — duplicate button gây confusion.
2. Cần thêm prop `defaultStatus` cho CreateTaskModal (Story 2.2) để pre-fill status khi mở từ column — out of scope Story 2.3 ("Tạo Task ở Backlog từ board" là enhancement riêng, ghi vào `_bmad-output/implementation-artifacts/deferred-work.md`).

**AC-8 — Empty state board-level: active project chưa có task nào:**
**Given** user có active project nhưng `GET /api/projects/{projectId}/tasks` trả `[]`
**When** board render
**Then** thay vì 8 cột trống xếp ngang (gây cảm giác app broken), render **full-page** EmptyState:
```tsx
<EmptyState
  variant="full"
  icon="📋"
  heading="No tasks yet in this project"
  description="Create your first task using the + New Task button in the top bar."
  ctaLabel={undefined}     // KHÔNG render CTA riêng — chỉ thị + New Task TopBar là single source
/>
```
**And** 8 columns KHÔNG render trong case này (avoid double empty state).

**AC-9 — Empty state board-level: KHÔNG có active project:**
**Given** không có project nào (response `GET /api/projects` trả `[]`) hoặc `useResolvedActiveProject()` trả `null`
**When** user navigate đến `/board`
**Then** render full-page EmptyState với CTA:
```tsx
<EmptyState
  variant="full"
  icon="📁"
  heading="No projects yet"
  description="Create your first project from the sidebar to start tracking tasks."
  ctaLabel="Create your first project"
  onCtaClick={() => { /* xem AC-9 implementation note dưới */ }}
/>
```
**Implementation note cho `onCtaClick`:** Story 2.1 có `<CreateProjectModal>` được mở từ Sidebar Project Switcher dropdown (Story 2.1 Task C.13 wire context). Story 2.3 KHÔNG có direct API để trigger modal đó từ board. Two acceptable options (chọn 1):
- **Option A (preferred):** `onCtaClick = () => { /* focus sidebar project switcher */ document.querySelector<HTMLButtonElement>('[data-testid="project-switcher"]')?.focus(); }`. Tốn 0 extra context wiring. Visual hint: sidebar button gets focus ring.
- **Option B:** Skip CTA (`ctaLabel={undefined}`) — chỉ text hint "from the sidebar" đủ. Acceptable nếu Option A không hoạt động (e.g. Story 2.1 chưa add `data-testid="project-switcher"` — verify implementation và update test-id nếu cần ở dev-story phase).

Chọn Option A. Nếu CSS focus-visible ring chưa visible trên project switcher button (debug ở dev-story), fallback Option B.

**AC-10 — Polling: refetch tasks list mỗi 5s khi có ≥ 1 task ở status `running`:**
**Given** board hiển thị với ≥ 1 task `status === "running"`
**When** thời gian trôi qua
**Then** `useTasks(projectId)` query tự động refetch `GET /api/projects/{projectId}/tasks` mỗi **5000ms** (architecture §"TanStack Query polling pattern" + §"Realtime updates").
**And** khi response mới về với updated status, TanStack Query update cache → board re-render và task có thể "di chuyển" từ column này sang column khác (e.g. `running` → `completed`) **không full-page reload** — chỉ DOM nodes của TaskCard re-mount trong cột mới.
**And** khi KHÔNG có task nào ở status `running` (e.g. tất cả tasks ở status `draft`/`completed`) → polling **dừng** (`refetchInterval: false`) để tiết kiệm CPU/network local.
**Implementation pattern:**
```ts
useQuery({
  queryKey: tasksQueryKey(projectId),
  queryFn: () => listTasks(projectId),
  enabled: projectId !== null,
  refetchInterval: (query) => {
    const tasks = query.state.data ?? [];
    const hasRunning = tasks.some((t) => t.status === "running");
    return hasRunning ? 5000 : false;
  },
});
```

**AC-11 — Loading state lần đầu (no cached data):**
**Given** user navigate đến `/board` lần đầu (TanStack Query cache miss)
**When** `useTasks` đang `isPending === true`
**Then** board render skeleton placeholder thay vì empty state:
- Render 8 column headers (full height 40px) với label + dot (KHÔNG count badge khi chưa biết).
- Body mỗi column render **2 skeleton cards** với class `task-card-skeleton`: width 100%, height 96px, `background: var(--bg-hover)`, `border-radius: var(--radius-md)`, `animation: app-skeleton-pulse 1.5s ease-in-out infinite` (opacity 0.5 → 1 → 0.5).
- Define `@keyframes app-skeleton-pulse` trong `TaskBoard.css` (KHÔNG collide với pulse animations khác).
**Rationale:** Lần đầu mở `/board` mất ≤ 500ms (local backend) — skeleton chỉ flash nhanh. Nhưng không có skeleton sẽ flash empty state rồi sang full board → UX glitch.

**AC-12 — Error state: API call lỗi:**
**Given** `useTasks` query lỗi (`isError === true`, e.g. backend `500`, network down)
**When** board render
**Then** render error block thay vì board hoặc empty state:
```tsx
<div role="alert" className="task-board__error">
  <h2>Couldn't load tasks</h2>
  <p>{error.message ?? "Unknown error"}</p>
  <Button variant="secondary" size="md" onClick={() => refetch()}>Try again</Button>
</div>
```
Style block: padding `var(--space-8)`, text-align center, `color: var(--text-secondary)`, border `1px dashed var(--status-failed-border)`, `border-radius: var(--radius-md)`.
**And** click "Try again" → call `query.refetch()` từ `useTasks` (TanStack Query expose `refetch`).
**Toast:** KHÔNG hiển thị toast cho lỗi này (board-level error đã visible inline; toast sẽ duplicate noise). Chỉ dùng toast cho transient action errors (Story 2.1/2.2 pattern).

**AC-13 — Active project switch: board refetch tasks cho project mới:**
**Given** board đang hiển thị tasks của project `OMNI` (URL vẫn `/board`)
**When** user click Project Switcher trong Sidebar và chọn project `ERP-CB`
**Then** `useTasks` query key đổi từ `["tasks", "OMNI-id"]` → `["tasks", "ERP-CB-id"]` (TanStack Query auto-fetch cho key mới — không cần manual invalidate).
**And** board re-render với 8 columns mới + tasks của ERP-CB.
**And** cache của `["tasks", "OMNI-id"]` vẫn giữ (TanStack Query default `gcTime: 5 minutes`) — nếu user switch lại về OMNI ngay sau đó, render từ cache instant rồi background-refetch.

**AC-14 — Mount routes + no regression (Existing behavior guard):**
**Given** trước story này, route `/board` render placeholder với heading "Task Board" + paragraph "Placeholder for kanban view (Story 2.3)."
**When** Story 2.3 implementation complete
**Then** placeholder REMOVED hoàn toàn — không còn paragraph "Placeholder for kanban view".
**And** route `/dashboard` vẫn render `DashboardRoute` (UNCHANGED — Story 2.3 KHÔNG touch dashboard).
**And** route `/` vẫn redirect `/dashboard`, route `*` vẫn render 404 (App.tsx UNCHANGED).
**And** AppShell + TopBar + Sidebar UNCHANGED (Story 2.3 chỉ thay nội dung route `/board`).
**And** Sidebar NavLink "All Tasks" → `/board` vẫn active highlight khi user ở board route (NavLink behavior từ Story 1.4 UNCHANGED).

**AC-15 — TypeScript types: tasks API client + Task model extension:**
**Given** Story 2.0 đã tạo `frontend/src/types/task.ts` với minimal `Task = { id, title, status }`, và Story 2.2 đã extend với full shape qua `frontend/src/api/tasks.ts`.
**When** Story 2.3 import Task type
**Then** **KHÔNG redefine** `Task` interface. Import từ existing `frontend/src/types/task.ts` (extended bởi Story 2.2). Nếu Story 2.2 KHÔNG extend `task.ts` (e.g. để fields phụ trong `tasks.ts`), Story 2.3 phải extend `frontend/src/types/task.ts` để thêm fields cần thiết:
```ts
export interface Task {
  id: string;
  projectId: string;
  seq: number;
  title: string;
  description: string;
  acceptanceCriteria: string | null;
  agent: "codex" | "claude" | null;
  role: string | null;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}
```
Constraint: extension PHẢI backward-compatible với Story 2.0 (`id`, `title`, `status` vẫn required) — chỉ thêm fields, KHÔNG đổi types existing.
**Verify:** `cd frontend && npx tsc --noEmit` exit 0.

---

## Tasks / Subtasks

> **Quy ước:** Mỗi task root checkable. Subtasks indented 2 spaces. Reference AC trong dấu `()`. **Backend KHÔNG có thay đổi** trong story này (consume API đã có từ Story 2.2). Tasks chia 4 nhóm: **A** (types + adapter — pre-work), **B** (api client + hook), **C** (UI components + route wiring), **D** (validation + docs).

### A. Types & adapter pre-work

- [x] **Task A.1 — Verify/extend `frontend/src/types/task.ts` (AC: 15)**
  - [x] A.1.1 Đọc file `frontend/src/types/task.ts` hiện tại (do Story 2.0 tạo). Kiểm tra `Task` interface đã được Story 2.2 extend đầy đủ chưa (đầy đủ là: `id, projectId, seq, title, description, acceptanceCriteria, agent, role, status, createdAt, updatedAt`).
  - [x] A.1.2 Nếu chưa đủ, extend `Task` interface theo shape ở AC-15. KHÔNG xóa hay đổi type của 3 fields original (`id`, `title`, `status`). KHÔNG redefine `TaskStatus` (giữ const-object pattern từ Story 2.0 — `erasableSyntaxOnly: true` constraint).
  - [x] A.1.3 Nếu Story 2.2 đã extend qua file riêng (e.g. `frontend/src/api/tasks.ts` define `ApiTask`), refactor để dùng `Task` từ `types/task.ts` làm canonical type. Đây là tech debt cleanup nhẹ, một-lần.

- [x] **Task A.2 — Tạo `frontend/src/features/board/taskToCardProps.ts` adapter (AC: 4)**
  - [x] A.2.1 Tạo folder `frontend/src/features/board/` (chưa có — Story 2.3 là feature đầu tiên dùng folder này).
  - [x] A.2.2 Tạo file `taskToCardProps.ts` (camelCase vì helper function, không phải React component):
    ```ts
    import type { Task } from "../../types/task";

    export interface TaskCardPropsAdapted {
      task: { id: string; title: string; status: Task["status"] };
      project: { key: string };
      agent: { name: string; runtime: "codex" | "claude" };
      sessionState: "no-session" | "active" | "resumable" | "closed";
      commentsCount: number;
      lastActivity: string;
    }

    export function taskToCardProps(
      task: Task,
      project: { key: string },
      now: Date = new Date(),
    ): TaskCardPropsAdapted {
      const runtime: "codex" | "claude" = task.agent === "claude" ? "claude" : "codex";
      const name = task.role ?? task.agent ?? "unassigned";
      return {
        task: { id: task.id, title: task.title, status: task.status },
        project: { key: project.key },
        agent: { name, runtime },
        sessionState: "no-session",
        commentsCount: 0,
        lastActivity: formatRelativeTime(task.updatedAt, now),
      };
    }

    export function formatRelativeTime(iso: string, now: Date = new Date()): string {
      const then = new Date(iso);
      const diffMs = now.getTime() - then.getTime();
      const minutes = Math.floor(diffMs / 60000);
      if (minutes < 1) return "just now";
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d`;
      const weeks = Math.floor(days / 7);
      if (weeks < 4) return `${weeks}w`;
      return then.toISOString().slice(0, 10);
    }
    ```
    Pure function — dễ unit test (xem Task D.1).
  - [x] A.2.3 KHÔNG dùng `Intl.RelativeTimeFormat` ở story này (over-engineered cho local single-user app + i18n không phải MVP). Format string đơn giản theo UX spec §4.2 ("2h", "5 min ago", "3 days ago" style).

### B. API client + hook

- [x] **Task B.1 — Verify `frontend/src/api/tasks.ts` exposes `listTasks(projectId)` (AC: 10, 15)**
  - [x] B.1.1 Đọc file `frontend/src/api/tasks.ts` (do Story 2.2 tạo). Verify đã có function `listTasks(projectId: string): Promise<Task[]>` gọi `GET /api/projects/{projectId}/tasks` (Story 2.2 AC-5).
  - [x] B.1.2 Nếu Story 2.2 expose tên khác (e.g. `getTasks`, `fetchTasks`), giữ tên đó và update Task B.2 + B.3 import path. KHÔNG rename — tránh churn.
  - [x] B.1.3 Nếu Story 2.2 KHÔNG có list function (chỉ create/update/delete), thêm `listTasks` theo pattern Story 2.1 `listProjects`:
    ```ts
    import { apiFetch } from "./client";
    import type { Task } from "../types/task";

    export async function listTasks(projectId: string): Promise<Task[]> {
      return apiFetch<Task[]>(`/api/projects/${encodeURIComponent(projectId)}/tasks`);
    }
    ```
    Reuse `apiFetch<T>` wrapper + `ApiError` class do Story 2.1 tạo (xem Previous story intelligence).

- [x] **Task B.2 — Tạo `frontend/src/hooks/useTasks.ts` (AC: 10, 13)**
  - [x] B.2.1 Tạo file `frontend/src/hooks/useTasks.ts`:
    ```ts
    import { useQuery, type UseQueryResult } from "@tanstack/react-query";
    import { listTasks } from "../api/tasks";
    import type { Task } from "../types/task";

    export const tasksQueryKey = (projectId: string | null) =>
      ["tasks", projectId] as const;

    export function useTasks(projectId: string | null): UseQueryResult<Task[], Error> {
      return useQuery({
        queryKey: tasksQueryKey(projectId),
        queryFn: () => {
          if (projectId === null) throw new Error("projectId required");
          return listTasks(projectId);
        },
        enabled: projectId !== null,
        refetchInterval: (query) => {
          const tasks = query.state.data ?? [];
          const hasRunning = tasks.some((t) => t.status === "running");
          return hasRunning ? 5000 : false;
        },
      });
    }
    ```
    Note: `tasksQueryKey` export là source of truth — mutation hooks ở Story 2.4 (update/delete) sẽ invalidate cache qua key này.
  - [x] B.2.2 KHÔNG implement `useTask(taskId)` (single task) hay `useUpdateTask` ở story này — sẽ là responsibility của Story 2.4 (Task Detail Panel). API client `listTasks` đã đủ cho board.

### C. UI components + route wiring

- [x] **Task C.1 — Tạo `frontend/src/features/board/KanbanColumn.tsx` (AC: 2, 3, 6, 7)**
  - [x] C.1.1 Tạo file `KanbanColumn.tsx` (PascalCase). Props:
    ```tsx
    import type { ReactNode } from "react";

    interface KanbanColumnProps {
      statusValue: "draft" | "ready" | "assigned" | "running" | "needs-review" | "changes-requested" | "completed" | "failed";
      label: string;
      count: number;
      isRunning: boolean;       // chỉ true cho column "Running" — controls pulse animation
      children: ReactNode;       // TaskCards hoặc EmptyState
    }

    export default function KanbanColumn({ statusValue, label, count, isRunning, children }: KanbanColumnProps) {
      return (
        <section className={`kanban-column kanban-column--${statusValue}`} aria-labelledby={`kanban-${statusValue}-heading`}>
          <header className="kanban-column__header">
            <span
              className={`kanban-column__dot${isRunning ? " kanban-column__dot--pulse" : ""}`}
              aria-hidden="true"
            />
            <h2 id={`kanban-${statusValue}-heading`} className="kanban-column__title">{label}</h2>
            <span className="kanban-column__count" aria-label={`${count} tasks`}>{count}</span>
          </header>
          <div className="kanban-column__body">{children}</div>
        </section>
      );
    }
    ```
  - [x] C.1.2 Tạo `KanbanColumn.css`:
    ```css
    .kanban-column {
      width: 280px;          /* UX-DR10 + UX §4.1 */
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      background: var(--bg-app);
      border-radius: var(--radius-md);
      max-height: 100%;
      overflow: hidden;
    }
    .kanban-column__header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      height: 40px;
      padding: 0 var(--space-3);
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .kanban-column__dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--text-secondary);
    }
    .kanban-column--draft           .kanban-column__dot { background: var(--status-draft-text); }
    .kanban-column--ready           .kanban-column__dot { background: var(--status-ready-text); }
    .kanban-column--assigned        .kanban-column__dot { background: var(--status-assigned-text); }
    .kanban-column--running         .kanban-column__dot { background: var(--status-running-text); }
    .kanban-column--needs-review    .kanban-column__dot { background: var(--status-needs-review-text); }
    .kanban-column--changes-requested .kanban-column__dot { background: var(--status-changes-requested-text); }
    .kanban-column--completed       .kanban-column__dot { background: var(--status-completed-text); }
    .kanban-column--failed          .kanban-column__dot { background: var(--status-failed-text); }
    .kanban-column__dot--pulse {
      animation: app-kanban-pulse 1.2s ease-in-out infinite alternate;
    }
    @keyframes app-kanban-pulse {
      from { transform: scale(1);   opacity: 1; }
      to   { transform: scale(1.5); opacity: 0.6; }
    }
    .kanban-column__title {
      flex: 1;
      font-size: var(--font-size-body);
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }
    .kanban-column__count {
      font-size: var(--font-size-caption);
      color: var(--text-secondary);
      font-weight: 500;
    }
    .kanban-column__body {
      padding: var(--space-3);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      overflow-y: auto;
      flex: 1 1 auto;
      min-height: 120px;
    }
    ```
    KHÔNG hardcode hex (project-context hard rule). Tất cả tokens từ `frontend/src/styles/tokens.css` (Story 1.3 lock 9 status color triples).
  - [x] C.1.3 Verify token names exist trong `tokens.css`. Nếu vô tình chưa có token cho 1 status (e.g. `--status-changes-requested-text`), STOP và update `tokens.css` (Story 1.3 backfill) — KHÔNG hardcode hex tạm thời. Update token list ở `_bmad-output/implementation-artifacts/1-3-frontend-scaffold-and-design-tokens.md` File List nếu phải sửa.

- [x] **Task C.2 — Tạo `frontend/src/features/board/TaskBoard.tsx` (AC: 1, 2, 3, 4, 8, 9, 10, 11, 12, 13)**
  - [x] C.2.1 Tạo file `TaskBoard.tsx`. Skeleton:
    ```tsx
    import { useMemo } from "react";
    import TaskCard from "../../components/TaskCard";
    import EmptyState from "../../components/EmptyState";
    import Button from "../../components/Button";
    import KanbanColumn from "./KanbanColumn";
    import { taskToCardProps } from "./taskToCardProps";
    import { useTasks } from "../../hooks/useTasks";
    import { useResolvedActiveProject } from "../project/ActiveProjectContext"; // hoặc đúng path Story 2.1
    import type { Task } from "../../types/task";
    import "./TaskBoard.css";

    type BoardStatus = "draft" | "ready" | "assigned" | "running" | "needs-review" | "changes-requested" | "completed" | "failed";

    const COLUMNS: ReadonlyArray<{ value: BoardStatus; label: string }> = [
      { value: "draft", label: "Backlog" },
      { value: "ready", label: "Ready" },
      { value: "assigned", label: "Assigned" },
      { value: "running", label: "Running" },
      { value: "needs-review", label: "Needs Review" },
      { value: "changes-requested", label: "Changes Requested" },
      { value: "completed", label: "Completed" },
      { value: "failed", label: "Blocked" },
    ];

    export default function TaskBoard() {
      const activeProject = useResolvedActiveProject();
      const projectId = activeProject?.id ?? null;
      const { data: tasks, isPending, isError, error, refetch } = useTasks(projectId);

      // No active project → AC-9
      if (activeProject === null) {
        return (
          <section className="task-board task-board--empty" aria-labelledby="task-board-heading">
            <h1 id="task-board-heading" className="visually-hidden">Task Board</h1>
            <EmptyState
              variant="full"
              icon="📁"
              heading="No projects yet"
              description="Create your first project from the sidebar to start tracking tasks."
              ctaLabel="Create your first project"
              onCtaClick={() => {
                document.querySelector<HTMLButtonElement>('[data-testid="project-switcher"]')?.focus();
              }}
            />
          </section>
        );
      }

      // Loading skeleton → AC-11
      if (isPending) {
        return (
          <section className="task-board" aria-labelledby="task-board-heading" aria-busy="true">
            <h1 id="task-board-heading" className="visually-hidden">Task Board</h1>
            <div className="task-board__columns">
              {COLUMNS.map((col) => (
                <KanbanColumn key={col.value} statusValue={col.value} label={col.label} count={0} isRunning={col.value === "running"}>
                  <div className="task-card-skeleton" aria-hidden="true" />
                  <div className="task-card-skeleton" aria-hidden="true" />
                </KanbanColumn>
              ))}
            </div>
          </section>
        );
      }

      // Error → AC-12
      if (isError) {
        return (
          <section className="task-board task-board--error" aria-labelledby="task-board-heading">
            <h1 id="task-board-heading" className="visually-hidden">Task Board</h1>
            <div role="alert" className="task-board__error">
              <h2>Couldn't load tasks</h2>
              <p>{error?.message ?? "Unknown error"}</p>
              <Button variant="secondary" size="md" onClick={() => refetch()}>Try again</Button>
            </div>
          </section>
        );
      }

      const tasksList = tasks ?? [];

      // Empty board → AC-8
      if (tasksList.length === 0) {
        return (
          <section className="task-board task-board--empty" aria-labelledby="task-board-heading">
            <h1 id="task-board-heading" className="visually-hidden">Task Board</h1>
            <EmptyState
              variant="full"
              icon="📋"
              heading="No tasks yet in this project"
              description="Create your first task using the + New Task button in the top bar."
            />
          </section>
        );
      }

      // Group tasks by status (cancelled filtered out)
      const grouped = useMemo(() => groupByStatus(tasksList), [tasksList]);

      return (
        <section className="task-board" aria-labelledby="task-board-heading">
          <h1 id="task-board-heading" className="visually-hidden">Task Board</h1>
          <div className="task-board__columns">
            {COLUMNS.map((col) => {
              const colTasks = grouped[col.value] ?? [];
              return (
                <KanbanColumn
                  key={col.value}
                  statusValue={col.value}
                  label={col.label}
                  count={colTasks.length}
                  isRunning={col.value === "running"}
                >
                  {colTasks.length === 0 ? (
                    <EmptyState variant="inline" icon="" heading="No tasks here" description="Tasks will appear when they reach this stage." />
                  ) : (
                    colTasks.map((t) => {
                      const props = taskToCardProps(t, { key: activeProject.key });
                      return (
                        <TaskCard
                          key={t.id}
                          task={props.task}
                          project={props.project}
                          agent={props.agent}
                          sessionState={props.sessionState}
                          commentsCount={props.commentsCount}
                          lastActivity={props.lastActivity}
                        />
                      );
                    })
                  )}
                </KanbanColumn>
              );
            })}
          </div>
        </section>
      );
    }

    function groupByStatus(tasks: Task[]): Partial<Record<BoardStatus, Task[]>> {
      const out: Partial<Record<BoardStatus, Task[]>> = {};
      for (const t of tasks) {
        if (t.status === "cancelled") continue;   // AC-2: cancelled hidden từ board
        const key = t.status as BoardStatus;
        (out[key] ??= []).push(t);
      }
      return out;
    }
    ```
    Hooks rule check: `useMemo` được gọi SAU early returns → vi phạm Rules of Hooks. Refactor: chuyển `const grouped = useMemo(...)` lên TRÊN tất cả early returns, hoặc bỏ `useMemo` (group cheap với ≤ 100 tasks). **Chọn bỏ `useMemo`** — grouping 100 tasks là O(n), microseconds. Một dòng `const grouped = groupByStatus(tasksList);` đặt sau khi confirm `tasksList.length > 0`.
  - [x] C.2.2 Tạo `frontend/src/features/board/TaskBoard.css`:
    ```css
    .task-board {
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    .task-board__columns {
      display: flex;
      gap: var(--space-4);
      overflow-x: auto;
      flex: 1 1 auto;
      padding-bottom: var(--space-3);   /* breathing room cho scroll bar */
      min-height: 0;
    }
    .task-board--empty {
      align-items: center;
      justify-content: center;
    }
    .task-board__error {
      max-width: 480px;
      margin: var(--space-12) auto;
      padding: var(--space-8);
      text-align: center;
      color: var(--text-secondary);
      border: 1px dashed var(--status-failed-border);
      border-radius: var(--radius-md);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      align-items: center;
    }
    .task-board__error h2 {
      color: var(--text-primary);
      font-size: var(--font-size-heading-m);
      margin: 0;
    }
    .task-card-skeleton {
      width: 100%;
      height: 96px;
      background: var(--bg-hover);
      border-radius: var(--radius-md);
      animation: app-skeleton-pulse 1.5s ease-in-out infinite;
    }
    @keyframes app-skeleton-pulse {
      0%   { opacity: 0.5; }
      50%  { opacity: 1; }
      100% { opacity: 0.5; }
    }
    .visually-hidden {
      position: absolute;
      width: 1px; height: 1px;
      padding: 0; margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    ```
    `.visually-hidden` — accessibility utility cho `<h1>` heading hierarchy (xem Dev Notes §"Heading hierarchy"). Nếu utility class này đã exist trong `frontend/src/styles/global.css` (Story 1.3/1.4 có thể đã thêm), REUSE và xóa định nghĩa duplicate ở đây. Check trước khi viết.

- [x] **Task C.3 — Update `frontend/src/routes/BoardRoute.tsx` (AC: 1, 14)**
  - [x] C.3.1 Replace nội dung hiện tại (10 dòng placeholder) bằng:
    ```tsx
    import TaskBoard from "../features/board/TaskBoard";

    export default function BoardRoute() {
      return <TaskBoard />;
    }
    ```
    KHÔNG bọc thêm `<section data-testid="board-route">`, KHÔNG render `<h1>Task Board</h1>` ở route level. TaskBoard tự owner `<section>` + `<h1 class="visually-hidden">`.
  - [x] C.3.2 Verify route mount flow:
    - `App.tsx` line 13 `<Route path="/board" element={<BoardRoute />} />` UNCHANGED.
    - `AppShell` outer route element UNCHANGED.
    - Sidebar NavLink "All Tasks" → `/board` UNCHANGED.
  - [x] C.3.3 KHÔNG xóa `data-testid="board-route"` attribute lock từ Story 1.4 — Story 1.4 đã có Playwright check dựa trên test ID này. Sửa thành: gắn test ID vào root `<section>` của TaskBoard nếu cần:
    - **Option A (preferred):** Add `data-testid="board-route"` vào `<section className="task-board">` trong `TaskBoard.tsx` để Story 1.4 test pass.
    - **Option B:** Nếu Story 1.4 check khác (e.g. text content "Task Board") — verify Story 1.4 Playwright spec/test trước khi quyết định. Nếu check là `await page.locator('[data-testid="board-route"]').isVisible()` — Option A. Nếu check là `page.locator('h1', { hasText: 'Task Board' })` — phải render visible `<h1>` thay vì visually-hidden, hoặc update Story 1.4 selector.
    
    **Decision criteria:** Đọc Story 1.4 packet trước khi chọn. Default Option A.

### D. Validation + docs

- [x] **Task D.1 — Unit test `taskToCardProps.ts` (AC: 4)**
  - [x] D.1.1 Tạo `frontend/src/features/board/taskToCardProps.test.ts`. Test cases (parameterize với `it.each` nếu vitest version support):
    1. Task có `agent: "claude", role: "coder"` → output `agent.name === "coder", agent.runtime === "claude"`.
    2. Task có `agent: "codex", role: null` → output `agent.name === "codex", agent.runtime === "codex"`.
    3. Task có `agent: null, role: null` → output `agent.name === "unassigned", agent.runtime === "codex"`.
    4. Task `updatedAt` 30s ago → `lastActivity === "just now"`.
    5. Task `updatedAt` 5 min ago → `lastActivity === "5m"`.
    6. Task `updatedAt` 3h ago → `lastActivity === "3h"`.
    7. Task `updatedAt` 2 days ago → `lastActivity === "2d"`.
    8. Task `updatedAt` 2 weeks ago → `lastActivity === "2w"`.
    9. Task `updatedAt` 2 months ago → `lastActivity === "<ISO date YYYY-MM-DD>"`.
    
    Pass `now` parameter explicitly trong từng test (KHÔNG dùng `Date.now()` — flaky).

- [x] **Task D.2 — Component test `KanbanColumn.tsx` (AC: 2, 3, 6, 7)**
  - [x] D.2.1 Tạo `frontend/src/features/board/KanbanColumn.test.tsx`. Cases:
    1. Render với `statusValue="running"`, `isRunning=true` → dot có class `kanban-column__dot--pulse` (verify qua `container.querySelector('.kanban-column__dot--pulse')`).
    2. Render với `statusValue="ready"`, `isRunning=false` → dot KHÔNG có class pulse.
    3. Render với `count={5}` → `<span>` count text "5" + `aria-label="5 tasks"`.
    4. Render heading `<h2>` với `label="Backlog"` → `screen.getByRole("heading", { level: 2, name: "Backlog" })` found.
    5. Render children (pass `<div>child</div>`) → child visible trong DOM.

- [x] **Task D.3 — Component test `TaskBoard.tsx` (AC: 1, 2, 3, 4, 8, 9, 10, 11, 12, 13)**
  - [x] D.3.1 Tạo `frontend/src/features/board/TaskBoard.test.tsx`. Setup helper:
    ```tsx
    import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
    import { render, screen } from "@testing-library/react";
    import { vi } from "vitest";
    import TaskBoard from "./TaskBoard";

    // Mock useResolvedActiveProject and listTasks
    vi.mock("../project/ActiveProjectContext", () => ({
      useResolvedActiveProject: vi.fn(),
    }));
    vi.mock("../../api/tasks", () => ({
      listTasks: vi.fn(),
    }));

    function renderBoard(opts?: { client?: QueryClient }) {
      const client = opts?.client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
      return render(
        <QueryClientProvider client={client}>
          <TaskBoard />
        </QueryClientProvider>,
      );
    }
    ```
  - [x] D.3.2 Cases (mỗi case mock `useResolvedActiveProject` + `listTasks` tương ứng):
    1. **No active project** → `useResolvedActiveProject` returns `null` → screen has heading "No projects yet", button "Create your first project".
    2. **Loading** → `listTasks` returns pending promise → 8 KanbanColumn render (verify `getAllByRole("heading", { level: 2 })` length === 8) + skeleton cards present (verify `container.querySelectorAll(".task-card-skeleton").length === 16` — 2 per column).
    3. **Empty board** → `listTasks` resolves `[]` → screen has heading "No tasks yet in this project".
    4. **Error** → `listTasks` rejects with `new Error("boom")` → screen has heading "Couldn't load tasks" + button "Try again". (Use `vi.waitFor` for async error state.)
    5. **8 columns + 4 tasks distributed correctly** → mock `listTasks` resolves 4 tasks (status `["draft","ready","running","completed"]`) → assert: column "Backlog" count `1`, "Ready" `1`, "Running" `1`, "Completed" `1`; columns "Assigned", "Needs Review", "Changes Requested", "Blocked" hiển thị inline empty state "No tasks here".
    6. **Cancelled task hidden** → 2 tasks `["completed", "cancelled"]` → only 1 TaskCard rendered (column "Completed"), no card for cancelled in any column. Total `screen.getAllByRole("article")` length === 1.
    7. **Running column pulse** → ≥ 1 task `status === "running"` → column "Running" dot có class `--pulse`.
    8. **TaskCard receives correct props** → mock 1 task với `agent: "claude", role: "coder"`, project key "OMNI" → `screen.getByText("coder")` (agent name) + `screen.getByText("OMNI")` (project key chip).
  - [x] D.3.3 KHÔNG test polling `refetchInterval` trực tiếp (vitest fake timers + TanStack Query timing assertion brittle). Polling integration được verify ở manual checklist E.1 step 6.

- [x] **Task D.4 — Manual smoke test checklist (AC: 1, 8, 9, 10, 13, 14)**
  - [x] D.4.1 Thêm checklist vào Dev Notes §"Validation — manual smoke":
    1. `cd backend && cargo run` + `cd frontend && npm install && npm run dev` → mở `http://127.0.0.1:5173/board`.
    2. Khi KHÔNG có project → expect full-page empty "No projects yet" + Create CTA (AC-9).
    3. Tạo project OMNI qua Sidebar Project Switcher → board switch sang empty "No tasks yet in this project" (AC-8).
    4. Tạo task qua TopBar "+ New Task" với title "Test board" → toast "Task OMNI-001 created" → board re-fetch (qua mutation invalidate từ Story 2.2 Task C.3.1 — VERIFY query key match: Story 2.2 invalidate `tasksQueryKey(projectId)` đúng theo `useTasks` hook ở Task B.2). Task xuất hiện trong column "Backlog".
    5. Manually UPDATE DB: `sqlite3 ~/.omni-agent/omni-agent.db "UPDATE tasks SET status='Running' WHERE id='OMNI-001';"` → wait ≤ 5s → task auto-moves sang column "Running" + Running column dot có pulse animation visible (AC-10).
    6. Manually UPDATE DB: `... SET status='Completed' ...` → wait ≤ 5s → task moves sang column "Completed" + KHÔNG còn task `running` → polling STOP (network tab: no more `/api/projects/.../tasks` requests sau 10s).
    7. Switch sang project khác (tạo project ERP-CB) → board switch tasks visible (cache ERP-CB ≠ OMNI). Switch ngược lại OMNI → board render từ cache instantly (AC-13).
    8. Stop backend (`Ctrl+C` `cargo run` process) → reload `/board` → board hiển thị error state "Couldn't load tasks" + "Try again" button. Restart backend, click "Try again" → board recover (AC-12).
    9. Navigate `/dashboard` (Sidebar) → Dashboard placeholder vẫn render (Story 2.3 KHÔNG regress AC-14).
    10. Hover task card → shadow + border upgrade visible (AC-5 — Story 2.0 behavior).

- [x] **Task D.5 — Update `docs/TEST_MATRIX.md` row Story 2.3 (post-implementation)**
  - [x] D.5.1 Khi dev-story workflow finalize, update row 2.3:
    ```
    | 2.3 Task Board Kanban View | 8-column kanban grouped by status, polling 5s when any task Running, empty/loading/error states, no-project fallback | yes (taskToCardProps + KanbanColumn + TaskBoard component tests) | no | no | no | implemented | npm run test passed; manual smoke (Task D.4 checklist) passed; _bmad-output/implementation-artifacts/2-3-task-board-kanban-view.md |
    ```
    (Dev agent set `status = implemented` + update evidence lúc đóng story, KHÔNG ở story creation.)

---

## Dev Notes

### Status casing decision

Architecture lock (Story 2.2 §"Status casing decision"): **DB lưu PascalCase** (`"Draft"`, `"Running"`) — schema default `1_init.sql` line 18 — nhưng **wire format API trả lowercase** (`"draft"`, `"running"`) vì serde `rename_all = "lowercase"` ở enum-level (Story 2.2 implementation Task B sẽ chốt). Story 2.3 frontend so sánh `task.status === "running"` (lowercase). KHÔNG so sánh PascalCase.

Conflict guard: nếu Story 2.2 implementation kết thúc với wire format khác kỳ vọng (e.g. trả PascalCase), Story 2.3 dev-story MUST stop và escalate — KHÔNG hack lowercase normalize ở frontend (gây spec drift).

### Status → Column mapping

UX-DR10 chốt **8 columns**: Backlog/Ready/Assigned/Running/NeedsReview/ChangesRequested/Completed/Blocked. TaskStatus enum (Story 2.0) có **9 values** vì có thêm `cancelled`. Mapping:

| TaskStatus (wire) | Board column | Rationale |
| --- | --- | --- |
| `draft` | Backlog | Display name "Backlog" cho new tasks chưa ready (UX §4.1) |
| `ready` | Ready | 1:1 |
| `assigned` | Assigned | 1:1 |
| `running` | Running | 1:1 + pulse dot |
| `needs-review` | Needs Review | 1:1 |
| `changes-requested` | Changes Requested | 1:1 |
| `completed` | Completed | 1:1 |
| `failed` | Blocked | Display name "Blocked" — UX-DR10 chốt naming, KHÔNG dùng "Failed" trên board (Failed là technical term, Blocked là UX term) |
| `cancelled` | (hidden) | Terminal state — không occupy column space. Future Story 2.x có thể add Filter "Show cancelled" |

**Spec gap flag — "Paused":** Epic Story 2.3 AC text liệt kê "Paused" trong column list, và project-context.md mention status transition `exit code 0 → Paused`. Nhưng TaskStatus enum (Story 2.0) KHÔNG có `paused` value. Resolution decision (defer đến Epic 3 session lifecycle):
- Epic 3 Story 3.2 (Session Exit Detection) sẽ chốt: hoặc (a) add `paused` vào TaskStatus enum + 9 status colors (cần backfill `tokens.css` + StatusBadge variant), hoặc (b) drop "paused" concept và map exit code 0 → `completed` (terminal happy state).
- Story 2.3 KHÔNG cần render "Paused" column vì TaskStatus enum hiện tại không có value đó. Khi Epic 3 chốt direction, sẽ revisit Story 2.3 (incremental enhancement, không phải rework).

**Spec gap flag — `cancelled` không có column:** UX-DR10 8 columns không include Cancelled. Story 2.3 hide cancelled tasks. Nếu UX team chốt sau muốn Cancelled visible (e.g. small column footer collapsed by default), revisit ở Story 2.x cho enhancement. Ghi vào `_bmad-output/implementation-artifacts/deferred-work.md` (Task D.6 nếu file đã exist, hoặc append qua story flow).

### Heading hierarchy

AppShell hierarchy (Story 1.4):
- `<TopBar>` brand "omni-agent" KHÔNG phải `<h1>` (chỉ là `<span class="app-top-bar__brand">`) → board route được phép có `<h1>`.
- Story 2.3 board render `<h1 class="visually-hidden">Task Board</h1>` ở root `<section className="task-board">`. Visually hidden vì UX design KHÔNG có visual heading cho board screen (toolbar chiếm vị trí đó — và toolbar sẽ implement ở Story 2.x sau, không phải Story 2.3 — xem Out of Scope).
- Mỗi KanbanColumn header là `<h2>` (8 cột → 8 `<h2>`).

Accessibility check: `axe-core` audit (manual via DevTools) PHẢI pass cho route `/board` ở mỗi state (no project, empty, loading, error, populated). Manual qua DevTools Lighthouse hoặc `@axe-core/playwright` (nếu Story 1.4 đã wire — verify).

### Why no Active SessionBadge yet

TaskCard có prop `sessionState` từ Story 2.0 (`SessionBadge` 4 variants: `no-session | active | resumable | closed`). Story 2.3 luôn pass `"no-session"` vì:
- Real session state lives trong `sessions` table (schema từ Story 1.2). Frontend cần `GET /api/projects/{id}/tasks/{task_id}/session` (chưa được Story 2.2 implement — wait Story 3.x).
- Naive solution "infer session state từ task.status" (e.g. `status === "running"` → `"active"`) sai logic vì:
  - Task có thể `running` nhưng session `closed` (rare race condition trong subprocess death detection — Story 3.2 edge case).
  - Task `completed` có thể có session `resumable` (mark done thủ công trước khi subprocess kill).
- Cho phép `sessionState: "no-session"` ở tất cả cards trong story này. Khi Story 3.x land session API, revisit `taskToCardProps` adapter (1 chỗ đổi).

Running column pulse dot trên header (AC-6) là **separate visual cue** — column-level signal, không phải card-level.

### TanStack Query patterns reuse

[Source: `_bmad-output/implementation-artifacts/2-1-project-management.md` Task C.7 + `_bmad-output/implementation-artifacts/2-2-task-crud-and-agent-assignment.md` Task C.3]

- `useQuery` v5 object form — không positional args.
- Query key tuple format `["tasks", projectId] as const` — kebab-case không bắt buộc, dùng tuple cho type-safety.
- `refetchInterval` accepts function `(query) => number | false` — return `false` để stop polling.
- Mutations từ Story 2.2 (`useCreateTask`) invalidate `tasksQueryKey(projectId)` — Story 2.3 PHẢI dùng cùng key function `tasksQueryKey` (export từ `useTasks.ts`). Nếu Story 2.2 hard-code key array `["tasks", projectId]` thay vì import helper, refactor Story 2.2 nhỏ: extract `tasksQueryKey` từ `useTasks.ts` và Story 2.2 import (tránh 2 query keys collide).

### Cancelled tasks

Filtered ra trong `groupByStatus()` helper (Task C.2.1). KHÔNG render bất kỳ visual indicator nào "X cancelled tasks hidden". User muốn xem cancelled phải dùng API/DB trực tiếp (acceptable cho local single-user MVP). Future enhancement: Filter chip "Show cancelled" + render thêm column 9. Ghi vào `deferred-work.md`.

### Files to UPDATE (existing) — không phải NEW

Per architecture §"Read files being modified" critical rule, list explicit UPDATE files với current state + change:

1. **`frontend/src/routes/BoardRoute.tsx`** (10 lines, Story 1.4):
   - Current state: render `<section data-testid="board-route">` với `<h1>Task Board</h1>` + paragraph placeholder.
   - Story 2.3 change: replace toàn bộ content bằng `return <TaskBoard />`.
   - Must preserve: route export default (App.tsx import path UNCHANGED).
   - Risk: Story 1.4 có Playwright check `data-testid="board-route"` — Task C.3.3 đã document mitigation.

2. **`frontend/src/types/task.ts`** (Story 2.0 baseline, Story 2.2 may have extended):
   - Current state (POST Story 2.0): `Task = { id, title, status }` + `TaskStatus` const-object.
   - Story 2.3 change: EXTEND fields (`projectId, seq, description, acceptanceCriteria, agent, role, createdAt, updatedAt`) — chỉ nếu Story 2.2 chưa làm.
   - Must preserve: `TaskStatus` const-object name + 9 values (Story 2.0 contract).
   - Must preserve: 3 original `Task` fields (`id, title, status`) — Story 2.0 dependents (StatusBadge, TaskCard) gãy nếu type narrow lại.

3. **`frontend/src/api/tasks.ts`** (Story 2.2):
   - Verify only — KHÔNG modify trừ khi `listTasks` missing (Task B.1.3 fallback).

4. **`frontend/src/styles/tokens.css`** (Story 1.3):
   - Verify only — KHÔNG modify. Task C.1.3 guard: nếu 1 trong 8 status color tokens missing, fallback là update tokens.css (Story 1.3 backfill, NOT story 2.3 scope creep).

### Web research — phiên bản & best practice mới nhất

[Verified 2026-05-21]

- `@tanstack/react-query` **5.100.11** — đã cài Story 2.1. API v5 object form. `refetchInterval` function signature: `(query: Query) => number | false | undefined`. Return `false` stops polling (not `0`). Verified docs: https://tanstack.com/query/v5/docs/react/reference/useQuery#refetchinterval.
- `react` **19.2.6**, `react-router` **7.15.1**, `vite` **8.0.13**, `vitest` (Story 2.0 chốt version) — UNCHANGED.
- `react-testing-library` `@testing-library/react` — Story 2.0 setup. Use `screen.getByRole`, `getAllByRole`. `userEvent.setup()` for interactions.
- KHÔNG cần thư viện drag-and-drop (`react-dnd`, `@dnd-kit`) — UX §4.3 drag & drop là Phase 4 polish, KHÔNG trong Story 2.3 (xem Out of Scope).

### Previous story intelligence (Story 2.2 learnings)

[Source: `_bmad-output/implementation-artifacts/2-2-task-crud-and-agent-assignment.md`]

- **Patterns established:**
  - TanStack Query mutation pattern với `mutateAsync` + `onSuccess: invalidateQueries(tasksQueryKey)` — Story 2.3 useTasks là READ-side counterpart, cùng query key.
  - Task wire format: `camelCase` JSON, status `lowercase` enum (Story 2.2 §"Status casing decision").
  - Error envelope `{ "error": "<code>", "message": "<text>" }` + frontend `ApiError` class (Story 2.1) — reuse cho error state (AC-12).
  - `useResolvedActiveProject` hook (Story 2.1 C.6.4) — single source cho "current project" — reuse cho gating board.
  - Task assignment endpoint: assign-via-POST pattern `/tasks/{id}/assign` (KHÔNG dùng PUT) — Story 2.3 không touch assign nhưng note pattern cho Story 2.4.
- **Gotchas tránh lặp lại:**
  - Hooks rules: `useMemo` / `useQuery` không được nằm sau early return. Refactor: hoặc move hooks lên top, hoặc bỏ `useMemo` (Task C.2.1 chọn bỏ — grouping 100 tasks ≈ microseconds).
  - jsdom KHÔNG support CSS `:hover` pseudo-class reliably — AC-5 (hover state) PHẢI verify manual, không Vitest.
  - `verbatimModuleSyntax: true` (Story 1.3) — `import type { Task }` không `import { type Task }`.
  - `erasableSyntaxOnly: true` (Story 1.3) — KHÔNG dùng TS `enum`. TaskStatus là const-object (Story 2.0).
- **Tests pattern:** vitest mock module với `vi.mock(path, factory)` — Story 2.3 mock `useResolvedActiveProject` + `listTasks` (Task D.3.1).

### Git intelligence (last 5 commits)

[As of 2026-05-21]

- `2fa313a` Merge PR #5: docs(bmad): create story 2.2 — Task CRUD & Agent Assignment
- `7a2e10f` docs(bmad): create story 2.2 — Task CRUD & Agent Assignment (bmad-create-story)
- `48daafa` gitnexus (index update)
- `eab71e1` Merge PR #4: docs(bmad): create story 2.1 — Project Management
- `e62aed5` merge: resolve conflicts with main (story 2.0 merged) on devin/1779358413-story-2-1-project-management

**Insights cho Story 2.3:**
- Stories 2.0, 2.1, 2.2 đều là **docs-only commits** (story packet files). Story 2.3 này cũng là docs-only (story packet). Implementation work cho cả 4 stories sẽ là separate PRs sau dev-story workflow tương ứng.
- Branch convention: `devin/<timestamp>-story-X-Y-name` — follow Story 2.2 pattern.
- Implementation order khi multiple stories dev-story chạy: Story 2.0 → 2.1 → 2.2 → 2.3 → 2.4 (chain dependency). Skip một story → broken dependencies. Dev agent PHẢI verify previous stories đã `done` (sprint-status.yaml) trước khi `dev-story 2-3`.

### Trace AC ↔ Task

| AC | Tasks |
| --- | --- |
| AC-1 (route mount TaskBoard) | C.3 |
| AC-2 (8 columns layout) | C.1, C.2 |
| AC-3 (1 task → 1 column) | C.2 (groupByStatus), D.3 (case 5) |
| AC-4 (TaskCard props mapping) | A.2 (adapter), C.2 (use adapter), D.1 (adapter unit tests), D.3 (case 8) |
| AC-5 (hover state) | C.1 + C.2 (no override Story 2.0 styles), D.4 (manual step 10) |
| AC-6 (Running pulse dot + no Active SessionBadge yet) | C.1 (pulse class), C.2 (isRunning prop), D.2 (cases 1, 2), Dev Notes §"Why no Active SessionBadge yet" |
| AC-7 (empty state per column) | C.2 (render EmptyState in column body), D.3 (case 5) |
| AC-8 (empty board) | C.2 (render full EmptyState), D.3 (case 3) |
| AC-9 (no active project) | C.2 (render full EmptyState + CTA), D.3 (case 1) |
| AC-10 (polling 5s when Running) | B.2 (useTasks refetchInterval), D.4 (manual steps 5, 6) |
| AC-11 (loading skeleton) | C.2 (isPending branch), C.2.2 (skeleton CSS + keyframes), D.3 (case 2) |
| AC-12 (error state) | C.2 (isError branch + refetch button), D.3 (case 4), D.4 (manual step 8) |
| AC-13 (active project switch) | B.2 (query key per projectId), D.4 (manual step 7) |
| AC-14 (no regression) | C.3.2, C.3.3, D.4 (manual step 9), D.5 (TEST_MATRIX entry confirms unchanged routes) |
| AC-15 (TS types) | A.1, B.1, D.3 (compile = pass), `npx tsc --noEmit` ở D.4 prerequisite |

### Project Structure Notes

- File naming: frontend `PascalCase.tsx` cho components (`TaskBoard.tsx`, `KanbanColumn.tsx`) + `camelCase.ts` cho helpers/hooks (`taskToCardProps.ts`, `useTasks.ts`) — match Story 2.0/2.1/2.2 pattern.
- Co-location: `Component.tsx` + `Component.css` + `Component.test.tsx` cùng folder (Story 2.0 pattern). Folder `features/board/` chứa cả implementation + tests.
- Test discovery: vitest auto-discovers `*.test.ts` / `*.test.tsx` cạnh source file (config từ Story 2.0).
- `frontend/src/features/` folder: Story 2.1 tạo `features/project/`. Story 2.3 tạo `features/board/`. KHÔNG nest sub-folders sâu hơn — flat structure trong từng feature.
- `frontend/src/hooks/`: Story 2.2 đã tạo (Task C.3). Story 2.3 thêm `useTasks.ts` cùng folder.

### Validation expectations (TEST_MATRIX update)

Sau khi implement Story 2.3, thêm/update row trong `docs/TEST_MATRIX.md`:

| Story | Coverage | Backend unit | Backend integration | Frontend unit | Manual |
| --- | --- | --- | --- | --- | --- |
| 2.3 Task Board Kanban View | 8-column kanban grouped by status, polling 5s when Running, loading/empty/error/no-project states | n/a (no backend changes) | n/a | `taskToCardProps` (9 cases) + `KanbanColumn` (5 cases) + `TaskBoard` (8 cases) | D.4 checklist (10 steps) |

### Out of Scope (defer to later stories or `deferred-work.md`)

- **Drag & drop** to change task status (UX §4.3) → Phase 4 polish, Story 2.x or later.
- **Toolbar above board**: "[Task Board ▾] [Filter: All Projects ▾] [Group by: Status ▾] [+ New Task]" (UX §4.1) → Story 2.x (board filtering enhancement). Story 2.3 KHÔNG render toolbar — "+ New Task" đã có trên TopBar (Story 2.2).
- **Filter chips** "Filtered by: ERP-CB-CENTRES ×" (UX §4.4) → Story 2.x. KHÔNG cần Filter UI cho MVP single-project view (active project context).
- **Cancelled column / "Show cancelled" toggle** → see Dev Notes §"Status → Column mapping" spec gap.
- **Real-time session badge** ("Active" pulse trên TaskCard) → Epic 3 (sessions API).
- **Findings count** trong TaskCard footer (UX §4.2) → Story 4.x (review workflow).
- **TaskCard click → open Task Detail Panel** → Story 2.4.
- **Project color tag** (UX §4.2 mentions project color) → deferred per Story 2.0 AC-7 note (`project.color` not in scope until Story 2.1 add color, currently not implemented).
- **"+ Add task" CTA trong empty column** → see AC-7 spec deviation note.

Append items vào `_bmad-output/implementation-artifacts/deferred-work.md` lúc dev-story phase nếu chưa được capture ở đó.

### References

- Epic + AC: [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.3: Task Board (Kanban View)` (dòng 442–477)]
- PRD requirements: [Source: `_bmad-output/planning-artifacts/prds/prd-omni-agent-2026-05-20/prd.md` FR-4 (Task Board Kanban View)]
- UX spec — board layout: [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` §4 "Task Board (Kanban)" (dòng 374–462), §9 "Empty States" (dòng 1099–1105 inline column empty), §13 (component anatomy)]
- UX-DR10 (Task Board) + UX-DR3 (TaskCard) + UX-DR7 (Toast — not used here) + UX-DR9 (AppShell): [Source: `_bmad-output/planning-artifacts/epics.md#UX Design Requirements` (dòng 85–125)]
- Architecture (route structure, polling pattern, file layout, naming): [Source: `_bmad-output/planning-artifacts/architecture.md` §"Frontend Architecture" (dòng 230–246), §"TanStack Query polling pattern" (dòng 238–246), §"Complete Project Directory Structure" (dòng 415–484), §"Architectural Boundaries"]
- Project context rules (status casing, design tokens, naming, hard rules): [Source: `_bmad-output/project-context.md` §"Critical Implementation Rules", §"Critical Don't-Miss Rules"]
- Story 2.0 component contracts (TaskCard, StatusBadge, SessionBadge, AgentAvatar, EmptyState, Button): [Source: `_bmad-output/implementation-artifacts/2-0-shared-ui-components.md` AC-4 → AC-8, Task 7-11]
- Story 2.1 context hooks (`useResolvedActiveProject`, `ActiveProjectContext`): [Source: `_bmad-output/implementation-artifacts/2-1-project-management.md` Task C.5, C.6, C.13]
- Story 2.2 API contracts + patterns (`listTasks`, `tasksQueryKey`, status casing, error envelope): [Source: `_bmad-output/implementation-artifacts/2-2-task-crud-and-agent-assignment.md` AC-5, AC-14, AC-15, Task B.3.4, B.5, C.2, C.3]
- Story 1.4 route structure (AppShell nested routes, NavLink, BoardRoute placeholder): [Source: `_bmad-output/implementation-artifacts/1-4-appshell-layout-and-routing.md`; current placeholder: `frontend/src/routes/BoardRoute.tsx:1-10`]
- DB schema (tasks table, status default): [Source: `backend/src/db/migrations/1_init.sql:9-21`]
- AGENTS / Harness: [Source: `AGENTS.md` §"Task Loop", §"Done Definition"]
- Feature intake lane classification: [Source: `docs/FEATURE_INTAKE.md`]

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

- `npx tsc --noEmit` → exit 0 (no type errors)
- `npm run test` → 93/93 tests passed (13 test files)
- `npm run build` → exit 0 (build succeeds)

### Completion Notes List

- `useResolvedActiveProject` nằm trong `frontend/src/hooks/useProjects.ts`, không phải `ActiveProjectContext.tsx` như story spec giả định. Tests mock từ `../../hooks/useProjects`.
- `cancelled` tasks bị filter ra, không hiển thị trong bất kỳ column nào per AC.
- Story 2.2 Review Finding F7 (optional fields trong `Task` interface) được deferred sang future story.
- `role="article"` đã được thêm vào `TaskCard.tsx` khi không clickable để `getAllByRole('article')` hoạt động trong tests.
- `data-testid="board-route"` được giữ trên `<section>` trong `TaskBoard.tsx` để tương thích với Story 1.4 test.

### File List

**New files:**
- `frontend/src/features/board/taskToCardProps.ts`
- `frontend/src/features/board/taskToCardProps.test.ts`
- `frontend/src/features/board/KanbanColumn.tsx`
- `frontend/src/features/board/KanbanColumn.css`
- `frontend/src/features/board/KanbanColumn.test.tsx`
- `frontend/src/features/board/TaskBoard.tsx`
- `frontend/src/features/board/TaskBoard.css`
- `frontend/src/features/board/TaskBoard.test.tsx`

**Modified files:**
- `frontend/src/hooks/useTasks.ts` (thêm refetchInterval polling 5s khi có task running)
- `frontend/src/components/TaskCard.tsx` (thêm role="article" khi không clickable)
- `frontend/src/routes/BoardRoute.tsx` (thay placeholder bằng `<TaskBoard />`)
- `docs/TEST_MATRIX.md` (row 2.3 → implemented)
