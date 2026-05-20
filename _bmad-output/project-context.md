---
project_name: 'omni-agent'
user_name: 'Loc'
date: '2026-05-20'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 35
optimized_for_llm: true
---

# Project Context for AI Agents

_File này chứa các rules và patterns quan trọng mà AI agents phải tuân theo khi implement code trong project này. Tập trung vào các chi tiết không hiển nhiên mà agents dễ bỏ sót._

---

## Technology Stack & Versions

- **Frontend:** React + TypeScript (Vite, strict mode)
- **Backend:** Rust (local web server, port localhost)
- **Database:** SQLite — dùng crate `sqlx` hoặc `rusqlite` với connection pool
- **Agent CLI:** Codex CLI, Claude CLI — gọi qua subprocess, **không qua API**
- **Môi trường:** Local only, single-user, không deploy cloud

> Phiên bản cụ thể chưa được pinned (dự án ở giai đoạn planning). Khi khởi tạo, dùng phiên bản stable mới nhất và ghi rõ vào `Cargo.toml` / `package.json`.

---

## Critical Implementation Rules

### Language-Specific Rules

**Rust (Backend):**
- Dùng `async/await` với `tokio` runtime — không dùng blocking calls trong async context
- Error handling: `thiserror` cho custom error types, `anyhow` cho application-level errors
- Tất cả subprocess calls phải non-blocking (`tokio::process::Command::spawn`)
- Session ID lưu nội bộ dưới dạng UUID string — dùng crate `uuid`
- SQLite access qua connection pool, không single connection

**TypeScript/React (Frontend):**
- TypeScript strict mode bắt buộc
- State management: ưu tiên React built-in (useState, useContext) trước khi dùng thư viện ngoài
- Giao tiếp với backend qua REST — thống nhất pattern trước khi implement

---

### Framework-Specific Rules

**React — Action buttons phụ thuộc chặt chẽ vào task status:**
- `Assigned` → chỉ "Start Session"
- `Running` → không có action button
- `Paused` / `Failed` → "Resume", "Mark Done", "Cancel"
- `Done` / `Cancelled` → read-only, không có button nào

**React — Layout:**
- Task Board là kanban theo status — mỗi task xuất hiện đúng **một** cột
- Task Detail dùng slide-in panel (420px) từ phải, không modal full-screen
- Session ID mặc định **ẩn** — chỉ hiện khi user toggle "Show ID"

**Rust Backend — Subprocess lifecycle:**
- Backend là **process owner** — subprocess sống độc lập với HTTP request/browser session
- Khi backend shutdown: flush tất cả task `Running` → `Paused` xuống DB **trước** khi exit
- Subprocess bị kill **chỉ** trong 3 trường hợp: user bấm Cancel, backend shutdown, timeout policy

---

### Testing Rules

**Rust:**
- Unit tests trong cùng file với `#[cfg(test)]` module
- Integration tests trong `tests/` directory ở root của crate
- Subprocess calls phải được mock — không spawn process thật trong unit test
- DB tests dùng in-memory SQLite (`:memory:`)

**React:**
- Test framework: Vitest + React Testing Library
- Test file đặt cạnh component: `ComponentName.test.tsx`
- Test behavior từ góc độ user, không test implementation details
- Mock fetch/API calls — không call backend thật trong component tests

---

### Code Quality & Style Rules

**Naming:**
- Task ID format: `{PROJECT_KEY}-NNN` (PROJECT_KEY: uppercase letters+digits, không space, unique trong app)
- Rust: `snake_case` cho functions/variables, `PascalCase` cho types/structs/enums
- React components: `PascalCase` cho tên file và component (`TaskCard.tsx`)
- CSS variables: `kebab-case` (`--bg-app`, `--brand-primary`)

**Design System (CSS variables — bắt buộc dùng, không hardcode hex):**
- Font stack: `Inter, Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- Mono font chỉ dùng trong Logs/Technical tab

**Data:**
- Log file lưu trên disk — path được lưu trong DB theo Run record
- DB chỉ lưu tail log (last ~100 lines / 10 KB), không full output
- Comment rỗng không được lưu vào DB
- Xóa Project bị block nếu còn Task — trả về error rõ ràng

---

### Development Workflow Rules

**Agent CLI — Resume commands:**
- Claude: `claude --continue --session-id <uuid>` với comment làm stdin/prompt
- Codex: `codex resume <uuid>` với comment làm stdin hoặc prompt tiếp theo

**Agent CLI — Session ID capture:**
- Claude: parse từ `session_id` field trong JSON output
- Codex: parse từ JSON/event output trước → fallback scan `~/.codex/sessions/` lọc theo cwd + modified time gần nhất
- Nếu không capture được sau timeout → log warning, cho phép user nhập thủ công

**Local:**
- SQLite file là single source of truth — không sync, không replicate
- Subprocess chạy với cwd của backend process

**Git:** Dùng conventional commits làm default.

---

### Critical Don't-Miss Rules

**KHÔNG làm (hard rules):**
- ❌ Tạo session mới khi Resume — phải dùng đúng session ID cũ
- ❌ Kill subprocess khi browser/tab đóng
- ❌ Lưu full log output vào DB
- ❌ Hiển thị Session ID mặc định trong UI
- ❌ Cho phép xóa Project còn Task
- ❌ Cho phép Edit Task ở trạng thái Done/Cancelled
- ❌ Lưu Comment rỗng
- ❌ Render action button không hợp lệ với trạng thái task
- ❌ Gọi Codex/Claude qua API

**Edge cases phải xử lý:**
- CLI binary không tìm thấy trên PATH → error rõ ràng, giữ trạng thái `Assigned`
- Session ID không capture được → log warning, cho phép nhập thủ công
- Backend shutdown bất ngờ → flush `Running` → `Paused` trước khi exit
- Resume không có comment → ghi "retry" vào Run log, không lỗi

**Business logic quan trọng:**
- Mỗi Task có **tối đa một** Session active tại một thời điểm
- Comment đã gửi vào agent phải được đánh dấu "sent" — không gửi lại lần resume sau
- Task ID scoped theo Project — `OMNI-001` và `PROJ-001` là hai task khác nhau
- Subprocess exit code 0 → Task status `Paused`; exit code ≠ 0 → `Failed`

---

## Usage Guidelines

**Dành cho AI Agents:**
- Đọc file này trước khi implement bất kỳ code nào
- Tuân theo TẤT CẢ rules chính xác như đã ghi
- Khi không chắc, chọn option restrictive hơn
- Cập nhật file này nếu phát hiện pattern mới

**Dành cho Humans:**
- Giữ file này ngắn gọn, tập trung vào những gì agent cần
- Cập nhật khi tech stack thay đổi
- Review định kỳ để loại bỏ rules đã lỗi thời

_Last Updated: 2026-05-20_
