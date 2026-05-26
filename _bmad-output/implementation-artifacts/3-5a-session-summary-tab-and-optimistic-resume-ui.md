# Story 3.5a: Session Summary Tab & Optimistic Resume UI

Status: ready-for-dev

<!-- Validation tùy chọn — chạy validate-create-story trước khi dev-story nếu muốn double-check. -->

**Epic:** 3 — Session Lifecycle & Agent Execution
**Story ID:** 3.5a
**Story Key:** 3-5a-session-summary-tab-and-optimistic-resume-ui
**Depends on:**
- Story 3.1 (AgentStrategy Trait & Start Session) — phải hoàn thành trước; story 3.5a reuse `startSession` API + task state model + agent label convention (`agent: "claude" | "codex"` → "Claude CLI" / "Codex CLI").
- Story 3.2 (Session Exit Detection & Graceful Shutdown) — phải hoàn thành trước; story 3.5a phụ thuộc vào task status transitions `Running → Paused | Failed | Cancelled` do 3.2 thực thi (UI cần status mới nhất để render Summary block đúng).
- Story 3.3 (Resume Session & Comment Tracking) — phải hoàn thành trước; story 3.5a reuse `resumeSession()` API client + `ResumeSessionResponse` type + `useResumeSession` hook. Story 3.5a **mở rộng** `useResumeSession` để thêm optimistic update (3.3 explicitly defer optimistic update tới 3.5a — xem 3.3 Task F.3.2).
- Story 3.4 (Run Log Dual-Storage) — phải hoàn thành trước; story 3.5a reuse `listRuns()` + `Run` type (`runNumber`, `input`, `exitCode`, `logTail`, `startedAt`, `endedAt`) để render Last Agent Summary block. **Nếu 3.4 chưa merge khi 3.5a bắt đầu**, dev agent phải pause + escalate — không stub Run type tạm thời.

---

## Story

As a developer using omni-agent,
I want Summary Tab trong Task Detail Panel hiển thị Current Status + Last Agent Summary + Next Suggested Action (gồm comment textarea + Resume button inline), thực hiện optimistic update khi resume, và auto-refresh live status feed mỗi 5s khi task đang `Running`,
So that tôi quản lý được toàn bộ vòng đời session active ngay trong Summary Tab — không phải switch tab, không phải chờ API round-trip để thấy status đổi, không phải reload để biết agent đang ở step nào.

---

## Acceptance Criteria

> **Nguồn gốc AC:** `_bmad-output/planning-artifacts/epics.md` Story 3.5a (dòng 681–707), FR-7 (dòng 136), FR-12 (dòng 141), NFR-7 (dòng 149), NFR-8 (dòng 150), UX-DR12 (dòng 163). `_bmad-output/planning-artifacts/ux-design-specification.md` §"Defining Core Experience" (dòng 1342–1413), §"Key UX Decisions Confirmed" (dòng 1489–1495), §"UJ-3: Resume Session cũ với Comment" (dòng 1548–1575), §"Component Strategy / Buttons" (dòng 1705–1733). `_bmad-output/planning-artifacts/architecture.md` §"Frontend Architecture" (dòng 232–246), §"Optimistic update (Resume/Start)" (dòng 381–388), §"Data Flow / Resume" (dòng 555–569). `_bmad-output/project-context.md` §"Critical Don't-Miss Rules" + §"React — Layout / Action buttons". Conventions: TanStack Query v5 `refetchInterval`, error envelope `{ error, message }` đã handle bởi `ApiError` (`frontend/src/api/client.ts`).

---

**AC-1 — Summary Tab layout cho task có session (status ∈ {Running, Paused, Failed, NeedsReview, ChangesRequested, Completed, Cancelled}):**

**Given** task `OMNI-001` mở trong Task Detail Panel với `task.status ∈ {paused, failed}` (state điển hình của UJ-3 Resume)
**When** user click tab "Summary" (mặc định active khi panel mở — xem TaskDetailPanel.tsx hiện tại dòng 158)
**Then** Summary tab render theo thứ tự top-to-bottom các block sau:

1. **Current Status block** — heading "Current Status" + human-readable label theo mapping AC-8 (KHÔNG hiển thị raw `exit_code`, KHÔNG hiển thị raw enum value `"paused"`).
2. **Last Agent Summary block** — heading "Last Agent Summary" + dòng metadata `Run #{runNumber} · {endedAt|startedAt} · agent: {Claude CLI|Codex CLI}` + một preformatted preview của `run.logTail` (last ≤ 10 dòng, truncate với ellipsis nếu dài hơn — KHÔNG full tail). Nếu `runs` list rỗng (chưa có run nào — không xảy ra với status `paused/failed` theo data model, nhưng defensive) → render placeholder "No runs yet for this task."
3. **Next Suggested Action block** — heading "Next Suggested Action" + comment textarea (AC-2) + Resume button (AC-3). Phía dưới button có hint text nhỏ: "Click Resume to continue this session." (không click → text chỉ là static guidance).

**And** description / acceptance criteria của task vẫn được hiển thị BÊN DƯỚI 3 block trên (sub-section "Task Description" + "Acceptance Criteria") — KHÔNG xóa content cũ, chỉ thêm 3 block mới ở đầu.

**Given** task ở status `running` (đang chạy)
**When** Summary tab mở
**Then** render 1. Current Status block (status mapping AC-8 → "Running") + **Live Status Feed block** (AC-5 — thay thế Last Agent Summary + Next Suggested Action). **KHÔNG render comment textarea / Resume button** khi đang Running (không thể resume một session đang chạy — backend reject 409 ở 3.3 AC-4).

**Given** task ở status `assigned | draft | ready | needs-review | changes-requested | completed | cancelled`
**When** Summary tab mở
**Then** Summary tab giữ nguyên content cũ (description + acceptance criteria từ Task 2.4 hiện tại) — KHÔNG render 3 block mới. Story 3.5a CHỈ thay đổi behavior cho 3 status: `paused`, `failed`, `running`. (Status khác có thể được mở rộng ở stories sau — Mark Done, NeedsReview UI flow… — out-of-scope 3.5a.)

---

**AC-2 — Comment textarea inline trong Next Suggested Action block:**

**Given** AC-1 render Next Suggested Action block (task ở `paused | failed`)
**When** kiểm tra DOM
**Then** có một `<textarea>` element với:
- `placeholder="Add instructions for next run…"` (đúng chuỗi với dấu `…` U+2026, KHÔNG dùng 3 dấu chấm thường `...` — match UX spec dòng 1390).
- `rows={3}` (đủ chỗ cho ~3 dòng instruction điển hình; user có thể resize nếu cần — KHÔNG khóa resize).
- Initial value = `""` (empty). Textarea state quản lý qua local `useState<string>("")` trong Summary tab component (KHÔNG dùng global state, KHÔNG dùng `useRef.current.value`).
- `aria-label="Comment for next run"` để screen reader navigate đúng.
- KHÔNG có `maxLength` cap (UX spec không yêu cầu — comment dài là edge case OK).

**And** textarea visible NGAY khi Summary tab mở (KHÔNG phải click "Add Comment" button rồi mới hiện textarea — luôn inline, theo UX spec dòng 1493).

**Given** user navigate qua tab khác (Comments / Runs / Logs / Settings) rồi quay lại Summary tab
**When** Summary tab re-mount
**Then** textarea content **bị reset về `""`** (theo design hiện tại của TaskDetailPanel: mỗi lần Active Tab đổi → component re-mount). Defer "draft persistence (localStorage)" sang story sau (KHÔNG scope 3.5a — Story 3.3 task F.4.3 đã defer rồi).

---

**AC-3 — Resume button label + behavior:**

**Given** AC-2 render textarea
**When** kiểm tra button bên dưới textarea
**Then** button luôn có label `"Resume Session"` (theo UX spec §"Key UX Decisions Confirmed" dòng 1493 + epic AC dòng 695: "Resume button label is 'Resume Session' when textarea is empty" — và không có quy định đổi label khi có content). **KHÔNG dùng label "Resume with Comment"** (UX spec dòng 1394 có nhắc nhưng dòng 1493 là consolidated key decision → ưu tiên 1493). Button dùng `<Button variant="primary" size="md">` — theo design system 2.0.

**And** button có `aria-label="Resume Session"` (cùng text như visible label — accessibility).

**Given** user click "Resume Session"
**When** mutation đang in-flight (loading state)
**Then** button label tạm thay sang `"Starting…"` (giống UX spec dòng 1395 + dòng 1564), button bị `disabled={true}`, textarea cũng `disabled={true}` (tránh user gõ thêm khi đang submit).

**Given** textarea có nội dung sau `.trim()` là empty string (e.g. user gõ toàn space)
**When** click Resume
**Then** treat như "no comment" — gọi `resumeSession(projectId, taskId, undefined)` (KHÔNG truyền empty string vì backend 3.3 AC-2 reject `"comment": ""` với 400). Comment empty/whitespace = user chỉ muốn retry mà không thêm instruction.

**Given** textarea có nội dung sau `.trim()` non-empty
**When** click Resume
**Then** gọi `resumeSession(projectId, taskId, trimmed)` — gửi text đã trim (KHÔNG raw value với leading/trailing whitespace) cho backend.

---

**AC-4 — Optimistic update task.status → "running" + invalidate + revert on error:**

