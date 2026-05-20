# Omni Agent

Một app dùng để **quản lý công việc được giao cho AI CLI agent**, trong đó mỗi task được gắn với một session thật của Codex/Claude/Gemini.

App không cố “nhớ thay” agent. Codex/Claude đã có context session riêng rồi. App chỉ đóng vai trò:

> Quản lý task, biết task nào thuộc session nào, và giúp anh resume đúng session khi cần làm tiếp.

---

## 1. Vấn đề đang giải quyết

Hiện tại khi làm việc bằng Codex/Claude CLI, anh thường gặp các vấn đề:

```text
- Task nằm rải rác trong file, terminal, chat, note.
- Không nhớ task nào đang làm tới đâu.
- Không nhớ session nào ứng với task nào.
- Muốn tiếp tục task cũ thì phải tự tìm lại session.
- Muốn comment thêm thì phải mở lại CLI, resume thủ công.
- Nhiều task chạy song song rất dễ loạn.
```

App này sinh ra để biến việc đó thành một workflow rõ ràng:

```text
Tạo task
→ Assign cho agent
→ Start session
→ Theo dõi trạng thái
→ Later mở lại task
→ Comment thêm
→ Resume đúng session cũ
```

---

## 2. Ý tưởng cốt lõi

Mỗi task trong app là một “vỏ quản lý” bên ngoài một agent session.

Ví dụ:

```text
TASK-001: Fix login redirect
→ Agent: Codex
→ Session: codex-session-abc123

TASK-002: Review payment flow
→ Agent: Claude
→ Session: claude-session-xyz789

TASK-003: Refactor dashboard UI
→ Agent: Codex
→ Session: codex-session-def456
```

Người dùng không cần nhớ session ID. App nhớ giúp.

Khi mở task, anh chỉ thấy:

```text
Task đang ở trạng thái nào?
Agent nào đang xử lý?
Lần chạy gần nhất ra sao?
Có cần resume không?
Có comment mới không?
```

---

## 3. User journey chính

### Bước 1: Tạo task

Anh tạo một task giống project management app bình thường:

```text
Title:
Fix lỗi login redirect

Description:
Sau khi login thành công, user đang bị redirect sai về /home.
Cần redirect về /dashboard.

Acceptance Criteria:
- Login thành công redirect về /dashboard
- Không ảnh hưởng flow logout
- Có test hoặc cách verify rõ ràng
```

Task ban đầu có trạng thái:

```text
Status: Draft / Ready
Session: chưa có
Agent: chưa assign
```

---

### Bước 2: Assign cho Codex/Claude

Anh chọn agent xử lý task:

```text
Assign to:
- Codex
- Claude
- Gemini
- Custom CLI agent
```

Có thể chọn thêm role nhẹ:

```text
Role:
- Coder
- Reviewer
- Planner
- Debugger
- Refactorer
```

Ví dụ:

```text
TASK-001
Agent: Codex
Role: Coder
```

Lúc này task chưa chạy, chỉ mới được gán agent.

---

### Bước 3: Start session

Anh bấm:

```text
Start Session
```

App sẽ mở một session mới cho agent đó, gửi task description ban đầu vào session.

Sau khi session bắt đầu, app lưu lại:

```text
Task ID: TASK-001
Agent: Codex
Session ID: codex-session-abc123
Started at: ...
Status: Running
```

Từ đây trở đi, session này là session chính của task.

---

### Bước 4: Agent làm việc

Agent xử lý task trong CLI session của nó.

App có thể hiển thị một số thông tin đơn giản:

```text
- Agent đang chạy
- Agent đã dừng
- Agent báo xong
- Agent bị lỗi
- Agent cần anh xác nhận
- Agent có thay đổi file
- Agent có output summary
```

Nhưng app không cần hiểu toàn bộ context nội bộ của agent.

Nó chỉ cần lưu:

```text
Session này thuộc task nào?
Lần chạy này kết thúc thế nào?
Có log/output gì đáng xem?
```

---

### Bước 5: Later mở lại task

Hôm sau hoặc vài tiếng sau, anh mở lại task trong app.

App hiển thị:

```text
TASK-001: Fix lỗi login redirect

Agent: Codex
Session: Đã có
Last status: Completed / Needs input / Failed / Paused
Last activity: 2 hours ago
```

Anh không cần tìm terminal cũ, không cần nhớ session ID.

---

### Bước 6: Comment thêm

Anh comment vào task:

```text
Redirect đã đúng rồi nhưng còn thiếu case user chưa verify email.
Hãy xử lý thêm case đó.
```

Comment này là input mới, không phải toàn bộ context.

App hiểu rằng task này đã có session cũ, nên nó không start session mới.

---

### Bước 7: Resume đúng session cũ

App bấm resume hoặc tự resume:

```text
Resume Session
```

Nội dung gửi vào agent chỉ cần là comment mới:

