---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - "_bmad-output/planning-artifacts/prds/prd-omni-agent-2026-05-20/prd.md"
  - "docs/US-omni-agent.md"
---

# UX Design Specification — omni-agent

**Author:** Loc
**Date:** 2026-05-20

---

## Executive Summary

### Project Vision

omni-agent là task board dành riêng cho AI CLI agents. Thay vì quản lý chat hay conversation, người dùng quản lý *task* — mỗi task được gắn với một session thực của Codex hoặc Claude CLI. Khi muốn làm tiếp, người dùng mở task, gõ comment, và app tự resume đúng session cũ.

Điểm khác biệt cốt lõi: **Session-as-Asset** — mỗi task sở hữu một agent session có thể resume bất kỳ lúc nào. Agent session là "working memory" của task.

### Target Users

**Primary Persona: Developer cá nhân (Loc)**
- Thường xuyên dùng Codex và Claude CLI để xử lý nhiều task song song
- Làm việc trên máy local, không cần multi-user hay cloud sync
- Điểm đau: mất track context giữa các session khi chuyển qua lại giữa task

**Jobs To Be Done:**
- Biết ngay task nào đang ở trạng thái nào mà không cần mở terminal
- Resume đúng agent session của một task cụ thể mà không cần nhớ session ID
- Gửi thêm chỉ dẫn cho agent mà không phải bắt đầu lại từ đầu
- Quản lý nhiều task song song mà không bị lẫn context

### Key Design Challenges

1. **Trừu tượng hóa sự phức tạp của session** — Session ID, subprocess lifecycle, per-agent resume format phải hoàn toàn ẩn đi. Người dùng chỉ thấy task và trạng thái.
2. **Interruption recovery UX** — Sau bất kỳ khoảng thời gian vắng mặt, người dùng phải trả lời được "tôi đang ở đâu, cái gì bị block, cái gì đang chờ tôi" trong vòng 3 giây khi mở board.
3. **Action clarity theo trạng thái** — Mỗi trạng thái task có một tập action buttons khác nhau. Phải tránh confusion và error.
4. **Không overpromise resume** — "Resume session" thực ra có thể là re-spawn với serialized context. UX copy phải phản ánh đúng thực tế.

### Design Opportunities

1. **Workflow friction-free** — "Mở task → gõ comment → bấm Resume" phải là flow 3 bước đơn giản nhất có thể.
2. **Situational awareness dashboard** — Mỗi task card phải trả lời "tôi cần làm gì với task này ngay bây giờ?" mà không cần click vào.
3. **Enterprise SaaS aesthetic** — UI phù hợp cả developer lẫn project manager, không phải terminal wrapper.

---

## 1. Định Hướng Thiết Kế

### 1.1 Triết Lý Thiết Kế

OmniAgent là công cụ quản lý công việc AI chuyên nghiệp cấp doanh nghiệp. Giao diện phải phản ánh sự tin cậy, rõ ràng và hiệu quả — không phải sự hào nhoáng kỹ thuật.

**Ba nguyên tắc cốt lõi:**

1. **Clarity First** — Người dùng phải biết "tôi cần làm gì tiếp theo" trong vòng 3 giây khi mở app. Mỗi màn hình có một mục đích chính. Thông tin kỹ thuật mặc định bị ẩn.
2. **Status Confidence** — Trạng thái task phải được truyền đạt ngay lập tức qua màu sắc, badge, và language đơn giản. Không bao giờ buộc người dùng phải suy luận xem task đang ở bước nào.
3. **Human-in-the-Loop** — Những điểm cần con người ra quyết định (review, approve, unblock) phải được ưu tiên hiển thị nổi bật. Agent activity là nền; human decisions là foreground.

**Định hướng visual:**
- Mental model: Linear + GitHub Projects + enterprise admin dashboard
- Không phải: terminal emulator, cyberpunk, gaming, developer-only tool
- Dùng được cho cả developer lẫn project manager không có technical background

### 1.2 Visual System

#### Typography

| Role | Style | Specs |
|------|-------|-------|
| Heading L | Semibold | 20px / line-height 28px |
| Heading M | Semibold | 16px / line-height 24px |
| Heading S | Medium | 14px / line-height 20px |
| Body | Regular | 14px / line-height 20px |
| Body S | Regular | 13px / line-height 18px |
| Caption | Regular | 12px / line-height 16px |
| Mono | Regular | 13px / line-height 20px — chỉ dùng trong Logs/Technical tab |

Font stack: `Inter, Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

#### Color System

**Neutrals:**
- `--bg-app`: `#F4F5F7` — nền toàn app
- `--bg-card`: `#FFFFFF` — card, panel, sidebar
- `--bg-hover`: `#F0F1F3` — hover state
- `--border`: `#E4E5E7` — border nhẹ
- `--border-strong`: `#D1D2D4` — border rõ hơn
- `--text-primary`: `#111827`
- `--text-secondary`: `#6B7280`
- `--text-disabled`: `#9CA3AF`
- `--text-inverse`: `#FFFFFF`

**Brand:**
- `--brand-primary`: `#4F46E5` — Indigo 600
- `--brand-hover`: `#4338CA` — Indigo 700
- `--brand-light`: `#EEF2FF` — Indigo 50

**Status Colors:**

| Status | Background | Text | Border |
|--------|-----------|------|--------|
| Created / Draft | `#F3F4F6` | `#6B7280` | `#E5E7EB` |
| Ready | `#EFF6FF` | `#1D4ED8` | `#BFDBFE` |
| Assigned | `#EEF2FF` | `#4338CA` | `#C7D2FE` |
| Running | `#F5F3FF` | `#6D28D9` | `#DDD6FE` |
| Needs Review | `#FFFBEB` | `#B45309` | `#FDE68A` |
| Changes Requested | `#FFF7ED` | `#C2410C` | `#FED7AA` |
| Completed | `#F0FDF4` | `#15803D` | `#BBF7D0` |
| Blocked / Failed | `#FEF2F2` | `#DC2626` | `#FECACA` |
| Cancelled | `#F9FAFB` | `#9CA3AF` | `#F3F4F6` |

**Severity Colors (Review):**
- Critical: `#DC2626` · High: `#EA580C` · Medium: `#D97706` · Low: `#2563EB` · Info: `#6B7280`

#### Spacing Scale

```
4px  — badge internal padding
8px  — compact gap, list item
12px — card padding S
16px — card padding M, section gap S
20px — section gap M
24px — card padding L, panel section gap
32px — layout section gap
40px — page section gap
```

#### Border Radius

- `--radius-sm`: 4px — badge, chip
- `--radius-md`: 8px — card, input, button
- `--radius-lg`: 12px — panel, modal
- `--radius-xl`: 16px — sidebar, sheet

#### Elevation

- `--shadow-sm`: `0 1px 2px rgba(0,0,0,0.06)` — card resting
- `--shadow-md`: `0 4px 8px rgba(0,0,0,0.08)` — card hover, dropdown
- `--shadow-lg`: `0 12px 24px rgba(0,0,0,0.10)` — modal, right panel
- `--shadow-focus`: `0 0 0 3px rgba(79,70,229,0.25)` — focus ring

