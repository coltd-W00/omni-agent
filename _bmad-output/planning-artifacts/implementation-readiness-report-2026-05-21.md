---
stepsCompleted: ["step-01-document-discovery", "step-02-prd-analysis", "step-03-epic-coverage-validation", "step-04-ux-alignment", "step-05-epic-quality-review", "step-06-final-assessment"]
documents:
  prd: "_bmad-output/planning-artifacts/prds/prd-omni-agent-2026-05-20/prd.md"
  architecture: "_bmad-output/planning-artifacts/architecture.md"
  epics: "_bmad-output/planning-artifacts/epics.md"
  ux: "_bmad-output/planning-artifacts/ux-design-specification.md"
---

# Implementation Readiness Assessment Report

**Date:** 2026-05-21
**Project:** omni-agent

## PRD Analysis

### Functional Requirements

FR-0: **Project CRUD** — Người dùng có thể tạo Project mới với tên (bắt buộc) và key viết tắt (bắt buộc, unique, chỉ chữ in hoa và số), đổi tên, và xóa Project rỗng (không có Task). Task Board lọc theo Project đang active. Xóa Project có Task bị block.

FR-1: **Tạo Task** — Người dùng có thể tạo Task mới trong Project đang active với Title (bắt buộc), Description (bắt buộc), và Acceptance Criteria (tùy chọn). Task mới được tạo ở trạng thái `Draft`. Task ID theo định dạng `{PROJECT_KEY}-NNN`.

FR-2: **Assign Agent cho Task** — Người dùng có thể assign Agent (Codex, Claude) và Role (Coder, Reviewer, Planner, Debugger, Refactorer) cho Task ở trạng thái Draft hoặc Ready. Sau khi assign, trạng thái chuyển sang `Assigned`.

FR-3: **Cập nhật và xóa Task** — Người dùng có thể chỉnh sửa Title, Description, Acceptance Criteria của Task ở bất kỳ trạng thái nào trừ `Done` và `Cancelled`. Người dùng có thể xóa Task ở trạng thái Draft.

FR-4: **Task Board (Kanban View)** — Task Board hiển thị tất cả Task theo trạng thái. Mỗi card hiển thị: Task ID, Title, Agent, Session status, thời gian hoạt động gần nhất. Card cập nhật realtime (hoặc sau refresh).

FR-5: **Start Session** — Người dùng có thể Start Session cho Task ở trạng thái `Assigned`. App spawn CLI agent subprocess với task description làm input. Session ID (UUID) được capture và lưu. Trạng thái Task chuyển sang `Running`. Nếu binary không tồn tại → error, giữ Assigned. Nếu không capture được session ID → log warning, cho phép nhập thủ công.

FR-6: **Phát hiện Session kết thúc** — App phát hiện khi CLI subprocess kết thúc. Exit code 0 → Task status = `Paused`. Exit code ≠ 0 → Task status = `Failed`. Backend là process owner — subprocess tiếp tục khi browser đóng. Cancel → subprocess bị kill → `Cancelled`. Backend shutdown → subprocess bị kill → Task status = `Paused`.

FR-7: **Resume Session** — Người dùng có thể Resume Session cho Task ở trạng thái `Paused` hoặc `Failed`, kèm Comment tùy chọn. Claude: `claude --continue --session-id <uuid>`. Codex: `codex resume <uuid>`. Run mới được tạo. Trạng thái → `Running`.

FR-8: **Lưu Run Log và Output** — Mỗi Run lưu: timestamp, input, exit code. Full output ghi ra file log trên disk. DB lưu metadata + tail (last 100 lines / 10 KB). UI hiển thị tail mặc định + nút view full log và download raw log.

FR-9: **Thêm Comment** — Người dùng có thể thêm Comment vào Task ở bất kỳ trạng thái nào trừ `Cancelled`. Comment lưu với timestamp và nội dung text. Comment rỗng không được lưu.

FR-10: **Comment làm input cho Resume** — Khi Resume, nội dung Comment mới nhất (hoặc comment người dùng chọn) trở thành input gửi vào agent session. Comment đã dùng được đánh dấu "sent".

FR-11: **Task Detail View** — Task Detail hiển thị: Title, Description, Acceptance Criteria, Agent/Role, Session Panel, Comments, Runs, và action buttons đúng theo trạng thái (Assigned → Start Session; Running → chỉ xem; Paused/Failed → Resume, Mark Done, Cancel; Done/Cancelled → chỉ xem).

