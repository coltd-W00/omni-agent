---
project_name: 'omni-agent'
user_name: 'Loc'
date: '2026-05-26'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 92
optimized_for_llm: true
---

# Project Context for AI Agents

_File này chứa các rules và patterns quan trọng mà AI agents phải tuân theo khi implement code trong project này. Tập trung vào các chi tiết không hiển nhiên mà agents dễ bỏ sót._

---

## Technology Stack & Versions

- **Frontend:** React 19.2.6 + TypeScript 6.0.3 + Vite 8.0.13.
- **Frontend routing/state:** React Router 7.15.1; TanStack Query 5.100.11 cho server state.
- **Frontend tests:** Vitest 4.1.7 + React Testing Library 16.3.2 + jsdom 29.1.1.
- **Backend:** Rust edition 2024 + Axum 0.8.9 + Tokio 1.52.3.
- **Database:** SQLite qua SQLx 0.8.6 connection pool; migrations chạy bằng `sqlx::migrate!()`.
- **Backend support crates:** `serde`, `serde_json`, `uuid`, `chrono`, `thiserror`, `anyhow`, `tower-http`, `tracing`.
- **Runtime:** local-only, single-user. Backend dev port `127.0.0.1:8080`; Vite dev port `5173` proxy `/api` sang backend.
- **Agent execution:** Codex CLI và Claude CLI chạy qua subprocess; không gọi agent qua API.
- **Persistent data:** SQLite ở `~/.omni-agent/omni-agent.db`; run logs ở `~/.omni-agent/logs/{task_id}/{run_id}.log`.

> `package.json` và `Cargo.toml` dùng semver ranges cho một số dependency; khi cần exact version, đọc `package-lock.json` và `Cargo.lock`.

---

## Critical Implementation Rules

### Language-Specific Rules

**Rust (Backend):**
- Backend dùng Rust edition 2024; giữ module split hiện tại: `handlers/`, `services/`, `models/`, `db/`, `agent/`.
- Dùng `async/await` với Tokio; không dùng blocking I/O trong request handlers hoặc service async paths.
- HTTP handlers chỉ parse/extract và delegate; business rules nằm trong `services/*`, không mutate domain state trực tiếp trong handler.
- Error responses phải đi qua `AppError` và giữ envelope `{ "error": "<code>", "message": "<human text>" }`.
- Request/response structs dùng `serde(rename_all = "camelCase")`; DB fields có thể `snake_case`, wire format phải camelCase.
- Task status trong DB đang lưu PascalCase nhưng serialize lowercase ra frontend; không so sánh status mới bằng string tùy tiện nếu có helper/service rule sẵn.
- Với PATCH-like update, giữ pattern double-option khi cần phân biệt field absent, explicit `null`, và string value.
- SQLite mutations cần race safety bằng transaction khi sinh sequence/task id hoặc thay đổi nhiều record liên quan.

**TypeScript/React (Frontend):**
- TypeScript strict mode bắt buộc; `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` đang bật trong `tsconfig.app.json`.
- Frontend types dùng string literal constants với `as const` thay vì enum runtime cho task status/agent/role.
- API calls phải đi qua `apiFetch` trong `frontend/src/api/*`; không gọi `fetch` rải rác trong component/hook.
- Backend errors phải được handle như `ApiError` với `status`, `code`, `message`; UI không parse response envelope thủ công.
- Wire format từ backend là camelCase; không introduce snake_case fields trong frontend types hoặc component props.

---

### Framework-Specific Rules

**React / TanStack Query:**
- Server state đi qua TanStack Query hooks trong `frontend/src/hooks/*`; component không tự gọi API client trực tiếp.
- Query keys phải ổn định và scoped theo entity, ví dụ `["tasks", projectId]`, `["task", projectId, taskId]`, `["runs", projectId, taskId]`.
- Khi task hoặc run đang `running`, dùng polling 5s qua `refetchInterval`; không thêm SSE/WebSocket cho MVP.
- Mutations phải invalidate đúng query liên quan; optimistic update phải snapshot và rollback như `useResumeSession`.
- Global provider order đang nằm trong `main.tsx`: `QueryClientProvider` → `ActiveProjectProvider` → `BrowserRouter` → `ToastProvider`.

