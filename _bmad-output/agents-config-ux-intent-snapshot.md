# Intent Snapshot — agents-config-ux

**Date:** 2026-05-26
**Skill:** grill-me
**Mock:** `_bmad-output/planning-artifacts/agents-screen-mock.html`

---

## Current Intent

- User muốn màn hình `/agents` để configure các AI agent runtime: chỉnh binary path, test xem binary có hoạt động không, và bật/tắt agent.
- Ngoài hai agent built-in (claude, codex), user muốn có thể thêm agent tùy ý với binary path và base protocol tự chọn.

---

## Desired Outcome

1. Xem danh sách tất cả agents (built-in + custom) trên một màn hình duy nhất
2. Chỉnh binary path cho từng agent — lưu vào `~/.omni-agent/config.json`
3. Test connection thực sự — spawn binary với lightweight prompt, hiển thị OK/Error kèm timestamp
4. Enable/disable agent — agent bị disable ẩn khỏi dropdown khi tạo task mới
5. Thêm custom agent: nhập name, chọn base protocol (claude-like / codex-like), nhập binary path
6. Edit và delete custom agents (claude/codex built-in không thể xóa)

---

## Boundaries to Keep

- Disable agent **không** kill subprocess đang chạy — chỉ ẩn khỏi UI task creation
- claude và codex là built-in: chỉ edit binary path và toggle enable, không có nút Delete
- Custom agent dùng base protocol sẵn có (claude-like hoặc codex-like) — backend tái dùng parse logic, không viết mới
- Config lưu ở file, không phải SQLite — giữ tách biệt khỏi app DB

---

## Confirmed Decisions

| Decision | Lựa chọn | Lý do |
|---|---|---|
| Config storage | `~/.omni-agent/config.json` | Đơn giản, user có thể edit tay, tách biệt DB |
| Test connection | Spawn binary với lightweight prompt (end-to-end) | Xác nhận binary chạy được, không chỉ tồn tại |
| Disable effect | Ẩn khỏi task creation dropdown | Không break tasks đang chạy |
| Custom agents | Cho phép thêm ngoài claude/codex | User có thể dùng agent khác |
| Custom agent shape | Binary path + base protocol | Tái dùng parse logic backend, tránh unknown behaviors |
| Nav placement | Sidebar item riêng trong section AGENTS | Dễ tìm, consistent với spec UX đã có |

---

## Current Assumptions

- Backend đọc config file khi khởi động và reload khi có thay đổi (hoặc per-request)
- Lightweight prompt test có timeout cố định ~15s; nếu timeout → hiển thị error
- Binary path thay đổi sau lần test cuối → clear test result cũ, hiện "Not tested yet"
- `AgentAvatar` component hiện tại dùng runtime `"claude" | "codex" | undefined` — custom agents sẽ dùng `undefined` (fallback initials + hue từ name)
- config.json schema ban đầu:
  ```json
  {
    "agents": [
      { "name": "claude", "protocol": "claude", "binary": "claude", "enabled": true },
      { "name": "codex",  "protocol": "codex",  "binary": "codex",  "enabled": true }
    ]
  }
  ```

---

## Evaluation Criteria

- Màn hình `/agents` không làm hỏng Dashboard, Board, hay bất kỳ route hiện có
- Disable agent → agent biến mất khỏi CreateTaskModal dropdown (có thể kiểm tra bằng test)
- Test connection trả kết quả trong 15s hoặc hiện timeout error rõ ràng
- Add agent modal: Save button disable khi bất kỳ required field nào trống
- Config file được write đúng sau mỗi thao tác save; không corrupt khi save nhanh liên tiếp

---

## Open Points

- Khi binary path thay đổi nhưng chưa save: lưu on-blur hay cần nút Save rõ ràng? *(chưa chốt)*
- Test connection output hiển thị đầy đủ hay chỉ first line? *(chưa chốt — mock đang hiện 1 dòng)*
- Có cần section "Edit agent" modal riêng cho custom agent, hay edit inline ngay trên card? *(chưa chốt)*

---

## Next Thinking Points

- Chọn tên story: "Story 5.x — Agent Configuration Screen"
- Viết story file với acceptance criteria dựa trên Desired Outcome và Evaluation Criteria ở trên
- Trước khi implement: chạy `./bin/pnotes brief --area frontend/src/features/agents` để recall context này