FR-12: **Session Panel** — Session Panel hiển thị: Agent type, Session ID (ẩn/hiện), Session Status, thời gian tạo, lần resume cuối. Chỉ hiển thị khi Task đã có Session. Session ID mặc định bị ẩn, có toggle "Show ID".

**Total FRs: 13 (FR-0 đến FR-12)**

---

### Non-Functional Requirements

NFR-1: **Performance — Resume latency** — Thời gian từ "muốn resume task cũ" đến "subprocess đã chạy" ≤ 30 giây (SM-3).

NFR-2: **Reliability — Resume success rate** — Resume thành công ≥ 90% số lần thực hiện (SM-2).

NFR-3: **Reliability — Session ID integrity** — Không có task nào bị "mất session" (session ID null sau khi đã start) trong điều kiện bình thường (SM-4).

NFR-4: **Reliability — Subprocess persistence** — Subprocess tiếp tục chạy khi người dùng đóng tab hoặc browser. Backend là process owner (FR-6).

NFR-5: **Reliability — Graceful shutdown** — Khi backend shutdown, trạng thái Task được flush xuống DB trước khi backend exit (FR-6, ASSUMPTION).

NFR-6: **Storage** — Toàn bộ dữ liệu lưu local (no cloud sync). SQLite là lựa chọn cho local storage.

NFR-7: **Log persistence** — Log file tồn tại khi app đóng và mở lại (FR-8).

NFR-8: **Log size control** — DB lưu tối đa last 100 lines / 10 KB làm tail (FR-8).

**Total NFRs: 8 (NFR-1 đến NFR-8)**

---

### Additional Requirements / Constraints

- **Tech stack:** React frontend + Rust backend, chạy local web app trên localhost port.
- **Agents supported:** Chỉ Codex và Claude trong MVP. Gemini và custom agents nằm ngoài scope.
- **User scope:** Single user, local only, no multi-user.
- **Task Status Machine:** 8 trạng thái (Draft, Ready, Assigned, Running, Paused, Failed, Done, Cancelled) với transition rules cụ thể.
- **Session ID capture strategy:** Claude → parse JSON `session_id` field; Codex → parse JSON/event output, fallback scan `~/.codex/sessions/` theo cwd + modified time.
- **Comment input rule:** Input gửi đến agent là comment text, không phải toàn bộ lịch sử.

---

### PRD Completeness Assessment

PRD được viết rõ ràng, có glossary đầy đủ, user journeys cụ thể, và FR/NFR có testable consequences. Các quyết định kỹ thuật quan trọng (session ID capture, resume command format, subprocess lifecycle) đã được giải quyết trong Open Questions. Một số điểm cần chú ý khi đối chiếu với epics:
- FR-0 (Project CRUD) là tính năng nền tảng — cần được cover đầy đủ trong epics trước FR-1.
- FR-6 (subprocess lifecycle) có behavior phức tạp (browser close, backend shutdown) — cần story riêng.
- FR-8 (log file + tail) có 2 cơ chế lưu trữ song song — cần kiểm tra epics có story cho cả hai.

## Epic Coverage Validation

### Coverage Matrix

| FR | Mô tả | Epic Coverage | Story | Trạng thái |
|----|--------|---------------|-------|------------|
| FR-0 | Project CRUD | Epic 2 | Story 2.1 | ✅ Covered |
| FR-1 | Tạo Task | Epic 2 | Story 2.2 | ✅ Covered |
| FR-2 | Assign Agent | Epic 2 | Story 2.2 | ✅ Covered |
| FR-3 | Cập nhật và xóa Task | Epic 2 | Story 2.2 | ✅ Covered |
| FR-4 | Task Board Kanban | Epic 2 | Story 2.3 | ✅ Covered |
| FR-5 | Start Session | Epic 3 | Story 3.1 | ✅ Covered |
| FR-6 | Phát hiện Session kết thúc | Epic 3 | Story 3.2 | ✅ Covered |
| FR-7 | Resume Session | Epic 3 | Story 3.3 | ✅ Covered |
| FR-8 | Lưu Run Log | Epic 3 | Story 3.4 | ✅ Covered |
| FR-9 | Thêm Comment | Epic 3 | Story 3.3 | ✅ Covered |
| FR-10 | Comment làm input cho Resume | Epic 3 | Story 3.3 | ✅ Covered |
| FR-11 | Task Detail View | Epic 2 | Story 2.4 | ✅ Covered |
| FR-12 | Session Panel | Epic 2 | Story 2.4 | ✅ Covered |

