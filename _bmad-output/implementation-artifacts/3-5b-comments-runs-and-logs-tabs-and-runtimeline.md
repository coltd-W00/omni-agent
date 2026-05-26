# Story 3.5b: Comments, Runs & Logs Tabs + RunTimeline

Status: in-review
Baseline Commit: 5005506a8504b7439b968019f2d0dd3e9faefa0d

<!-- Validation tùy chọn — chạy validate-create-story trước khi dev-story nếu muốn double-check. -->

**Epic:** 3 — Session Lifecycle & Agent Execution
**Story ID:** 3.5b
**Story Key:** 3-5b-comments-runs-and-logs-tabs-and-runtimeline
**Depends on:**
- Story 3.3 (Resume Session & Comment Tracking) — phải hoàn thành trước; story 3.5b reuse `Comment` model + `addComment(projectId, taskId, content)` API client + `POST .../comments` endpoint mà 3.3 thiết lập. Story 3.5b **mở rộng backend** thêm `GET .../comments` endpoint (3.3 chỉ định nghĩa POST — xem 3.3 Task A.3) và thêm React hook `useCommentList` + `useAddComment` reuse field convention `sent: boolean`.
- Story 3.4 (Run Log Dual-Storage) — phải hoàn thành trước; story 3.5b reuse `listRuns(projectId, taskId)` + `getRun(projectId, taskId, runId)` API clients + `Run` type (`runNumber`, `input`, `exitCode`, `logPath`, `logTail`, `startedAt`, `endedAt`). Story 3.5b **không thêm endpoint runs mới** — toàn bộ Runs Tab + Logs Tab + RunTimeline build trên 2 endpoint sẵn có. **Nếu 3.4 chưa merge khi 3.5b bắt đầu**, dev agent phải pause + escalate — KHÔNG stub `Run` type tạm thời.
- Story 3.5a (Session Summary Tab & Optimistic Resume UI) — phải hoàn thành trước; story 3.5b reuse `useTask` polling hook + `agentLabel` mapping (`"claude" | "codex"` → "Claude CLI" / "Codex CLI") + `formatStatusLabel` helper + cross-tab navigation pattern (`setActiveTab("logs")`) đã thiết lập trong 3.5a. Story 3.5b **thay thế placeholder content** trong các tab `comments | runs | logs` của `TaskDetailPanel.tsx` (3.5a chỉ chạm tab `summary`; placeholder EmptyState ở tabs khác hiện tại — xem TaskDetailPanel.tsx dòng 264–289).
- Story 2.4 (Task Detail Panel) — đã hoàn thành (status `done`); story 3.5b reuse tab container infrastructure: `TABS` array, `activeTab` state, `setActiveTab` callback, ARIA roles (`role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`), focus management, Escape/backdrop close. **KHÔNG thay đổi** tab bar UI hay close behavior — chỉ render content khác cho 3 tabs.

---

## Story

As a developer using omni-agent,
I want xem comment history (Comments Tab), run history (Runs Tab), raw logs (Logs Tab) và RunTimeline component — tất cả trong Task Detail Panel với tab navigation đã có,
So that tôi có full visibility vào những gì gửi cho agent, agent đã chạy bao nhiêu lần / kết quả ra sao, và output thô nếu cần debug — không phải mở terminal riêng hay đào DB.

---

## Acceptance Criteria

> **Nguồn gốc AC:** `_bmad-output/planning-artifacts/epics.md` Story 3.5b (dòng 709–745), FR-8 (dòng 36), FR-9 (dòng 38), FR-10 (dòng 40), FR-11 (dòng 42), NFR-6 (dòng 58), NFR-8 (dòng 62), UX-DR13 (dòng 111), UX-DR14 (dòng 113), UX-DR15 (dòng 115), UX-DR16 (dòng 117). `_bmad-output/planning-artifacts/ux-design-specification.md` §"Tab: Comments" (dòng 580–595), §"Tab: Runs" (dòng 599–614), §"Tab: Logs" (dòng 631–641), §"Agent Run Timeline" (dòng 651–768), §"6.5 Event Label Mapping" (dòng 720–737). `_bmad-output/planning-artifacts/architecture.md` §"Frontend Architecture" (dòng 232–246), §"API Route Structure" (dòng 207–226), §"Project Directory Structure" (dòng 415–522). `_bmad-output/project-context.md` §"Critical Implementation Rules" + §"React — Layout". Conventions: TanStack Query v5 `refetchInterval` polling 5s, error envelope `{ error, message }` đã handle bởi `ApiError` (`frontend/src/api/client.ts`), camelCase JSON serialization với `serde(rename_all = "camelCase")`.

---

**AC-1 — Backend: `GET /api/projects/{project_id}/tasks/{task_id}/comments` — list comments endpoint (NEW):**

**Given** route mới `GET /api/projects/{project_id}/tasks/{task_id}/comments` (mount trong `backend/src/main.rs::api_router` cùng vị trí với `POST .../comments` của Story 3.3)
**When** client gọi `GET /api/projects/OMNI/tasks/OMNI-001/comments` cho một task có 3 comments
**Then** response **`200 OK`** với body là JSON array sorted theo `created_at` **tăng dần** (oldest first — chronological), shape mỗi element giống `Comment` model của Story 3.3 (`id`, `taskId`, `content`, `sent: boolean`, `createdAt`):
```json
[
  { "id": "c1", "taskId": "OMNI-001", "content": "First instruction", "sent": true,  "createdAt": "2026-05-25T10:00:00+00:00" },
  { "id": "c2", "taskId": "OMNI-001", "content": "Second instruction", "sent": false, "createdAt": "2026-05-25T10:05:00+00:00" },
  { "id": "c3", "taskId": "OMNI-001", "content": "Third instruction",  "sent": true,  "createdAt": "2026-05-25T10:10:00+00:00" }
]
```
**And** field tên đúng `camelCase` (`taskId`, `createdAt`) — reuse `Comment::Serialize` impl đã định nghĩa ở Story 3.3 Task A.1 (boolean conversion `sent: i64 != 0` giữ nguyên).
**And** nếu task chưa có comment nào → response `200 OK` với body `[]` (empty array, KHÔNG 404).
**And** content-type header: `application/json`.

**Given** project `XYZ` không tồn tại
**When** GET `/api/projects/XYZ/tasks/XYZ-001/comments`
**Then** response `404 Not Found` với `{ "error": "project_not_found", "message": "Project XYZ not found" }`.

**Given** project `OMNI` tồn tại nhưng task `OMNI-999` không tồn tại
**When** GET `/api/projects/OMNI/tasks/OMNI-999/comments`
**Then** response `404 Not Found` với `{ "error": "task_not_found", "message": "Task OMNI-999 not found" }`.

*Lý do sort ASC (chronological):* UX-DR13 nêu rõ "thread-style" — Comments Tab render oldest → newest từ trên xuống dưới (giống chat thread). Backend trả sẵn để tránh sort phía client.

---

**AC-2 — Comments Tab UI: list rendering + sent/pending labels:**

**Given** task `OMNI-001` ở status non-terminal (`assigned | running | paused | failed | needs-review | changes-requested`) với 3 comments theo AC-1 data sample
**When** user click tab "Comments" trong Task Detail Panel
**Then** Comments Tab render theo thứ tự top-to-bottom:

1. **Thread list** — mỗi comment là một thread item (theo UX spec dòng 583–588):
   - **Author avatar** — reuse `AgentAvatar` component với `name="You"`, `runtime` mặc định `codex` (vì comments hiện tại không có author field — single-user MVP — placeholder "You"; xem Dev Notes về future-proof).
   - **Author label** — "You" (hardcode — single-user MVP; không có user model).
   - **Timestamp** — `new Date(createdAt).toLocaleString()` (format theo locale, giống pattern TaskDetailPanel SessionPanel dòng 106).
   - **Content text** — render plain text (KHÔNG markdown render — agent CLI nhận text thuần). Whitespace preserved (CSS `white-space: pre-wrap`).
   - **Status label** — dưới content:
     - Nếu `comment.sent === true` → label `Sent to agent ✓` với màu success (`--status-completed` hoặc fallback `#22C55E`).
     - Nếu `comment.sent === false` → label `Pending · will be sent on next Resume` với màu muted (`--text-secondary`).

2. **Input section** ở cuối tab (theo UX spec dòng 590–595):
   - Textarea với placeholder `"Add a comment or instruction for the agent..."` (theo UX spec dòng 592).
   - Sub-text dưới textarea: `"This comment will be sent to the agent on next resume."` (theo UX spec dòng 593).
   - Button `[Add Comment]` (variant `primary`, size `md`).

**And** nếu task chưa có comment nào → render `EmptyState` (reuse component) với `icon="💬"`, `heading="No comments yet"`, `description="Comments and instructions sent to the agent will appear here."` (giữ nguyên placeholder hiện tại của TaskDetailPanel.tsx dòng 264–272 — chỉ thay đổi: render input section bên dưới EmptyState để user vẫn có thể add comment đầu tiên).

**Given** task ở status terminal (`done | cancelled`)
**When** Comments Tab mở
**Then** thread list vẫn render (read-only history), nhưng input section bị disable hoặc ẩn:
- Textarea attribute `disabled={true}` + placeholder đổi thành `"Comments disabled — task is ${status}."`.
- Button disabled.

*Lý do:* Story 3.3 AC-7 → backend reject POST comments với `task_terminal` 409 cho task done/cancelled. Frontend disable preemptive — không gọi API rồi xử lý error.

---

**AC-3 — Comments Tab: thêm comment mới via input section:**

**Given** AC-2 input section với textarea + Button rendered
**When** user gõ text "Check edge case khi token expired" vào textarea rồi click "Add Comment"
**Then** frontend gọi `addComment(projectId, taskId, content)` (Story 3.3 Task E.1 đã định nghĩa API client):
- Path: `POST /api/projects/${projectId}/tasks/${taskId}/comments` với body `{ "content": "Check edge case khi token expired" }`.
- Response `201 Created` (theo Story 3.3 AC-6 happy path): body chứa `Comment` mới với `id`, `taskId`, `content`, `sent: false`, `createdAt`.

**And** trên success:
1. `queryClient.invalidateQueries({ queryKey: ["comments", projectId, taskId] })` — refresh thread list (comment mới xuất hiện ở cuối thread vì ASC).
2. Textarea clear (`setCommentInputText("")`).
3. Toast success: `tone: "success"`, `message: "Comment added"` (reuse `useToast` từ existing pattern, dòng 8 TaskDetailPanel.tsx).
4. Focus quay lại textarea (`textareaRef.current?.focus()`) — UX nice-to-have, giữ user trong flow nếu muốn add comment thứ 2.