**Given** AC-3 mutation fired (`useResumeSession(...).mutate(...)`)
**When** mutation `onMutate` callback chạy
**Then** **trước khi** HTTP request fire, frontend phải:
1. `queryClient.cancelQueries({ queryKey: ["task", projectId, taskId] })` — pause polling tạm thời tránh race.
2. `queryClient.cancelQueries({ queryKey: ["tasks", projectId] })` — pause list polling tương tự.
3. Snapshot data cũ: `const prevTask = queryClient.getQueryData(["task", projectId, taskId])` và `const prevTasks = queryClient.getQueryData(["tasks", projectId])`.
4. `queryClient.setQueryData(["task", projectId, taskId], old => old ? { ...old, status: "running" } : old)` — optimistic.
5. `queryClient.setQueryData(["tasks", projectId], (old: Task[] | undefined) => old?.map(t => t.id === taskId ? { ...t, status: "running" } : t))` — sync list cache.
6. Return `{ prevTask, prevTasks }` (context cho rollback).

**And** UI badge của task IMMEDIATELY hiển thị "Running" (StatusBadge → running variant, có pulse animation theo UX spec dòng 1643) — không chờ HTTP response.

**Given** mutation `onError` callback chạy (HTTP error, network fail, hoặc backend trả 4xx/5xx)
**When** error fire
**Then** **rollback bằng snapshot** (theo architecture.md dòng 381–388 đề xuất `onError: queryClient.invalidateQueries` — nhưng pattern chuẩn TanStack Query v5 là set lại snapshot, sau đó invalidate để re-fetch từ server làm authoritative):
1. `queryClient.setQueryData(["task", projectId, taskId], context.prevTask)` (rollback optimistic).
2. `queryClient.setQueryData(["tasks", projectId], context.prevTasks)` (rollback list).
3. `queryClient.invalidateQueries(...)` cho cả 2 query keys — để tự đồng bộ với server (server-side state có thể đã thay đổi do race, e.g. session đã exit giữa optimistic + error).
4. Hiển thị toast error qua `useToast().showToast({ tone: "error", message: <ApiError.message hoặc fallback "Failed to resume session"> })`.
5. **Đặc biệt cho error code `"session_already_active"` (3.3 AC-4 → 409):** tone = `"warning"` thay vì `"error"` (giống pattern 3.3 F.4.1 dòng 1187–1190 đã thiết lập).

**Given** mutation `onSuccess`
**When** response 200 trả về
**Then**:
1. `queryClient.invalidateQueries({ queryKey: ["task", projectId, taskId] })` — refresh task từ server (server-state authoritative).
2. `queryClient.invalidateQueries({ queryKey: ["tasks", projectId] })`.
3. `queryClient.invalidateQueries({ queryKey: ["runs", projectId, taskId] })` — Last Agent Summary cần biết run mới (3.4 đã expose endpoint).
4. **KHÔNG** đẩy task.status thành "running" thêm lần nữa qua `setQueryData` — optimistic đã làm rồi, invalidate sẽ tự re-sync (response từ server cũng là `status: "running"` per 3.3 AC-1).
5. Textarea clear (`setCommentText("")`).
6. Toast success: nếu có comment → `"Resumed ${taskId} with comment"`, không có comment → `"Session resumed for ${taskId}"` (match 3.3 F.4.1 dòng 1180–1183).

**And** mutation `onSettled` (luôn chạy after success/error): cleanup nothing — optimistic state đã handle bằng onError. Nếu không có `onError` (e.g. backend không reachable), `onSettled` không revert — phải dựa vào `onError`. Nếu cần, dùng `onSettled` để re-enable button/textarea (thực ra `isPending` đã handle).

---

**AC-5 — Live status feed khi task ở Running:**

**Given** task `OMNI-001` ở `task.status === "running"` (có thể do optimistic AC-4 hoặc do polling phát hiện status change)
**When** Summary tab mở
**Then** render **Live Status Feed block** thay cho Last Agent Summary + Next Suggested Action. Block này có:
- Heading "Live Status" với icon dot pulse (theo UX spec dòng 1398 — `[● RUNNING]`).
- Một `<ol aria-live="polite" aria-atomic="false">` (semantic ordered list — accessibility) chứa các step events. **`aria-live="polite"` bắt buộc** — match epic AC dòng 706.
- Mỗi step là `<li>` với: colored dot (green for completed, indigo for in-progress, gray for pending), label text (human-readable), timestamp (relative — "just now", "5s ago", "2m ago" — dùng helper format đơn giản, KHÔNG cần lib `date-fns`/`dayjs`).
- KHÔNG có raw log content trong feed — chỉ human-readable label. Raw log defer cho Logs tab (3.5b).

**And** steps được DERIVE từ task + latest run state (KHÔNG cần backend event log API mới):

| Step Label | Trigger Condition | Timestamp Source | State |
|---|---|---|---|
| "Starting session…" | `task.status === "running"` AND latest run `startedAt` đã có | `latestRun.startedAt` | completed (dot green) |
| "Sending comment to agent" | `task.status === "running"` AND `latestRun.input !== "retry"` AND `latestRun.input != null` | `latestRun.startedAt` | completed (dot green) |
| "Agent running…" | `task.status === "running"` AND latestRun.endedAt is null | `latestRun.startedAt` ("started Xs ago") | in-progress (dot indigo pulse) |

**And** **nếu** `task.status === "running"` nhưng list runs rỗng hoặc latest run không match (race window giữa optimistic AC-4 và polling fetch lần đầu) → render 1 step duy nhất "Starting session…" với timestamp "just now" (state in-progress). Khi polling lần tiếp theo fetch xong runs, feed re-render với đầy đủ steps theo bảng trên.

**Given** task transitions ra khỏi `running` (status đổi sang `paused | failed | needs-review | completed | cancelled` do polling phát hiện exit detection của 3.2)
**When** Summary tab nhận polling update
**Then** Live Status Feed block disappear; Last Agent Summary + Next Suggested Action block xuất hiện lại (AC-1) — render dựa trên status mới. Transition này **không** cần animation đặc biệt (story này không scope animation library — defer).

---

**AC-6 — TanStack Query polling refetchInterval 5s khi task đang Running:**

**Given** task ở `task.status === "running"` AND Task Detail Panel mở (`useTask` hook active)
**When** `useTask(projectId, taskId)` query register `refetchInterval`
**Then** interval = `5000` ms (5 giây — match architecture.md dòng 244 + NFR-8 + epic AC dòng 706). Backend GET `/api/projects/{projectId}/tasks/{taskId}` fire mỗi 5s.

**Given** task NOT ở `running` (paused/failed/done/...)
**When** `useTask` query register `refetchInterval`
**Then** interval = `false` (TanStack Query disable polling cho query đó) — KHÔNG hammer backend không cần thiết. Match pattern existing `useTasks` (dòng 17–22 của `frontend/src/hooks/useTasks.ts`).

**And** **dynamic switching:** khi task chuyển từ `paused → running` (do user resume, optimistic) → TanStack Query tự động restart polling vì `refetchInterval` là function nhận `query` state. Khi task chuyển `running → paused/failed` → tự động stop. Implementation pattern:
```ts
refetchInterval: (query) => query.state.data?.status === "running" ? 5000 : false,
```

**Given** TaskDetailPanel UNMOUNT (user đóng panel)
**When** TanStack Query observe disappearance
**Then** polling tự động pause (vì không observer nào subscribe nữa). KHÔNG cần manual cleanup.

**Given** task Running, polling tick mỗi 5s
**When** backend trả về task với status mới (e.g. `paused` do exit detection 3.2)
**Then** UI re-render Summary tab content theo status mới (Live Status Feed → Last Agent Summary + Next Suggested Action).

**Performance budget:** 5s là max acceptable theo UX spec dòng 1366–1368 ("Resume ≤30s" + "thấy step trong 10s"). 5s interval đảm bảo worst-case lag 5s giữa exit detection và UI update. KHÔNG giảm interval xuống dưới 5s (sẽ tăng load không cần thiết — defer SSE/WebSocket sang post-MVP).

---

**AC-7 — `useTask` hook mới (single task with polling):**

**Given** architecture.md dòng 446 + 466 specify `hooks/useTask.ts` ← useQuery + refetchInterval polling — nhưng file CHƯA tồn tại trong repo hiện tại (verify bằng `ls frontend/src/hooks/` chỉ có `useProjects.ts`, `useStartSession.ts`, `useTasks.ts`).
**When** Story 3.5a implement
**Then** tạo file mới `frontend/src/hooks/useTask.ts` với shape:
```ts
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getTask } from "../api/tasks";
import type { Task } from "../types/task";

export const taskQueryKey = (projectId: string, taskId: string) =>
  ["task", projectId, taskId] as const;

export function useTask(
  projectId: string | null,
  taskId: string | null,
): UseQueryResult<Task, Error> {
  return useQuery({
    queryKey: taskQueryKey(projectId ?? "", taskId ?? ""),
    queryFn: () => {
      if (!projectId || !taskId) throw new Error("projectId and taskId required");
      return getTask(projectId, taskId);
    },
    enabled: projectId !== null && taskId !== null,
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 5000 : false,
  });
}
```

**And** TaskDetailPanel.tsx được refactor để dùng `useTask(project.id, task.id)` lấy data fresh thay vì chỉ dựa vào `selectedTask` từ `TaskDetailContext` (static snapshot). `selectedTask` vẫn dùng để biết task ID + open/close panel, nhưng RENDER content dựa trên `useTask().data ?? selectedTask` (fallback snapshot khi query đang loading lần đầu).