| NFR | Mô tả | Epic Coverage | Story | Trạng thái |
|-----|--------|---------------|-------|------------|
| NFR-1 | Subprocess independence (process owner) | Epic 3 | Story 3.2 | ✅ Covered |
| NFR-2 | Session ID capture reliability + fallback | Epic 3 | Story 3.1 | ✅ Covered |
| NFR-3 | Log dual-storage (file + DB tail) | Epic 3 | Story 3.4 | ✅ Covered |
| NFR-4 | AgentStrategy trait abstraction | Epic 3 | Story 3.1 | ✅ Covered |
| NFR-5 | Graceful shutdown | Epic 3 | Story 3.2 | ✅ Covered |
| NFR-6 | WCAG 2.1 AA | Epic 4 | Story 4.2 | ✅ Covered |
| NFR-7 | Resume latency ≤ 30s | Epic 3 | Story 3.5 (optimistic UI) | ✅ Covered |
| NFR-8 | Realtime status polling | Epic 2/3 | Story 2.3, 3.5 | ✅ Covered |

### Missing Requirements

✅ **Không có FR hay NFR nào bị thiếu coverage.** Tất cả 13 FRs và 8 NFRs đều được map đến ít nhất một Epic và Story cụ thể.

### Coverage Statistics

- **Total PRD FRs:** 13 (FR-0 đến FR-12)
- **FRs covered in epics:** 13
- **FR Coverage:** 100%
- **Total NFRs:** 8 (NFR-1 đến NFR-8)
- **NFRs covered:** 8
- **NFR Coverage:** 100%

## UX Alignment Assessment

### UX Document Status

✅ **Found** — `_bmad-output/planning-artifacts/ux-design-specification.md` (76KB, 14 steps completed, 2026-05-20)

### UX ↔ PRD Alignment

| Kiểm tra | Kết quả |
|----------|---------|
| UX phản ánh đúng vision và persona PRD | ✅ Aligned — cùng "Session-as-Asset" concept, cùng persona Loc |
| User journeys UJ-1..4 có UX counterpart | ✅ Aligned — UJ-1 (New Task modal), UJ-2 (Start Session + Action Bar), UJ-3 (Resume flow), UJ-4 (Mark Done) đều có UX spec |
| 8 Task statuses khớp PRD | ✅ Aligned — Draft/Ready/Assigned/Running/Paused/Failed/Done/Cancelled đều được định nghĩa trong color system và StatusBadge |
| Agents Codex + Claude only (no Gemini) | ✅ Aligned — UX spec design cho 2 agents |
| Local only, no cloud | ✅ Aligned — không có sync/auth UI |

⚠️ **UX Scope Expansion (ngoài PRD MVP):**

UX spec định nghĩa các views/features **không có trong PRD MVP scope**:
1. **Review Queue** (`/reviews`) — màn hình riêng với Needs Review / Changes Requested / Findings workflow. PRD §5 Non-Goals: "Không tự động review hay planning"; trạng thái NeedsReview và ChangesRequested bị loại khỏi MVP transitions.
2. **Task List view** (`/tasks`) — table/list view bổ sung ngoài Kanban.
3. **Session Monitor** (`/sessions`) — màn hình quản lý active sessions tổng hợp.
4. **Agent Config** (`/agents`) — màn hình cấu hình agent setup.
5. **Inbox** — notification system với badge đỏ và dropdown notifications.
6. **My Tasks** — filtered view.
7. **Keyboard shortcuts J/K** cho task list navigation.

**Đánh giá:** Đây là UX scope creep có kiểm soát — các views này được ghi nhận trong spec nhưng **không được map vào bất kỳ Epic hay Story nào** trong epics.md. Epics.md chỉ cover: Dashboard (`/dashboard`), Board (`/board`), và Task Detail Panel. Điều này tạo ra gap về implementation expectations.

### UX ↔ Architecture Alignment

| Kiểm tra | Kết quả |
|----------|---------|
| React Router v7 routes đủ cho các views PRD cần | ✅ Architecture có React Router v7; routes `/dashboard` và `/board` được mention trong epics |
| TanStack Query polling (5s) cho Running tasks | ✅ Architecture và epics aligned |
| Optimistic UI cho Resume | ✅ Architecture mention `useSessionMutation`; epics Story 3.5 có optimistic update |
| Design token CSS variables | ✅ Architecture mention frontend structure; Story 1.3 implement tokens |
| Detail Panel (420px slide-in) | ✅ CSS transform animation spec trong UX; Story 2.4 implement |
| Monospace font cho Logs tab | ✅ Typography spec + Story 3.5 |