#### Iconography

Stroke-based icons (Lucide, Heroicons, hoặc tương đương). Sizes: 16px (inline), 20px (button), 24px (nav). Không dùng icon filled hay quá phức tạp.

#### Information Density

Medium density — không ultra-compact như Jira, không spacious như consumer app.

---

## 2. Layout Tổng Thể (AppShell)

### 2.1 Cấu Trúc Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  TopBar (height: 52px, full width, sticky)                      │
├──────────┬──────────────────────────────────────┬───────────────┤
│          │                                      │               │
│ Sidebar  │        Main Work Area                │  Detail Panel │
│ (220px   │   (flex-grow, min-width 640px)       │  (420px,      │
│  fixed)  │                                      │  slide-in)    │
│          │                                      │               │
└──────────┴──────────────────────────────────────┴───────────────┘
```

- **TopBar**: fixed top, z-index cao, background `--bg-card`, border-bottom `--border`
- **Sidebar**: fixed left, scrollable, background `--bg-card`, border-right `--border`
- **Main Work Area**: scrollable, background `--bg-app`, padding 24px
- **Detail Panel**: slide in từ phải, overlay trên mobile, side-by-side trên desktop ≥ 1280px

### 2.2 Sidebar

**Kích thước:** 220px wide, full height, fixed

**Cấu trúc từ trên xuống:**

```
[Logo / App Name]          ← 52px, align với TopBar
─────────────────
[Project Switcher]         ← dropdown, tên project + icon mũi tên
─────────────────
  📊 Dashboard
  📥 Inbox           [3]   ← badge đỏ số notifications chưa đọc
  ─────────────────
  TASKS                    ← section header, 11px uppercase
  📋 All Tasks
  ✅ My Tasks
  🔍 Review Queue    [2]   ← badge amber khi có pending reviews
  ─────────────────
  AGENTS
  🤖 Agents
  ▶  Sessions
  ─────────────────
  PROJECT
  📁 Settings
─────────────────
[User Avatar + Name]       ← bottom, user menu trigger
```

**Sidebar item specs:**
- Height: 34px · Padding: 8px 12px · Border-radius: 6px
- Active: background `--brand-light`, text `--brand-primary`, font-weight 500
- Hover: background `--bg-hover`
- Section header: 11px uppercase, letter-spacing 0.08em, color `--text-disabled`

**Notification badge:** Rounded pill, background red `#EF4444` / amber `#F59E0B`, white text 11px bold, padding 2px 6px.

### 2.3 TopBar

**Kích thước:** 52px height, full width, fixed

**Layout (left → right):**
```
[Logo — 220px] | [Breadcrumb] | [spacer] | [Search] [+ New Task] [🔔] [Avatar]
```

**Project Switcher:** Project icon (2-char abbreviation, project color) + name + `⌄`. Dropdown có search + "New Project" option.

**Search Box:** Width 240px, expand to 360px on focus. Placeholder "Search tasks, agents, sessions…". Shortcut `⌘K` shown when unfocused. Results dropdown grouped by Tasks / Agents / Sessions.

**New Task Button:** Primary filled indigo. Label "+ New Task". Opens Create Task modal.

**Notification Bell:** Badge đỏ khi có unread. Click → dropdown notifications.

**User Avatar:** 32px circle. Click → Profile / Preferences / Sign out.

### 2.4 Main Work Area Views

| View | Route | Mô tả |
|------|-------|-------|
| Dashboard | `/dashboard` | Morning overview |
| Task Board | `/board` | Kanban view |
| Task List | `/tasks` | Table/list view |
| Review Queue | `/reviews` | Pending reviews |
| Session Monitor | `/sessions` | Active sessions |
| Agent Config | `/agents` | Agent setup |
| Settings | `/settings` | App settings |

---

## 3. Màn Hình: Morning Dashboard

### 3.1 Mục Đích

Màn hình mặc định khi mở app. Trong vòng 5 giây, người dùng biết: task nào cần xử lý ngay, agent nào đang chạy, có gì bị lỗi/block, và cần làm gì tiếp theo.

**Nguyên tắc:** Dashboard KHÔNG bao giờ mở đầu bằng log kỹ thuật, raw output, hay session ID.

### 3.2 Layout Dashboard

**Page header:**
```
Good morning, Loc 👋                        Wednesday, May 20
You have 2 tasks needing review and 1 blocked task.
```

**Section order (ưu tiên từ trên xuống):**
1. Needs Your Review ← **Ưu tiên cao nhất**
2. Failed & Blocked
3. Running Sessions
4. Ready to Assign
5. Recent Agent Activity
6. Completed Recently

