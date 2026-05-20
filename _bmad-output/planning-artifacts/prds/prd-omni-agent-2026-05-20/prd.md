---
title: omni-agent
status: final
created: 2026-05-20
updated: 2026-05-20
---

# PRD: omni-agent

## 0. Mục đích tài liệu

PRD này dành cho product manager, developer và các downstream workflow owners (UX, architecture, epics). Tài liệu sử dụng bộ từ vựng được định nghĩa trong §3 Glossary. Các tính năng được nhóm theo feature group với FR nested bên trong. Các giả định được đánh dấu inline bằng `[ASSUMPTION]` và tổng hợp ở §9.

Input chính: `docs/US-omni-agent.md` — tài liệu mô tả ý tưởng sản phẩm do Loc soạn thảo.

---

## 1. Vision

**omni-agent** là một task board dành riêng cho AI CLI agents. Thay vì quản lý chat hay conversation, người dùng quản lý *task* — mỗi task được gắn với một session thực của Codex, Claude, hoặc CLI agent khác. Khi muốn làm tiếp, người dùng mở task, gõ comment, và app tự resume đúng session cũ.

Vấn đề cốt lõi mà omni-agent giải quyết: khi làm việc với nhiều AI CLI agent song song, context bị phân tán — task nằm ở file, terminal, note; session ID bị quên; không biết task nào đang dở ở đâu. omni-agent là lớp quản lý metadata nằm bên trên các agent, giúp người dùng không bao giờ mất track.

Điểm khác biệt của omni-agent so với task manager thông thường là khái niệm **Session-as-Asset**: mỗi task sở hữu một session agent có thể resume bất kỳ lúc nào. Agent session là "working memory" của task — mất session là mất khả năng tiếp tục tự nhiên.

---

## 2. Target User

### 2.1 Primary Persona

**Loc** — developer cá nhân, thường xuyên dùng Codex và Claude CLI để xử lý nhiều task song song: coding, review, refactor, debug. Làm việc trên máy local, không cần multi-user hay cloud sync. Điểm đau chính là mất track context giữa các session khi chuyển qua lại giữa các task.

### 2.2 Jobs To Be Done

- Biết ngay task nào đang ở trạng thái nào mà không cần mở terminal hay tìm lại note.
- Resume đúng agent session của một task cụ thể mà không cần nhớ session ID hay tìm lại lệnh.
- Gửi thêm chỉ dẫn cho agent đang xử lý một task mà không phải bắt đầu lại từ đầu.
- Xem output/log của lần chạy gần nhất mà không cần mở terminal.
- Quản lý nhiều task song song (mỗi task một agent khác nhau) mà không bị lẫn context.

### 2.3 Non-Users (v1)

- Team nhiều người dùng chung (multi-user).
- Người dùng cần sync dữ liệu lên cloud hay CI/CD.
- Người dùng cần workflow tự động hóa phức tạp (auto-planning, auto-review).

### 2.4 Key User Journeys

**UJ-1. Loc tạo task mới và assign cho Codex.**
- **Persona + context:** Loc vừa nhận ra cần fix một bug, mở omni-agent trên trình duyệt local.
- **Entry state:** App đang hiển thị Task Board. Chưa có session nào cho task này.
- **Path:** Bấm "Tạo task" → điền Title, Description, Acceptance Criteria → chọn Agent = Codex, Role = Coder → Save.
- **Climax:** Task xuất hiện trên board ở cột "Ready" với label "Codex / Coder".
- **Resolution:** Task ở trạng thái Assigned, chờ Loc bấm Start Session.

**UJ-2. Loc start session và giao task cho agent.**
- **Persona + context:** Loc mở task TASK-001 đang ở trạng thái Assigned.
- **Entry state:** Task Detail đang mở, có nút "Start Session".
- **Path:** Bấm "Start Session" → App spawn CLI subprocess Codex với task description làm input → Session ID được lưu → Status chuyển sang Running.
- **Climax:** App hiển thị Session Panel với Session ID và trạng thái "Running".
- **Resolution:** Codex đang xử lý. Loc có thể đóng app và quay lại sau.
- **Edge case:** Nếu CLI agent không khởi động được (binary không tìm thấy), app hiển thị lỗi rõ ràng và giữ trạng thái Assigned.