⚠️ **Architecture không có API endpoints cho UX-expanded views:**
- Không có `/api/notifications`, `/api/inbox`
- Không có endpoints cho Review Queue workflow (findings, approve, send-back)
- Không có endpoints cho Session Monitor aggregation
- Điều này hợp lý vì các views đó không được include trong epics — nhưng nếu UX spec được hiểu là in-scope, backend cần bổ sung.

### Warnings

⚠️ **WARNING-UX-1 (Medium):** UX spec defines 6+ views/features (`/reviews`, `/tasks`, `/sessions`, `/agents`, Inbox, notifications) that are NOT in PRD MVP scope, NOT in Architecture API design, và NOT covered by any Epic or Story. Risk: developer đọc UX spec có thể nhầm đây là in-scope.

⚠️ **WARNING-UX-2 (Low):** UX spec section 2.4 có route table bao gồm `Review Queue (/reviews)` và mentions `NeedsReview/ChangesRequested` status colors — nhưng PRD §4.2 (Task Status) đã ghi rõ "MVP: Needs Input và Needs Review được bỏ khỏi transitions tự động". Cần làm rõ: các status colors này được giữ cho v2 hay hoàn toàn loại bỏ khỏi MVP UI?

## Epic Quality Review

### Epic Structure Validation

#### Epic 1: Project Foundation & Infrastructure

**User Value Check:**
- ⚠️ Title "Project Foundation & Infrastructure" mang tính **technical milestone**, không mô tả user value.
- Tuy nhiên, goal được viết tương đối user-centric: "Loc có thể khởi chạy app lần đầu... sẵn sàng cho feature development." Phần "sẵn sàng cho feature development" là developer-centric, không phải end-user value.
- Đánh giá: **Borderline acceptable** — Epic foundation/infrastructure là trường hợp ngoại lệ được chấp nhận trong greenfield project, nhưng cần ghi nhận.

**Epic Independence:** ✅ Epic 1 không phụ thuộc vào Epic nào khác.

**Stories trong Epic 1:**
- Story 1.1 (Monorepo Setup & Backend Scaffold): Technical setup. ACs: Given/When/Then ✅. Testable ✅. Error scenarios: unknown route → 404 ✅.
- Story 1.2 (Database Schema & Migrations): ⚠️ **Tạo TẤT CẢ 5 tables trong một story**. Best practice là mỗi story chỉ tạo tables mà feature đó cần. Tuy nhiên, trong Rust/SQLx migration pattern, toàn bộ schema thường được define upfront — đây là architectural constraint hợp lý. Acceptable với caveat.
- Story 1.3 (Frontend Scaffold & Design Tokens): Hợp lý, technical foundation với ACs cụ thể.
- Story 1.4 (AppShell Layout & Routing): ✅ User-facing output. ACs rõ ràng.

**Verdict Epic 1:** 🟡 Minor — Tên epic kỹ thuật, Schema upfront (architectural decision, không phải violation).

---

#### Epic 2: Project & Task Management

**User Value Check:** ✅ "Loc có thể tạo Projects và Tasks, xem Task Board dạng kanban" — rõ ràng, user-centric.

**Epic Independence:** ✅ Phụ thuộc đúng vào Epic 1 (app shell, DB schema, token). Không phụ thuộc Epic 3.

**Stories trong Epic 2:**

**Story 2.1 (Project Management & Shared UI Components):**
- ⚠️ **Story này combine 2 concerns**: Project CRUD (user feature) VÀ Shared UI Components (technical library). Đây là violation của single responsibility. Một developer cần implement Button, Toast, ConfirmationDialog (frontend components) — việc này không liên quan trực tiếp đến Project CRUD backend logic.
- ACs: rất đầy đủ, Given/When/Then ✅. Error conditions ✅ (409 Conflict, "Cannot delete with tasks").
- Recommendation: Tách thành Story 2.1a (Shared UI Components) và Story 2.1b (Project CRUD), hoặc chấp nhận nếu team muốn deliver cùng lúc.