**Reasoning:** `TaskDetailContext` snapshot không tự update khi `useTasks` list refresh. Để Summary tab thấy status transition real-time, cần một observer riêng cho single task. Đây là refactor có chủ đích — KHÔNG break behavior hiện tại của các tab khác (vì các tab khác chỉ dùng `task.id` để fetch sub-resources, không quan tâm `task.status` thay đổi).

**Defensive:** nếu `useTask` trả error (e.g. task bị xóa trong khi panel mở — edge case) → fallback render với `selectedTask` snapshot + log warning qua `console.warn`. KHÔNG crash panel.

---

**AC-8 — Status label mapping (human-readable, không raw enum):**

**Given** task có một trong các `status` value của `TaskStatus` enum
**When** Summary tab Current Status block render
**Then** dùng mapping sau (label tiếng Anh — match UX spec convention; có thể i18n sau):

| `task.status` | Current Status label |
|---|---|
| `running` | "Running — agent is processing this task" |
| `paused` | "Paused — last run ended cleanly. Ready to resume." |
| `failed` | "Failed — last run exited with a non-zero code. Review and resume." |
| `needs-review` | "Needs Review — agent finished and is awaiting your review." |
| `changes-requested` | "Changes Requested — your review has been sent back to the agent." |
| `completed` | "Completed — task is done." |
| `cancelled` | "Cancelled — session was killed." |
| `assigned` | "Assigned — ready to start the first session." |
| `ready` / `draft` | (Current Status block KHÔNG render cho 2 status này — fallback về description / AC như trước.) |

**And** label được implement như một pure function `summaryStatusLabel(status: TaskStatus): string | null` (return `null` cho `ready` / `draft` để component dễ check render hay không). Function đặt trong `frontend/src/features/detail/summaryStatus.ts` (file mới — nhỏ, ≤30 dòng).

**And** **KHÔNG** hiển thị `exitCode` raw trong label (e.g. KHÔNG có chuỗi như "Failed (exit 1)" trong AC-8 — exit code chỉ visible trong Last Agent Summary block dưới dạng metadata tổng hợp, không phải primary label). Match epic AC dòng 693: "Current Status (human-readable, not raw exit code)".

---

**AC-9 — Last Agent Summary block data fetch + render (Paused/Failed only):**

**Given** task `OMNI-001` ở `paused | failed`
**When** Summary tab mở, AC-1 render Last Agent Summary block
**Then** dùng `useQuery({ queryKey: ["runs", projectId, taskId], queryFn: () => listRuns(projectId, taskId) })` (reuse `listRuns` từ 3.4 `frontend/src/api/runs.ts`). KHÔNG cần polling cho query này (Paused/Failed = terminal state — KHÔNG cần refetchInterval). Specifically: `refetchInterval: false` (explicit override default).

**And** render dựa trên `runs[0]` (sorted DESC by `startedAt` theo 3.4 AC-6):
- `Run #{runNumber}` — large mono-ish text.
- `· ${endedAt ?? startedAt}` (formatted local time — dùng `new Date(...).toLocaleString()` giống TaskDetailPanel hiện tại dòng 106).
- `· ${agentLabel}` — Claude CLI / Codex CLI (reuse mapping từ TaskDetailPanel SessionPanel hiện tại dòng 89–90).
- `· exit: ${exitCode}` — nếu `exitCode != null` (chỉ Failed thường có exitCode hiển thị; Paused exit=0 thì cũng OK hiển thị "exit: 0" — không che giấu).
- **Preview của `logTail`:** nếu `runs[0].logTail` non-null AND non-empty, render trong `<pre>` block với:
  - Max 10 dòng (split by `\n`, slice 0–10, join `\n`).
  - Nếu original có > 10 dòng → append `\n…` (ellipsis dòng cuối — báo có thêm content trong Logs tab).
  - Font monospace (đã có CSS variable `--font-mono` — kiểm tra `frontend/src/styles/tokens.css`; nếu chưa có, dùng `font-family: ui-monospace, ...` inline với class CSS riêng `summary-log-preview`).
  - Background xám nhẹ (theme token `--bg-subtle` hoặc fallback `#f5f5f7`).
  - `max-height: 12em; overflow: hidden;` — KHÔNG scroll trong Summary tab (full content trong Logs tab 3.5b).
- Link text dưới preview: "View full log in Logs tab →" (chỉ visual hint — Logs tab actual content vẫn placeholder cho đến 3.5b. Click link hiện tại có thể no-op hoặc switch tab — chọn switch tab cho UX tốt hơn: `onClick={() => setActiveTab("logs")}`).

**And** nếu `runs.isLoading` → render skeleton placeholder "Loading last run…" (KHÔNG render block trống).
**And** nếu `runs.isError` → render fallback "Could not load last run details." (KHÔNG crash panel; KHÔNG toast lặp lại — query error đã được TanStack Query handle, không cần escalate).
**And** nếu `runs.data?.length === 0` → render placeholder "No runs yet for this task." (defensive — không xảy ra với paused/failed theo backend invariant của 3.1 + 3.3, nhưng UI must not crash).

---

**AC-10 — Tests (frontend, vitest + React Testing Library):**

**Given** test framework Vitest + RTL đã setup (`frontend/package.json` `"test": "vitest run"` + `frontend/src/test-setup.ts`)
**When** Story 3.5a implement
**Then** mở rộng `frontend/src/features/detail/TaskDetailPanel.test.tsx` (KHÔNG tạo file test mới — giữ co-located convention) với các test cases sau, tổng tối thiểu 10 test cases mới:

| Test ID | Scenario | Mocks | Assertion |
|---|---|---|---|
| T1 | Task `paused` → Summary tab render Current Status + Last Agent Summary + comment textarea + Resume button | Mock `getTask` return paused; mock `listRuns` return 1 run | `screen.getByText("Paused — last run...")` visible; `screen.getByPlaceholderText("Add instructions for next run…")` visible; `screen.getByRole("button", { name: "Resume Session" })` visible |
| T2 | Task `failed` → tương tự T1 nhưng status label khác | Mock `getTask` return failed; mock `listRuns` 1 run with `exitCode = 1` | label "Failed — last run..." + "exit: 1" visible trong Last Agent Summary |
| T3 | Task `running` → Summary tab render Live Status Feed (NO textarea/Resume button) | Mock `getTask` return running; mock `listRuns` return 1 run | `screen.getByLabelText(/Live Status|status feed/i)` (role: list) visible; KHÔNG có textarea; KHÔNG có button name "Resume Session" |
| T4 | Click Resume với textarea empty → mutation called with `undefined` comment | Mock `resumeSession` to resolve | `expect(resumeSession).toHaveBeenCalledWith(projectId, taskId, undefined)` |
| T5 | Click Resume với textarea "  hello  " → mutation called with `"hello"` (trimmed) | Mock `resumeSession` to resolve | `expect(resumeSession).toHaveBeenCalledWith(projectId, taskId, "hello")` |
| T6 | Optimistic update on click Resume → status badge immediately shows "Running" | Mock `resumeSession` to delay 100ms then resolve | After `fireEvent.click(resumeBtn)`, immediately (within same tick) `screen.getByText(/Running/)` visible inside StatusBadge |
| T7 | Resume error rollback → status badge revert to paused + error toast shown | Mock `resumeSession` to reject `new ApiError(500, "internal", "boom")` | After error: `await waitFor` → StatusBadge back to paused; toast with "boom" visible |
| T8 | Resume 409 conflict → warning toast (not error) | Mock `resumeSession` to reject `ApiError(409, "session_already_active", "...")` | toast role/tone = warning (assert via `screen.getByText` + class hoặc data attribute) |
| T9 | Polling: task running → `getTask` called twice within 6 seconds (1 initial + 1 refetch at 5s) | Mock with `vi.useFakeTimers()`; advance 5500ms | `expect(getTask).toHaveBeenCalledTimes(2)` (or ≥2) |
| T10 | Polling stops when status changes to paused | Mock getTask: first return running, second return paused; advance timers | After second call, advance 5500ms more → no third call (`expect(getTask).toHaveBeenCalledTimes(2)`) |
| T11 | Live Status Feed has `aria-live="polite"` attribute | Mock running task + 1 run | `screen.getByRole("list").getAttribute("aria-live") === "polite"` (hoặc query by aria-live attribute) |
| T12 | Comment textarea reset (`""`) khi switch tab away rồi quay lại Summary | Mock paused task | Type "hello" in textarea → click Comments tab → click Summary tab → textarea value `""` |

**And** test KHÔNG được call real network — mock tất cả API qua `vi.mock("../../api/sessions")`, `vi.mock("../../api/tasks")`, `vi.mock("../../api/runs")` (pattern theo TaskDetailPanel.test.tsx hiện tại dòng 12–16).

**And** test KHÔNG được dùng setTimeout real — dùng `vi.useFakeTimers()` + `vi.advanceTimersByTime(...)` cho polling tests (T9, T10).

**And** test KHÔNG được test implementation details (e.g. internal `useState` value) — chỉ test user-visible behavior (theo project-context "React — Test behavior từ góc độ user").

---

**AC-11 — Boundary với Story 3.5b (KHÔNG implement):**