**Stats bar (optional, dưới greeting):**
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Active      │ │  Needs       │ │  Running     │ │  Completed   │
│  Tasks  12   │ │  Review   2  │ │  Agents   1  │ │  Today    1  │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```
Small cards, text-only, border `--border`, no shadow.

### 3.3 Section: Needs Your Review

```
Needs Your Review                                    [View all →]
2 tasks waiting for your decision
```

**Review Task Card (320px wide, horizontal scroll row):**
```
┌─────────────────────────────────────────────────┐
│ [⚑ NEEDS REVIEW]                               │
│                                                 │
│ Refactor audit event partitioning               │
│ ERP-CB-CENTRES · planner / Claude CLI           │
│                                                 │
│ 3 findings · Highest: ⚠ Medium                 │
│ Agent completed 45 min ago                      │
│                                                 │
│ [Open Review]                     [Dismiss]     │
└─────────────────────────────────────────────────┘
```

### 3.4 Section: Failed & Blocked

```
Failed & Blocked                                    [View all →]
1 task needs attention
```

**Failed/Blocked Card:**
```
┌─────────────────────────────────────────────────┐
│ [✕ BLOCKED]                                     │
│                                                 │
│ Fix login redirect after token refresh          │
│ ERP-CB-CENTRES · backend-coder / Codex CLI      │
│                                                 │
│ Session terminated unexpectedly                 │
│ Last active: 2 hours ago                        │
│                                                 │
│ [Resume Session]              [View Details]    │
└─────────────────────────────────────────────────┘
```

Reason text là human-readable ("Session terminated unexpectedly") — không phải exit code hay stack trace.

### 3.5 Section: Running Sessions

**Running Session Card:**
```
┌─────────────────────────────────────────────────┐
│ [● RUNNING]  ← violet pulse dot                 │
│                                                 │
│ Fix login redirect after token refresh          │
│ ERP-CB-CENTRES                                  │
│ backend-coder  ·  Codex CLI                     │
│ Started 12 min ago · Step: Editing files        │
│                                                 │
│ [View Progress]                                 │
└─────────────────────────────────────────────────┘
```

"Step" lấy từ last timeline event — human-readable, không có command hay path kỹ thuật.

### 3.6 Section: Ready to Assign

**Compact list items (không phải card full):**
```
● Improve Dice Monsters game UI layout     Dice Monsters    [Assign Agent →]
● Create harness planner brief             harness-eng      [Assign Agent →]
```
Height 48px, border-bottom `--border`.

### 3.7 Section: Recent Agent Activity

**Activity feed:**
```
[BC]  backend-coder finished Run #3 on "Fix login redirect"          10 min ago
[P]   planner completed review on "Refactor audit event"              45 min ago
[FC]  frontend-coder requested changes on "Dice Monsters UI"          2 hrs ago
[H]   harness-planner completed "Create harness planner brief"        3 hrs ago
```
Agent avatar 24px, plain-language activity text, relative time. Không có session ID hay command.

### 3.8 Section: Completed Recently

```
✓ Create harness planner brief             harness-eng    Completed 3 hrs ago
✓ Setup database migration pipeline        ERP-CB         Completed 8 hrs ago
```

---

## 4. Màn Hình: Task Board (Kanban)

### 4.1 Layout

**Toolbar (sticky dưới TopBar):**
```
[Task Board ▾]  [Filter: All Projects ▾]  [Group by: Status ▾]  [+ New Task]
```

**8 columns (horizontal scroll, mỗi column 280px):**

| Column | Color scheme |
|--------|-------------|
| Backlog | Gray |
| Ready | Blue |
| Assigned | Indigo |
| Running | Violet + pulse dot |
| Needs Review | Amber |
| Changes Requested | Orange |
| Completed | Green |
| Blocked | Red |

Column header: status dot 6px + name + count `(N)`. Height 40px.

### 4.2 Task Card

```
┌─────────────────────────────────────┐
│ [PROJECT TAG]          [AGENT CHIP] │
│                                     │
│ Task Title Here                     │
│ Truncate at 2 lines                 │
│                                     │
│ [Runtime badge]    [Session badge]  │
│                                     │
│ ● 2 comments  ⚑ 3 findings  2h ago │
└─────────────────────────────────────┘
```

**Card specs:** White bg, 1px `--border`, radius 8px, padding 12px, `--shadow-sm`.
Hover: `--shadow-md`, `--border-strong`. Selected: 2px `--brand-primary` border, `--brand-light` bg.

**Fields:**
- **Project tag**: pill badge, project color + project key (e.g. "ERP-CB")
- **Agent chip**: agent name + 14px avatar circle
- **Task title**: Body 500, max 2 lines, ellipsis
- **Runtime badge**: "Codex CLI" / "Claude CLI" — gray pill
- **Session badge**: No session (gray dashed) / Active (violet dot) / Resumable (blue) / Closed (gray)
- **Footer**: comments count `● N`, findings count `⚑ N` (amber if > 0), last activity time

**Ví dụ 4 tasks mẫu:**

Card 1 — Running:
```
[ERP-CB]              [backend-coder]
Fix login redirect after token refresh
[Codex CLI]           [● Active]
● 1 comment                      12m
```

Card 2 — Needs Review:
```
[ERP-CB]                  [planner]
Refactor audit event partitioning
[Claude CLI]          [Resumable]
● 0 comments  ⚑ 3 findings   45m
```

Card 3 — Changes Requested:
```
[DICE]            [frontend-coder]
Improve Dice Monsters game UI layout
[Codex CLI]           [Resumable]
● 2 comments  ⚑ 1 finding     2h
```

Card 4 — Completed:
```
[HARNESS]        [harness-planner]
Create harness planner brief
[Codex CLI]              [Closed]
● 0 comments                   3h
```

### 4.3 Drag & Drop

- Card drag sang column khác → thay đổi trạng thái
- Dragging: ghost opacity 50%, target column dashed border highlight
- Invalid drop (ngược lifecycle): snap về vị trí cũ + toast "This transition is not allowed"

### 4.4 Filter Chips

Khi filter active:
```
[Filtered by: ERP-CB-CENTRES ×]  [Agent: backend-coder ×]  [Clear all]
```

---

## 5. Task Detail Panel

### 5.1 Trigger & Animation

- **Trigger:** Click task card bất kỳ
- **Animation:** Slide in từ phải, 200ms ease-out
- **Đóng:** `×` button, click ngoài panel, hoặc `Esc`
- **Desktop ≥ 1280px:** 420px side-by-side; **< 1280px:** overlay với backdrop 30%

### 5.2 Panel Header

```
ERP-CB-001                                  [⋯ More]  [×]

Fix login redirect after token refresh

[● RUNNING]  [ERP-CB-CENTRES]  [backend-coder]  [Codex CLI]

Session: Active · Started 12 min ago · Last run 5 min ago
```

- Task ID: Caption `--text-secondary`
- `⋯` menu: Rename, Duplicate, Move to project, Delete (confirm)
- Title: Heading M, font-weight 600
- Session line: 1 line `--text-secondary`

### 5.3 Action Bar (sticky, dưới header)

Action buttons thay đổi theo trạng thái:

| Task Status | Actions |
|-------------|---------|
| Backlog / Draft | Edit Task, Assign Agent |
| Ready | Assign Agent, Edit Task |
| Assigned | Start Session, Edit Task |
| Running | View Progress (no primary action) |
| Paused / Resumable | Resume Session, Add Comment, Mark Done |
| Needs Review | Open Review, Resume Session, Mark Done |
| Changes Requested | Resume Session, Add Comment |
| Completed | (view only — Mark as Incomplete) |
| Blocked / Failed | Resume Session, Reassign Agent, View Error |
| Cancelled | Reopen Task |

`···` overflow: Reassign Agent, Move to Project, Duplicate, Archive, Delete.

### 5.4 Tabs

```
[Summary]  [Comments]  [Runs]  [Artifacts]  [Logs]  [Settings]
```

Default: **Summary**. Tab indicator: 2px underline `--brand-primary`.

**Tab Logs** là technical tab — luôn hiển thị disclaimer khi mở.

---

### Tab: Summary

**Khối 1 — Goal & Current Status:**
```
Goal
─────────────────────────────────────────────
After successful login, redirect user to /dashboard
instead of /home. Ensure logout flow is unaffected.