**Story 2.2 (Task CRUD & Agent Assignment):**
- ✅ User-centric, FR-1, FR-2, FR-3 được cover.
- ACs đầy đủ: happy path ✅, validation error ✅, state transitions ✅.
- ⚠️ Minor: AC "Task Detail Panel opens automatically" phụ thuộc Story 2.4 (Task Detail Panel). Đây là **forward dependency nhẹ** — Story 2.2 gọi mở Detail Panel nhưng Story 2.4 mới implement panel đó. Nếu delivered theo thứ tự 2.2 trước 2.4, AC này sẽ fail.

**Story 2.3 (Task Board Kanban View):**
- ✅ User-centric, FR-4 cover đầy đủ.
- ACs: Given/When/Then ✅. Empty states ✅. Realtime polling ✅.
- ⚠️ **Kanban spec có 8-10 columns** (Draft/Ready/Assigned/Running/Paused/NeedsReview/ChangesRequested/Completed/Failed/Cancelled). AC "8 columns render (Draft/Ready/Assigned/Running/Paused/NeedsReview/ChangesRequested/Completed/Failed/Cancelled — visible columns per spec)" — nhưng PRD §4.2 đã loại NeedsReview và ChangesRequested khỏi MVP transitions. Columns này có visible nhưng luôn rỗng? Hay hidden? AC cần làm rõ.

**Story 2.4 (Task Detail Panel):**
- ✅ User-centric, FR-11, FR-12 cover đầy đủ.
- ACs: slide-in animation spec ✅, action buttons per status ✅, Session Panel ✅, tabs structure ✅.
- Forward dependency check: Story 2.4 chỉ implement Summary tab placeholder + tabs navigation. Summary Tab content đầy đủ (comment + resume inline) được defer sang Story 3.5 — điều này **hợp lý** vì Story 3.5 là Session UI.

**Verdict Epic 2:** 🟠 Major — Story 2.1 combines 2 concerns; Story 2.2 có forward dependency nhẹ vào 2.4; Story 2.3 ACs có ambiguity về NeedsReview/ChangesRequested columns.

---

#### Epic 3: Session Lifecycle & Agent Execution

**User Value Check:** ✅ "Loc có thể start session... resume đúng session cũ... xem run log. Đây là core value của sản phẩm."

**Epic Independence:** ✅ Phụ thuộc đúng vào Epic 1 (infra) và Epic 2 (task entity tồn tại).

**Stories trong Epic 3:**

**Story 3.1 (AgentStrategy Trait & Start Session):**
- ⚠️ **"AgentStrategy Trait"** trong tên story là technical. Tuy nhiên, story này đồng thời deliver user value (Start Session). Acceptable nhưng tên nên là "Start Session" thuần túy.
- ACs: subprocess spawn ✅, session ID capture (Claude + Codex) ✅, fallback ✅, timeout handling ✅, error if binary missing ✅.
- ACs rất đầy đủ và kỹ thuật — testable ✅.

**Story 3.2 (Session Exit Detection & Graceful Shutdown):**
- ✅ User value: "app tự detect khi agent xong" — user không cần manually check.
- ACs: exit code 0 → Paused ✅, exit code ≠ 0 → Failed ✅, browser close doesn't kill subprocess ✅, Cancel → kill ✅, graceful shutdown ✅.
- ✅ Không có forward dependency.

**Story 3.3 (Resume Session & Comment Tracking):**
- ✅ User-centric. FR-7, FR-9, FR-10 covered.
- ACs: resume command format per-agent ✅, comment → Run.input ✅, no-comment → "retry" ✅.
- ✅ Error cases: resume Running (409) ✅, resume Done/Cancelled (400) ✅, empty comment (400) ✅.
- ✅ Idempotency: sent=1 comment không được gửi lại ✅.

**Story 3.4 (Run Log Dual-Storage):**
- ✅ Technical story nhưng deliver user value (persistent log, view full log, download).
- ACs: file write ✅, DB tail ✅, persistence after restart ✅, GET run endpoint ✅, async non-blocking ✅.
- ✅ Không có forward dependency.

**Story 3.5 (Session UI — Summary, Comments, Runs & Logs Tabs):**
- ✅ User-centric frontend.
- ACs: Summary tab với Resume inline ✅, optimistic UI ✅, live timeline ✅, Comments tab ✅, Runs tab ✅, Logs tab ✅, RunTimeline ✅.
- ⚠️ **Story rất lớn** — cover 4 tabs + RunTimeline component + live polling + optimistic UI. Đây là story có thể mất 5-8 ngày implement. Best practice là story ≤ 2-3 ngày. Recommendation: tách thành Story 3.5a (Summary Tab + Optimistic Resume) và Story 3.5b (Comments + Runs + Logs Tabs).
- ⚠️ **Forward dependency ẩn**: Story 3.5 cần Story 3.1 (session start), 3.2 (exit detection), 3.3 (resume), 3.4 (log data) — tất cả đều là backward dependency hợp lý ✅.