**Given** scope phân chia rõ giữa 3.5a (Summary tab + optimistic resume) và 3.5b (Comments / Runs / Logs tabs + RunTimeline)
**When** Story 3.5a implement
**Then** **KHÔNG** thay đổi nội dung các tab Comments / Runs / Logs / Settings — chúng giữ nguyên placeholder EmptyState như hiện tại. Story 3.5b sẽ implement.

**And** **KHÔNG** tạo component `RunTimeline.tsx` — defer 3.5b.

**And** **KHÔNG** tạo route mới hoặc endpoint backend nào — story 3.5a là pure-frontend story (zero backend changes).

**And** **KHÔNG** thêm `POST /api/.../comments` standalone call trong Summary tab (3.3 đã wire Resume tự insert comment row với `sent=1`). Standalone Comments POST defer cho 3.5b Comments tab.

**And** Link "View full log in Logs tab →" (AC-9) chỉ switch active tab — KHÔNG render log content (đó là 3.5b scope).

**And** Hint "links to the full RunTimeline are shown in the Runs Tab (Story 3.5b)" (epic AC dòng 707) → trong Live Status Feed (AC-5), thêm 1 footer link nhỏ "See full timeline in Runs tab →" — click switch tab "runs". Khi 3.5b implement Runs tab content, link đó sẽ navigate tới RunTimeline. Story 3.5a chỉ wire switch tab — KHÔNG render timeline content.

---

**AC-12 — Action Bar refactor (Resume button MOVE từ ActionBar sang Summary tab):**

**Given** TaskDetailPanel hiện tại có ActionBar component (dòng 33–78) render Resume Session button + (placeholder Mark Done + Cancel) cho `paused | failed`
**When** Story 3.5a implement
**Then** **REMOVE** Resume Session button + textarea khỏi ActionBar (theo UX spec dòng 1491: "Action bar: chỉ hiện actions phù hợp, không duplicate"). ActionBar cho `paused | failed`:
- Giữ stub: `<Button variant="secondary" size="md">Mark Done</Button>` + `<Button variant="ghost" size="md">Cancel</Button>` (chưa wire — out-of-scope; sẽ implement story sau cho Mark Done; Cancel đã có backend route từ 3.2 nhưng frontend wire defer).
- **REMOVE** dòng `<Button variant="primary" size="md">Resume Session</Button>` (dòng 71 hiện tại).
- Nếu Story 3.3 sau merge đã add textarea/Resume button vào ActionBar (theo 3.3 F.4.1 dòng 1200–1217) → 3.5a MOVE phần đó từ ActionBar sang Summary tab.

**And** ActionBar cho `assigned` GIỮ NGUYÊN — Start Session button vẫn ở đây (theo UX spec line 507: "Assigned → Start Session" là primary action ở top, không phải Summary tab; consistent vì Start Session không có comment input như Resume).

**And** ActionBar cho `running` GIỮ NGUYÊN (return null — không có action button cho Running). Cancel button có thể wire ở story sau.

**Verification của AC-12:** sau khi 3.5a merge, `screen.getByRole("button", { name: "Resume Session" })` query trong test phải tìm thấy button trong **Summary tab content** (không phải trong ActionBar). Có thể assert qua `within(summaryTabPanel).getByRole("button", ...)` để precise.

---

## Tasks / Subtasks

### A. Frontend types & API (Sanity check — KHÔNG sửa nếu đã có từ 3.3/3.4)

- [ ] **Task A.1 — Verify `frontend/src/api/sessions.ts` có `resumeSession` (3.3 deliverable)** (AC: 3, 4)
  - [ ] A.1.1 Đọc file, confirm có function `resumeSession(projectId, taskId, comment?)` + interface `ResumeSessionResponse`. Nếu CHƯA có → escalate "Story 3.3 chưa merge — story 3.5a phải defer".
  - [ ] A.1.2 KHÔNG thay đổi file này — 3.3 owns API client cho `/sessions/resume`.

- [ ] **Task A.2 — Verify `frontend/src/api/runs.ts` có `listRuns` + `Run` type (3.4 deliverable)** (AC: 9)
  - [ ] A.2.1 Đọc file `frontend/src/api/runs.ts` + `frontend/src/types/run.ts`. Confirm `listRuns(projectId, taskId): Promise<Run[]>` + `Run` interface có `runNumber`, `input`, `exitCode`, `logPath`, `logTail`, `startedAt`, `endedAt`. Nếu CHƯA có → escalate "Story 3.4 chưa merge".
  - [ ] A.2.2 KHÔNG thay đổi file này — 3.4 owns API client cho `/runs`.

- [ ] **Task A.3 — Verify `getTask` trong `frontend/src/api/tasks.ts`** (AC: 7)
  - [ ] A.3.1 Confirm function `getTask(projectId, taskId): Promise<Task>` đã có (file `frontend/src/api/tasks.ts` dòng 24 hiện tại). KHÔNG sửa file này.

### B. Hooks layer (NEW files / EXTEND existing)

- [ ] **Task B.1 — Tạo file mới `frontend/src/hooks/useTask.ts`** (AC: 6, 7)
  - [ ] B.1.1 Implement đúng theo skeleton trong AC-7. Export `useTask` + `taskQueryKey`.
  - [ ] B.1.2 `refetchInterval` function dùng predicate `query.state.data?.status === "running"` — match pattern existing `useTasks.ts` dòng 17–22.
  - [ ] B.1.3 `enabled` flag cho cả `projectId` và `taskId` null check (TaskDetailPanel có thể mount khi chưa chọn task).

- [ ] **Task B.2 — Mở rộng hook `useResumeSession` (3.3 deliverable) để thêm optimistic update** (AC: 4)
  - [ ] B.2.1 Locate file — theo 3.3 F.3.1 spec `frontend/src/hooks/useSessionMutation.ts`, NHƯNG existing convention là một-file-một-hook (`useStartSession.ts`). Dev agent confirm file thực tế sau khi 3.3 merge. Nếu pattern khác → adapt.
  - [ ] B.2.2 Thêm `onMutate` callback theo AC-4 step 1–6: cancel queries → snapshot prev → setQueryData optimistic → return context.
  - [ ] B.2.3 Thêm `onError` callback theo AC-4: rollback từ context + invalidate queries.
  - [ ] B.2.4 Cập nhật `onSuccess` (3.3 đã có) để thêm invalidate `["runs", projectId, taskId]` (Last Agent Summary cần refresh).
  - [ ] B.2.5 **KHÔNG** đổi signature public của hook — vẫn `useResumeSession(projectId, taskId)` → `useMutation` return value. Component code không cần thay đổi import.
  - [ ] B.2.6 Lưu ý TypeScript: `onMutate` return type = `{ prevTask, prevTasks }`; context type được TanStack Query v5 infer; verify type qua `tsc --noEmit`.

### C. Summary status helper (NEW file)

- [ ] **Task C.1 — Tạo file mới `frontend/src/features/detail/summaryStatus.ts`** (AC: 8)
  - [ ] C.1.1 Export pure function `summaryStatusLabel(status: TaskStatus): string | null` theo mapping AC-8.
  - [ ] C.1.2 Export pure function `formatRelativeTime(iso: string, now?: Date): string` — return "just now" / "5s ago" / "2m ago" / "1h ago" / "Xd ago". Implementation đơn giản (≤30 dòng, không cần lib):
    ```ts
    export function formatRelativeTime(iso: string, now: Date = new Date()): string {
      const diffMs = now.getTime() - new Date(iso).getTime();
      const sec = Math.floor(diffMs / 1000);
      if (sec < 5) return "just now";
      if (sec < 60) return `${sec}s ago`;
      const min = Math.floor(sec / 60);
      if (min < 60) return `${min}m ago`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `${hr}h ago`;
      const day = Math.floor(hr / 24);
      return `${day}d ago`;
    }
    ```
  - [ ] C.1.3 KHÔNG thêm dependency `date-fns` / `dayjs` — pure JS Date đủ. Project context: "ưu tiên React built-in trước khi dùng thư viện ngoài".

### D. Summary tab content components (REFACTOR TaskDetailPanel.tsx)

- [ ] **Task D.1 — Tạo các sub-components (file mới hoặc inline trong TaskDetailPanel.tsx)** (AC: 1, 2, 3, 5, 9, 11)
  - [ ] D.1.1 Quyết định cấu trúc: chọn MỘT trong hai pattern:
    - **Pattern A (preferred):** Tạo các sub-components trong file riêng `frontend/src/features/detail/SummaryTab.tsx` (toàn bộ Summary tab content). Pattern này dễ test, dễ maintain. Sub-components nội bộ (`CurrentStatusBlock`, `LastAgentSummaryBlock`, `NextSuggestedActionBlock`, `LiveStatusFeedBlock`) khai báo trong cùng file `SummaryTab.tsx` (KHÔNG cần extract thêm).
    - **Pattern B (acceptable):** Giữ trong TaskDetailPanel.tsx như inline JSX. Dùng nếu file SummaryTab.tsx cảm thấy quá nhỏ.
    - **Recommended: Pattern A** — SummaryTab.tsx ước tính ~200–300 dòng (đủ lớn để tách).
  - [ ] D.1.2 SummaryTab component signature: `function SummaryTab({ projectId, task }: { projectId: string; task: Task }): JSX.Element`. Component tự useQuery cho runs (qua `useQuery({ queryKey: ["runs", projectId, task.id], queryFn: () => listRuns(projectId, task.id), enabled: ["paused","failed"].includes(task.status), refetchInterval: false })`).
  - [ ] D.1.3 Logic branching theo `task.status`:
    - `running` → `<LiveStatusFeedBlock />`
    - `paused | failed` → `<CurrentStatusBlock /> + <LastAgentSummaryBlock /> + <NextSuggestedActionBlock />` + existing description/AC content below.
    - `needs-review | changes-requested | completed | cancelled | assigned` → `<CurrentStatusBlock />` only (chỉ render status label, KHÔNG textarea/resume/last agent — defer).
    - `draft | ready` → existing description/AC content only (no status block).