Current Status
─────────────────────────────────────────────
Agent is currently editing authentication middleware
and running tests. Estimated completion: in progress.
```
"Current Status" là human-readable summary — không phải raw log.

**Khối 2 — Last Agent Summary:**
```
Last Agent Summary                    [Run #3 · 5 min ago]
─────────────────────────────────────────────
Modified: src/auth/redirect.ts, src/auth/middleware.ts
Tests: 12 passed, 0 failed
Next step: Verify logout redirect remains unchanged
```

**Khối 3 — Next Suggested Action:**
```
💡 Review the latest run output and verify acceptance
   criteria are met, then mark as Done or resume.

   [Resume Session]    [Mark Done]
```

**Khối 4 — Acceptance Criteria (checklist):**
```
☐ Login success → redirect to /dashboard
☐ Logout flow unaffected
☐ Test coverage for redirect logic
```
Người dùng có thể manually check/uncheck.

**Khối 5 — Recent Updates:**
```
● Agent completed Run #3                    5 min ago
● You added a comment                      18 min ago
● Session started                          22 min ago
```

---

### Tab: Comments

Thread-style. Comment đã gửi cho agent:
```
[Avatar]  You                              May 20, 8:15 AM
          Check if the fix handles unverified email case.
          [Sent to agent ✓]
```
Pending comment: "Pending · will be sent on next Resume"

**Input:**
```
Add a comment or instruction for the agent...
This comment will be sent to the agent on next resume.
                                        [Add Comment]
```

---

### Tab: Runs

```
Run #3    Codex CLI · backend-coder    ● Running · 5 min
Run #2    Codex CLI · backend-coder    ✓ Completed · 2h ago
Run #1    Codex CLI · backend-coder    ✓ Completed · 3h ago
```

**Expanded run:**
```
▼ Run #2                           Completed · May 20, 8:30 AM
  Input:    "Add handling for unverified email case"
  Output:   Modified 2 files · Tests: 10 passed, 0 failed
  Duration: 4m 22s · Exit: 0 (success)
  [View Timeline]    [View Logs]
```

---

### Tab: Artifacts

```
Artifact                  Type       Run     Size
────────────────────────────────────────────────────
src/auth/redirect.ts      File edit  Run #2  2.4 KB   [View]
src/auth/middleware.ts    File edit  Run #2  1.8 KB   [View]
test-report-run2.json     Report     Run #2  12 KB    [Download]
```
"View" → preview trong modal, không hiển thị raw content mặc định.

---

### Tab: Logs

Disclaimer khi mở:
```
This tab contains raw technical output.
For a human-readable summary, see the Summary tab.
```

Controls: `[Run: All ▾]  [Level: All ▾]  [Search logs...]  [Download]`

Content: monospace 13px, grouped by run. Background `#1E1E1E` (dark) hoặc `#F9FAFB` (light).

---

### Tab: Settings

Rename task, Change project, Reassign agent, Change runtime, Archive, Delete (với confirmation).

---

## 6. Agent Run Timeline

### 6.1 Mục Đích

Hiển thị tiến trình agent dưới dạng timeline dễ đọc — không phải raw log. Người dùng thấy agent đã làm gì và kết quả ở mỗi bước mà không cần đọc terminal output.

**Trigger:** Click "View Timeline" trong Runs tab.
**Placement:** Modal 1000px hoặc dedicated view `/tasks/{id}/runs/{run-id}/timeline`.

### 6.2 Timeline Header

```
← Back

Run #2 · Fix login redirect after token refresh
backend-coder · Codex CLI
May 20, 2026 · 8:30 AM → 8:34 AM (4m 22s) · ✓ Completed
```

### 6.3 Timeline Layout

```
  ●─── Session started                              8:30:12 AM
  │
  ●─── Loaded task brief                            8:30:13 AM
  │
  ●─── Read implementation files (3)                8:30:15 AM ▶
  │    ▼ expanded:
  │      → src/auth/redirect.ts     (read, 148 lines)
  │      → src/auth/middleware.ts   (read, 92 lines)
  │      → src/auth/tests/auth.test.ts (read, 267 lines)
  │
  ●─── Generated implementation plan                8:30:45 AM
  │
  ●─── Edited files (2)                             8:31:02 AM ▶
  │    ▼ expanded:
  │      → Modified src/auth/redirect.ts (+12, -3 lines)
  │      → Modified src/auth/middleware.ts (+5, -1 lines)
  │
  ●─── Ran tests                                    8:33:10 AM ▶
  │    ▼ expanded:
  │      → 10 tests passed · 0 failed
  │      → [View test output] ← opens Logs tab
  │
  ●─── Created summary report                       8:33:58 AM
  │
  ●─── Session completed successfully               8:34:34 AM
```

### 6.4 Step Anatomy

**Collapsed:**
```
  ● Step Name                              HH:MM:SS ▶
```
- Dot: 10px circle, màu theo status
- `▶` chỉ hiện nếu có detail content
- Connecting line: 2px solid `--border`

**Dot colors:** Completed Green `#22C55E` · In progress Violet pulse `#7C3AED` · Failed Red `#DC2626` · Waiting Amber `#F59E0B` · Skipped Gray

**Expanded (click ▶):**
```
  ▼ ● Read implementation files (3)        8:30:15 AM ↑
    → src/auth/redirect.ts   (read, 148 lines)
    → src/auth/middleware.ts (read, 92 lines)
```
Expanded content: `#F9FAFB` bg, border-left 3px `--border-strong`, padding 12px. Raw output LUÔN ẩn — chỉ có "View raw output →" link mở Logs tab.

### 6.5 Event Label Mapping

| Agent Event (raw) | Display Label |
|-------------------|---------------|
| `session_start` | Session started |
| `context_load` | Loaded task brief |
| `file_read` | Read [files] |
| `file_write` / `file_edit` | Edited [files] |
| `test_run` | Ran tests |
| `command_exec` | Executed command |
| `plan_generate` | Generated implementation plan |
| `summary_create` | Created summary report |
| `review_request` | Submitted for review |
| `session_end` | Session completed |
| `session_fail` | Session failed |
| `waiting_input` | Waiting for your input |

Fallback: snake_case → Title Case.

### 6.6 Live Timeline (Running Session)

```
● Live  ·  Auto-refreshing every 5s            [Pause refresh]
```

- Steps completed: hiển thị bình thường
- Step đang chạy: pulse violet dot + "In progress…"
- Steps chưa chạy: chưa hiển thị

Không có spinner hay progress bar liên tục.

### 6.7 Failed Run Timeline

```
  ● Read implementation files (3)             8:30:15 AM ✓
  ● Generated implementation plan             8:30:45 AM ✓
  ✕ Edited files                              8:31:02 AM ▶
    ✕ Error: Permission denied writing to src/auth/redirect.ts
    [View error details →]
  ─ (run terminated)
```

**Suggested action block:**
```
⚠ This run failed at the "Edit files" step.
Common cause: file permission or path error.

[Resume Session]    [View Error Logs]    [Reassign Agent]
```

---

## 7. Màn Hình: Review Queue

### 7.1 Mục Đích

Nơi xử lý tất cả task cần con người ra quyết định: review output của agent, approve thay đổi, hoặc gửi agent chạy lại. Đây là điểm human-in-the-loop quan trọng nhất trong workflow.

### 7.2 Layout

**Page header:**
```
Review Queue                               [Filter ▾]  [Sort ▾]
5 items need your attention
```

**Grouped sections (theo priority):**
```
BLOCKED   (1)
────────────────────────────────────────
[Review item card]

CHANGES REQUESTED   (1)
────────────────────────────────────────
[Review item card]

NEEDS REVIEW   (2)
────────────────────────────────────────
[Review item card]
[Review item card]

NEEDS HUMAN DECISION   (1)
────────────────────────────────────────
[Review item card]
```
Section header: 12px uppercase, letter-spacing 0.08em, `--text-secondary`, border-top `--border`.

### 7.3 Review Item Card

```
┌──────────────────────────────────────────────────────────────────┐
│  [⚑ NEEDS REVIEW]  ERP-CB-CENTRES  ·  planner / Claude CLI      │
│                                                                  │
│  Refactor audit event partitioning                               │
│  Completed 45 min ago · Run #1                                   │
│                                                                  │
│  3 findings  ·  Highest: ⚠ Medium  ·  2 recommendations          │
│                                                                  │
│  "Partitioning logic refactored and tested. 3 edge cases         │
│   identified that may require clarification."                    │
│                                                                  │
│  [Open Review →]           [Dismiss]           [Send Back]       │
└──────────────────────────────────────────────────────────────────┘
```

**Severity indicators:** `● Critical` (red) · `● High` (orange) · `⚠ Medium` (amber) · `● Low` (blue) · `ℹ Info` (gray)

### 7.4 Review Detail View

**Header:**
```
← Back to Review Queue

Refactor audit event partitioning                     [NEEDS REVIEW]
ERP-CB-CENTRES · planner / Claude CLI · Run #1 · May 20, 8:00 AM

[Approve & Close]    [Send Back to Agent]    [Resume with Comment]
```

**Section 1 — Agent Summary:**
```
Agent Summary
──────────────────────────────────────────────────
Partitioning logic for audit events has been refactored.
The new structure separates events by domain (user, system,
billing) into dedicated partitions. All existing tests pass.

3 edge cases identified that may require clarification.
```

**Section 2 — Findings:**

```
Findings (3)                       [Filter: All severities ▾]
──────────────────────────────────────────────────────────────

┌──────────────────────────────────────────────────────────┐
│  ⚠ Medium                                                │
│  Area: src/audit/partition-router.ts:L45                 │
│                                                          │
│  Issue                                                   │
│  All "billing" events route to a single partition        │
│  without considering tenant ID. May cause cross-tenant   │
│  data mixing in multi-tenant deployments.                │
│                                                          │
│  Recommendation                                          │
│  Add tenant_id as secondary partition key for billing    │
│  events. This will require schema migration.             │
│                                                          │
│  [Accept]      [Ignore]      [Send Back to Agent]        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  ℹ Info                                                  │
│  Area: src/audit/retention-policy.ts                     │
│                                                          │
│  Issue                                                   │
│  No retention policy applied to the new partitions.      │
│                                                          │
│  Recommendation                                          │
│  Consider adding TTL configuration per partition type.   │
│                                                          │
│  [Accept]      [Ignore]      [Send Back to Agent]        │
└──────────────────────────────────────────────────────────┘
```

**Per-finding actions:**
- **Accept** — finding đã xem xét, sẽ được addressed trong run tiếp
- **Ignore** — dismiss (có thể undo)
- **Send Back to Agent** — mở text input thêm instruction cụ thể

**Section 3 — Decision:**
```
Your Decision
──────────────────────────────────────────────────
○ Approve — All findings reviewed, task can proceed
○ Request Changes — Send back with instructions
○ Close as Done — Task is complete

[Optional comment for agent...]

                                  [Submit Decision →]
```

**Outcomes:**
- Approve → task Completed, session Closed, toast "Task marked as complete ✓"
- Request Changes → task Changes Requested, comment + findings sent on next Resume
- Close as Done với unresolved findings → Confirmation Dialog trước khi proceed

### 7.5 Bulk Actions

```
✓ 2 selected        [Dismiss selected]    [Send back selected]
```

---

## 8. Component Library

### 8.1 StatusBadge

Variants: `[● Created]` gray · `[● Ready]` blue · `[● Assigned]` indigo · `[● Running]` violet pulse · `[⚑ Needs Review]` amber · `[! Changes Req.]` orange · `[✓ Completed]` green · `[✕ Blocked]` red · `[─ Cancelled]` muted

Sizes: `sm` 20px/10px font (card footer) · `md` 24px/12px (card header) · `lg` 28px/13px (detail header)

Rules: luôn có text, không all-caps (trừ column header), không dùng icon phức tạp.

### 8.2 AgentAvatar

Hình tròn, màu nền từ agent name hash. Initials: "BC" (backend-coder), "P" (planner), "FC" (frontend-coder).
Sizes: 20px (inline) · 28px (card) · 36px (detail header).
Runtime overlay badge góc phải dưới: ⚙ Codex CLI (orange) · ✦ Claude CLI (violet).

### 8.3 RuntimeBadge

`[⚙ Codex CLI]` · `[✦ Claude CLI]` · `[⚡ Custom]` — gray pill, dark text.

### 8.4 SessionBadge

`[─ No session]` gray dashed · `[● Active]` violet dot · `[↩ Resumable]` blue · `[✓ Closed]` muted green.

### 8.5 Button

| Variant | Use case |
|---------|----------|
| Primary (filled indigo) | Resume Session, Create Task |
| Secondary (outlined) | View Details |
| Ghost | Cancel, Dismiss |
| Destructive (red) | Delete, Force Close |
| Link | View all → |

Sizes: `sm` 28px · `md` 36px (default) · `lg` 44px (modal CTAs).
Loading: spinner replaces icon, text stays, button disabled.
Disabled: opacity 40%, cursor not-allowed, tooltip explains why.

### 8.6 ToastNotification

```
✓  Task marked as complete               [View task]  [×]
✕  Session failed to start. Check agent config.      [×]
```

Position: bottom-right, stack từ dưới lên. Width 360px. Auto-dismiss 4s (error: không auto-dismiss). Animation: slide in từ dưới, fade out.

### 8.7 ConfirmationDialog

```
┌─────────────────────────────────────┐
│  Delete Task                        │
│                                     │
│  Are you sure you want to delete    │
│  "Fix login redirect after token    │
│  refresh"? This cannot be undone.   │
│                                     │
│  [Cancel]          [Delete Task]    │
└─────────────────────────────────────┘
```

Rules: title = tên action cụ thể (không phải "Are you sure?"), Cancel trái ghost, Confirm phải destructive red, không có "don't show again" checkbox.

**Actions cần confirm:** Xóa task/project · Force close session · Mark Done với unresolved findings · Reassign agent khi Running · Approve review với findings chưa xử lý.

### 8.8 Interaction Rules

**Navigation:** Click card → mở Detail Panel (không navigate away). Click outside → đóng panel. `Esc` → đóng panel/modal/dropdown.

**Forms:** Validation inline khi blur. Error message ngay dưới field. Submit disabled khi có error. Comment draft autosave to localStorage.

**Status Updates:** Card cập nhật in-place, fade animation 300ms. Không reload toàn board. Toast confirm mỗi action thành công.

**Loading:** Skeleton loading cho card list (không spinner toàn trang). Inline spinner trên action button khi processing.

**Error Handling:** API error → toast thân thiện + retry. Không hiển thị stack trace hay HTTP status code. Network timeout → banner "Connection issue — retrying…".

**Keyboard Shortcuts:**

| Shortcut | Action |
|----------|--------|
| `⌘K` | Open search |
| `N` | New task (khi không focus input) |
| `Esc` | Close panel / modal |
| `J` / `K` | Navigate task list |
| `Enter` | Open selected task |
| `R` | Resume session (trong Detail Panel) |

---

## 9. Empty States

### 9.1 Nguyên Tắc

- Giải thích tại sao trống và nên làm gì tiếp theo
- Icon lớn đơn giản 48px, không dùng illustration phức tạp
- Không dùng "No data found" — text phải có ý nghĩa
- Luôn có CTA nếu user có thể thực hiện action

### 9.2 Danh Sách Empty States

**Chưa có Project:**
```
📁
No projects yet
Create your first project to start organizing
tasks and assigning them to AI agents.
[Create Project]
```

**Chưa có Task trong project:**
```
📋
No tasks in this project
Create a task, describe the goal, and assign it
to an AI agent to get started.
[+ New Task]
```

**Chưa có Agent:**
```
🤖
No agents configured
Connect an AI runtime to start delegating tasks.
OmniAgent supports Codex CLI, Claude CLI, and custom runtimes.
[Configure Agent]
```

**Review Queue trống:**
```
✓
No tasks need review
All reviewed tasks are either completed or
waiting for the next agent run.
[View completed tasks →]
```

**Không có Session đang chạy:**
```
▶
No active sessions
Sessions start when you assign a task to an
agent and click "Start Session".
[View assigned tasks →]
```

**Task chưa có Log:**
```
📄
No logs yet
Logs will appear here once an agent session
has been started for this task.
[Start Session →]
```

**Task chưa có Artifact:**
```
📎
No artifacts yet
Files created or modified by the agent will
appear here after the first run.
```
(Không CTA — artifacts tự xuất hiện)

**Task chưa có Comment:**
```
💬
No comments yet
Add a comment to send new instructions to the
agent on the next session resume.
```
(Input bên dưới là CTA)

**Review Queue — đã xử lý hết:**
```
🎉
You're all caught up!
No tasks are waiting for review.
Check back after your agents complete their runs.
[Go to Dashboard]
```

**Kanban column trống (Backlog/Ready):**
```
No tasks here
Tasks will appear when they reach this stage.
[+ Add task]
```
Nhỏ hơn, inline, không icon lớn.

**Search không tìm thấy:**
```
No results for "refaktor"
Try checking the spelling or search with different keywords.
```

### 9.3 Layout Spec

**Full-page:** Icon 48px `--text-disabled`, Heading M, Body `--text-secondary` max-width 320px centered, Primary button margin-top 20px.

**Inline/column:** Icon 32px optional, Body S `--text-secondary`, Link hoặc small outlined button, padding 24px centered.

---

## Core User Experience

### Defining Experience

Vòng lặp giá trị cốt lõi của omni-agent là:

> **Mở task cũ → gõ comment → resume đúng session cũ**

Đây không phải task manager hay chat app. Đây là công cụ **continuity** — giúp người dùng không bao giờ phải bắt đầu lại từ đầu. Mỗi task là một luồng công việc đang diễn ra, không phải một ticket đóng/mở.

Tần suất thực tế: tạo task mới 1–3 lần/ngày, nhưng resume/comment/tiếp tục 5–15 lần/ngày. Điều đó có nghĩa UI phải được tối ưu cho **returning user**, không phải onboarding hay creation.

Vấn đề thật sự khi resume không phải là tìm session ID — đó chỉ là triệu chứng. Vấn đề gốc là **mất continuity**: không nhớ task đang ở đâu, phải nhắc lại context cho agent, phải tìm lại thread tư duy cũ. omni-agent giải quyết vấn đề này bằng cách làm cho "trạng thái hiện tại của task" luôn hiện diện và dễ đọc.

### Platform Strategy

- **Desktop-first, browser-based** — Chrome/desktop là primary target. Mobile không phải MVP scope.
- **Local app, luôn có server** — không cần offline mode. Giả định localhost server đang chạy khi dùng app.
- **Single monitor layout** — main work area + right detail panel hoạt động tốt trên 1440px–1920px. Multi-monitor là bonus.
- **Keyboard-friendly** — developer user, keyboard shortcuts là first-class citizen.

### Effortless Interactions

Ba tương tác phải effortless đến mức không cần suy nghĩ:

1. **Scan trạng thái tổng quan** — Mở app → trong 3 giây biết có gì cần làm ngay không. Không click, không scroll, không đọc log. Dashboard là "morning briefing", không phải bảng dữ liệu.

2. **Resume session** — Từ "muốn resume task X" đến "subprocess đang chạy" phải ≤ 2 bước và ≤ 30 giây. Click task → bấm Resume (+ optional comment). Không modal phức tạp, không confirm thừa.

3. **Thêm comment nhanh** — Comment input phải accessible ngay từ card hoặc detail panel, không cần tab switching hay navigation.

### Critical Success Moments

**Moment #1 — First successful resume:**
Lần đầu tiên người dùng resume một task cũ và thấy agent tiếp tục đúng từ chỗ dở — không cần giải thích lại context. Đây là khoảnh khắc "aha" của sản phẩm.

**Moment #2 — Morning scan trong < 5 giây:**
Mở app buổi sáng và ngay lập tức biết: task nào đang chạy, task nào cần review, task nào bị block. Không cần click vào từng task.

**Moment #3 — Comment → Resume trong một flow:**
Bổ sung yêu cầu và resume session trong cùng một thao tác liên tục — gõ comment, bấm Resume, xong. Không phải hai bước tách biệt với navigation ở giữa.

**Make-or-break:** Resume session — nếu flow này có friction, toàn bộ giá trị sản phẩm sụp đổ.

### Experience Principles

1. **Continuity over creation** — Mọi quyết định thiết kế ưu tiên người dùng đang quay lại làm tiếp. Resume phải nhanh hơn create.

2. **Status là ngôn ngữ chính** — Status badge, session state, last activity là thông tin first-class. Người dùng giao tiếp với app chủ yếu qua trạng thái task.

3. **Complexity hides, actions surface** — Session ID, subprocess logs, CLI commands, JSON output ẩn mặc định. Những gì hiển thị là: task đang ở đâu, cần làm gì tiếp, agent đã làm gì.

4. **Speed for the returning user** — Mỗi common action (resume, comment, check status) có path ngắn nhất có thể. Không có workflow nào cần > 3 bước.

---

## Desired Emotional Response

### Primary Emotional Goals

Cảm giác chủ đạo người dùng phải có khi dùng omni-agent:

> **"Tôi đang kiểm soát tất cả"** — dù có nhiều task agent đang xử lý song song, không có gì bị bỏ sót, không có gì mất track.

omni-agent không hướng đến "delight" hay "fun" — đây là công cụ chuyên nghiệp. Emotional goal là **calm confidence**: bình tĩnh vì mọi thứ rõ ràng, tự tin vì biết chính xác trạng thái của từng task.

### Emotional Journey Mapping

| Giai đoạn | Cảm xúc mong muốn | Cảm xúc cần tránh |
|-----------|-------------------|-------------------|
| Mở app buổi sáng | Nhẹ nhõm — tình hình rõ ngay | Overwhelmed — quá nhiều thứ |
| Scan dashboard | Tự tin — biết cần làm gì | Lo lắng — không biết bắt đầu từ đâu |
| Resume task cũ | Liền mạch — tiếp tục tự nhiên | Bực bội — nhiều bước thừa |
| Thêm comment | Nhẹ nhàng — gõ xong là xong | Gián đoạn — phải navigate đi đâu |
| Agent chạy xong | Hài lòng — kết quả rõ ràng | Hoang mang — không biết output ở đâu |
| Có lỗi/blocked | Bình tĩnh — biết làm gì tiếp | Hoảng loạn — error message khó hiểu |
| Review findings | Tự tin — thông tin đủ để quyết định | Mơ hồ — không hiểu agent muốn nói gì |

### Micro-Emotions

- **Tin tưởng** — "App sẽ nhớ session ID thay tôi, tôi không cần nhớ"
- **Continuity** — "Tôi đang tiếp tục đúng từ chỗ dở, không phải bắt đầu lại"
- **Visibility** — "Tôi luôn biết agent đang làm gì, không phải đoán mò"
- **Safety** — "Nếu có lỗi, tôi sẽ thấy ngay và biết cách fix, không bị mất công"

Cảm xúc cần chủ động tránh: Anxiety (không biết task nào đang dở) · Friction (nhiều bước cho common action) · Distrust (UI nói Running nhưng không chắc agent đang làm gì).

### Design Implications

| Cảm xúc mục tiêu | Quyết định thiết kế |
|------------------|---------------------|
| Calm confidence | Dashboard ưu tiên "cần làm gì" trước "đang xảy ra gì" |
| Trust | Session state luôn hiển thị rõ, status không bao giờ ambiguous |
| Continuity | Summary tab hiển thị "last agent did X, next step Y" — không để blank |
| Speed | Resume = 1–2 bước, không modal phức tạp, không confirm thừa |
| Safety | Error state có human-readable explanation + suggested action, không chỉ error code |
| Visibility | Running task hiển thị current step (human-readable), không chỉ spinner |

### Emotional Design Principles

1. **Rõ ràng hơn hào nhoáng** — Một status badge rõ ràng có giá trị hơn một animation đẹp. Người dùng cần biết, không cần bị impressed.

2. **Lỗi là thông tin, không phải thất bại** — Khi agent gặp lỗi, UI frame nó như "đây là thông tin bạn cần để tiếp tục", không phải "có gì đó sai rồi".

3. **Trạng thái không bao giờ mơ hồ** — Không có "unknown", "loading…" kéo dài, hay status không rõ. Nếu không biết, nói thẳng "Status unavailable — last seen X ago".

4. **Tin tưởng qua nhất quán** — Mỗi lần resume hoạt động giống nhau, mỗi lần agent chạy xong hiển thị giống nhau. Predictability xây dựng trust.

---

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

**Linear — Task Management**
- Speed-first: mọi thao tác có keyboard shortcut, không bao giờ cần hơn 2–3 bước
- Status hiển thị rõ trên card mà không cần mở detail
- Command palette (⌘K) làm shortcut cho mọi action
- Information hierarchy rõ: title → status → metadata
- Empty state hướng dẫn cụ thể thay vì "No data"

**VS Code — Developer Workspace**
- Layout 3-panel quen thuộc: sidebar / main area / output panel
- Log/terminal ẩn ở dưới, không chiếm không gian chính
- Output panel có thể toggle — hiện khi cần, ẩn khi không dùng

**Raycast — Command Launcher**
- "Open → Type → Act" trong < 2 giây là tiêu chuẩn
- Search-first: không cần nhớ navigation, chỉ cần search
- Action list contextual — bấm vào item nào thấy action của item đó
- Không có form dài — mọi input đều inline hoặc single-step

### Transferable UX Patterns

**Navigation:**
- *Linear sidebar* — section headers gọn, icon + label, active state rõ bằng màu → áp dụng cho Sidebar
- *VS Code panel toggle* — technical output ẩn mặc định → Logs tab chỉ mở khi user chủ động chọn

**Interaction:**
- *Linear inline status change* — click status badge → dropdown, không cần mở form → áp dụng status badge click-to-change
- *Raycast contextual actions* — focus item thì action phù hợp hiện ra → áp dụng Action Bar thay đổi theo task state
- *Linear ⌘K* — search + action trong một bước → áp dụng cho search tasks/agents/sessions

**Visual:**
- *Linear card density* — compact nhưng không chật, hierarchy qua font weight → card 280px, padding 12px
- *VS Code color-for-meaning* — màu chỉ dùng khi có semantic value → status color system Section 1

### Anti-Patterns to Avoid

**Jira anti-patterns:**
- Form tạo task quá nhiều field → omni-agent chỉ cần Title + Description (AC optional)
- Không rõ action tiếp theo → omni-agent luôn có "Next Suggested Action" visible
- Quá nhiều trạng thái phức tạp → 8 trạng thái là max, transition rõ ràng
- Click sâu để tìm thông tin cơ bản → thông tin quan trọng trên card hoặc Summary tab

**Terminal/log-viewer anti-patterns:**
- Raw output mặc định chiếm toàn màn hình → Logs luôn ẩn trong tab
- Technical jargon trong UI chính → session ID, exit code, CLI command ẩn trong Logs/Technical tab

**Notion anti-patterns:**
- Quá linh hoạt, không opinionated → omni-agent có structure cố định cho agent workflow
- Phải tự setup structure → user chỉ cần điền content

### Design Inspiration Strategy

**Adopt trực tiếp từ Linear:** Speed + keyboard shortcuts first-class · Card design compact · Sidebar structure clean

**Adopt trực tiếp từ VS Code:** Sidebar/main/detail panel layout · Log panel ẩn mặc định · Color-for-meaning

**Adapt từ Raycast:** Tinh thần "open → find → act" áp dụng cho Resume flow: mở app → thấy task trên dashboard → Resume → xong · ⌘K search nhanh

**Tránh hoàn toàn:** Jira-style forms và nested workflows · Terminal full-screen làm màn hình chính · Blank canvas không có opinionated structure

---

## Design System Foundation

### Design System Choice

**Approach:** Themeable Component System dựa trên Design Tokens

omni-agent sử dụng hệ thống design token-based, xây dựng từ foundation tùy chỉnh thay vì adopt nguyên xi một design system có sẵn. Approach này cho phép visual identity riêng, component behavior phù hợp với workflow agent management, và flexibility để thêm component đặc thù (StatusBadge, SessionBadge, RunTimeline).

Nếu cần chọn implementation cụ thể: **Tailwind CSS + shadcn/ui** là lựa chọn phù hợp nhất với stack React và tinh thần Linear/VS Code.

### Rationale

- **Developer-facing tool cần precision cao** — custom tokens đảm bảo status colors, spacing, typography nhất quán tuyệt đối, không bị override bởi library defaults
- **Component đặc thù** — StatusBadge, SessionBadge, AgentAvatar, RunTimeline không có trong bất kỳ design system nào — phải build custom dù dùng library nào
- **Maintainability** — token-based system dễ update toàn bộ visual khi cần, không phải tìm từng hardcoded value

### Design Tokens (Foundation)

Toàn bộ visual values được định nghĩa như tokens:

- **Color tokens**: đầy đủ trong Section 1.2 (neutrals, brand, status, severity)
- **Spacing tokens**: scale 4px → 48px, nhất quán toàn app
- **Typography tokens**: 7 roles với font stack và size cố định
- **Radius tokens**: 4 levels sm → xl
- **Shadow tokens**: 4 levels sm → focus ring

### Component Strategy

**Reuse từ library (không build lại):**
Button · Input · Textarea · Dropdown · Dialog/Modal · Tabs · Tooltip · Toast

**Build custom (không có trong library):**
StatusBadge · SessionBadge · AgentAvatar · RuntimeBadge · TaskCard · RunTimeline · TimelineStep · ReviewFindingCard · DashboardSection

**Hybrid (extend từ library):**
DataTable (custom cell renderers) · Badge (status variants)

### Customization Strategy

- Light theme mặc định, dark theme optional trong v2
- Component variants define qua token tham chiếu, không hardcode hex
- Spacing và sizing dùng scale cố định, không dùng arbitrary values
- Status colors có semantic meaning cố định — không thay đổi theo theme

---

## Defining Core Experience

### Defining Experience

Tương tác duy nhất mà nếu làm đúng, mọi thứ còn lại theo sau:

> **Xem context hiện tại của task → gõ comment inline → bấm Resume → agent tiếp tục đúng từ chỗ dở**

Đây là flow người dùng thực hiện 5–15 lần/ngày. Mọi quyết định thiết kế ưu tiên làm flow này nhanh và ít friction nhất có thể.

### User Mental Model

Người dùng không nghĩ về "spawn subprocess" hay "session ID". Họ nghĩ về task như một luồng công việc đang diễn ra với một "người cộng sự" (agent). Khi quay lại task:

- Muốn biết ngay: "cộng sự của tôi đã làm gì, đang ở đâu?"
- Muốn nói: "tiếp tục đi, và làm thêm cái này"
- Expect: agent hiểu context cũ, không phải giải thích lại từ đầu

**Mental model: Task = một thread công việc đang mở, có thể tiếp tục bất kỳ lúc nào**

### Success Criteria

Flow Resume thành công khi:

1. Từ "muốn resume" → subprocess chạy ≤ 30 giây
2. User thấy agent đang làm gì (human-readable step) trong vòng 10 giây sau khi bấm Resume
3. Agent tiếp tục đúng context cũ — không cần nhắc lại mô tả task
4. Toàn bộ flow không cần mở terminal, không cần nhớ ID hay command
5. Comment → Resume trong cùng 1 màn hình, không navigate đi đâu

### Novel vs. Established Patterns

Flow Resume kết hợp hai pattern quen thuộc theo cách mới:

- **Established:** Comment input + Submit (GitHub Issues, Linear) — người dùng đã biết
- **Established:** Background job progress (CI/CD run) — người dùng đã biết
- **Novel:** Hai pattern merge thành một flow — comment là input cho background job, job progress hiển thị ngay trong task detail

Không cần user education — pattern đủ quen để hiểu ngay.

### Experience Mechanics

**Flow chi tiết — Resume with Comment:**

**Bước 1 — Initiation (mở task):**
User mở Task Detail Panel, thấy ngay: Current Status, Last Agent Summary, Next Suggested Action. Comment input box hiển thị trong Summary tab — không cần switch tab.

**Bước 2 — Comment (gõ chỉ dẫn):**
Inline textarea trong Summary tab. Placeholder: "Add instructions for next run…". Không phải modal, không phải separate page.

**Bước 3 — Resume (bấm button):**
- Có comment → button label "Resume with Comment"
- Không có comment → button label "Resume Session"
- Click → loading state "Starting…" → không cần confirm dialog

**Bước 4 — Progress (live status):**
Task status → `[● RUNNING]` ngay lập tức. Summary tab hiển thị live timeline:
```
● Starting session…              just now
● Sending comment to agent       2s ago
● Agent running                  5s ago
● Reading files…                 10s ago   ← live update
```
Human-readable steps, không phải raw log. User có thể đóng panel — session vẫn chạy background.

**Bước 5 — Completion:**
Status → `[⚑ NEEDS REVIEW]` hoặc `[✓ COMPLETED]`. Summary tab cập nhật Last Agent Summary. Toast: "Agent completed Run #N — review now?". Next Suggested Action cập nhật.

**Error path:**
Status → `[✕ BLOCKED]`, Summary hiển thị human-readable error + suggested action. Stack trace và exit code chỉ trong Logs tab.

**Key UX constraint:** Comment box + Resume button LUÔN visible trong Summary tab khi task ở trạng thái Resumable/Paused/Changes Requested. Không ẩn sau tab switch hay accordion.

---

## Visual Design Foundation

### Color System Decisions

**Primary Color: Indigo `#4F46E5`**
Lý do: phù hợp SaaS chuyên nghiệp, gần Linear/Notion, không quá "developer tool". Đủ khác biệt với status colors (Blue = Ready, Violet = Running) để không gây nhầm lẫn.

**Secondary action color: Blue `#2563EB`** — links, secondary CTAs, "Ready" status.

**Status colors không dựa hoàn toàn vào màu:** Mỗi status có màu + icon + text label. Người dùng mù màu vẫn phân biệt được trạng thái qua text badge.

### Typography Decisions

**Tone:** Professional, clean, modern — không playful hay editorial.

**Rationale chọn Inter/Geist:** Thiết kế cho UI (không phải print), legibility tốt ở small sizes, được Linear/Vercel dùng — nhất quán với mental model.

**Readability rules:**
- Body text minimum 14px — không xuống 12px cho content chính
- Monospace chỉ dùng trong Logs tab
- Line-height 1.4–1.5 cho body

### Spacing & Layout Foundation

**Base unit: 4px** — toàn bộ spacing là bội số của 4px.

**Layout density: Medium** — compact hơn consumer app, airy hơn Jira. Card padding 12px, section gap 24px, page padding 24px.

**Layout approach:** Flexbox — Sidebar 220px fixed, Main area flex-grow, Detail panel 420px fixed khi mở. Kanban board không giới hạn horizontal width.

### Branding (MVP)

Text "OmniAgent" + icon đơn giản. Không cần custom SVG logo cho MVP. App icon trong sidebar: 28px rounded square, Indigo background, white icon.

### Accessibility Baseline (WCAG AA Practical)

**Contrast:** Text on white minimum 4.5:1 · Large text minimum 3:1.

**Không chỉ dựa vào màu:** Status luôn có text + icon · Error/warning có icon (✕, ⚠) · Active/selected có border + background change.

**Focus:** Visible focus ring `--shadow-focus` 3px Indigo · Keyboard navigation toàn bộ interactive elements · Modal trap focus.

**Motion:** Animations ≤ 200ms ease-out · Không looping animation ngoài Running pulse · Respect `prefers-reduced-motion`.