**Given** textarea sau `.trim()` là empty string
**When** click "Add Comment"
**Then** mutation **KHÔNG fire** (preemptive guard). Hiển thị toast warning `message: "Comment cannot be empty"` (match backend error message từ Story 3.3 AC-6 nhưng client-side để tránh round-trip).
**And** button `disabled` khi textarea empty (computed disable state — `disabled={inputText.trim().length === 0 || mut.isPending}`).

**Given** mutation `onError` callback chạy với `ApiError(409, "task_terminal", ...)` (race: task chuyển sang done/cancelled giữa lúc UI render và lúc submit)
**When** error fire
**Then** toast tone `"warning"` (match 3.3 F.4.1 pattern dòng 1187–1190) với `err.message` ("Comment cannot be added to terminal task" hoặc tương tự).

**Given** mutation `onError` với generic `ApiError` (400 empty_comment, 404 task_not_found, 500 internal)
**When** error fire
**Then** toast tone `"error"` với `err.message` (fallback `"Failed to add comment"` nếu err không phải ApiError).

**And** trong khi `mut.isPending === true`:
- Textarea `disabled={true}`.
- Button label đổi thành `"Adding…"` (UX nice-to-have, match pattern `"Starting…"` của 3.5a F.3.6 dòng 533).
- Button `disabled={true}`.

---

**AC-4 — Runs Tab UI: list rendering + expandable row:**