- [ ] **Task D.2 — Wire `useTask` vào TaskDetailPanel.tsx** (AC: 6, 7)
  - [ ] D.2.1 Import `useTask` từ `../../hooks/useTask`.
  - [ ] D.2.2 Trong `TaskDetailPanel` component (dòng 133), sau `useTaskDetail()`, gọi:
    ```ts
    const taskQuery = useTask(selectedProject?.id ?? null, selectedTask?.id ?? null);
    const task = taskQuery.data ?? selectedTask; // fallback while loading
    ```
  - [ ] D.2.3 Replace tất cả reference `selectedTask` trong render body bằng `task` (KHÔNG breakage — `selectedTask` chỉ dùng cho null check + open/close).
  - [ ] D.2.4 Pass `task` (fresh) thay vì `selectedTask` (stale) xuống `ActionBar` và `SummaryTab` props.
  - [ ] D.2.5 Edge case: `taskQuery.isError` AND `selectedTask !== null` → fallback `task = selectedTask` + log `console.warn("useTask query failed, using stale snapshot", error)`. KHÔNG crash panel.

- [ ] **Task D.3 — Refactor `ActionBar` (REMOVE Resume button + textarea từ ActionBar)** (AC: 12)
  - [ ] D.3.1 Trong TaskDetailPanel.tsx, function `ActionBar` (dòng 38), update branch `task.status === "paused" || task.status === "failed"`:
    - REMOVE `<Button variant="primary">Resume Session</Button>`.
    - Giữ stub `<Button variant="secondary">Mark Done</Button>` + `<Button variant="ghost">Cancel</Button>` (chưa wire).
    - Nếu 3.3 đã add textarea vào ActionBar → REMOVE.
  - [ ] D.3.2 ActionBar cho `running` giữ nguyên `return null` (3.5a không thay đổi behavior này).
  - [ ] D.3.3 Cập nhật tests cũ trong TaskDetailPanel.test.tsx nếu có test cụ thể cho Resume button vị trí ActionBar → update assertion để search trong Summary tab content thay vì panel-wide.

- [ ] **Task D.4 — Replace existing summary tab JSX (TaskDetailPanel.tsx dòng 240–263) bằng `<SummaryTab projectId={...} task={...} />`** (AC: 1)
  - [ ] D.4.1 Replace block `{activeTab === "summary" && (<div>...</div>)}` bằng `{activeTab === "summary" && <SummaryTab projectId={project.id} task={task} />}`.
  - [ ] D.4.2 SummaryTab tự render description + acceptanceCriteria existing content (cho task non-paused/failed/running). KHÔNG xóa content cũ — chỉ wrap + thêm Current Status block / Last Agent Summary / Next Suggested Action blocks ở trên.

### E. Live Status Feed (LiveStatusFeedBlock component)

- [ ] **Task E.1 — Implement `LiveStatusFeedBlock` trong SummaryTab.tsx** (AC: 5, 11)
  - [ ] E.1.1 Component signature: `function LiveStatusFeedBlock({ projectId, task }: { projectId: string; task: Task }): JSX.Element`.
  - [ ] E.1.2 Internal `useQuery` cho latest run: `useQuery({ queryKey: ["runs", projectId, task.id], queryFn: () => listRuns(projectId, task.id), refetchInterval: task.status === "running" ? 5000 : false })`.
    - **Lưu ý:** runs query polling 5s tương tự task query — đảm bảo Last Agent Summary cập nhật khi task chuyển từ running → paused (do `refetchInterval` dynamic).
  - [ ] E.1.3 `latestRun = runs.data?.[0]` (DESC sort theo 3.4 AC-6).
  - [ ] E.1.4 Derive steps theo bảng AC-5 — implement như array:
    ```tsx
    const steps: Array<{ label: string; timestamp: string; state: "completed" | "in-progress" }> = [];
    if (latestRun) {
      steps.push({ label: "Starting session…", timestamp: latestRun.startedAt, state: "completed" });
      if (latestRun.input && latestRun.input !== "retry") {
        steps.push({ label: "Sending comment to agent", timestamp: latestRun.startedAt, state: "completed" });
      }
      if (latestRun.endedAt === null) {
        steps.push({ label: "Agent running…", timestamp: latestRun.startedAt, state: "in-progress" });
      }
    } else {
      // Race window: optimistic just fired, runs query hasn't returned new run yet.
      steps.push({ label: "Starting session…", timestamp: new Date().toISOString(), state: "in-progress" });
    }
    ```
  - [ ] E.1.5 Render:
    ```tsx
    <section className="summary-live-feed" aria-labelledby="summary-live-feed-heading">
      <h3 id="summary-live-feed-heading" className="summary-block-heading">
        <span className="summary-status-dot summary-status-dot--running" aria-hidden="true" />
        Live Status
      </h3>
      <ol className="summary-live-feed-list" aria-live="polite" aria-atomic="false">
        {steps.map((s, i) => (
          <li key={i} className={`summary-live-feed-step summary-live-feed-step--${s.state}`}>
            <span className={`summary-feed-dot summary-feed-dot--${s.state}`} aria-hidden="true" />
            <span className="summary-feed-label">{s.label}</span>
            <span className="summary-feed-time">{formatRelativeTime(s.timestamp)}</span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="summary-feed-runs-link"
        onClick={() => onSwitchTab("runs")}
      >
        See full timeline in Runs tab →
      </button>
    </section>
    ```
  - [ ] E.1.6 `onSwitchTab` prop: từ TaskDetailPanel pass xuống — gọi `setActiveTab("runs")`. Hoặc lift state lên panel-level qua callback.

### F. CurrentStatusBlock + LastAgentSummaryBlock + NextSuggestedActionBlock (3 sub-components trong SummaryTab.tsx)

- [ ] **Task F.1 — Implement `CurrentStatusBlock`** (AC: 1, 8)
  - [ ] F.1.1 Signature: `function CurrentStatusBlock({ task }: { task: Task }): JSX.Element | null`.
  - [ ] F.1.2 Gọi `summaryStatusLabel(task.status)` → return `null` nếu function return null (status `ready | draft`). Else render `<section><h3>Current Status</h3><p>{label}</p></section>`.

- [ ] **Task F.2 — Implement `LastAgentSummaryBlock`** (AC: 1, 9)
  - [ ] F.2.1 Signature: `function LastAgentSummaryBlock({ projectId, task }: { projectId: string; task: Task }): JSX.Element`.
  - [ ] F.2.2 `useQuery({ queryKey: ["runs", projectId, task.id], queryFn: () => listRuns(projectId, task.id), enabled: ["paused","failed"].includes(task.status), refetchInterval: false })`.
  - [ ] F.2.3 Render states:
    - `isLoading` → `<p>Loading last run…</p>`.
    - `isError` → `<p>Could not load last run details.</p>`.
    - `data?.length === 0` → `<p>No runs yet for this task.</p>`.
    - `data?.[0]` → metadata + log_tail preview (theo AC-9 detail).
  - [ ] F.2.4 Log preview truncate: split by `\n`, slice(0, 10), join `\n`, append `\n…` nếu original có > 10 lines.

- [ ] **Task F.3 — Implement `NextSuggestedActionBlock` (textarea + Resume button + optimistic mutation)** (AC: 2, 3, 4)
  - [ ] F.3.1 Signature: `function NextSuggestedActionBlock({ projectId, task }: { projectId: string; task: Task }): JSX.Element`.
  - [ ] F.3.2 Local state `const [commentText, setCommentText] = useState<string>("")`.
  - [ ] F.3.3 `const resumeMut = useResumeSession(projectId, task.id);` (hook mở rộng từ B.2 — đã có optimistic).
  - [ ] F.3.4 `const { showToast } = useToast();` — reuse existing toast context.
  - [ ] F.3.5 `handleResume` callback:
    ```ts
    const handleResume = () => {
      const trimmed = commentText.trim();
      const commentArg = trimmed === "" ? undefined : trimmed;
      resumeMut.mutate(commentArg, {
        onSuccess: () => {
          setCommentText("");
          showToast({
            tone: "success",
            message: commentArg
              ? `Resumed ${task.id} with comment`
              : `Session resumed for ${task.id}`,
          });
        },
        onError: (err) => {
          const msg = err instanceof ApiError ? err.message : "Failed to resume session";
          const tone =
            err instanceof ApiError && err.code === "session_already_active"
              ? "warning"
              : "error";
          showToast({ tone, message: msg });
        },
      });
    };
    ```
  - [ ] F.3.6 Render:
    ```tsx
    <section className="summary-next-action" aria-labelledby="summary-next-action-heading">
      <h3 id="summary-next-action-heading">Next Suggested Action</h3>
      <textarea
        value={commentText}
        onChange={(e) => setCommentText(e.target.value)}
        placeholder="Add instructions for next run…"
        rows={3}
        aria-label="Comment for next run"
        disabled={resumeMut.isPending}
        className="summary-comment-textarea"
      />
      <Button
        variant="primary"
        size="md"
        onClick={handleResume}
        disabled={resumeMut.isPending}
        aria-label="Resume Session"
      >
        {resumeMut.isPending ? "Starting…" : "Resume Session"}
      </Button>
      <p className="summary-action-hint">Click Resume to continue this session.</p>
    </section>
    ```

