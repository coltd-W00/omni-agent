# Deferred Work

## Deferred from: code review of 1-3-frontend-scaffold-and-design-tokens.md (2026-05-21)

- No Dark Mode support in CSS design tokens [frontend/src/styles/tokens.css] — deferred, pre-existing
- Missing Error Boundary at root in main.tsx [frontend/src/main.tsx] — deferred, pre-existing
- Bullet status marker viết cứng hoặc ký tự unicode trực tiếp trong JSX [frontend/src/App.tsx:22] — deferred, pre-existing

## Deferred from: code review of 1-4-appshell-layout-and-routing.md (2026-05-21)

- Thiếu Error Boundary bảo vệ ứng dụng khi xảy ra lỗi render ở Route [frontend/src/main.tsx:12-19] — deferred, pre-existing
- Cấu hình scroll container chưa tối ưu cho Sidebar [frontend/src/components/AppShell.css] — deferred, pre-existing
- Thiếu Code Splitting / Lazy Loading cho các Route component [frontend/src/App.tsx] — deferred, pre-existing

## Deferred from: code review of 2-1-project-management.md (2026-05-22)

- Đồng bộ localStorage active project ID giữa các tabs [frontend/src/features/project/ActiveProjectContext.tsx] — deferred, pre-existing
- Trải nghiệm điều hướng dropdown Project Switcher và phục hồi tiêu điểm (Lost focus) [frontend/src/features/project/ProjectSwitcher.tsx] — deferred, pre-existing
- Toast auto-dismissal không pause khi hover [frontend/src/components/Toast.tsx] — deferred, pre-existing
- Sự không thống nhất về môi trường kiểm thử (Testing mock health handler) [backend/tests/projects_test.rs] — deferred, pre-existing

## Deferred from: code review of 2-2-task-crud-and-agent-assignment.md (2026-05-22)

- D1: SQLite foreign key enforcement không được verify — Schema có `REFERENCES projects(id)` nhưng SQLite cần `PRAGMA foreign_keys = ON` để enforce. Service layer tự handle nhưng DB không có safety net. [backend/src/db/] — pre-existing infrastructure issue
- D2: `onClose` callback trong TopBar tạo function mới mỗi render — `<CreateTaskModal onClose={() => setOpen(false)} />` trigger cleanup/re-setup listener không cần thiết. Fix: `useCallback`. [frontend/src/components/TopBar.tsx] — minor performance issue

## Deferred from: code review of 2-3-task-board-kanban-view.md (2026-05-25)

- F1: `groupByStatus` unsafe cast `t.status as BoardStatus` — nếu backend thêm status mới ngoài cancelled/paused, task silently vào wrong column. Nên dùng whitelist check. [frontend/src/features/board/TaskBoard.tsx:29]
- F2: `useCreateTask` trong `useTasks.ts` out-of-scope Story 2.3, không có test cover. Nên move sang hooks riêng hoặc test cover. [frontend/src/hooks/useTasks.ts:24-35]
- F3: `.visually-hidden` utility class định nghĩa inline trong `TaskBoard.css` — nên extract sang global stylesheet (`tokens.css` hay `globals.css`) để tái sử dụng. [frontend/src/features/board/TaskBoard.css:48-56]
- F4: `position:sticky` trên `.kanban-column__header` bị vô hiệu do parent có `overflow:hidden` — không có visual impact nhờ flex layout, nhưng là dead CSS. Nên bỏ `position:sticky` hoặc điều chỉnh overflow. [frontend/src/features/board/KanbanColumn.css:17-21]
- F5: Loading skeleton hiển thị `count={0}` (count badge) khi AC-11 nói không render count badge khi chưa biết số lượng. Cosmetic deviation. [frontend/src/features/board/TaskBoard.tsx:98]
- D1: `TaskRole` const narrows `Task.role` to 5 values nhưng DB là `role TEXT` free-form. Provisional, fix sau khi Story 3.x xác định agent role API contract. [frontend/src/types/task.ts:21-26]

## Deferred from: code review of 2-4-task-detail-panel.md (2026-05-25)

- W1: Tab arrow-key navigation chưa implement trong tablist của TaskDetailPanel — ARIA tabs pattern chuẩn yêu cầu arrow keys di chuyển giữa tabs. Cân nhắc implement trong Epic 3 khi tab content đầy đủ. [frontend/src/features/detail/TaskDetailPanel.tsx:tablist]
- W2: Focus trap thiếu trong slide-in panel — panel dùng `role="complementary"` (không phải `role="dialog"`) nên không bắt buộc, nhưng nên thêm nếu nâng cấp lên dialog pattern. Keyboard users hiện có Esc + close button. [frontend/src/features/detail/TaskDetailPanel.tsx]