```text
User added a new comment to TASK-001:

Redirect đã đúng rồi nhưng còn thiếu case user chưa verify email.
Hãy xử lý thêm case đó.

Continue from the existing session context.
```

Codex/Claude tự dùng context cũ của session để hiểu nó đã làm gì trước đó.

App không cần nhồi lại toàn bộ lịch sử.

---

## 4. Nguyên tắc sản phẩm

Ý tưởng này nên có vài nguyên tắc rất rõ:

### 1. Task là trung tâm, không phải chat

Người dùng làm việc theo task:

```text
Tôi muốn task này được xử lý
Tôi muốn task này được review
Tôi muốn task này resume
Tôi muốn task này done
```

Không phải mở từng đoạn chat rời rạc.

---

### 2. Session là tài sản của task

Một session agent không phải thứ tạm bợ. Nó là “working memory” của task.

Vì vậy app phải coi session như một tài sản quan trọng:

```text
Task mất session = mất khả năng resume tự nhiên
```

---

### 3. App không thay thế context của agent

App chỉ giữ metadata:

```text
- task
- assigned agent
- session id
- status
- comments
- runs
- outputs
```

Còn context sâu nằm trong Codex/Claude session.

---

### 4. Comment là cách điều khiển agent

Muốn agent làm tiếp, anh không tạo task mới ngay. Anh comment vào task cũ.

Ví dụ:

```text
- Làm tiếp phần còn thiếu
- Sửa lại theo hướng A
- Đừng đổi file X nữa
- Thêm test cho case Y
- Revert phần Z
```

App biến comment đó thành resume instruction cho session cũ.

---

## 5. Các trạng thái task nên có

MVP có thể dùng trạng thái đơn giản:

```text
Draft
Ready
Assigned
Running
Paused
Needs Input
Needs Review
Done
Failed
Cancelled
```

Ý nghĩa:

```text
Draft       : task mới tạo, chưa sẵn sàng
Ready       : đã đủ mô tả, có thể assign
Assigned    : đã chọn agent nhưng chưa chạy
Running     : agent đang xử lý
Paused      : session tạm dừng, có thể resume
Needs Input : agent cần người dùng bổ sung thông tin
Needs Review: agent làm xong, chờ anh hoặc agent khác review
Done        : task hoàn tất
Failed      : run lỗi
Cancelled   : dừng task
```

---

## 6. Màn hình chính nên có gì

### Task Board

Dạng kanban:

```text
Ready | Running | Needs Review | Paused | Done
```

Mỗi card hiển thị:

```text
TASK-001 Fix login redirect
Agent: Codex
Session: Active
Last run: 10 mins ago
Status: Needs Review
```

---

### Task Detail

Khi mở task:

```text
Title
Description
Acceptance Criteria
Assigned Agent
Session Info
Comments
Runs
Artifacts / Outputs
Buttons:
- Start Session
- Resume Session
- Add Comment
- Send to Review
- Mark Done
```

---

### Session Panel

Một block nhỏ cho biết:

```text
Agent: Codex
Session ID: abc123
Session status: Paused
Created: ...
Last resumed: ...
```

Người dùng bình thường không cần quan tâm session ID, nhưng app vẫn có để debug.

---

## 7. Điểm “wow” của app

Điểm mạnh nhất không phải là task board. Task board thì nhiều app có rồi.

Điểm mạnh là:

```text
Mở một task cũ
→ gõ comment
→ agent tiếp tục đúng session cũ
```

Tức là biến AI CLI agent thành worker có trí nhớ theo từng task.

Anh có thể có 20 task khác nhau, mỗi task có một session riêng, không bị lẫn context.

---

## 8. MVP rất gọn

MVP chỉ cần làm được flow này:

```text
1. Tạo project
2. Tạo task
3. Assign task cho Codex hoặc Claude
4. Start session
5. Lưu session id
6. Hiển thị task đang gắn với session nào
7. Add comment
8. Resume đúng session cũ với comment mới
9. Xem run log/output cuối
```

Chưa cần:

```text
- Multi-agent phức tạp
- Auto planning
- Auto review
- GitHub sync
- Dashboard cost/token
- Workflow engine
- Permission phức tạp
```

---

## 9. Mô tả sản phẩm một câu

Có thể mô tả như này:

> Đây là task board dành cho AI CLI agents. Mỗi task được gắn với một session thật của Codex/Claude. Khi người dùng muốn làm tiếp, họ chỉ cần mở task, comment thêm, và app sẽ resume đúng session cũ thay vì tạo context mới.

Hoặc ngắn hơn:

> Linear/Jira cho AI coding agents, nhưng mỗi issue có một agent session riêng có thể resume.

---

## 10. Tư duy nên giữ

Đại ca nên giữ ý tưởng này thật sắc:

```text
Không build agent mới.
Không thay thế Codex/Claude.
Không quản lý context thay agent.
Không biến mọi thứ thành chat app.

Chỉ quản lý:
Task → Agent → Session → Resume.
```

Đó là lõi sản phẩm.