**Verdict Epic 3:** 🟠 Major — Story 3.1 có tên kỹ thuật; Story 3.5 quá lớn, nên tách.

---

#### Epic 4: Dashboard & Operational Visibility

**User Value Check:** ✅ "Loc mở app và trong 3–5 giây biết ngay..." — rõ ràng user value.

**Epic Independence:** ✅ Epic 4 là enhancement/polish của các Epics 1-3. Không có feature nào của 1-3 phụ thuộc vào Epic 4.

**Stories trong Epic 4:**

**Story 4.1 (Morning Dashboard):**
- ✅ User-centric, UX-DR17 covered.
- ACs: greeting ✅, section order ✅ (Needs Review → Failed → Running → Ready → Activity → Completed), stats bar ✅, "all caught up" empty state ✅.
- ⚠️ Dashboard sections bao gồm "Needs Your Review" (tasks in NeedsReview/ChangesRequested) — nhưng như đã flag ở WARNING-UX-2, các statuses này không có transitions tự động trong PRD MVP. Tasks sẽ không tự chuyển sang NeedsReview trong MVP, vậy section này sẽ luôn rỗng? Cần clarification.

**Story 4.2 (Accessibility & Keyboard Shortcuts):**
- ✅ Đây là story hợp lý cho NFR-6 (WCAG 2.1 AA).
- ACs: focus ring ✅, focus trap ✅, aria-label ✅, aria-live ✅, role="dialog" ✅, icon-only aria-labels ✅, skip link ✅, shortcuts ⌘K/⌘N/R/Esc ✅, contrast ratio ✅.
- ⚠️ ACs cho keyboard shortcut `R` (Resume) — chỉ hoạt động khi Detail Panel open và focused. AC không specify điều kiện này rõ ràng.

**Story 4.3 (Responsive Layout):**
- ✅ User value rõ ràng (NFR-free), covers UX-DR20.
- ACs: ≥1440px push layout ✅, 1280-1439px overlay ✅, 1024-1279px icon sidebar ✅, tablet drawer ✅, mobile message ✅.
- ✅ Không có forward dependency.

**Verdict Epic 4:** 🟡 Minor — Story 4.1 có ambiguity về NeedsReview section; Story 4.2 AC cho `R` shortcut thiếu điều kiện.

---

### Dependency Analysis

#### Within-Epic Dependencies

| Dependency | Type | Assessment |
|-----------|------|------------|
| Story 1.2 cần Story 1.1 (backend running) | Backward ✅ | Hợp lý |
| Story 1.3 cần Story 1.1 (Vite proxy to backend) | Backward ✅ | Hợp lý |
| Story 1.4 cần Story 1.3 (routing, tokens) | Backward ✅ | Hợp lý |
| Story 2.2 AC "Task Detail Panel opens" | Forward ⚠️ | Cần 2.4 chưa implement |
| Story 2.3 cần Story 2.2 (task data) | Backward ✅ | Hợp lý |
| Story 2.4 cần Story 2.2 (task entity) | Backward ✅ | Hợp lý |
| Story 3.1 cần Story 2.2 (Assigned task) | Cross-epic ✅ | Backward hợp lý |
| Story 3.3 cần Story 3.1 (session exists) | Backward ✅ | Hợp lý |
| Story 3.4 cần Story 3.1 (Run record) | Backward ✅ | Hợp lý |
| Story 3.5 cần Stories 3.1-3.4 | Backward ✅ | Hợp lý |
| Story 4.1 cần Stories 2.x + 3.x (task data) | Cross-epic ✅ | Backward hợp lý |

#### Database/Entity Creation Timing

Story 1.2 tạo TẤT CẢ 5 tables upfront (projects, tasks, sessions, runs, comments) — đây là trường hợp ngoại lệ hợp lý cho Rust/SQLx migration pattern với `sqlx::migrate!()`. Không thể split migrations dễ dàng trong Rust workflow mà không tạo ra migration ordering problems.

### Best Practices Compliance Checklist