### G. CSS (extend TaskDetailPanel.css hoặc tạo SummaryTab.css)

- [ ] **Task G.1 — Style các block mới** (AC: 1, 5, 9)
  - [ ] G.1.1 Quyết định: tạo file mới `frontend/src/features/detail/SummaryTab.css` (nếu SummaryTab.tsx tách riêng theo Pattern A — Task D.1.1). Else extend `TaskDetailPanel.css`.
  - [ ] G.1.2 Style classes cần định nghĩa:
    - `.summary-block` — wrapper `<section>` cho mỗi block (padding, border-top, margin-bottom).
    - `.summary-block-heading` — h3 với font-weight 600, font-size 14px.
    - `.summary-status-label` — body text cho Current Status.
    - `.summary-last-run-meta` — metadata line (Run #N · time · agent · exit) với divider `·` giữa.
    - `.summary-log-preview` — `<pre>` block với font monospace, background subtle, max-height 12em, overflow hidden.
    - `.summary-comment-textarea` — full-width, padding, border match design tokens.
    - `.summary-action-hint` — small muted text dưới button.
    - `.summary-live-feed-list` — ordered list, padding-left 24px.
    - `.summary-live-feed-step` — li with flex layout: dot · label · timestamp.
    - `.summary-feed-dot--completed` — green dot (CSS variable `--status-completed` hoặc fallback `#16a34a`).
    - `.summary-feed-dot--in-progress` — indigo dot với pulse animation (reuse pattern từ StatusBadge running pulse — verify trong `frontend/src/components/StatusBadge.css`).
    - `.summary-feed-runs-link` — text button styling (no border, indigo text, underline on hover).
  - [ ] G.1.3 Dùng CSS variables từ `frontend/src/styles/tokens.css` — KHÔNG hardcode hex. Verify token names (e.g. `--bg-app`, `--text-primary`, `--brand-primary`) — nếu thiếu token cần thêm → defer (KHÔNG add token mới cho 3.5a; dùng existing).
  - [ ] G.1.4 Respect `prefers-reduced-motion` cho pulse animation: wrap animation trong `@media (prefers-reduced-motion: no-preference)`.

### H. Tests (TaskDetailPanel.test.tsx + new tests cho hook)

- [ ] **Task H.1 — Extend `frontend/src/features/detail/TaskDetailPanel.test.tsx` với T1–T12 theo AC-10** (AC: 10)
  - [ ] H.1.1 Thêm mocks ở đầu file:
    ```ts
    vi.mock("../../api/sessions", () => ({
      startSession: vi.fn(),
      resumeSession: vi.fn(),
    }));
    vi.mock("../../api/runs", () => ({
      listRuns: vi.fn(),
    }));
    vi.mock("../../api/tasks", async () => {
      const actual = await vi.importActual<typeof import("../../api/tasks")>("../../api/tasks");
      return { ...actual, getTask: vi.fn() };
    });
    ```
  - [ ] H.1.2 Helper `makeRun(overrides)` tương tự `makeTask` để tạo Run fixture.
  - [ ] H.1.3 Implement T1–T12 theo bảng AC-10.
  - [ ] H.1.4 Test T9, T10 dùng `vi.useFakeTimers()` + `vi.advanceTimersByTime(5500)` + `await waitFor` để flush promise. Lưu ý sequence: `useFakeTimers` phải call TRƯỚC khi render component; cleanup `useRealTimers` ở `afterEach`.
  - [ ] H.1.5 KHÔNG sửa các test cases cũ trong TaskDetailPanel.test.tsx (T tests cũ của Story 2.4 + Story 3.1 phải vẫn pass). Nếu test cũ check Resume button trong ActionBar → cần update assertion (Task D.3.3).

- [ ] **Task H.2 — Tạo test mới `frontend/src/hooks/useTask.test.ts`** (AC: 7) — optional but recommended
  - [ ] H.2.1 Test: `useTask(null, null)` → `isFetching === false` (query disabled).
  - [ ] H.2.2 Test: `useTask("p", "t")` → call `getTask("p", "t")` 1 lần.
  - [ ] H.2.3 Test: `useTask` với running task → polling 5s; với paused → no polling.
  - [ ] H.2.4 Dùng `@tanstack/react-query` test helper hoặc `renderHook` từ `@testing-library/react`.
  - [ ] H.2.5 Nếu cảm thấy redundant với T9/T10 trong H.1 → có thể SKIP H.2 (đặt is "optional").

### I. Lint / typecheck / build

- [ ] **Task I.1 — Frontend verification gates** (AC: all)
  - [ ] I.1.1 `cd frontend && pnpm typecheck` (hoặc `npm run` — verify command trong `frontend/package.json` "scripts"). KHÔNG có type error.
  - [ ] I.1.2 `cd frontend && pnpm lint` — KHÔNG warning mới. Frontend hiện chưa có lint script trong `package.json` — nếu thiếu, run `tsc -b` qua `pnpm build` để verify type errors.
  - [ ] I.1.3 `cd frontend && pnpm test` — tất cả vitest pass, bao gồm test cũ + test mới của 3.5a.
  - [ ] I.1.4 `cd frontend && pnpm build` (tsc + vite build) — KHÔNG error.

- [ ] **Task I.2 — Backend KHÔNG đổi gì** (sanity)
  - [ ] I.2.1 `git diff backend/` (verify): zero changes. Story 3.5a là pure-frontend.
  - [ ] I.2.2 Nếu vô tình edit backend file → revert.

### J. Documentation + Sprint status

- [ ] **Task J.1 — Update sprint status** (workflow requirement)
  - [ ] J.1.1 `_bmad-output/implementation-artifacts/sprint-status.yaml`: `3-5a-session-summary-tab-and-optimistic-resume-ui: backlog` → `ready-for-dev`. `last_updated` → current datetime ISO.
  - [ ] J.1.2 KHÔNG đổi status story khác trong sprint.

- [ ] **Task J.2 — Project notes (per repo AGENTS.md gate)** (workflow requirement)
  - [ ] J.2.1 Tạo continuity note qua `./bin/pnotes add continuity ...` SAU khi implementation pass tests — note ngắn về: hooks mới (`useTask`), summary-tab refactor, optimistic update pattern, polling 5s cho running.
  - [ ] J.2.2 Nếu `./bin/pnotes` không có (repo chưa setup) → skip với lý do "no pnotes binary". Verify bằng `ls bin/` hoặc `which pnotes`.

---

## Dev Notes

### Architecture compliance

**File locations (theo `architecture.md` §"Project Directory Structure" dòng 419–522):**
- `frontend/src/hooks/useTask.ts` — NEW (architecture đã list dòng 446, chưa tồn tại trong repo hiện tại).
- `frontend/src/features/detail/SummaryTab.tsx` — NEW (pattern A — extract Summary tab content thành component riêng). Architecture không list explicitly nhưng đặt dưới `features/task-detail/` (path differ — repo dùng `features/detail/` không phải `features/task-detail/`; follow repo actual path).
- `frontend/src/features/detail/SummaryTab.css` — NEW.
- `frontend/src/features/detail/summaryStatus.ts` — NEW (helper functions, KHÔNG component).
- `frontend/src/features/detail/TaskDetailPanel.tsx` — UPDATE (refactor để wire `useTask` + `<SummaryTab />` + remove Resume button khỏi ActionBar).
- `frontend/src/features/detail/TaskDetailPanel.test.tsx` — UPDATE (thêm T1–T12).
- `frontend/src/hooks/useResumeSession.ts` HOẶC `frontend/src/hooks/useSessionMutation.ts` — UPDATE (extend `useResumeSession` với `onMutate` + `onError` optimistic; file thực tế phụ thuộc 3.3 deliverable).

**KHÔNG được tạo module mới ngoài danh sách trên** (architecture là single source of truth).

### Library / framework constraints

Story 3.5a KHÔNG thêm npm dependency mới. Tất cả đã có trong `frontend/package.json`:
- `@tanstack/react-query` 5.100.11 — `useQuery`, `useMutation`, `useQueryClient`, `onMutate`/`onError`/`onSuccess` callbacks, `refetchInterval` predicate.
- `react` 19.2.6 — `useState`, `useEffect`.
- `vitest` + `@testing-library/react` + `@testing-library/user-event` — đã setup trong `frontend/src/test-setup.ts`.

KHÔNG thêm:
- ❌ `date-fns` / `dayjs` — viết `formatRelativeTime` thủ công (Task C.1.2).
- ❌ `clsx` / `classnames` — dùng template strings hoặc array join (existing convention).
- ❌ State management lib khác (zustand, redux) — TanStack Query + useState đã đủ.

### Patterns to reuse (KHÔNG reinvent)

**Từ Story 3.1 / existing code:**
- `ActionBar` structure (TaskDetailPanel.tsx dòng 33–78) — branch theo status.
- `agentLabel` mapping (TaskDetailPanel.tsx dòng 89–90) — "claude" → "Claude CLI", "codex" → "Codex CLI", default "—".
- `useToast` + `showToast({ tone, message })` (TaskDetailPanel.tsx dòng 39, 45).
- `ApiError` instance check (TaskDetailPanel.tsx dòng 48).
- `useStartSession` mutation pattern (`frontend/src/hooks/useStartSession.ts`) — `useMutation` + `onSuccess` invalidate queries.

**Từ Story 2.4:**
- Tab bar pattern (TaskDetailPanel.tsx dòng 217–231) — `<button role="tab" aria-selected>`.
- Tab content pattern (TaskDetailPanel.tsx dòng 234–298) — conditional render dựa trên `activeTab`.

**Từ Story 3.3:**
- `useResumeSession` hook (vị trí TBD per 3.3 spec).
- `resumeSession(projectId, taskId, comment?)` API client.
- `ResumeSessionResponse` type — đặc biệt `commentId | null` + `commentSent | null` distinction.
- Toast pattern: success vs warning (409) vs error (other).

**Từ Story 3.4:**
- `listRuns(projectId, taskId)` API client.
- `Run` type với 8 field (`runNumber`, `input`, `exitCode`, `logPath`, `logTail`, `startedAt`, `endedAt`, `id`).

### TanStack Query v5 specifics

**`onMutate` context return:**
TanStack Query v5 expect `onMutate` return giá trị → được pass vào `onError` và `onSettled` qua param thứ 3:
```ts
useMutation({
  mutationFn: ...,
  onMutate: async (variables) => {
    // ... cancel, snapshot ...
    return { prevTask, prevTasks }; // context
  },
  onError: (err, variables, context) => {
    if (context?.prevTask) queryClient.setQueryData(["task", ...], context.prevTask);
  },
  onSuccess: (data, variables, context) => { ... },
  onSettled: () => queryClient.invalidateQueries({ queryKey: [...] }),
});
```

**`cancelQueries` essential trước optimistic update:**
Nếu không cancel, polling đang in-flight có thể overwrite optimistic state ngay sau khi set. Đây là gotcha lớn nhất của optimistic update pattern (xem TanStack docs "Optimistic Updates").

**`refetchInterval` là function (v5):**
TanStack v5 cho phép `refetchInterval` là `(query) => number | false | undefined` — match pattern existing `useTasks.ts`. KHÔNG dùng static number nếu cần dynamic (vì task status có thể đổi trong runtime).

**`enabled` flag null-safe:**
`useQuery({ enabled: projectId !== null && taskId !== null })` đảm bảo query KHÔNG fire khi TaskDetailPanel chưa có task selected. Match React Hook rules (hook luôn được call, conditional là `enabled`).

### Optimistic update gotchas

**Gotcha 1: Race với existing polling.**
TaskDetailPanel có thể đã có `useTasks` (list polling) đang chạy. Khi user click Resume:
1. Optimistic set `["task", id]` → status: running.
2. Polling tick fire ngay sau (vì cancel chỉ scope query key đó).
3. Polling result vẫn là status cũ (paused) — overwrite optimistic.

**Mitigation:** cancel CẢ HAI keys (`["task", id]` + `["tasks", projectId]`) trong onMutate. List query có ID match cũng phải update.

**Gotcha 2: Multiple Resume clicks (double-submit).**
User click button nhiều lần liên tiếp (UI lag). Button `disabled={resumeMut.isPending}` cover case này — KHÔNG cần extra debounce.

**Gotcha 3: Component unmount giữa optimistic và error.**
User đóng TaskDetailPanel ngay sau click Resume. Mutation tiếp tục in-flight. Khi error fire, `onError` thử rollback → `queryClient.setQueryData` vẫn ok (queryClient là singleton, không phụ thuộc component lifecycle).

**Gotcha 4: Server response chứa updated task data → race với invalidate.**
3.3 AC-1 response chứa `status: "running"` + run/comment IDs nhưng KHÔNG chứa full Task object. Vì vậy phải invalidate `["task", id]` trong `onSuccess` để fetch authoritative Task từ server.

### Status feed event derivation (NO backend event log API)

**Quyết định:** event feed được derive client-side từ `task.status` + `latestRun.startedAt` + `latestRun.input` + `latestRun.endedAt`. **KHÔNG cần backend event API mới.**

**Lý do:**
- Backend 3.4 đã expose đủ Run state qua GET /runs.
- 3 step labels của AC-5 ("Starting session…", "Sending comment to agent", "Agent running…") map 1-1 với Run state machine (started, input present, ended).
- Polling 5s đủ để render "near-realtime" feel.
- Defer "server-pushed event log" (SSE/WebSocket) sang post-MVP NFR — match architecture.md dòng 61 ("No realtime streaming MVP").

**Limitation chấp nhận được:** Step "Sending comment to agent" timestamp = `latestRun.startedAt` (cùng moment với "Starting session…") — không hoàn toàn chính xác về timeline thật (comment được pipe vào stdin sau spawn ~ms). Nhưng UX spec dòng 1400–1404 cũng show 2 step liên tục — chấp nhận được cho human readability.

### Accessibility (a11y)

**Story 3.5a phải tuân thủ WCAG 2.1 AA partial (epic NFR-6 deferred tới Epic 4, nhưng các pattern cơ bản phải có):**
- `aria-live="polite"` trên Live Status Feed list (AC-5, AC-10 T11).
- `aria-label` trên textarea ("Comment for next run") và Resume button ("Resume Session").
- `aria-labelledby` cho mỗi section block (heading id + section aria-labelledby).
- `aria-atomic="false"` trên live region — chỉ announce changes, KHÔNG re-read toàn bộ list.
- Focus ring visible trên textarea + button (CSS variable `--shadow-focus` đã có trong design tokens).
- Keyboard navigation: Tab qua textarea → Resume button → Mark Done → Cancel — natural DOM order.
- `disabled` state có visual indicator (dimmer color) — đã handle bởi `<Button>` component.
- Status badge update khi optimistic — screen reader có thể announce qua aria-live trên StatusBadge (nếu StatusBadge chưa có, defer post-MVP — KHÔNG block 3.5a).

### Edge cases phải xử lý

**EC-1 — Task bị xóa trong khi panel mở (race):**
- `useTask` query trả 404 → `taskQuery.isError === true`.
- Fallback render với `selectedTask` snapshot (stale) + log warning.
- KHÔNG crash panel. KHÔNG auto-close panel (user có thể vẫn muốn xem snapshot).
- Defer auto-close logic sang story sau (out-of-scope 3.5a).

**EC-2 — Resume click khi network offline:**
- `resumeSession` throw fetch error (KHÔNG là `ApiError` — fetch network error là `TypeError: NetworkError`).
- `onError` callback: `err instanceof ApiError` → false → fallback message "Failed to resume session".
- Rollback optimistic vẫn chạy đúng.

**EC-3 — Polling fires nhưng task vừa bị xóa (404):**
- TanStack Query mặc định KHÔNG retry 404 (default retry 3 times but only for 5xx).
- Cần config `retry: false` hoặc `retry: (failureCount, error) => !(error instanceof ApiError) || error.status >= 500`.
- Để giữ scope nhỏ: 3.5a sẽ dùng default retry. Nếu CI fail do retry storm trên 404, dev agent có thể adjust.

**EC-4 — User mở 2 tab browser cùng một task, resume từ tab A:**
- Tab A: optimistic → Running. Tab B: polling fire → cũng thấy Running.
- KHÔNG conflict — backend là source of truth, cả 2 tab đều converge.
- Edge case: tab A optimistic, server error, rollback. Tab B polling fire trước server error → có thể thấy Running tạm thời. Sau polling tick tiếp → revert.
- Acceptable — KHÔNG cần multi-tab coordination.

**EC-5 — `logTail` chứa ANSI escape codes (color):**
- Subprocess Claude/Codex có thể output ANSI codes.
- Story 3.5a render `<pre>{logTail}</pre>` raw — ANSI codes hiển thị thành garbage chars (\\x1b[...).
- Acceptable cho 3.5a — defer "ANSI stripping / coloring" sang 3.5b Logs tab (3.5b có thể dùng `ansi-to-html` lib hoặc strip).

**EC-6 — Optimistic update + user closes panel ngay → mutation vẫn fire → onSuccess invalidate query → polling restart on background:**
- Acceptable. TanStack Query observer count = 0 → polling không thực sự fire (no observer). Invalidate chỉ mark cache stale.
- Lần sau user mở panel lại → refetch ngay → status fresh.

**EC-7 — `latestRun.input` value `""` (empty string) vs `null` vs `"retry"`:**
- 3.3 AC-1: comment có content → input = comment text (non-empty, non-"retry").
- 3.3 AC-2: no comment → input = `"retry"` literal.
- 3.3 AC-6: empty comment string → 400 (KHÔNG insert run với input=""; backend reject ở validation layer).
- Vì vậy `input === ""` KHÔNG occur trong DB (backend enforce). UI logic AC-5 chỉ check `input !== "retry" && input != null`. Edge case `input === ""` defensive treated as "Sending comment" — không correct semantically, nhưng KHÔNG crash.

### Subprocess lifecycle invariants (project-context)

- ✅ Backend là process owner — frontend KHÔNG kill subprocess (chỉ via Cancel button → backend route).
- ✅ Task status transition chỉ trong `services/tasks.rs` (backend) — frontend chỉ READ.
- ✅ KHÔNG hiển thị Session ID mặc định — Story 3.5a giữ SessionPanel pattern (toggle "Show ID") như TaskDetailPanel hiện tại dòng 115–128 — KHÔNG đổi.

### API contract stability

**Story 3.5a CHỈ consume API contract — KHÔNG đổi:**
- GET `/api/projects/{id}/tasks/{taskId}` — Task object (Story 1/2.x).
- POST `/api/projects/{id}/tasks/{taskId}/sessions/resume` — ResumeSessionResponse (Story 3.3).
- GET `/api/projects/{id}/tasks/{taskId}/runs` — Run[] DESC by startedAt (Story 3.4).

**Nếu phát hiện contract mismatch (e.g. 3.3 chưa expose field `runInput`):**
- ESCALATE chat: "Story 3.3 / 3.4 contract mismatch — found X, expected Y. Block 3.5a until fix."
- KHÔNG silent workaround.

### Testing standards (theo Story 2.x / 3.1)

- **Component tests** trong `*.test.tsx` co-located với component file.
- **Mock all API**: KHÔNG fetch real backend (project-context "Mock fetch/API calls").
- **User-perspective**: query by role / label / placeholder text — KHÔNG by classname hoặc internal state.
- **No flaky timers**: dùng `vi.useFakeTimers()` cho polling test, cleanup `vi.useRealTimers()` ở `afterEach`.
- **No console.error in test output**: nếu component log warning (e.g. useTask error fallback) → wrap trong `vi.spyOn(console, 'warn').mockImplementation(() => {})` rồi assert + restore.

### Project Structure Notes

Alignment với architecture directory structure dòng 419–522:
- `frontend/src/hooks/useTask.ts` — đúng vị trí (architecture đã list).
- `frontend/src/features/detail/SummaryTab.tsx` — repo dùng `features/detail/` thay vì `features/task-detail/` (architecture spec slightly differ). Follow repo actual structure để consistency.
- `frontend/src/features/detail/summaryStatus.ts` — helper function, đặt cạnh feature usage.
- `frontend/src/features/detail/SummaryTab.css` — CSS co-located với component.

No detected conflicts.

### References

- **Epics:** `_bmad-output/planning-artifacts/epics.md`
  - Story 3.5a (dòng 681–707)
  - FR-7 Resume (dòng 136)
  - FR-12 Detail/Panel (dòng 141)
  - NFR-7 Resume performance ≤30s optimistic UI (dòng 149)
  - NFR-8 Realtime polling 5s (dòng 150)
  - UX-DR12 Summary Tab Story 3.5a (dòng 163)
- **Architecture:** `_bmad-output/planning-artifacts/architecture.md`
  - §"Frontend Architecture" (dòng 230–246) — TanStack Query v5 polling pattern
  - §"Process Patterns / Optimistic update (Resume/Start)" (dòng 381–388)
  - §"Data Flow / Resume" (dòng 555–569)
  - §"Project Directory Structure" — `hooks/useTask.ts`, `features/task-detail/TaskDetailPanel.tsx` (dòng 446, 468)
  - §"API Route Structure" — GET task, POST resume, GET runs (dòng 207–226)
- **UX spec:** `_bmad-output/planning-artifacts/ux-design-specification.md`
  - §"Defining Core Experience" (dòng 1342–1413) — flow chi tiết Resume
  - §"Key UX Decisions Confirmed" (dòng 1489–1495) — Resume button label, comment box inline
  - §"UJ-3: Resume Session cũ với Comment" (dòng 1548–1575) — Core loop journey
  - §"Component Strategy / Buttons" (dòng 1703–1733) — Primary variant Resume Session
- **Project context:** `_bmad-output/project-context.md`
  - §"React — Action buttons phụ thuộc task status" (dòng 49–53)
  - §"React — Layout" (dòng 55–59) — slide-in panel, Show ID toggle
  - §"Critical Don't-Miss Rules" (dòng 123–134) — KHÔNG hiển thị Session ID mặc định
  - §"Edge cases phải xử lý" (dòng 135–139)
  - §"Testing Rules / React" (dòng 81–86)
- **Previous stories (READ before implementing):**
  - `_bmad-output/implementation-artifacts/3-1-agentstrategy-trait-and-start-session.md` — `useStartSession` hook pattern, ActionBar wiring cho Assigned.
  - `_bmad-output/implementation-artifacts/3-2-session-exit-detection-and-graceful-shutdown.md` — exit detection flow → status transitions UI phải observe.
  - `_bmad-output/implementation-artifacts/3-3-resume-session-and-comment-tracking.md` — `resumeSession` API, `useResumeSession` hook (Task F.3), ActionBar Resume wiring (Task F.4) — 3.5a sẽ MOVE từ ActionBar sang SummaryTab.
  - `_bmad-output/implementation-artifacts/3-4-run-log-dual-storage.md` — `listRuns` + `getRun` API, `Run` type, `logTail` shape.
- **Existing code (READ before editing):**
  - `frontend/src/features/detail/TaskDetailPanel.tsx` — root component, refactor để dùng `useTask` + `<SummaryTab />`.
  - `frontend/src/features/detail/TaskDetailPanel.test.tsx` — extend với T1–T12.
  - `frontend/src/features/detail/TaskDetailPanel.css` — extend hoặc tạo SummaryTab.css cạnh đó.
  - `frontend/src/hooks/useStartSession.ts` — pattern reference cho `useTask.ts` + `useResumeSession.ts`.
  - `frontend/src/hooks/useTasks.ts` — pattern reference cho `refetchInterval` dynamic.
  - `frontend/src/api/client.ts` — `apiFetch` + `ApiError`, không sửa.
  - `frontend/src/api/sessions.ts` — `resumeSession` (3.3 deliverable), không sửa.
  - `frontend/src/api/runs.ts` — `listRuns` (3.4 deliverable), không sửa.
  - `frontend/src/api/tasks.ts` — `getTask`, không sửa.
  - `frontend/src/contexts/TaskDetailContext.tsx` — vẫn dùng cho open/close panel, KHÔNG đổi.
  - `frontend/src/components/Toast.tsx` — `useToast` + `showToast({ tone, message })`.
  - `frontend/src/components/StatusBadge.tsx` — render task status badge, optimistic update sẽ reflect qua đây.
  - `frontend/src/components/Button.tsx` — variants `primary | secondary | ghost`, sizes `sm | md`.
  - `frontend/src/styles/tokens.css` — design tokens (kiểm tra có token nào cần thêm — nếu cần, defer).

### Out-of-scope reminders

| Hạng mục | Story chịu trách nhiệm |
|---|---|
| Comments Tab content (chronological list, sent/pending labels, standalone POST /comments) | 3.5b |
| Runs Tab content (list runs, expandable row, click → run detail) | 3.5b |
| Logs Tab content (raw monospace, download button, disclaimer) | 3.5b |
| RunTimeline component (colored dots, expandable steps, "View raw →" link) | 3.5b |
| Mark Done button wire (transition Paused/Failed → Completed) | Story sau (chưa có story spec) |
| Cancel button wire trong ActionBar (POST /sessions/cancel) | Story sau / 3.2 hậu wire |
| localStorage draft persistence cho comment textarea | Post-MVP NFR |
| ANSI escape code stripping trong logTail preview | 3.5b Logs tab |
| Server-sent events (SSE) / WebSocket cho live feed | Post-MVP (architecture explicit defer) |
| Dark theme | v2 (UX spec dòng 1335) |
| i18n cho status labels (currently English in mapping AC-8) | Post-MVP |
| Authentication / authorization | Out-of-scope MVP (local single-user app) |
| Multi-tab coordination cho optimistic state | Out-of-scope (acceptable EC-4 behavior) |

### AC ↔ Task ↔ Test traceability matrix

| AC | Tasks | Tests |
|---|---|---|
| AC-1 Summary Tab layout (Current + Last + Next) | D.1, D.4, F.1, F.2, F.3 | T1, T2 |
| AC-2 Comment textarea inline | F.3.6 | T1, T2, T12 |
| AC-3 Resume button label "Resume Session" + Starting… | F.3.5, F.3.6 | T3 (negative — no button for running), T6 (label) |
| AC-4 Optimistic update + revert on error | B.2 | T6 (optimistic), T7 (revert), T8 (409 warning) |
| AC-5 Live Status Feed | E.1 | T3, T11 (aria-live) |
| AC-6 Polling 5s when running | B.1, D.2 | T9, T10 |
| AC-7 `useTask` hook | B.1, D.2 | T9, T10 (covers polling indirectly); optional H.2 |
| AC-8 Status label mapping | C.1, F.1 | T1, T2 (label assertion) |
| AC-9 Last Agent Summary data fetch | F.2 | T1, T2 (Run #N + exit code visible) |
| AC-10 Tests T1–T12 | H.1 | (this row IS the test row) |
| AC-11 Boundary với 3.5b (no Comments/Runs/Logs change) | (negative — verify zero diff trong các tab khác) | manual review of diff |
| AC-12 ActionBar refactor (REMOVE Resume button) | D.3 | T1, T2 (Resume button in summary, NOT in action bar — assert with `within(summaryPanel)`) |

---

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
