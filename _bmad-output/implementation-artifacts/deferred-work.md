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


