# Tổng Quan Product

## Vision

omni-agent là local task board cho AI CLI agents. Người dùng quản lý task thay
vì quản lý chat: mỗi task có metadata, trạng thái, agent được assign, run logs,
comments, và một agent session có thể resume.

Điểm khác biệt cốt lõi là **Session-as-Asset**. Session của Codex hoặc Claude
được xem như working memory của task; app phải giúp người dùng resume đúng
session cũ thay vì vô tình tạo session mới.

## User Mục Tiêu

Primary user là một developer cá nhân làm việc local, thường chạy nhiều Codex
và Claude CLI sessions song song cho coding, review, refactor, và debug.

Out of scope cho MVP:

- Multi-user collaboration.
- Cloud sync.
- CI/CD automation.
- Auto-planning hoặc auto-review workflows.
- Gemini hoặc custom agent support.

## Trạng Thái Implementation Hiện Tại

Implementation đã bắt đầu ở Epic 1 foundation.

- Backend Rust/Axum scaffold tồn tại trong `backend/`.
- SQLite migration đầu tiên tạo các bảng `projects`, `tasks`, `sessions`,
  `runs`, và `comments`.
- `frontend/` hiện chỉ là placeholder; Vite React scaffold thuộc story sau.
- Runtime database và logs thuộc `~/.omni-agent/`, không commit vào repo.

## Source Artifacts

Detailed source material:

- `_bmad-output/planning-artifacts/prds/prd-omni-agent-2026-05-20/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/project-context.md`