**UJ-3. Loc quay lại task cũ và resume session.**
- **Persona + context:** Vài tiếng sau, Loc mở lại app, task đang ở Paused.
- **Entry state:** Task Board hiển thị TASK-001 ở cột Paused.
- **Path:** Bấm vào card → Task Detail hiển thị last activity, last output → Loc gõ comment mới → Bấm "Resume Session".
- **Climax:** App resume đúng session Codex cũ (dùng cơ chế resume của CLI, ví dụ flag `--resume <session-id>`), gửi comment mới làm input.
- **Resolution:** Status chuyển sang Running. Codex tiếp tục từ context cũ.

**UJ-4. Loc xem output và đánh dấu task Done.**
- **Persona + context:** Codex báo xong, task ở trạng thái Needs Review.
- **Entry state:** Task Detail mở, có output/log của lần chạy cuối.
- **Path:** Loc xem output → verify Acceptance Criteria đã đủ → Bấm "Mark Done".
- **Climax:** Task chuyển sang Done, Session được đánh dấu Closed.
- **Resolution:** Task Board cập nhật. Task vẫn xem được trong lịch sử.

---

## 3. Glossary

- **Task** — Đơn vị công việc trung tâm của app. Có title, description, acceptance criteria, trạng thái, và một Session gắn liền. Một Task thuộc về một Project.
- **Project** — Nhóm chứa nhiều Task. Người dùng có thể tạo nhiều Project, mỗi Task thuộc một Project. Task Board hiển thị Task của Project đang chọn.
- **Session** — Một lần chạy CLI agent gắn với một Task. Lưu agent type, session ID (UUID string chuẩn hóa nội bộ), trạng thái, thời gian bắt đầu, lần cuối hoạt động. Mỗi Task có tối đa một Session active tại một thời điểm.
- **Agent** — CLI tool được gọi qua subprocess: Codex hoặc Claude. Mỗi agent có cơ chế resume riêng: Codex dùng `codex resume <uuid>`, Claude dùng `claude --continue --session-id <uuid>`.
- **Run** — Một lần gọi CLI agent trong vòng đời của một Session: lần start đầu tiên, hoặc mỗi lần resume. Mỗi Run có timestamp, input gửi đi, và output/log nhận về.
- **Comment** — Input mới người dùng gửi vào Task sau lần chạy đầu. Khi Resume, Comment trở thành input gửi vào agent session cũ.
- **Task Status** — Trạng thái lifecycle của Task. Xem §4.2 cho danh sách và transitions đầy đủ. MVP có 8 trạng thái: Draft, Ready, Assigned, Running, Paused, Failed, Done, Cancelled.
- **Session Status** — Trạng thái của Session: `none` (chưa có), `running`, `paused`, `closed`.
- **Resume** — Hành động gọi lại CLI agent với đúng session ID và input mới (comment), không tạo session mới.
- **Artifact** — File hoặc output có ý nghĩa agent tạo ra trong một Run, được app lưu đường dẫn để tham chiếu.

---

## 4. Features

### 4.1 Project Management

**Mô tả:** Người dùng tạo và quản lý nhiều Project. Mỗi Task thuộc một Project. Task Board hiển thị theo Project đang chọn. Đây là lớp tổ chức cao nhất — không có workflow hay permission phức tạp.

**Functional Requirements:**

#### FR-0: Project CRUD

Người dùng có thể tạo Project mới với tên (bắt buộc) và key viết tắt (bắt buộc, ví dụ `OMNI` — dùng làm prefix cho Task ID), đổi tên, và xóa Project rỗng (không có Task). Task Board lọc theo Project đang active.

**Consequences (testable):**
- Project mới xuất hiện trong danh sách project selector.
- Project key phải unique trong app, chỉ gồm chữ in hoa và số, không có space.
- Chuyển project → Task Board chỉ hiển thị Task của project đó.
- Xóa Project có Task bị block — app hiển thị error.
- Tên Project không được để trống.

---

### 4.2 Task Management

**Mô tả:** Người dùng tạo, xem, cập nhật, và quản lý vòng đời của Task. Mỗi Task có Title, Description, Acceptance Criteria (tùy chọn), Agent được assign, Role của agent, và trạng thái lifecycle. Task Board hiển thị tất cả task theo trạng thái dạng kanban. Realizes UJ-1, UJ-4.

**Trạng thái Task — transitions MVP:**

| Status | Ý nghĩa | Chuyển sang |
|---|---|---|
| Draft | Mới tạo, chưa đủ mô tả | Ready (thủ công) |
| Ready | Đủ mô tả, có thể assign | Assigned (khi assign agent) |
| Assigned | Đã chọn agent, chưa chạy | Running (khi Start Session) |
| Running | Agent đang xử lý | Paused (subprocess exit 0) / Failed (exit ≠ 0) |
| Paused | Session tạm dừng, có thể resume | Running (Resume) / Done (thủ công) / Cancelled (thủ công) |
| Failed | Run lỗi | Running (Resume/retry) / Cancelled (thủ công) |
| Done | Hoàn tất | — |
| Cancelled | Đã dừng | — |