**React Components / UX:**
- Routes chính đi qua `AppShell`: `/dashboard`, `/board`, fallback `NotFoundRoute`; không tạo landing page.
- Task detail là slide-in complementary panel, đóng bằng Escape/backdrop/close button, focus close button khi mở.
- Action buttons phụ thuộc task status: `assigned` có `Start Session`; `running`, `completed`, `cancelled`, `draft` không có action button; `paused`/`failed` hiển thị resume/done/cancel-related controls theo tab/action area.
- Session ID mặc định ẩn; chỉ reveal qua toggle `Show ID`.
- Board render 8 cột hiện tại và bỏ qua `cancelled`/`paused`; đừng tự thêm cột nếu UX spec/story chưa yêu cầu.
- UI state cục bộ dùng `useState`/context hiện có; không thêm global state library mới.

**Rust / Axum:**
- Axum handlers nhận `State<Arc<AppState>>`, `Path`, `Json`, rồi gọi service; không đặt SQL/business transition trực tiếp trong handler.
- `AppState` giữ `SqlitePool` và `subprocess_map`; subprocess ownership thuộc backend process.
- Dev proxy `/api` nằm ở Vite; backend route shape vẫn phải khớp frontend API client.

---

### Testing Rules

**Backend Rust:**
- Integration tests đặt trong `backend/tests/*_test.rs`; unit tests nhỏ có thể ở cùng module với `#[cfg(test)]`.
- Test API bằng Axum `Router` + `tower::ServiceExt::oneshot`; không cần start TCP server.
- Test DB dùng `sqlite::memory:` và luôn chạy `db::run_migrations(&pool)` trước setup data.
- Khi test subprocess/session, dùng fixture shell scripts trong `backend/tests/fixtures/` và env vars như `OMNI_AGENT_CLAUDE_BIN`, `OMNI_AGENT_CODEX_BIN`, `MOCK_AGENT_*`; không spawn Codex/Claude thật.
- Tests đụng `HOME`, agent env vars, hoặc subprocess lifecycle phải cleanup/kill subprocess; dùng `serial_test` khi env/global state có thể race.
- Assert cả HTTP status lẫn error code trong envelope, ví dụ `invalid_task_title`, `task_not_found`, `session_already_active`.

**Frontend React:**
- Test framework là Vitest + React Testing Library; setup global ở `frontend/src/test-setup.ts`.
- Component tests đặt cạnh component hoặc feature file theo pattern `*.test.tsx` / `*.test.ts`.
- Test behavior qua role, label, visible text, aria attributes; tránh assert implementation internals khi có user-facing signal.
- Mock API modules bằng `vi.mock("../../api/...")`; component tests không gọi backend thật.
- Khi component dùng TanStack Query/context/toast/router, tạo test wrapper/provider rõ trong test thay vì phụ thuộc app root.
- Với optimistic update, polling, timers, hoặc toast auto-dismiss: dùng fake timers có cleanup `vi.useRealTimers()` trong `afterEach`.

---

### Code Quality & Style Rules

**Naming / Domain:**
- Project key format là `^[A-Z][A-Z0-9]{1,7}$`; task id sinh theo `{PROJECT_KEY}-NNN`, sau 999 dùng `{PROJECT_KEY}-{seq}`.
- Backend Rust dùng `snake_case` cho fields nội bộ/DB structs, nhưng API JSON phải camelCase qua serde.
- Frontend components dùng `PascalCase.tsx`; hooks dùng `use*.ts`; API modules nằm trong `frontend/src/api/*`; domain types nằm trong `frontend/src/types/*`.
- Status labels có mapping UI riêng: backend/wire status không tự động đồng nghĩa với label hiển thị như `failed` → “Blocked”, `completed` → completed/done semantics.

**CSS / UI Style:**
- `frontend/src/styles/tokens.css` là source of truth cho colors, spacing, radius, font, shadow; không hardcode hex mới trong component CSS nếu token đã có.
- Component CSS dùng class prefix/BEM theo component, ví dụ `app-button`, `app-button--primary`, `task-detail-panel__header`.
- Global CSS chỉ setup base/reset và import tokens; style cụ thể đặt cạnh component/feature.
- Focus states phải dùng token như `--shadow-focus`; không bỏ accessibility affordance khi chỉnh CSS.
- Mono font chỉ dùng cho logs/technical output; UI thường dùng `--font-family-sans`.