| Epic | User Value | Independent | Sized OK | No Forward Deps | Clear ACs | FR Traceability |
|------|-----------|-------------|----------|-----------------|-----------|-----------------|
| Epic 1 | ⚠️ Borderline | ✅ | ✅ | ✅ | ✅ | ✅ (Architecture) |
| Epic 2 | ✅ | ✅ | ⚠️ Story 2.1 | ⚠️ Story 2.2 | ✅ | ✅ |
| Epic 3 | ✅ | ✅ | ⚠️ Story 3.5 | ✅ | ✅ | ✅ |
| Epic 4 | ✅ | ✅ | ✅ | ✅ | ⚠️ Story 4.1, 4.2 | ✅ (Aggregation) |

### Quality Findings Summary

#### 🔴 Critical Violations
Không có critical violation.

#### 🟠 Major Issues

**ISSUE-EQ-1:** Story 2.1 combines Project CRUD (user feature) với Shared UI Component Library (technical library) trong một story. Nếu stories được assigned riêng lẻ, một developer phải làm cả backend API lẫn toàn bộ frontend component library.
- **Remediation:** Tách thành Story 2.0 (Shared UI Components) và Story 2.1 (Project CRUD), với 2.1 phụ thuộc vào 2.0.

**ISSUE-EQ-2:** Story 2.2 AC: "Task Detail Panel opens automatically showing the new task" — đây là forward dependency vào Story 2.4 (Task Detail Panel). Nếu dev implement 2.2 trước 2.4, AC này sẽ không pass.
- **Remediation:** Đổi AC thành "New task appears on the Task Board in Draft column" hoặc thêm note "requires Story 2.4 completed first."

**ISSUE-EQ-3:** Story 3.5 quá lớn — cover 4 tabs UI (Summary, Comments, Runs, Logs), RunTimeline component, live polling, optimistic UI. Estimate: 5-8 ngày.
- **Remediation:** Tách thành Story 3.5a (Summary Tab: comment textarea + optimistic Resume UI + live timeline) và Story 3.5b (Comments Tab, Runs Tab, Logs Tab, RunTimeline component).

#### 🟡 Minor Concerns

**CONCERN-EQ-1:** Epic 1 tên kỹ thuật ("Infrastructure"). Không block delivery nhưng không user-centric.

**CONCERN-EQ-2:** Story 3.1 tên kỹ thuật ("AgentStrategy Trait"). Suggest renaming to "Start Agent Session".

**CONCERN-EQ-3:** Story 2.3 AC đề cập NeedsReview và ChangesRequested columns nhưng PRD loại các status này khỏi MVP transitions. Cần clarification: columns có visible nhưng empty, hay hidden?

**CONCERN-EQ-4:** Story 4.1 Dashboard section "Needs Your Review" — tasks không thể đạt trạng thái NeedsReview trong MVP (vì không có automatic transitions). Section sẽ luôn empty. Cần quyết định: remove section, hoặc clarify rằng user có thể manually set status?

**CONCERN-EQ-5:** Story 4.2 AC cho keyboard shortcut `R` thiếu điều kiện: phải specify "khi Task Detail Panel đang open VÀ focus ở trong panel".

## Summary and Recommendations

### Overall Readiness Status

## 🟡 NEEDS WORK (Minor-to-Moderate)

Planning artifacts chất lượng cao — PRD rõ ràng, Architecture solid, UX spec chi tiết, FR/NFR coverage 100%. Tuy nhiên có một số issue trong epics và stories cần giải quyết trước khi bắt đầu Phase 4 để tránh confusion trong quá trình implement.

---

### Critical Issues Requiring Immediate Action

**Không có Critical (🔴) violations.** Tất cả issues đều ở mức Major hoặc Minor và có thể resolve nhanh.

---

### Major Issues (🟠 — Nên fix trước khi implement)

**ISSUE-EQ-1 — Story 2.1 kết hợp 2 concerns:**
Story 2.1 gộp "Shared UI Components" (Button, Toast, ConfirmationDialog...) với "Project CRUD" (API + backend). Một developer sẽ phải làm cả frontend component library lẫn backend API trong cùng một story.
- **Action:** Tách thành Story 2.0 (Shared UI Components) và Story 2.1 (Project CRUD). Story 2.1 phụ thuộc vào 2.0.