> **MVP:** `Needs Input` và `Needs Review` được bỏ khỏi transitions tự động. Người dùng chỉ cần chuyển task sang Done khi xong. Có thể thêm lại ở v2 với output parsing.

**Functional Requirements:**

#### FR-1: Tạo Task

Người dùng có thể tạo Task mới trong Project đang active với Title (bắt buộc), Description (bắt buộc), và Acceptance Criteria (tùy chọn). Task mới được tạo ở trạng thái `Draft`.

**Consequences (testable):**
- Task được lưu vào database với ID duy nhất, scope theo Project (định dạng `{PROJECT_KEY}-NNN`, ví dụ `OMNI-001`).
- Task xuất hiện trên Task Board ở cột Draft.
- Title không được để trống — app hiển thị validation error nếu vi phạm.

#### FR-2: Assign Agent cho Task

Người dùng có thể assign Agent (Codex, Claude) và Role (Coder, Reviewer, Planner, Debugger, Refactorer) cho Task ở trạng thái Draft hoặc Ready. Sau khi assign, trạng thái chuyển sang `Assigned`.

**Consequences (testable):**
- Task hiển thị Agent và Role đã chọn trên card và trong Task Detail.
- Trạng thái chuyển từ Draft/Ready → Assigned.

#### FR-3: Cập nhật và xóa Task

Người dùng có thể chỉnh sửa Title, Description, Acceptance Criteria của Task ở bất kỳ trạng thái nào trừ `Done` và `Cancelled`. Người dùng có thể xóa Task ở trạng thái Draft.

**Consequences (testable):**
- Thay đổi được lưu ngay khi người dùng save.
- Task ở trạng thái Done/Cancelled không có nút Edit.
- Xóa Task Draft xóa luôn mọi data liên quan (không có session để clean up).

#### FR-4: Task Board (Kanban View)

Task Board hiển thị tất cả Task theo trạng thái. Mỗi card hiển thị: Task ID, Title, Agent, Session status, thời gian hoạt động gần nhất. Realizes UJ-3.

**Consequences (testable):**
- Mỗi Task xuất hiện đúng một cột tương ứng với trạng thái hiện tại.
- Card cập nhật realtime (hoặc sau refresh) khi trạng thái thay đổi.

---

### 4.2 Session Lifecycle

**Mô tả:** App quản lý vòng đời của Session gắn với Task: start, pause (ngầm định khi subprocess kết thúc), resume với comment mới. App spawn CLI subprocess thực sự và lưu session ID được trả về. Realizes UJ-2, UJ-3.

**Functional Requirements:**

#### FR-5: Start Session

Người dùng có thể Start Session cho Task ở trạng thái `Assigned`. App spawn CLI agent subprocess với task description làm input ban đầu. Session ID được lưu lại. Trạng thái Task chuyển sang `Running`.

**Consequences (testable):**
- CLI subprocess được gọi với đúng command của agent (ví dụ: `codex "<task description>"`).
- Session ID (UUID string) được capture theo thứ tự ưu tiên:
  - **Claude:** parse từ JSON output (`session_id` field).
  - **Codex:** parse từ JSON/event output nếu có; fallback scan `~/.codex/sessions/` lọc theo cwd và modified time gần nhất.
- Session ID được lưu vào database sau khi capture thành công.
- Trạng thái Task chuyển sang Running.
- Nếu CLI binary không tồn tại trên PATH, app hiển thị error và giữ trạng thái Assigned.
- Nếu session ID không capture được sau timeout hợp lý, app log warning và cho phép người dùng nhập thủ công.

#### FR-6: Phát hiện Session kết thúc

App phát hiện khi CLI subprocess kết thúc (exit). Nếu agent exit bình thường, trạng thái Task chuyển sang `Paused`. Nếu exit với error code, chuyển sang `Failed`.

Backend là process owner — subprocess tiếp tục chạy khi người dùng đóng tab hoặc browser. Subprocess chỉ bị kill trong các trường hợp: người dùng bấm Stop/Cancel, backend shutdown, hoặc timeout policy.

