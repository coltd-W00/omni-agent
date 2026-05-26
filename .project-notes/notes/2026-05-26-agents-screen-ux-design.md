---
id: 2026-05-26-agents-screen-ux-design
type: continuity
task: agents-screen-ux-design
created_at: 2026-05-26
signal: UX design cho /agents screen đã được clarify và mock HTML tạo xong
areas:
  - frontend/src/features
  - frontend/src/routes
  - frontend/src/components
  - backend/src/agent
decisions:
  - Config lưu ở file ~/.omni-agent/config.json (không dùng SQLite)
  - Test connection = spawn binary với lightweight prompt thực (POST /api/agents/:name/test)
  - Disable agent = ẩn khỏi task creation dropdown; tasks đang chạy không bị ảnh hưởng
  - Custom agent = binary path + base protocol (claude-like hoặc codex-like); backend tái dùng parse logic sẵn có
  - Nav placement = sidebar item riêng trong section AGENTS (đã có TODO trong Sidebar.tsx)
invariants:
  - claude và codex là built-in agents — không thể xóa, chỉ edit binary path và toggle enable
  - Custom agents có đủ CRUD (add, edit, delete, enable/disable)
  - Button hierarchy: mỗi card chỉ có một primary action; Save trong modal disable khi required fields trống
  - Toggle disable agent chỉ ẩn khỏi UI dropdown — không kill subprocess đang chạy
risks:
  - config.json read/write cần atomic để tránh race condition nếu user save nhanh liên tiếp
  - "Test connection" spawn thật có thể tốn thời gian — cần timeout rõ ràng (đề xuất 15s) và cancel nếu user navigate away
  - Binary path thay đổi không invalidate test result cũ — cần clear indicator khi path thay đổi sau lần test cuối
missing_tests:
  - Toggle disable → verify agent không xuất hiện trong CreateTaskModal agent dropdown
  - Test connection timeout path
  - Config file corrupt / missing → fallback behavior
---

## Intent Snapshot — /agents screen

### Desired Outcome

Màn hình `/agents` cho phép user:
1. Xem danh sách agents (built-in: claude, codex; custom: do user thêm)
2. Chỉnh binary path cho từng agent
3. Test connection (spawn binary với lightweight prompt, hiển thị OK/Error + timestamp)
4. Enable/disable agent (ẩn khỏi task creation)
5. Thêm custom agent mới (name + protocol + binary path)
6. Edit và delete custom agents

### Mock

`_bmad-output/planning-artifacts/agents-screen-mock.html` — 6 scenarios:
Default, Test đang chạy, Test OK, Test Error, Add Agent modal, Empty state

### Cấu trúc implementation dự kiến

**Backend:**
- `GET /api/agents` — đọc config file, trả list agents
- `PUT /api/agents/:name` — update binary path / enabled
- `POST /api/agents` — thêm custom agent
- `DELETE /api/agents/:name` — xóa custom agent (chỉ custom, built-in reject 400)
- `POST /api/agents/:name/test` — spawn binary với lightweight prompt, trả OK/error

**Frontend:**
- Route: `/agents` → `frontend/src/routes/AgentsRoute.tsx`
- Feature: `frontend/src/features/agents/` (AgentsPage, AgentCard, AddAgentModal)
- Sidebar: thêm NavLink vào section AGENTS (xem TODO trong `frontend/src/components/Sidebar.tsx` dòng 1)
- API hooks: `useAgents`, `useTestAgent`

### Lưu ý khi code — không được làm hỏng UI hiện tại

- **Sidebar.tsx**: chỉ thêm NavLink vào đúng vị trí TODO. Không đổi class, không đổi structure `<ul>` hiện có, không sửa nav items Dashboard và All Tasks.
- **AppShell.tsx**: không sửa. Chỉ thêm route trong `App.tsx`.
- **App.tsx**: chỉ thêm `<Route path="/agents" element={<AgentsRoute />} />` bên cạnh routes hiện có — không đổi các routes khác.
- **tokens.css**: không thêm token mới vào file này. Nếu cần color mới (ví dụ custom agent avatar), define inline hoặc trong CSS module của feature đó, tham chiếu rõ lý do không dùng token.
- **TopBar.tsx**: không sửa. `/agents` không cần "+ New Task" context khác.
- **AgentAvatar component**: đang dùng runtime "claude" | "codex" | undefined. Khi thêm custom agent, KHÔNG mở rộng type này — dùng fallback `undefined` cho custom agents.
- CSS naming: dùng prefix riêng cho feature agents (`agents-page__*`, `agent-card__*`) — không tái dùng class từ dashboard hay board để tránh side-effect.
- Design tokens sử dụng đúng như mock: `--bg-card`, `--border`, `--brand-primary`, `--radius-lg` cho cards; `--shadow-sm` cho card shadow.