**ISSUE-EQ-2 — Forward dependency trong Story 2.2:**
AC "Task Detail Panel opens automatically showing the new task" yêu cầu Story 2.4 (Task Detail Panel) phải được implement trước. Nếu dev làm 2.2 trước 2.4, AC này sẽ không pass.
- **Action:** Đổi AC thành "New task appears on the Task Board in Draft column" để Story 2.2 có thể pass độc lập.

**ISSUE-EQ-3 — Story 3.5 quá lớn:**
Story 3.5 cover 4 tabs UI, RunTimeline component, live polling, và optimistic UI. Estimate 5-8 ngày — vượt quá story sizing best practice.
- **Action:** Tách thành Story 3.5a (Summary Tab + Optimistic Resume + Live Timeline) và Story 3.5b (Comments, Runs, Logs Tabs + RunTimeline).

---

### Minor Concerns (🟡 — Có thể giải quyết inline khi implement)

**CONCERN-EQ-3 / WARNING-UX-2 — NeedsReview / ChangesRequested status trong MVP:**
PRD §4.2 loại NeedsReview và ChangesRequested khỏi MVP transitions. Nhưng Story 2.3 AC đề cập các columns này, Story 4.1 có section "Needs Your Review", và UX spec có màu/badge cho các statuses này. Cần quyết định rõ:
- **Option A:** Các status colors được giữ lại cho v2, nhưng columns hidden trong MVP Kanban và section "Needs Your Review" bị ẩn.
- **Option B:** Columns visible nhưng không có automatic transitions — user không thể manually set chúng trong MVP.
- **Action:** PM confirm và update Story 2.3 AC + Story 4.1 để align.

**WARNING-UX-1 — UX spec có 6+ views ngoài MVP scope:**
`/reviews`, `/tasks`, `/sessions`, `/agents`, Inbox, My Tasks không được cover bởi bất kỳ Epic hay Story nào. Không phải issue nếu team hiểu đây là v2. Nhưng cần đảm bảo developer đọc UX spec hiểu đúng scope.
- **Action:** Thêm một banner/note vào đầu UX spec: "Sections X, Y, Z là v2 scope, không trong MVP epics."

**CONCERN-EQ-4 — Story 4.1 Dashboard section "Needs Your Review" sẽ luôn empty:**
Vì NeedsReview tasks không được tạo tự động trong MVP. Section này không có giá trị thực tế cho user.
- **Action:** Remove section khỏi Story 4.1 AC, hoặc combine với option A/B ở CONCERN-EQ-3.

**CONCERN-EQ-5 — Story 4.2 `R` shortcut thiếu điều kiện:**
- **Action:** Thêm vào AC: "Given the Task Detail Panel is open AND a task in Paused/Failed status is displayed."

---

### Recommended Next Steps

1. **PM action (15 phút):** Confirm quyết định về NeedsReview/ChangesRequested trong MVP — visible columns nhưng empty, hay hidden? Update Story 2.3 AC.

2. **Epic lead action (30 phút):** Tách Story 2.1 → Story 2.0 (UI Components) + Story 2.1 (Project CRUD). Cập nhật số thứ tự stories trong Epic 2.

3. **Story owner action (10 phút):** Fix forward dependency trong Story 2.2 — thay AC về Task Detail Panel bằng AC về Task Board.

4. **Epic lead action (20 phút):** Tách Story 3.5 → Story 3.5a + Story 3.5b. Đảm bảo 3.5a deliver working Resume flow trong Summary Tab.

5. **UX author action (10 phút):** Thêm scope annotation vào UX spec để mark v2-only sections.

6. **Sau khi fix:** Bắt đầu Phase 4 implementation với Epic 1, theo thứ tự Stories 1.1 → 1.2 → 1.3 → 1.4.

---

### Final Note

Assessment này phát hiện **0 critical, 3 major, 5 minor issues** trong 4 categories (FR Coverage, UX Alignment, Epic Quality, Story Sizing). PRD, Architecture, và UX spec chất lượng cao và đã giải quyết tốt các open questions kỹ thuật phức tạp (session ID capture, subprocess lifecycle, per-agent resume format). Các issues chủ yếu nằm ở story structure và scope clarity.

Với 3 major issues được fix (est. ~1 giờ tổng cộng), dự án sẵn sàng cho Phase 4 implementation.

---

**Report generated:** 2026-05-21
**Assessed by:** Kiro (Implementation Readiness Workflow)
**Documents reviewed:** PRD (v2026-05-20), Architecture (v2026-05-21), UX Spec (v2026-05-20), Epics & Stories (v2026-05-21)