**Consequences (testable):**
- Subprocess exit code 0 → Task status = Paused.
- Subprocess exit code != 0 → Task status = Failed, error message được lưu vào Run log.
- Đóng browser tab không ảnh hưởng đến subprocess đang chạy.
- Bấm Cancel trên Task đang Running → subprocess bị kill → Task status = Cancelled.
- Backend shutdown → tất cả subprocess đang chạy bị kill, trạng thái Task tương ứng chuyển sang Paused để có thể resume sau. [ASSUMPTION: trạng thái được flush xuống DB trước khi backend exit]

#### FR-7: Resume Session

Người dùng có thể Resume Session cho Task ở trạng thái `Paused` hoặc `Failed`, kèm theo Comment tùy chọn. Nếu không có comment mới, app retry với input rỗng hoặc tái gửi comment gần nhất. Realizes UJ-3.

**Consequences (testable):**
- Command resume đúng format theo từng agent:
  - **Claude:** `claude --continue --session-id <uuid>` với comment (nếu có) làm stdin/prompt
  - **Codex:** `codex resume <uuid>` với comment (nếu có) làm stdin hoặc prompt tiếp theo
- Run mới được tạo với timestamp và input = comment (hoặc ghi rõ "retry" nếu không có comment).
- Trạng thái Task chuyển sang Running.
- Nút Resume không hiển thị với Task ở trạng thái Running, Done, Cancelled.
- Task ở trạng thái `Failed` cũng có nút Resume (để retry).

#### FR-8: Lưu Run Log và Output

Mỗi Run (start hoặc resume) được lưu với: timestamp, input, exit code. Full output (stdout/stderr) được ghi ra **file log** trên disk. DB chỉ lưu metadata và tail (last N lines). UI mặc định hiển thị last N lines; người dùng có thể xem full log hoặc download raw log.

**Consequences (testable):**
- Full output được ghi ra file log (path lưu trong DB theo Run).
- DB lưu tối đa last 100 lines (hoặc 10 KB) làm tail. [ASSUMPTION: 100 lines / 10 KB là giá trị mặc định hợp lý — có thể điều chỉnh]
- Task Detail hiển thị tail của Run gần nhất theo mặc định.
- Có nút "View full log" mở file log, và nút download raw log file.
- Log file vẫn tồn tại khi app đóng và mở lại.

---

### 4.3 Comment

**Mô tả:** Người dùng thêm Comment vào Task để gửi chỉ dẫn mới cho agent trong lần resume tiếp theo. Comment là input — không phải conversation. Realizes UJ-3.

**Functional Requirements:**

#### FR-9: Thêm Comment

Người dùng có thể thêm Comment vào Task ở bất kỳ trạng thái nào trừ `Cancelled`. Comment được lưu với timestamp và nội dung text.

**Consequences (testable):**
- Comment xuất hiện trong Task Detail theo thứ tự thời gian.
- Comment rỗng không được lưu.

#### FR-10: Comment làm input cho Resume

Khi Resume, nội dung Comment mới nhất (hoặc comment được người dùng chọn) trở thành input gửi vào agent session. Comment đã dùng được đánh dấu để tránh dùng lại. Realizes UJ-3.

**Consequences (testable):**
- Input gửi đến agent khi resume bao gồm comment text, không phải toàn bộ lịch sử.
- Comment đã gửi vào agent được đánh dấu "sent" trong UI.

---

### 4.4 Session Panel và Task Detail

**Mô tả:** Task Detail là màn hình trung tâm khi làm việc với một task cụ thể. Session Panel là block thông tin về session hiện tại của task. Realizes UJ-2, UJ-3, UJ-4.

**Functional Requirements:**

#### FR-11: Task Detail View

Task Detail hiển thị: Title, Description, Acceptance Criteria, Agent/Role đã assign, Session Panel, danh sách Comments, danh sách Runs, và các action buttons phù hợp với trạng thái hiện tại.

**Consequences (testable):**
- Action buttons hiển thị đúng theo trạng thái:
  - Assigned → Start Session
  - Running → (không có action, chỉ xem)
  - Paused / Failed → Resume, Mark Done, Cancel
  - Done / Cancelled → (chỉ xem)
- Không hiển thị button không hợp lệ với trạng thái hiện tại.

#### FR-12: Session Panel

Session Panel hiển thị: Agent type, Session ID (có thể ẩn/hiện), Session Status, thời gian tạo, lần resume cuối.

**Consequences (testable):**
- Session Panel chỉ hiển thị khi Task đã có Session (từ trạng thái Running trở đi).
- Session ID mặc định bị ẩn, có toggle "Show ID" cho debug.

---

## 5. Non-Goals (Explicit)