**Backend Style:**
- Validation errors phải có stable machine code (`invalid_project_key`, `project_has_tasks`, etc.) và human message rõ.
- Dùng `.chars().count()` khi validate độ dài user-facing text để không reject sai Unicode.
- Không thêm dependency cho việc nhỏ nếu stdlib đủ dùng, ví dụ project key validation hiện tránh regex crate.
- Comments chỉ giữ khi giải thích concurrency, transaction, lifecycle, hoặc serde nuance không hiển nhiên.

---

### Development Workflow Rules

**Before implementing:**
- Đọc `AGENTS.md` trước; repo yêu cầu giao tiếp tiếng Việt, thay đổi surgical, success criteria rõ, và không tự refactor ngoài scope.
- Trước broad source exploration hoặc implementation, chạy `./bin/pnotes brief --area <path> --limit 3`; nếu không hữu ích thì dùng `recall`.
- Nếu làm theo story, kiểm tra `_bmad-output/implementation-artifacts/sprint-status.yaml` và story dependencies trước khi code; không workaround khi dependency story chưa done.

**Validation commands:**
- Backend: chạy từ `backend/`: `cargo test`; dùng `cargo run` để smoke server `127.0.0.1:8080`.
- Frontend: chạy từ `frontend/`: `npm run test` và `npm run build`; `npm run dev` dùng Vite port `5173`.
- Full local smoke thường cần 2 process: `cd backend && cargo run`, rồi `cd frontend && npm run dev`.
- Không invent fake validation command; nếu lint script chưa tồn tại trong `package.json`, dùng command có thật hoặc nêu rõ chưa chạy.

**Git / notes:**
- Conventional commits là default, nhưng repo history cũng có story verification commits; match intent của change.
- Branch pattern trong story artifacts thường là `devin/<timestamp>-story-X-Y-name` khi cần story branch.
- Với mọi implementation output, tạo continuity note trước khi báo xong: `./bin/pnotes add continuity ...`, sau đó đọc lại note.
- Không commit runtime artifacts như `frontend/dist/`, `backend/target/`, SQLite data, hoặc logs trừ khi user yêu cầu rõ.

---

### Critical Don't-Miss Rules

**Hard no:**
- Không gọi Codex/Claude qua API; chỉ dùng CLI subprocess qua `AgentStrategy`.
- Không tạo session mới khi resume; phải dùng đúng `session_id` đã capture/lưu.
- Không spawn process thật trong tests; dùng fixture/env override.
- Không lưu full log vào DB; DB chỉ lưu `log_tail`, file log trên disk là source cho raw output.
- Không cho edit task ở terminal status (`completed`/`cancelled`) và không cho comment rỗng.
- Không tự normalize/hack status ở frontend để che backend serializer drift; nếu wire format sai, fix backend contract.
- Không thêm SSE/WebSocket/global state library/extra router shape ngoài MVP khi story chưa yêu cầu.
- Không xóa project còn task; phải trả conflict code rõ.

**Agent/session lifecycle:**
- `subprocess_map` keyed theo `task_id`; mỗi task tối đa một active subprocess/session.
- Cancel/shutdown mới được kill subprocess; browser close hoặc request end không được kill agent.
- Start/resume phải pipe stdout/stderr để capture session id và logs; comment chỉ pipe stdin khi có comment.
- Claude resume command: `claude --continue --session-id <uuid>`; Codex resume command: `codex resume <uuid>`.
- Claude parse `session_id` từ JSON output; Codex parse JSON trước rồi fallback session file lookup.
- Subprocess exit code `0` đưa task về paused/review path theo service rule; non-zero đưa về failed; cancelled task không được relabel như normal failure.

**Data/business edge cases:**
- Comment đã gửi vào agent phải đánh dấu `sent`; pending comment chỉ gửi một lần vào next resume.
- Empty resume comment là hợp lệ: gửi resume không comment, UI/log không coi là validation error.
- Task id sequence phải race-safe theo project; `OMNI-001` và `PROJ-001` là hai task khác nhau.
- Run list order hiện là `run_number DESC`; UI không tự reorder nếu backend đã trả authoritative order.
- `read_log_tail` cap mặc định là 100 lines / 10 KB; đừng tăng DB payload tùy tiện.
- Runtime paths dùng `~/.omni-agent`; đừng ghi SQLite/logs vào repo working tree.

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

_Last Updated: 2026-05-26_