**Given** task `OMNI-001` có 3 runs (Run #1 done, Run #2 done, Run #3 running) — backend list endpoint của Story 3.4 AC-6 trả về DESC (`[Run #3, Run #2, Run #1]`)
**When** user click tab "Runs" trong Task Detail Panel
**Then** Runs Tab render **collapsed list** theo thứ tự DESC từ backend (không re-sort client) (theo UX spec dòng 601–605):

```
Run #3    Codex CLI · backend-coder    ● Running · 5 min
Run #2    Codex CLI · backend-coder    ✓ Completed · 2h ago
Run #1    Codex CLI · backend-coder    ✓ Completed · 3h ago
```

Mỗi row hiển thị:
- `Run #${runNumber}` — bold, font-weight 600.
- Agent label: `${agentLabel} · ${task.role ?? "unassigned"}` (reuse `agentLabel` từ TaskDetailPanel SessionPanel dòng 89–90: `task.agent === "claude" ? "Claude CLI" : "Codex CLI"`).
- Status indicator:
  - Run đang chạy (`exitCode === null AND endedAt === null`): violet pulse dot `●` (CSS variable `--brand-primary` hoặc fallback `#7C3AED`) + label `Running · ${elapsed}` với `elapsed = formatRelativeTime(startedAt)` (e.g. "5 min ago").
  - Run completed exit_code 0: green dot `✓` (success color) + label `Completed · ${endedAtRelative}`.
  - Run failed exit_code ≠ 0: red dot `✕` (`--status-failed` hoặc `#DC2626`) + label `Failed · ${endedAtRelative}`.

**And** `formatRelativeTime(timestamp)` helper:
- < 60s → `"just now"`.
- < 60min → `"${minutes} min ago"`.
- < 24h → `"${hours}h ago"`.
- ≥ 24h → `new Date(timestamp).toLocaleDateString()`.

**And** mỗi row có aria-label semantic: `<button role="button" aria-expanded="false" aria-controls="run-detail-${runId}">` để keyboard user (Enter/Space) có thể expand.

**Given** click vào một row (Run #2)
**When** row expand (toggle `expandedRunId` state — chỉ 1 row expanded cùng lúc; click row khác → close current + open new)
**Then** render block detail theo UX spec dòng 608–614:

```
▼ Run #2                           Completed · May 20, 8:30 AM
  Input:    "Add handling for unverified email case"
  Output:   Modified 2 files · Tests: 10 passed, 0 failed
  Duration: 4m 22s · Exit: 0 (success)
  [View Timeline]    [View Logs]
```

Cụ thể fields hiển thị:
- `Input:` — `run.input ?? "(none)"` (start session input là `null`; resume retry là `"retry"`; resume với comment là comment text — match Story 3.3 AC-2 + 3.4 AC-5 invariants).
- `Output:` — preview ngắn từ `run.logTail`:
  - Lấy 5 dòng cuối (split `\n`, slice `-5`, join `\n`).
  - Truncate mỗi dòng tại 80 ký tự, append `…` nếu dài hơn.
  - Wrap trong `<pre>` block với `max-height: 8em` + `overflow: hidden`.
  - Nếu `logTail === null OR logTail === ""` → render text `"(no output captured yet)"`.
- `Duration:` — `formatDuration(startedAt, endedAt ?? now)`:
  - `< 60s` → `${seconds}s`.
  - `< 60min` → `${minutes}m ${seconds % 60}s`.
  - `≥ 60min` → `${hours}h ${minutes % 60}m`.
  - Run đang chạy (`endedAt === null`) → tính từ `now` (refresh mỗi 5s qua polling — xem AC-7).
- `Exit:` — `run.exitCode === null` → text `"(not finished)"`; `=== 0` → `"0 (success)"`; `> 0` → `"${exitCode} (failed)"`.

**And** 2 action buttons (variant `secondary`, size `sm`):
- `[View Timeline]` → render `RunTimeline` component inline (AC-6) — toggle hiển thị bên dưới detail block.
- `[View Logs]` → switch active tab sang "logs" + scroll Logs Tab đến section của run này (AC-5 + AC-8). Cụ thể: `setActiveTab("logs")` + set state `focusedRunId = runId` truyền cho LogsTabPanel.

**Given** task chưa có run nào (`runs.data?.length === 0`)
**When** Runs Tab mở
**Then** render `EmptyState` với `icon=""`, `heading="No runs yet"`, `description="Session runs will appear here."` (giữ nguyên placeholder TaskDetailPanel.tsx dòng 275–282).

**Given** `runs.isLoading === true`
**When** Runs Tab mở
**Then** render skeleton placeholder `"Loading runs…"` (KHÔNG render empty state — empty state chỉ khi `data?.length === 0`).

**Given** `runs.isError === true`
**When** Runs Tab mở
**Then** render fallback `"Could not load runs."` + retry button (variant ghost) gọi `runs.refetch()`.

---

**AC-5 — Logs Tab UI: disclaimer + per-run tail display + Download:**

**Given** task `OMNI-001` có ≥ 1 run với `logTail` populated
**When** user click tab "Logs" trong Task Detail Panel
**Then** Logs Tab render theo thứ tự top-to-bottom:

1. **Disclaimer banner** (theo UX spec dòng 634–637, epic AC dòng 738):
   - Text: `"This tab contains raw technical output. For a human-readable summary, see the Summary tab."`.
   - Style: card với background subtle (`--bg-subtle`), border-left 3px `--border-strong`, padding 12px, font-size 13px.
   - Sub-text link `"→ Switch to Summary tab"` (button styled as link) → `onClick={() => setActiveTab("summary")}`.

2. **Run filter dropdown** (theo UX spec dòng 639):
   - Native `<select>` với options: `"All runs"` + 1 option per run (`"Run #${runNumber} (${status})"` — e.g. `"Run #3 (Running)"`).
   - State: `selectedRunFilter: "all" | runId`.
   - Default value khi tab mở:
     - Nếu Runs Tab đã set `focusedRunId` (qua AC-4 "View Logs" click) → default `selectedRunFilter = focusedRunId` (cross-tab handoff).
     - Else: `"all"`.

3. **Log content area** (theo UX spec dòng 641, epic AC dòng 739):
   - Filter: nếu `selectedRunFilter === "all"` → list tất cả runs (DESC như Runs Tab); else chỉ 1 run được chọn.
   - Mỗi run render một section:
     - Header: `Run #${runNumber} · ${agentLabel} · ${endedAt ?? "running"}` (font-weight 600).
     - Content: `<pre>` block với:
       - Font: `font-family: ui-monospace, "SF Mono", "Cascadia Code", monospace`.
       - Font-size: `13px` (CHÍNH XÁC, theo UX spec dòng 641, epic AC dòng 739).
       - Background: `--bg-subtle` (light theme) — KHÔNG implement dark theme cho 3.5b (UX spec đề cập dark/light option dòng 641 nhưng OOS cho MVP).
       - Line-height: 1.4.
       - `max-height: 24em` + `overflow-y: auto` (KHÁC với Runs Tab — Logs Tab cần scroll vì tail có thể dài).
       - Content: `run.logTail ?? "(no output captured yet)"`.
       - Preserve whitespace: `white-space: pre`.
     - Footer: `[Download]` button (variant `ghost`, size `sm`).

**And** Download button click handler:
1. Tạo Blob: `new Blob([run.logTail ?? ""], { type: "text/plain;charset=utf-8" })`.
2. Tạo Object URL: `URL.createObjectURL(blob)`.
3. Trigger download: tạo `<a>` element ẩn với `href = objectUrl`, `download = "omni-agent-${taskId}-run${runNumber}.log"`, append vào body, click, remove, revoke URL.
4. **Lưu ý scope:** Download chỉ tải xuống `logTail` (last 100 lines / 10KB per Story 3.4 AC-3) — KHÔNG phải full log file. **Full log download là follow-up story** (xem Dev Notes → Deferred Work). Disclaimer banner đã warn user về raw output — không cần extra warning về tail-only.

**Given** task chưa có run nào hoặc tất cả runs có `logTail === null`
**When** Logs Tab mở
**Then** render disclaimer banner + EmptyState (`icon=""`, `heading="No logs yet"`, `description="Run output will appear here when an agent starts producing output."`).

**Given** `runs.isLoading` hoặc `runs.isError`
**When** Logs Tab mở
**Then** render disclaimer banner + skeleton placeholder hoặc fallback (giống AC-4 pattern).

---

**AC-6 — RunTimeline component: vertical timeline với event labels:**

**Given** Runs Tab có một row expanded với `[View Timeline]` đã click → toggle state `showTimelineFor: runId | null`
**When** RunTimeline render cho `run` cụ thể
**Then** component `<RunTimeline run={run} task={task} onViewRawClick={() => setActiveTab("logs")} />` render block timeline với layout theo UX spec dòng 663–714 (simplified cho MVP — xem Dev Notes về event-source decision).

**Layout:**

```
Run #${runNumber} · ${task.title}
${agentLabel} · ${task.role}
${startedAt} → ${endedAt ?? "running"} · ${duration} · ${statusBadge}

  ●─── Session started                              ${startedAt local time}
  │
  ●─── Agent running…  (chỉ khi running — pulse dot)  ${"in progress"}
  │
  ●─── Session ${completed|failed}                  ${endedAt local time}  (chỉ khi run kết thúc)
```

**Event sources cho MVP:**

Story 3.5b RunTimeline render **minimal events** dựa thuần trên `Run` table fields (KHÔNG parse log content). Events derived:

1. **`session_start`** (luôn có, từ `run.startedAt`):
   - Dot color: **green** (`--status-completed` hoặc `#22C55E`).
   - Label: `"Session started"` (theo Event Label Mapping UX spec dòng 724).
   - Timestamp: `new Date(run.startedAt).toLocaleString()`.

2. **`session_running`** (chỉ render khi `run.exitCode === null AND run.endedAt === null`):
   - Dot color: **violet pulse** (`--brand-primary` hoặc `#7C3AED`) với CSS animation `pulse` (reuse class từ `StatusBadge.css` Running variant).
   - Label: `"Agent running…"` (custom label — không có trong Event Label Mapping nhưng UX spec dòng 746 đề cập "In progress…").
   - Timestamp: text `"in progress"` (KHÔNG đổi thành thời gian real-time để tránh rerender liên tục).
   - **Lưu ý:** Event này KHÔNG có expandable detail (▶) — chỉ là status placeholder.

3. **`session_end`** (chỉ render khi `run.endedAt !== null`):
   - Nếu `exitCode === 0`:
     - Dot color: **green** (`--status-completed`).
     - Label: `"Session completed"` (Event Label Mapping dòng 733).
     - Timestamp: `new Date(run.endedAt).toLocaleString()`.
   - Nếu `exitCode > 0` (failed):
     - Dot color: **red** (`--status-failed` hoặc `#DC2626`).
     - Label: `"Session failed"` (Event Label Mapping dòng 734).
     - Timestamp: `new Date(run.endedAt).toLocaleString()`.
     - Sub-label dưới timestamp: `Exit code: ${exitCode}`.

**And** mỗi step render theo anatomy UX spec dòng 700–718:
- Dot: 10px circle.
- Connecting line: 2px solid `--border` giữa các dots (CSS `border-left` trên container).
- Label: text 14px, font-weight 500.
- Timestamp: text 13px, color `--text-secondary`, align right.

**And** dưới timeline có **"View raw output →"** link (theo UX spec dòng 718, epic AC dòng 745):
- Button styled as link (no border, brand color, underline on hover).
- Click → `props.onViewRawClick(run.id)` → parent component (Runs Tab) sets `setActiveTab("logs")` + `setFocusedRunId(run.id)` (chain qua AC-5 cross-tab handoff).

**Given** RunTimeline render cho failed run (exit_code = 1) theo UX spec dòng 753–768
**When** inspect timeline
**Then** ngoài 2 events `session_start` + `session_end` (failed), render thêm **suggested action block** dưới timeline:

```
⚠ This run failed.
Common cause: session terminated unexpectedly or agent error.

[Resume Session]    [View Error Logs]
```

- Icon `⚠` + text `"This run failed."` + sub-text generic `"Common cause: session terminated unexpectedly or agent error."` (KHÔNG parse exit_code thành reason cụ thể — defer to future story khi có structured error events; UX spec dòng 766 đề xuất nhưng OOS).
- `[Resume Session]` button (variant `primary`, size `sm`) — trigger `useResumeSession` (Story 3.3 hook).
  - Comment: `undefined` (resume retry — không có inline input ở timeline; nếu user muốn comment thì dùng Summary Tab 3.5a hoặc Comments Tab AC-3).
- `[View Error Logs]` button (variant `secondary`, size `sm`) — `onClick = () => onViewRawClick(run.id)` (giống "View raw output →" link).

**Given** RunTimeline render trong các tình huống edge case
**When** rendered
**Then** xử lý đúng:
- Run đang `running` (live mode) — KHÔNG render suggested action block. Chỉ 2 events: `session_start` + `session_running`.
- Run có `cancelled` semantics (`exitCode !== null AND exitCode !== 0` nhưng task status `cancelled`) — render giống failed nhưng label thay `"Session failed"` → `"Session cancelled"` (custom — không có trong Event Label Mapping). **Note:** task status không nằm trên `run` model — phải pass `task` prop để derive này.

**And** component file path: `frontend/src/components/RunTimeline.tsx` (theo architecture.md dòng 457 đã list).

**And** test file co-located: `frontend/src/components/RunTimeline.test.tsx`.

---

**AC-7 — Live mode polling: RunTimeline + Runs/Logs tabs auto-refresh khi task running:**

**Given** task `OMNI-001` ở `task.status === "running"` (có thể do AC-4 RunTimeline live mode hoặc Runs/Logs tab đang mở)
**When** Comments/Runs/Logs Tab được mở (active tab thuộc 1 trong 3)
**Then** queries phải auto-refetch với interval:
- `useTask(projectId, taskId)` — đã có polling 5s khi running (thiết lập Story 3.5a). KHÔNG đổi.
- `useRunList(projectId, taskId)` — polling 5s khi `task.status === "running"`, else không polling. Pattern theo architecture.md dòng 238–246:
  ```ts
  useQuery({
    queryKey: ["runs", projectId, taskId],
    queryFn: () => listRuns(projectId, taskId),
    refetchInterval: (query) =>
      task?.status === "running" ? 5000 : false,
    enabled: !!projectId && !!taskId,
  })
  ```
- `useCommentList(projectId, taskId)` — **KHÔNG polling** (comments chỉ thay đổi khi user POST hoặc Resume — invalidate query trên cả 2 events). Polling không cần thiết.

**And** RunTimeline component (mounted trong Runs Tab khi user click "View Timeline"):
- `aria-live="polite"` trên container (theo UX-DR15 dòng 115 + epic AC dòng 706 cho Summary tab — apply tương tự cho RunTimeline live mode).
- Khi `run.exitCode === null` (live) — timeline display "Agent running…" event với pulse dot.
- Khi polling phát hiện `exitCode != null` (run đã kết thúc) → re-render với event `session_end` added — KHÔNG kích hoạt scroll/jarring layout shift (CSS transition mềm, KHÔNG mandatory).

**And** unmount cleanup: TanStack Query tự handle cleanup queries khi component unmount — KHÔNG cần custom logic.

**Given** task transitions `running → paused` (do backend exit detection của Story 3.2)
**When** polling refetch phát hiện status change
**Then**:
1. `useRunList` next refetch trả về run với `endedAt` populated, `exitCode = 0`.
2. RunTimeline re-render: event `session_running` được thay bằng `session_end` (completed).
3. Polling tự stop (vì `task.status !== "running"` ở `refetchInterval` callback).

---

**AC-8 — Cross-tab interaction: "View raw →" + "View Timeline" + "View Logs":**

**Given** TaskDetailPanel có state mới `focusedRunId: string | null` (thêm vào component state cùng `activeTab` — context: cross-tab handoff cho phép Runs Tab → Logs Tab targeting một run cụ thể)
**When** Runs Tab `[View Logs]` button click cho `Run #2`
**Then**:
1. `setActiveTab("logs")` — switch tab.
2. `setFocusedRunId(run.id)` — set focus.

**Given** Logs Tab mount với `focusedRunId !== null`
**When** component mount
**Then**:
1. `selectedRunFilter` initial state = `focusedRunId` (cross-tab default — overrides "all").
2. Sau mount, optionally scroll section của run đó vào view (`scrollIntoView({ block: "start", behavior: "smooth" })` — UX nice-to-have).
3. Sau khi mount xong (1 tick), `setFocusedRunId(null)` để clear state — tránh sticky behavior khi user manually switch tabs sau này.

**Given** RunTimeline "View raw output →" link click
**When** click
**Then** giống AC-8 above: `setActiveTab("logs")` + `setFocusedRunId(run.id)` (cùng `runId` của RunTimeline đang render).

**Given** User click tab "Logs" trực tiếp (KHÔNG qua "View Logs" button) sau khi đã có `focusedRunId` từ session trước
**When** Logs Tab render
**Then** `focusedRunId === null` (đã clear ở mount trước) → `selectedRunFilter = "all"` (default behavior). User vẫn có thể chọn run cụ thể via dropdown.

**Given** `focusedRunId` trỏ tới run không tồn tại (race: run bị xóa giữa tabs switch — không xảy ra trong MVP vì không có delete run feature, nhưng defensive)
**When** Logs Tab mount
**Then** dropdown default "all" (fallback). KHÔNG crash, KHÔNG throw.

---

**AC-9 — Accessibility (WCAG 2.1 AA):**

**Given** Comments / Runs / Logs Tabs render
**When** screen reader user navigate qua keyboard
**Then** tuân thủ NFR-6 (WCAG 2.1 AA):

**Comments Tab:**
- Thread list: `<ul role="list">` với mỗi comment là `<li>` (semantic HTML).
- Mỗi comment có `aria-label="Comment by You at ${formattedTime}, ${sentStatus}"` (compact label cho screen reader).
- Textarea có `<label>` hoặc `aria-label="New comment"` (KHÔNG dựa vào placeholder).
- Button "Add Comment" disabled state có `aria-disabled="true"` (đồng bộ với `disabled` attribute).
- Status labels (`Sent to agent ✓` / `Pending`) KHÔNG dựa vào màu đơn độc — luôn có icon hoặc text (✓ và "Pending" text đã đảm bảo).

**Runs Tab:**
- List dùng `<ul role="list">` với mỗi run row là `<li>`.
- Mỗi row là `<button role="button" aria-expanded={isExpanded} aria-controls="run-detail-${runId}">` để keyboard expand bằng Enter/Space.
- Expanded detail block có `id="run-detail-${runId}"`.
- Status indicator (Running / Completed / Failed) KHÔNG dựa vào màu đơn độc — luôn có text label kèm dot.
- `[View Timeline]` / `[View Logs]` buttons có `aria-label` rõ ràng: `aria-label="View timeline for Run #${runNumber}"` / `"View logs for Run #${runNumber}"`.

**Logs Tab:**
- Disclaimer banner có `role="note"` (informational landmark).
- Filter `<select>` có `<label for="logs-run-filter">Filter by run</label>` (visible label).
- Log content `<pre>` có `aria-label="Log content for Run #${runNumber}"`.
- Download button `aria-label="Download log for Run #${runNumber}"`.

**RunTimeline:**
- Container `<ol role="list" aria-label="Timeline for Run #${runNumber}">`.
- Mỗi step `<li role="listitem">` với text label (KHÔNG chỉ dot).
- Live mode: `aria-live="polite"` trên container (chỉ apply khi `run.exitCode === null`).
- "View raw output →" link là `<button>` (semantic — không dùng `<a href="#">`).

**Color contrast:**
- Tất cả text trên background phải đạt 4.5:1+ (NFR-6). Reuse design tokens — KHÔNG hardcode contrast-failing colors.
- Status dots (green/red/violet) phải có text label kèm theo — không thông tin được encode bằng riêng màu.

**Keyboard navigation:**
- Tab order: thread items → input textarea → Add Comment button (Comments Tab).
- Tab order: run rows (focusable, can be expanded) → view-timeline button → view-logs button (Runs Tab).
- Tab order: disclaimer link → filter dropdown → download button (Logs Tab).
- Esc key đóng panel (đã có từ TaskDetailPanel — KHÔNG đổi).

**Reduced motion:**
- Pulse animation cho dot (Running run) wrap trong `@media (prefers-reduced-motion: no-preference)`.

---

**AC-10 — Tests (frontend, Vitest + React Testing Library):**

**Given** test framework Vitest + RTL đã setup (`frontend/package.json` `"test": "vitest run"` + `frontend/src/test-setup.ts`)
**When** Story 3.5b implement
**Then** mở rộng `frontend/src/features/detail/TaskDetailPanel.test.tsx` + tạo `frontend/src/components/RunTimeline.test.tsx` với các test cases sau, tổng tối thiểu 15 test cases mới:

**TaskDetailPanel.test.tsx — Comments Tab tests:**

| Test ID | Scenario | Mocks | Assertion |
|---|---|---|---|
| TC1 | Click tab "Comments" → thread list render với 2 comments (1 sent + 1 pending) | `listComments` return `[{sent: true}, {sent: false}]` | Both comments visible; "Sent to agent ✓" + "Pending · will be sent on next Resume" labels visible |
| TC2 | Comments empty → render EmptyState + input section vẫn visible | `listComments` return `[]` | EmptyState heading "No comments yet" visible; textarea "Add a comment..." visible |
| TC3 | Submit comment "hello" → `addComment` called + thread invalidated | `addComment` mock resolve | `expect(addComment).toHaveBeenCalledWith(projectId, taskId, "hello")`; sau success: textarea cleared (value === "") |
| TC4 | Submit empty/whitespace comment → mutation NOT called + warning toast | — | `expect(addComment).not.toHaveBeenCalled()`; toast "Comment cannot be empty" visible |
| TC5 | Submit error 409 task_terminal → warning toast (not error) | `addComment` reject `ApiError(409, "task_terminal", ...)` | toast tone warning (assert via data attribute / class) |
| TC6 | Task status `done` → textarea disabled + placeholder updated | task fixture `status: "done"` | textarea `disabled` attribute present; placeholder contains "Comments disabled" |

**TaskDetailPanel.test.tsx — Runs Tab tests:**

| Test ID | Scenario | Mocks | Assertion |
|---|---|---|---|
| TR1 | Click tab "Runs" → list render DESC với 3 runs | `listRuns` return `[Run#3, Run#2, Run#1]` (DESC) | First row shows "Run #3"; status labels visible |
| TR2 | Click run row → expand details (Input/Output/Duration/Exit) | — | After click: `screen.getByText("Input:")` visible; `screen.getByText(/Duration:/)` visible |
| TR3 | Click second row → first row collapsed (only 1 expanded at a time) | — | First row's detail block no longer visible; second row's detail block visible |
| TR4 | Empty runs → EmptyState | `listRuns` return `[]` | EmptyState heading "No runs yet" visible |
| TR5 | Click "View Logs" button on expanded row → activeTab switches to "logs" + filter set to that run | — | Logs Tab visible; `<select>` value === runId of clicked row |
| TR6 | Click "View Timeline" button → RunTimeline component mounts | — | `screen.getByRole("list", { name: /Timeline for Run #/ })` visible |

**RunTimeline.test.tsx — RunTimeline component tests:**

| Test ID | Scenario | Mocks | Assertion |
|---|---|---|---|
| TT1 | Completed run (exit 0) → 2 events: session_start + session_completed | run fixture with `exitCode: 0`, `endedAt: timestamp` | 2 list items visible; labels "Session started" + "Session completed" |
| TT2 | Failed run (exit 1) → 2 events + suggested action block | run fixture `exitCode: 1` | "Session failed" label + "This run failed." text + Resume button visible |
| TT3 | Running run (`exitCode: null`, `endedAt: null`) → 2 events: session_start + Agent running with pulse | run fixture running | "Agent running…" label visible; container has `aria-live="polite"` attribute |
| TT4 | Click "View raw output →" → onViewRawClick called with runId | — | `expect(onViewRawClick).toHaveBeenCalledWith(runId)` |
| TT5 | Click "Resume Session" (failed run suggested action) → `useResumeSession` mutate called with no comment | mock resumeSession | `expect(resumeSession).toHaveBeenCalledWith(projectId, taskId, undefined)` |
| TT6 | Cancelled task with failed run → label "Session cancelled" instead of "Session failed" | task fixture `status: "cancelled"`, run exit_code 1 | "Session cancelled" visible (NOT "Session failed") |

**Backend tests (`backend/tests/comments_test.rs` — NEW file extending Story 3.3's tests):**

| Test ID | Scenario | Assertion |
|---|---|---|
| BC1 | `GET .../comments` happy path (3 comments) → 200 + array sorted ASC | Response array length 3, `createdAt` ascending order, camelCase keys |
| BC2 | `GET .../comments` empty → 200 `[]` | Response is `[]` (NOT 404) |
| BC3 | `GET .../comments` project not found → 404 `project_not_found` | Error envelope correct |
| BC4 | `GET .../comments` task not found → 404 `task_not_found` | Error envelope correct |
| BC5 | `GET .../comments` sent boolean conversion verified | Response field `sent` is JSON boolean (NOT integer) |

---

**AC-11 — Regression: existing routes / components / tests KHÔNG bị thay đổi:**

**Given** tất cả route đã mount ở Story 1.x, 2.x, 3.1 → 3.5a (projects CRUD, tasks CRUD, sessions start/resume/cancel, runs list/get, comments POST)
**When** Story 3.5b thêm 1 route mới: `GET /api/projects/{project_id}/tasks/{task_id}/comments`
**Then**:
- KHÔNG xóa route nào khác.
- KHÔNG đổi method/path/behavior của bất kỳ existing route.
- `backend/tests/{projects,tasks,sessions,comments,runs}_test.rs` — tất cả pass.

**Given** existing frontend components: `StatusBadge`, `AgentAvatar`, `Button`, `EmptyState`, `Toast`, `TaskCard`, `TaskDetailPanel` (Summary tab + ActionBar + SessionPanel)
**When** Story 3.5b implement
**Then**:
- KHÔNG sửa props interface của existing components (`StatusBadge`, `AgentAvatar`, `Button`, `EmptyState`, `Toast`).
- KHÔNG sửa Summary tab behavior (Story 3.5a invariants giữ nguyên).
- KHÔNG sửa ActionBar / SessionPanel / Header / Tab bar.
- Existing tests (TaskCard.test.tsx, StatusBadge.test.tsx, Button.test.tsx, Toast.test.tsx, EmptyState.test.tsx, etc.) — tất cả pass.

**Given** TaskDetailPanel.test.tsx có các test cases T1–T12 từ Story 3.5a (Summary tab tests)
**When** Story 3.5b mở rộng file này
**Then** TẤT CẢ T1–T12 vẫn pass — Story 3.5b chỉ THÊM TC1–TC6 (Comments) và TR1–TR6 (Runs), KHÔNG sửa test cases cũ.

---


### A. Backend: GET comments endpoint

- [x] **Task A.1 — Mở rộng `backend/src/services/comments.rs`** (AC: 1)
  - [x] A.1.1 Thêm function `list_comments_for_task` vào file đã tạo từ Story 3.3 Task A.2:
    ```rust
    pub async fn list_comments_for_task(
        pool: &SqlitePool,
        project_id: &str,
        task_id: &str,
    ) -> Result<Vec<Comment>, AppError> {
        // Verify project exists (reuse pattern từ services/tasks.rs hoặc services/runs.rs)
        let project_exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM projects WHERE id = ?",
        )
        .bind(project_id)
        .fetch_one(pool)
        .await?;
        if project_exists == 0 {
            return Err(AppError::NotFound {
                code: "project_not_found",
                message: format!("Project {} not found", project_id),
            });
        }

        // Verify task exists in this project
        let task_exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM tasks WHERE id = ? AND project_id = ?",
        )
        .bind(task_id)
        .bind(project_id)
        .fetch_one(pool)
        .await?;
        if task_exists == 0 {
            return Err(AppError::NotFound {
                code: "task_not_found",
                message: format!("Task {} not found", task_id),
            });
        }

        // List comments sorted ASC by created_at
        let rows = sqlx::query_as::<_, Comment>(
            "SELECT id, task_id, content, sent, created_at \
             FROM comments WHERE task_id = ? ORDER BY created_at ASC",
        )
        .bind(task_id)
        .fetch_all(pool)
        .await?;

        Ok(rows)
    }
    ```
  - [x] A.1.2 KHÔNG đổi `validate_content_non_empty`, `create_comment`, `insert_comment_in_tx` (Story 3.3 sở hữu — không invasion).
  - [x] A.1.3 Verify `Comment` struct + `Serialize` impl của Story 3.3 đã đúng — KHÔNG sửa.

- [x] **Task A.2 — Mở rộng `backend/src/handlers/comments.rs`** (AC: 1)
  - [x] A.2.1 Thêm handler `list_comments` vào file của Story 3.3 Task A.3:
    ```rust
    pub async fn list_comments(
        State(state): State<Arc<AppState>>,
        Path((project_id, task_id)): Path<(String, String)>,
    ) -> Result<impl IntoResponse, AppError> {
        let comments = services::comments::list_comments_for_task(
            &state.db,
            &project_id,
            &task_id,
        ).await?;
        Ok(Json(comments))
    }
    ```
  - [x] A.2.2 KHÔNG đổi `add_comment` handler (Story 3.3 sở hữu).

- [x] **Task A.3 — Mount route trong `backend/src/main.rs`** (AC: 1)
  - [x] A.3.1 Trong `api_router` chain, thêm route MỚI:
    ```rust
    .route(
        "/projects/{project_id}/tasks/{task_id}/comments",
        get(handlers::comments::list_comments).post(handlers::comments::add_comment),
    )
    ```
  - [x] A.3.2 **Lưu ý:** Story 3.3 đã mount `POST .../comments` riêng (chỉ POST). 3.5b refactor thành combined `get(...).post(...)` — Axum routing pattern chuẩn (cùng path, multiple methods). **KHÔNG được xóa** POST behavior — verify bằng cách chạy Story 3.3's `comments_test.rs` sau refactor.
  - [x] A.3.3 Verify `use axum::routing::get;` đã import (main.rs hiện đã có từ Story 1.x).

### B. Backend: Integration tests cho GET comments

- [x] **Task B.1 — Mở rộng `backend/tests/comments_test.rs`** (AC: 1, BC1–BC5)
  - [x] B.1.1 Pattern theo `backend/tests/runs_test.rs` (Story 3.4 Task D.1) hoặc `comments_test.rs` của Story 3.3:
    - Helper `build_test_app_with_pool` (đã có từ Story 1.x).
    - Serial test execution với env isolation.
  - [x] B.1.2 Test `list_comments_returns_200_with_chronological_order` (BC1):
    - Seed project + task + 3 comments (`created_at` ascending: T1, T2, T3).
    - HTTP `GET /api/projects/{id}/tasks/{id}/comments` → status 200.
    - Body parse thành `Vec<serde_json::Value>`, assert length 3, assert `createdAt` field ascending.
    - Verify keys: `id`, `taskId`, `content`, `sent`, `createdAt` (camelCase).
    - Verify `sent` là JSON boolean (`true` / `false`, KHÔNG phải `0` / `1`).
  - [x] B.1.3 Test `list_comments_returns_empty_array_when_no_comments` (BC2):
    - Seed project + task + NO comments.
    - GET → 200 với body `[]` (assert exact length 0; KHÔNG 404).
  - [x] B.1.4 Test `list_comments_returns_404_when_project_not_found` (BC3).
  - [x] B.1.5 Test `list_comments_returns_404_when_task_not_found` (BC4).
  - [x] B.1.6 Test `list_comments_returns_correct_sent_boolean_serialization` (BC5):
    - Seed 2 comments: one with `sent = 1` (DB INTEGER), one with `sent = 0`.
    - GET → parse first element's `sent` field → must be JSON `true`. Second element's `sent` → JSON `false`.
    - Assert type với `serde_json::Value::Bool` (KHÔNG `Number`).
  - [x] B.1.7 Test regression `add_comment_still_works_after_route_refactor`:
    - POST `/api/projects/{id}/tasks/{id}/comments` body `{"content":"test"}` → 201.
    - Verify Story 3.3's `comments_test.rs` add_comment tests vẫn pass (no regression).
  - [x] B.1.8 Test `list_comments_excludes_other_tasks`:
    - Seed 2 tasks trong cùng project, mỗi task có 1 comment.
    - GET task1's comments → response array length 1, content khớp task1.

### C. Frontend types: extend Comment + Run types

- [x] **Task C.1 — Verify `frontend/src/types/comment.ts`** (AC: 2, 3)
  - [x] C.1.1 File này đã được Story 3.3 Task E.1 dự kiến tạo. **Verify:** trước khi implement 3.5b, check file tồn tại. Nếu chưa có (3.3 chưa merge) → escalate.
  - [x] C.1.2 Expected shape:
    ```ts
    export interface Comment {
      id: string;
      taskId: string;
      content: string;
      sent: boolean;
      createdAt: string;
    }
    ```
  - [x] C.1.3 KHÔNG sửa file (3.3 owner). 3.5b chỉ consume.

- [x] **Task C.2 — Verify `frontend/src/types/run.ts`** (AC: 4, 5, 6)
  - [x] C.2.1 File này đã được Story 3.4 Task E.1 dự kiến tạo. **Verify:** check file tồn tại.
  - [x] C.2.2 Expected shape (từ 3.4 spec):
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
  - [x] C.2.3 KHÔNG sửa file (3.4 owner).

### D. Frontend API clients: extend comments.ts

- [x] **Task D.1 — Mở rộng `frontend/src/api/comments.ts`** (AC: 1, 3)
  - [x] D.1.1 File này đã được Story 3.3 Task E.1 tạo với function `addComment`. **Thêm** function `listComments`:
    ```ts
    import { apiFetch } from "./client";
    import type { Comment } from "../types/comment";

    export const listComments = (projectId: string, taskId: string) =>
      apiFetch<Comment[]>(
        `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/comments`,
      );

    // addComment - existing from Story 3.3
    export const addComment = (
      projectId: string,
      taskId: string,
      content: string,
    ) =>
      apiFetch<Comment>(
        `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/comments`,
        { method: "POST", body: JSON.stringify({ content }) },
      );
    ```
  - [x] D.1.2 KHÔNG đổi `addComment` signature (3.3 owner).

- [x] **Task D.2 — Verify `frontend/src/api/runs.ts`** (AC: 4, 5)
  - [x] D.2.1 File này đã được Story 3.4 Task E.2 dự kiến tạo. **Verify** function signatures:
    ```ts
    export const listRuns = (projectId: string, taskId: string) => Promise<Run[]>;
    export const getRun = (projectId: string, taskId: string, runId: string) => Promise<Run>;
    ```
  - [x] D.2.2 KHÔNG sửa (3.4 owner).

### E. Frontend hooks: useCommentList, useAddComment, useRunList

- [x] **Task E.1 — Tạo `frontend/src/hooks/useCommentList.ts`** (AC: 2, 7)
  - [x] E.1.1 Pattern theo `frontend/src/hooks/useTasks.ts` (existing):
    ```ts
    import { useQuery } from "@tanstack/react-query";
    import { listComments } from "../api/comments";

    export function useCommentList(projectId: string | null, taskId: string | null) {
      return useQuery({
        queryKey: ["comments", projectId, taskId],
        queryFn: () => listComments(projectId!, taskId!),
        enabled: !!projectId && !!taskId,
        // KHÔNG polling — comments chỉ thay đổi qua user action (invalidate on POST hoặc Resume)
      });
    }
    ```
  - [x] E.1.2 KHÔNG thêm `refetchInterval` (theo AC-7 quyết định không polling).

- [x] **Task E.2 — Tạo `frontend/src/hooks/useAddComment.ts`** (AC: 3)
  - [x] E.2.1 Pattern theo `frontend/src/hooks/useStartSession.ts` (existing) với invalidation:
    ```ts
    import { useMutation, useQueryClient } from "@tanstack/react-query";
    import { addComment } from "../api/comments";

    export function useAddComment(projectId: string, taskId: string) {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (content: string) => addComment(projectId, taskId, content),
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["comments", projectId, taskId] });
          // Comments không trigger task status change → KHÔNG invalidate ["task", ...] / ["tasks", ...]
        },
      });
    }
    ```
  - [x] E.2.2 KHÔNG handle toast trong hook — toast là UI concern, handle ở component level (giống pattern `useStartSession` của Story 3.1 + `useResumeSession` của 3.3).

- [x] **Task E.3 — Tạo `frontend/src/hooks/useRunList.ts`** (AC: 4, 5, 7)
  - [x] E.3.1 Pattern với polling theo architecture.md:
    ```ts
    import { useQuery } from "@tanstack/react-query";
    import { listRuns } from "../api/runs";
    import type { TaskStatus } from "../types/task";

    export function useRunList(
      projectId: string | null,
      taskId: string | null,
      taskStatus: TaskStatus | null,
    ) {
      return useQuery({
        queryKey: ["runs", projectId, taskId],
        queryFn: () => listRuns(projectId!, taskId!),
        enabled: !!projectId && !!taskId,
        refetchInterval: () => (taskStatus === "running" ? 5000 : false),
      });
    }
    ```
  - [x] E.3.2 `taskStatus` param truyền từ parent component (TaskDetailPanel đã có `task.status`).
  - [x] E.3.3 **Lưu ý:** `useResumeSession` của Story 3.3 đã invalidate `["runs", projectId, taskId]` trên onSuccess (xem 3.3 Task F.3.4 / 3.5a AC-4.3). 3.5b KHÔNG cần thêm invalidation chỗ này — chỉ cần tận dụng pattern đã có.

### F. Frontend components: RunTimeline

- [x] **Task F.1 — Tạo `frontend/src/components/RunTimeline.tsx`** (AC: 6)
  - [x] F.1.1 Component signature:
    ```tsx
    interface RunTimelineProps {
      run: Run;
      task: Task;
      projectId: string;
      onViewRawClick: (runId: string) => void;
    }
    export default function RunTimeline(props: RunTimelineProps): JSX.Element;
    ```
  - [x] F.1.2 Internal: derive events từ `run` fields:
    ```ts
    type TimelineEvent = {
      type: "session_start" | "session_running" | "session_end";
      label: string;
      timestamp: string | null;  // null cho "in progress"
      dotColor: "green" | "violet-pulse" | "red";
      subLabel?: string;  // e.g. "Exit code: 1"
    };

    function deriveEvents(run: Run, task: Task): TimelineEvent[] {
      const events: TimelineEvent[] = [
        {
          type: "session_start",
          label: "Session started",
          timestamp: run.startedAt,
          dotColor: "green",
        },
      ];

      if (run.exitCode === null && run.endedAt === null) {
        // Live mode
        events.push({
          type: "session_running",
          label: "Agent running…",
          timestamp: null,
          dotColor: "violet-pulse",
        });
      } else if (run.endedAt !== null) {
        const isCancelled = task.status === "cancelled";
        const isSuccess = run.exitCode === 0;
        events.push({
          type: "session_end",
          label: isCancelled
            ? "Session cancelled"
            : isSuccess
            ? "Session completed"
            : "Session failed",
          timestamp: run.endedAt,
          dotColor: isSuccess && !isCancelled ? "green" : "red",
          subLabel: !isSuccess && run.exitCode !== null
            ? `Exit code: ${run.exitCode}`
            : undefined,
        });
      }

      return events;
    }
    ```
  - [x] F.1.3 Render header + events list + "View raw output →" link + (optional) suggested action block cho failed run.
  - [x] F.1.4 Suggested action block — only render khi `run.endedAt !== null AND run.exitCode > 0 AND task.status !== "cancelled"`:
    ```tsx
    <div className="run-timeline-suggested-action" role="note">
      <p>⚠ This run failed.</p>
      <p className="run-timeline-suggested-action-hint">
        Common cause: session terminated unexpectedly or agent error.
      </p>
      <div className="run-timeline-suggested-action-buttons">
        <Button variant="primary" size="sm" onClick={handleResumeFromTimeline}>
          Resume Session
        </Button>
        <Button variant="secondary" size="sm" onClick={() => props.onViewRawClick(run.id)}>
          View Error Logs
        </Button>
      </div>
    </div>
    ```
  - [x] F.1.5 `handleResumeFromTimeline` reuse `useResumeSession` từ Story 3.3 Task F.2:
    ```tsx
    const resumeMut = useResumeSession(props.projectId, props.task.id);
    const handleResumeFromTimeline = () => {
      resumeMut.mutate(undefined, {
        onSuccess: () => { /* toast success */ },
        onError: (err) => { /* toast error */ },
      });
    };
    ```
  - [x] F.1.6 Container có `aria-live="polite"` khi `run.exitCode === null` (live mode). Else KHÔNG attribute (tránh announce spam).

- [x] **Task F.2 — Tạo `frontend/src/components/RunTimeline.css`** (AC: 6, 9)
  - [x] F.2.1 Style classes:
    - `.run-timeline` — wrapper container.
    - `.run-timeline-header` — header với run #, agent, duration.
    - `.run-timeline-list` — `<ol>` với padding-left + border-left 2px solid `--border` (vertical line).
    - `.run-timeline-step` — `<li>` với flex layout (dot · label · timestamp).
    - `.run-timeline-dot` — 10px circle, absolute positioned over the line.
    - `.run-timeline-dot--green` — background `--status-completed` hoặc `#22C55E`.
    - `.run-timeline-dot--red` — background `--status-failed` hoặc `#DC2626`.
    - `.run-timeline-dot--violet-pulse` — background `--brand-primary` hoặc `#7C3AED` + pulse animation.
    - `.run-timeline-label` — text 14px font-weight 500.
    - `.run-timeline-timestamp` — text 13px color `--text-secondary` align right.
    - `.run-timeline-sublabel` — text 12px italic color `--text-secondary`.
    - `.run-timeline-view-raw` — button styled as link (no border, brand color, underline on hover).
    - `.run-timeline-suggested-action` — alert/note card với background subtle.
  - [x] F.2.2 Pulse animation:
    ```css
    @media (prefers-reduced-motion: no-preference) {
      @keyframes run-timeline-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(1.15); }
      }
      .run-timeline-dot--violet-pulse {
        animation: run-timeline-pulse 1.5s ease-in-out infinite;
      }
    }
    ```
  - [x] F.2.3 Dùng CSS variables từ `frontend/src/styles/tokens.css` — KHÔNG hardcode hex. Verify token names (e.g. `--bg-app`, `--text-primary`, `--brand-primary`, `--status-completed`, `--status-failed`, `--border`, `--text-secondary`). Nếu token thiếu → fallback hex (KHÔNG add token mới cho 3.5b).

- [x] **Task F.3 — Tạo `frontend/src/components/RunTimeline.test.tsx`** (AC: 6, 10 — TT1–TT6)
  - [x] F.3.1 Setup: mock `useResumeSession`, `useToast` (nếu RunTimeline trực tiếp dùng).
  - [x] F.3.2 Implement TT1–TT6 theo bảng AC-10 RunTimeline section.
  - [x] F.3.3 Helper `makeRun(overrides)` + `makeTask(overrides)` để tạo fixtures linh hoạt.
  - [x] F.3.4 Test TT6 (cancelled task) cần task fixture `status: "cancelled"` + run `exitCode: 1, endedAt: "..."`. Assert text "Session cancelled" visible; "Session failed" KHÔNG visible.

### G. Frontend feature: tab content panels

- [x] **Task G.1 — Refactor `TaskDetailPanel.tsx`: tách 3 tab content thành sub-components** (AC: 2, 4, 5, 8)
  - [x] G.1.1 Quyết định kiến trúc:
    - **Option A:** Inline JSX trong TaskDetailPanel.tsx (giống current code dòng 264–289). Pros: ít file, navigation đơn giản. Cons: file lớn (>400 dòng sau 3.5b).
    - **Option B:** Tách thành 3 sub-components: `CommentsTabPanel.tsx`, `RunsTabPanel.tsx`, `LogsTabPanel.tsx` trong `frontend/src/features/detail/`. Pros: file nhỏ + dễ test isolated. Cons: thêm 3 file + tăng cognitive load.
    - **Khuyến nghị:** Option B — match pattern Story 3.5a Task D.1.1 dự kiến tách `SummaryTab.tsx` (nếu 3.5a chose Option A, 3.5b cũng giữ inline cho consistency).
    - **Verify pattern của 3.5a sau khi merge** trước khi chọn architecture 3.5b.
  - [x] G.1.2 Component props chung pattern:
    ```tsx
    interface TabPanelProps {
      task: Task;
      projectId: string;
      onSwitchTab: (tab: PanelTab, runId?: string) => void;  // for cross-tab handoff
    }
    ```
  - [x] G.1.3 Thêm state `focusedRunId: string | null` vào `TaskDetailPanel` (AC-8). Bao gồm trong callback `onSwitchTab`:
    ```tsx
    const [focusedRunId, setFocusedRunId] = useState<string | null>(null);
    const handleSwitchTab = (tab: PanelTab, runId?: string) => {
      setActiveTab(tab);
      if (runId !== undefined) setFocusedRunId(runId);
    };
    ```
  - [x] G.1.4 Pass `focusedRunId` + `clearFocusedRunId` callback xuống `LogsTabPanel`.

- [x] **Task G.2 — Tạo / refactor `CommentsTabPanel.tsx`** (AC: 2, 3)
  - [x] G.2.1 Component render:
    - `useCommentList(projectId, taskId)` → fetch list.
    - `useAddComment(projectId, taskId)` → mutation.
    - Loading state: render skeleton.
    - Error state: render fallback.
    - Empty state: render `EmptyState` icon "💬" + heading "No comments yet".
    - List state: render `<ul>` với mỗi comment một `<li>`.
    - Bottom: input section với textarea + Add Comment button.
  - [x] G.2.2 Comment item render:
    ```tsx
    <li className="comment-thread-item" aria-label={`Comment by You at ${formatted}, ${comment.sent ? "sent" : "pending"}`}>
      <div className="comment-thread-header">
        <AgentAvatar name="You" runtime="codex" size="sm" />
        <span className="comment-thread-author">You</span>
        <span className="comment-thread-timestamp">{new Date(comment.createdAt).toLocaleString()}</span>
      </div>
      <div className="comment-thread-content">{comment.content}</div>
      <div className={`comment-thread-status comment-thread-status--${comment.sent ? "sent" : "pending"}`}>
        {comment.sent ? "Sent to agent ✓" : "Pending · will be sent on next Resume"}
      </div>
    </li>
    ```
  - [x] G.2.3 Input section handler:
    ```tsx
    const handleAddComment = () => {
      const trimmed = inputText.trim();
      if (trimmed.length === 0) {
        showToast({ tone: "warning", message: "Comment cannot be empty" });
        return;
      }
      mut.mutate(trimmed, {
        onSuccess: () => {
          setInputText("");
          showToast({ tone: "success", message: "Comment added" });
          textareaRef.current?.focus();
        },
        onError: (err) => {
          const msg = err instanceof ApiError ? err.message : "Failed to add comment";
          const tone = err instanceof ApiError && err.code === "task_terminal" ? "warning" : "error";
          showToast({ tone, message: msg });
        },
      });
    };
    ```
  - [x] G.2.4 Disabled state cho terminal task:
    ```tsx
    const isTerminal = task.status === "done" || task.status === "cancelled";
    const placeholderText = isTerminal
      ? `Comments disabled — task is ${task.status}.`
      : "Add a comment or instruction for the agent...";
    ```

- [x] **Task G.3 — Tạo / refactor `RunsTabPanel.tsx`** (AC: 4, 6, 7, 8)
  - [x] G.3.1 Component:
    - `useRunList(projectId, taskId, task.status)` → fetch + polling.
    - State `expandedRunId: string | null` (chỉ 1 run expanded cùng lúc).
    - State `showTimelineForRunId: string | null` (toggle independent của expanded).
    - Loading / Error / Empty states tương tự CommentsTabPanel.
  - [x] G.3.2 Run row render:
    ```tsx
    <li className="run-list-row">
      <button
        type="button"
        role="button"
        aria-expanded={expandedRunId === run.id}
        aria-controls={`run-detail-${run.id}`}
        onClick={() => setExpandedRunId((id) => (id === run.id ? null : run.id))}
      >
        <span className="run-list-row-number">Run #{run.runNumber}</span>
        <span className="run-list-row-agent">{agentLabel} · {task.role ?? "unassigned"}</span>
        <span className={`run-list-row-status run-list-row-status--${statusVariant}`}>
          <span className="run-list-row-dot" aria-hidden="true" />
          {statusLabel}
        </span>
      </button>
      {expandedRunId === run.id && (
        <div id={`run-detail-${run.id}`} className="run-list-row-detail">
          {/* Input / Output / Duration / Exit */}
          {/* [View Timeline] + [View Logs] buttons */}
          {showTimelineForRunId === run.id && (
            <RunTimeline run={run} task={task} projectId={projectId} onViewRawClick={(rid) => onSwitchTab("logs", rid)} />
          )}
        </div>
      )}
    </li>
    ```
  - [x] G.3.3 `formatRelativeTime`, `formatDuration` helpers — đặt trong cùng file hoặc tạo `frontend/src/utils/time.ts` (nếu tái sử dụng ở các file khác). Quyết định: tạo `frontend/src/utils/time.ts` — RunTimeline + RunsTabPanel + Logs Tab có thể share.
  - [x] G.3.4 Output preview helper (truncate logTail to 5 lines, 80 chars/line, append `…` if long):
    ```ts
    function formatOutputPreview(logTail: string | null): string {
      if (!logTail) return "(no output captured yet)";
      const lines = logTail.split("\n").slice(-5);
      return lines.map((l) => (l.length > 80 ? l.slice(0, 80) + "…" : l)).join("\n");
    }
    ```

- [x] **Task G.4 — Tạo / refactor `LogsTabPanel.tsx`** (AC: 5, 8)
  - [x] G.4.1 Component:
    - `useRunList(projectId, taskId, task.status)` → reuse cùng query (TanStack Query dedupes).
    - Props: `focusedRunId: string | null`, `clearFocusedRunId: () => void`.
    - State `selectedRunFilter: "all" | string` (initial = `focusedRunId ?? "all"`).
    - useEffect on mount: nếu `focusedRunId !== null` → setTimeout clear sau 100ms (next tick) để tránh sticky.
  - [x] G.4.2 Render:
    - Disclaimer banner (top).
    - Filter dropdown.
    - Filtered runs list — mỗi run là `<section>` với header + log content `<pre>` + download button.
  - [x] G.4.3 Disclaimer banner:
    ```tsx
    <div className="logs-disclaimer" role="note">
      <p>This tab contains raw technical output. For a human-readable summary, see the Summary tab.</p>
      <button type="button" className="logs-disclaimer-link" onClick={() => onSwitchTab("summary")}>
        → Switch to Summary tab
      </button>
    </div>
    ```
  - [x] G.4.4 Download handler:
    ```tsx
    const handleDownload = (run: Run) => {
      const content = run.logTail ?? "";
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `omni-agent-${taskId}-run${run.runNumber}.log`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
    ```
  - [x] G.4.5 Filter logic:
    ```tsx
    const filteredRuns = selectedRunFilter === "all"
      ? runs
      : runs.filter((r) => r.id === selectedRunFilter);
    ```

### H. Frontend wiring trong TaskDetailPanel

- [x] **Task H.1 — Refactor `TaskDetailPanel.tsx` tab content** (AC: 2, 4, 5, 8, 11)
  - [x] H.1.1 Replace placeholder content (dòng 264–289 hiện tại) bằng:
    ```tsx
    {activeTab === "comments" && (
      <CommentsTabPanel task={task} projectId={project.id} onSwitchTab={handleSwitchTab} />
    )}
    {activeTab === "runs" && (
      <RunsTabPanel task={task} projectId={project.id} onSwitchTab={handleSwitchTab} />
    )}
    {activeTab === "logs" && (
      <LogsTabPanel
        task={task}
        projectId={project.id}
        focusedRunId={focusedRunId}
        clearFocusedRunId={() => setFocusedRunId(null)}
        onSwitchTab={handleSwitchTab}
      />
    )}
    ```
  - [x] H.1.2 **KHÔNG đổi** Summary tab content (Story 3.5a invariant).
  - [x] H.1.3 **KHÔNG đổi** Settings tab (placeholder OK).
  - [x] H.1.4 **KHÔNG đổi** Header / ActionBar / SessionPanel / Tab bar / close behavior.
  - [x] H.1.5 Thêm state `const [focusedRunId, setFocusedRunId] = useState<string | null>(null);` cùng `activeTab` state.

### I. CSS files cho 3 tab panels

- [x] **Task I.1 — Style CSS** (AC: 2, 4, 5, 9)
  - [x] I.1.1 Quyết định: tạo 3 file CSS riêng (`CommentsTabPanel.css`, `RunsTabPanel.css`, `LogsTabPanel.css`) hoặc extend `TaskDetailPanel.css`.
  - [x] I.1.2 Class names:
    - **Comments:** `.comment-thread-item`, `.comment-thread-header`, `.comment-thread-author`, `.comment-thread-timestamp`, `.comment-thread-content`, `.comment-thread-status`, `.comment-thread-status--sent`, `.comment-thread-status--pending`, `.comment-input-section`, `.comment-input-textarea`, `.comment-input-hint`.
    - **Runs:** `.run-list`, `.run-list-row`, `.run-list-row-number`, `.run-list-row-agent`, `.run-list-row-status`, `.run-list-row-status--running`, `.run-list-row-status--completed`, `.run-list-row-status--failed`, `.run-list-row-dot`, `.run-list-row-detail`, `.run-list-row-field`.
    - **Logs:** `.logs-disclaimer`, `.logs-disclaimer-link`, `.logs-filter`, `.logs-section`, `.logs-section-header`, `.logs-section-pre`, `.logs-section-download`.
  - [x] I.1.3 Reuse CSS variables — KHÔNG hardcode.
  - [x] I.1.4 Specifically font-size 13px cho `.logs-section-pre` (epic AC dòng 739 mandatory).
  - [x] I.1.5 Specifically font-family monospace cho `.logs-section-pre` (`ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace`).

### J. Tests: TaskDetailPanel.test.tsx extension

- [x] **Task J.1 — Extend `TaskDetailPanel.test.tsx` với TC1–TC6 + TR1–TR6** (AC: 2, 3, 4, 5, 8, 10, 11)
  - [x] J.1.1 Thêm mocks ở đầu file (extend mocks của 3.5a):
    ```ts
    vi.mock("../../api/comments", () => ({
      listComments: vi.fn(),
      addComment: vi.fn(),
    }));
    vi.mock("../../api/runs", () => ({
      listRuns: vi.fn(),
      getRun: vi.fn(),
    }));
    ```
  - [x] J.1.2 Helper `makeComment(overrides)` + `makeRun(overrides)` để tạo fixtures.
  - [x] J.1.3 Implement TC1–TC6 (Comments Tab tests):
    - Default mock returns: `listComments.mockResolvedValue([])` để tránh test cũ break.
    - Setup mỗi test với specific mocks.
  - [x] J.1.4 Implement TR1–TR6 (Runs Tab tests):
    - Default mock returns: `listRuns.mockResolvedValue([])`.
    - Test TR5 (`View Logs`): assert `screen.getByText(...)` xác minh Logs Tab content visible sau click.
    - Test TR6 (`View Timeline`): assert RunTimeline visible (`screen.getByRole("list", { name: /Timeline for Run #/ })`).
  - [x] J.1.5 **KHÔNG sửa** test cases cũ của Story 2.4 + Story 3.1 + Story 3.5a (T1–T12 hoặc tên gì 3.5a chose).

- [x] **Task J.2 — Implement RunTimeline.test.tsx (TT1–TT6)** đã list ở Task F.3 — KHÔNG duplicate ở đây.

### K. Lint, typecheck, regression verification

- [x] **Task K.1 — Backend verification** (AC: 11)
  - [x] K.1.1 `cd backend && cargo fmt --check && cargo clippy -- -D warnings && cargo test` — tất cả pass.
  - [x] K.1.2 Verify Story 3.3 + 3.4's test files (`comments_test.rs` POST tests, `runs_test.rs`) — pass without modification.
  - [x] K.1.3 Số test mới expected: ≥ 5 integration tests trong `comments_test.rs` (BC1–BC5 + regression test) + ≥ 1 cross-task isolation test.

- [x] **Task K.2 — Frontend verification** (AC: 11)
  - [x] K.2.1 `cd frontend && pnpm typecheck && pnpm lint` — pass (verify command qua `package.json` "scripts"; nếu repo dùng `npm` thì dùng `npm run typecheck`).
  - [x] K.2.2 `cd frontend && pnpm test` — tất cả pass (existing + new).
  - [x] K.2.3 Số test mới expected: ≥ 12 test cases mới trong `TaskDetailPanel.test.tsx` (TC1–TC6 + TR1–TR6) + ≥ 6 test cases trong `RunTimeline.test.tsx` (TT1–TT6).
  - [x] K.2.4 No regression: existing test suite TaskCard, StatusBadge, Button, Toast, EmptyState, AgentAvatar, ConfirmationDialog, CreateTaskModal, AppShell, TopBar — pass.

### L. Sprint status + Documentation

- [x] **Task L.1 — Update sprint status** (workflow requirement)
  - [x] L.1.1 `_bmad-output/implementation-artifacts/sprint-status.yaml`: `3-5b-comments-runs-and-logs-tabs-and-runtimeline: backlog` → `ready-for-dev`. `last_updated` → current datetime.
  - [x] L.1.2 KHÔNG đổi status story khác trong sprint.

- [x] **Task L.2 — Verification gates trước khi report Done** (workflow requirement)
  - [x] L.2.1 Tất cả AC-1 đến AC-11 đã được satisfy bằng implementation + tests.
  - [x] L.2.2 PR description liệt kê các files changed/added theo bảng "File List" ở dưới.
  - [x] L.2.3 Project notes: nếu repo có `./bin/pnotes` available, tạo continuity note trước khi mark Done. Note nội dung tối thiểu:
    - Decision: GET comments endpoint mới, refactor `POST .../comments` route thành combined `get().post()`.
    - Decision: RunTimeline derive events từ Run table fields only — KHÔNG parse log content (defer event parsing to future story).
    - Decision: Logs Tab download = tail blob (logTail field) — full log streaming deferred.
    - Trap: `focusedRunId` state phải clear sau mount để tránh sticky cross-tab behavior.
    - Trap: Comments Tab disabled cho task.status terminal (done/cancelled) — preempt backend 409.
    - Missing tests (deferred): full log streaming, event parsing per agent (Claude JSON vs Codex), dark theme logs tab.


### Architecture compliance

**File locations (theo `architecture.md` §"Project Directory Structure" dòng 415–522):**
- `backend/src/services/comments.rs` — EXTEND (Story 3.3 sở hữu; 3.5b thêm `list_comments_for_task`).
- `backend/src/handlers/comments.rs` — EXTEND (Story 3.3 sở hữu; 3.5b thêm `list_comments`).
- `backend/src/main.rs` — UPDATE (refactor POST-only route thành combined `get().post()`).
- `backend/tests/comments_test.rs` — EXTEND (3.3 sở hữu; 3.5b thêm BC1–BC5 + regression tests).
- `frontend/src/api/comments.ts` — EXTEND (3.3 sở hữu; 3.5b thêm `listComments`).
- `frontend/src/hooks/useCommentList.ts` — NEW.
- `frontend/src/hooks/useAddComment.ts` — NEW.
- `frontend/src/hooks/useRunList.ts` — NEW.
- `frontend/src/components/RunTimeline.tsx` — NEW (architecture đã list dòng 457).
- `frontend/src/components/RunTimeline.css` — NEW.
- `frontend/src/components/RunTimeline.test.tsx` — NEW (co-located).
- `frontend/src/features/detail/CommentsTabPanel.tsx` — NEW (architecture list dòng 472).
- `frontend/src/features/detail/RunsTabPanel.tsx` — NEW (architecture list dòng 473).
- `frontend/src/features/detail/LogsTabPanel.tsx` — NEW (architecture list dòng 474).
- `frontend/src/features/detail/CommentsTabPanel.css`, `RunsTabPanel.css`, `LogsTabPanel.css` — NEW (mỗi tab có CSS riêng) hoặc extend `TaskDetailPanel.css`.
- `frontend/src/features/detail/TaskDetailPanel.tsx` — UPDATE (replace placeholder tab content).
- `frontend/src/features/detail/TaskDetailPanel.test.tsx` — EXTEND (3.5a sở hữu; 3.5b thêm TC1–TC6 + TR1–TR6).
- `frontend/src/utils/time.ts` — NEW (helpers `formatRelativeTime`, `formatDuration`). Architecture chưa list utils folder; tạo mới theo convention.

**KHÔNG được tạo module mới ngoài danh sách trên** (architecture là single source of truth).

### Library / framework constraints

Story 3.5b KHÔNG thêm crate Rust mới. Tất cả đã có từ Story 3.1/3.2/3.3/3.4.
Story 3.5b KHÔNG thêm npm package mới. Tất cả đã có:
- `@tanstack/react-query` 5.100.11 (đã có từ Story 1.x).
- `react` ^19.2.6 / `react-dom` ^19.2.6 (đã có).
- `react-router` ^7.15.1 (đã có).
- KHÔNG thêm date-fns hoặc dayjs — `formatRelativeTime` / `formatDuration` self-implement đủ cho MVP (lines of code khoảng 30 — thêm dependency không justify).

### State management decisions

- `expandedRunId`, `showTimelineForRunId` (RunsTabPanel): local state với `useState`. KHÔNG dùng URL params (overkill cho MVP).
- `selectedRunFilter` (LogsTabPanel): local state. KHÔNG dùng URL params.
- `focusedRunId` (TaskDetailPanel): local state, clear sau 1 tick để tránh sticky.
- `inputText` (CommentsTabPanel textarea): local state với `useState`.
- TanStack Query cache keys:
  - `["comments", projectId, taskId]` — comments list.
  - `["runs", projectId, taskId]` — runs list (shared giữa Runs + Logs tabs — auto-dedup).
  - `["task", projectId, taskId]` — task detail (đã có từ Story 3.5a polling).

### Backend serialization decisions

- `Comment.sent` field: DB store `i64` (0/1), JSON serialize as `boolean` — custom `Serialize` impl đã có từ Story 3.3 Task A.1.1. KHÔNG đổi.
- `Comment` fields camelCase: `taskId`, `createdAt` (rest of fields đã single word). Reuse Story 3.3 wire struct pattern.

### Frontend formatting helpers

`formatRelativeTime(timestamp: string): string`:
```ts
export function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  if (diffMs < 60_000) return "just now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} min ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}
```

`formatDuration(startedAt: string, endedAt: string | null): string`:
```ts
export function formatDuration(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
```

**Lưu ý:** Cả 2 helper trả về string deterministic per call, nhưng `formatRelativeTime` phụ thuộc `Date.now()` — trong test phải mock với `vi.setSystemTime()` để có output ổn định.

### Critical implementation rules

**TypeScript strict mode (project-context.md §"Language-Specific Rules"):**
- Khai báo type rõ ràng cho mọi prop, state, hook return.
- KHÔNG dùng `any` — nếu cần, dùng `unknown` + type guard.

**React Layout (project-context.md §"React — Layout"):**
- Task Detail dùng slide-in panel — KHÔNG thay đổi (Story 3.5b chỉ chạm bên trong panel).
- Action buttons theo `task.status` — vẫn theo bảng mapping của project-context. RunTimeline suggested action block chỉ render khi failed/cancelled, KHÔNG override ActionBar logic ở header.

**TanStack Query polling pattern (architecture.md dòng 238–246):**
- `refetchInterval` là callback `(query) => task.status === "running" ? 5000 : false` — KHÔNG hardcode 5000 trực tiếp.

**Error envelope (architecture.md dòng 201):**
- Backend trả `{ "error": "<code>", "message": "<human text>" }` — đã thiết lập từ Story 1.x. Frontend xử lý qua `ApiError` class (`frontend/src/api/client.ts`).

### Deferred Work (out-of-scope cho 3.5b)

1. **Full log file streaming endpoint** (`GET .../runs/{run_id}/log`): để stream full log file từ `logPath` thay vì chỉ tail. Cần evaluate security (path traversal) + performance (file >100MB?). → Story riêng (3.5c hoặc Epic 4).
2. **Per-agent event parsing** (file_read, test_run, command_exec, etc.): RunTimeline hiện chỉ render 3 events derived từ Run table. Để parse structured events, cần:
   - Claude: parse JSON lines từ stdout.
   - Codex: parse text patterns (regex). → Story riêng khi có time/scope.
3. **Logs Tab dark theme**: UX spec dòng 641 đề cập dark/light option. MVP chỉ light theme. → Theme toggle khi Epic 4 NFR-6 accessibility pass.
4. **Logs Tab Level filter + Search**: UX spec dòng 639 đề cập. MVP chỉ có Run filter. → Iteration sau khi có agent log format chuẩn (structured logs).
5. **Comment author field** (`createdBy`): hiện tại single-user MVP nên hardcode "You". Khi có user model (multi-user / SaaS) → migration thêm `created_by` column.
6. **Live mode pause/resume button** (UX spec dòng 742 `[Pause refresh]`): MVP không cho user control polling rate. → Khi user feedback show muốn control.
7. **Run cancel button trong Runs Tab**: hiện task cancel button ở ActionBar (Story 3.2). Per-run cancel chưa cần — chỉ 1 run active tại một thời điểm per task. → Defer.

### Testing standards

**Rust (project-context.md §"Testing Rules"):**
- Integration tests trong `backend/tests/` directory.
- DB tests dùng in-memory SQLite hoặc temp DB (`tempfile::TempDir` đã có pattern từ 3.4).
- KHÔNG spawn subprocess thật trong tests (comments không spawn subprocess — N/A).

**React (project-context.md §"Testing Rules"):**
- Test file co-located: `ComponentName.test.tsx`.
- Test behavior từ góc độ user — dùng RTL query (`getByRole`, `getByLabelText`, `getByPlaceholderText`, `getByText`).
- Mock API calls (vi.mock).
- KHÔNG test implementation details (class names, state object directly).

### Previous story intelligence

**Từ Story 3.5a (in `ready-for-dev`, not yet merged):**
- TaskDetailPanel.tsx có thể đã được refactor tách `SummaryTab.tsx` (Option A vs B trong Story 3.5a Task D.1.1). Story 3.5b cần verify pattern và follow.
- `useTask` polling pattern đã thiết lập với `refetchInterval`. Story 3.5b's `useRunList` follow cùng pattern.
- `agentLabel` helper đã có (`task.agent === "claude" ? "Claude CLI" : "Codex CLI"`). Story 3.5b reuse — KHÔNG copy-paste; nếu chưa export → export từ utility file.
- `formatStatusLabel` đã có trong 3.5a. Story 3.5b's run status label (Running/Completed/Failed) khác — đừng confuse.

**Từ Story 3.3 (ready-for-dev):**
- `Comment` model + `Serialize` impl (boolean conversion) đã thiết lập.
- `addComment` API client + `useResumeSession` hook đã có.
- `POST .../comments` route mount riêng — Story 3.5b refactor thành combined `get().post()`. Verify Story 3.3's tests pass sau refactor.

**Từ Story 3.4 (ready-for-dev):**
- `Run` model + `listRuns` + `getRun` API clients đã thiết lập.
- Log dual-storage: file `~/.omni-agent/logs/{task_id}/{run_id}.log` + DB `log_tail` (last 100 lines / 10KB).
- `log_tail` có thể chứa stderr lines prefixed `[stderr]` — Logs Tab `<pre>` render preserve whitespace nên lines này xuất hiện đúng.

### Git intelligence

**Recent commits trong epic 3:**
- `feat(session): implement cancel session functionality with graceful shutdown and exit detection` (ce70657) — Story 3.2 implementation merged.
- `docs(story): create 3-5a-session-summary-tab-and-optimistic-resume-ui` (52d8de3) — Story 3.5a story created.
- `docs(story): create 3-4-run-log-dual-storage` (a45dba0) — Story 3.4 story created.
- `docs(story): create 3-3-resume-session-and-comment-tracking` — Story 3.3 story created.

**Patterns observed:**
- Story creation PRs chỉ chứa 2 files: story `.md` + `sprint-status.yaml` update. KHÔNG có code changes.
- Implementation PRs thường có 10–30 files (backend services/handlers/tests + frontend components/hooks/tests).
- Tests location consistent: backend `tests/` + frontend co-located `*.test.tsx`.

### Latest technical specifics

Không có technical area nào yêu cầu research latest version cho 3.5b:
- React 19.2 + TanStack Query 5.100 — đã pinned trong `frontend/package.json`. 3.5b dùng API stable.
- Vitest 4.1 — mature test framework, no breaking changes affecting test patterns.
- Axum routing — `get().post()` chain pattern stable từ axum 0.6+.
- SQLite ORDER BY ASC/DESC — standard SQL, no version concerns.

### Project Structure Notes

**Alignment với architecture.md:** Story 3.5b's file list (Dev Notes §"Architecture compliance") khớp hoàn toàn với architecture's `Project Directory Structure` (dòng 415–522). Files mới đều đã được architecture pre-allocate (RunTimeline.tsx, CommentsTab.tsx, RunsTab.tsx, LogsTab.tsx).

**Detected variance:** Architecture dòng 472–474 list `CommentTab.tsx`, `RunsTab.tsx`, `LogsTab.tsx` (singular "Tab"); 3.5b chọn naming `*TabPanel.tsx` để rõ ràng hơn (Tab vs TabPanel — Tab là button trong tab bar, TabPanel là content area). **Lý do:** consistent với React aria attributes (`role="tab"` vs `role="tabpanel"`). KHÔNG có file conflict — architecture's intent is preserved.

### References

- `_bmad-output/planning-artifacts/epics.md#Story 3.5b: Comments, Runs & Logs Tabs + RunTimeline` (dòng 709–745) — Source of AC-1 đến AC-11.
- `_bmad-output/planning-artifacts/epics.md#FR-8` (dòng 36) — Run Log dual-storage requirement.
- `_bmad-output/planning-artifacts/epics.md#FR-9, FR-10` (dòng 38, 40) — Comments requirements.
- `_bmad-output/planning-artifacts/epics.md#FR-11` (dòng 42) — Task Detail tabs requirement.
- `_bmad-output/planning-artifacts/epics.md#NFR-6` (dòng 58) — Accessibility.
- `_bmad-output/planning-artifacts/epics.md#NFR-8` (dòng 62) — Polling 5s khi running.
- `_bmad-output/planning-artifacts/epics.md#UX-DR13` (dòng 111) — Comments Tab spec.
- `_bmad-output/planning-artifacts/epics.md#UX-DR14` (dòng 113) — Runs Tab spec.
- `_bmad-output/planning-artifacts/epics.md#UX-DR15` (dòng 115) — RunTimeline spec.
- `_bmad-output/planning-artifacts/epics.md#UX-DR16` (dòng 117) — Logs Tab spec.
- `_bmad-output/planning-artifacts/ux-design-specification.md#Tab: Comments` (dòng 580–595).
- `_bmad-output/planning-artifacts/ux-design-specification.md#Tab: Runs` (dòng 599–614).
- `_bmad-output/planning-artifacts/ux-design-specification.md#Tab: Logs` (dòng 631–641).
- `_bmad-output/planning-artifacts/ux-design-specification.md#Agent Run Timeline` (dòng 651–768).
- `_bmad-output/planning-artifacts/ux-design-specification.md#6.5 Event Label Mapping` (dòng 720–737).
- `_bmad-output/planning-artifacts/architecture.md#API & Communication Patterns` (dòng 195–226).
- `_bmad-output/planning-artifacts/architecture.md#Frontend Architecture` (dòng 230–246).
- `_bmad-output/planning-artifacts/architecture.md#Project Directory Structure` (dòng 415–522).
- `_bmad-output/project-context.md#Critical Implementation Rules` — Language/Framework rules.
- `_bmad-output/implementation-artifacts/3-3-resume-session-and-comment-tracking.md` — Story 3.3 source for `Comment` model + `POST .../comments`.
- `_bmad-output/implementation-artifacts/3-4-run-log-dual-storage.md` — Story 3.4 source for `Run` model + `GET .../runs`.
- `_bmad-output/implementation-artifacts/3-5a-session-summary-tab-and-optimistic-resume-ui.md` — Story 3.5a source for TaskDetailPanel patterns.

---

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