- **Không quản lý context nội bộ của agent.** App chỉ lưu metadata — session ID, status, log. Context sâu do Codex/Claude tự quản lý trong session của họ.
- **Không build thêm agent mới.** omni-agent không phải AI agent, không xử lý task thay người dùng.
- **Không sync lên cloud.** Toàn bộ dữ liệu lưu local.
- **Không multi-user.** v1 chỉ cho một người dùng trên máy local.
- **Không tự động review hay planning.** Không có workflow tự động nào ngoài start/resume subprocess.
- **Không tích hợp GitHub, Jira, hay bất kỳ external tool nào** trong v1.
- **Không dashboard cost/token** — không track token usage hay cost của agent.
- **Không workflow engine phức tạp** — không có conditional routing, multi-step pipeline, hay agent-to-agent handoff.

---

## 6. MVP Scope

### 6.1 In Scope

- Project CRUD (tạo, đổi tên, xóa project rỗng).
- Task CRUD (tạo, xem, sửa, xóa Draft) trong context của Project.
- Assign agent (Codex, Claude) và role cho task.
- Start Session: spawn CLI subprocess, capture và lưu session ID (UUID).
- Pause/Resume Session: detect subprocess exit, resume với comment input.
- Run log: full output ghi ra file, DB lưu tail, UI hiển thị last N lines + nút view/download full log.
- Comment: thêm comment, dùng comment làm input khi resume.
- Task Board (kanban view theo status), lọc theo Project.
- Task Detail view với Session Panel.
- Local storage (SQLite).
- React frontend + Rust backend (local web app, port localhost).

### 6.2 Out of Scope cho MVP

- Gemini hoặc custom CLI agent khác ngoài Codex/Claude. [NOTE FOR PM: dễ thêm sau nếu abstract đúng cơ chế per-agent config]
- Tự động detect "Needs Review" hay "Needs Input" từ output của agent — người dùng tự chuyển trạng thái. [NOTE FOR PM: có thể làm sau bằng output parsing heuristic]
- Real-time streaming output từ subprocess vào UI.
- File browser hay diff viewer cho Artifacts.
- Export/import task data.
- Keyboard shortcuts và power-user features.

---

## 7. Success Metrics

**Primary**
- **SM-1:** Loc dùng app hàng ngày để track ít nhất 3 task active song song trong 4 tuần liên tiếp sau khi ra MVP. Validates FR-1, FR-4, FR-11.
- **SM-2:** Resume thành công (subprocess chạy đúng session cũ) ≥ 90% số lần thực hiện. Validates FR-7.

**Secondary**
- **SM-3:** Thời gian từ "muốn resume task cũ" đến "subprocess đã chạy" ≤ 30 giây (bao gồm thao tác UI). Validates FR-7, FR-11.
- **SM-4:** Không có task nào bị "mất session" (session ID bị null sau khi đã start) trong điều kiện bình thường. Validates FR-5, FR-8.

**Counter-metrics (không tối ưu)**
- **SM-C1:** Số lần tạo task mới thay vì comment vào task cũ không được tăng — nếu tăng, nghĩa là flow comment + resume chưa đủ friction-free. Counterbalances SM-1.

---

## 8. Open Questions

1. ~~**Claude CLI resume mechanism:**~~ **RESOLVED** — xem D-008.
2. ~~**Session ID format:**~~ **RESOLVED** — xem D-008.
3. ~~**Subprocess lifecycle khi app đóng:**~~ **RESOLVED** — xem D-009.
4. ~~**Single project assumption:**~~ **RESOLVED** — MVP hỗ trợ multi-project. Xem FR-0, D-010.
5. ~~**Output size:**~~ **RESOLVED** — Full log ra file, DB lưu tail, UI hiển thị last N lines + view/download. Xem FR-8, D-010.

---

## 9. Assumptions Index

- ~~**§3 / FR-1** — Single project đủ cho MVP.~~ **RESOLVED** — MVP hỗ trợ multi-project.
- ~~**§3 / FR-5** — CLI agent in ra session ID ở stdout theo format có thể parse được.~~ **RESOLVED** — xem D-008.
- ~~**§3 / FR-7** — Claude CLI có cơ chế resume tương tự Codex.~~ **RESOLVED** — xem D-008.
- ~~**§3 / FR-7** — Mỗi agent có config per-agent cho resume command format.~~ **RESOLVED** — format đã confirmed, xem FR-7.
- **§6.1** — SQLite là lựa chọn phù hợp cho local storage với Rust backend.
