# Test Matrix

File này map product behavior tới proof.

Không mark một row là implemented cho đến khi có tests hoặc validation
evidence. Planning artifacts có thể là evidence cho story readiness, nhưng
implemented status cần code-level proof hoặc recorded manual verification.

## Giá Trị Status

| Status | Meaning |
| --- | --- |
| planned | Đã được chấp nhận như intended behavior, chưa implemented |
| in_progress | Đang được build |
| implemented | Đã implemented và có proof |
| changed | Contract thay đổi sau implementation trước đó |
| retired | Không còn là một phần của product contract |

## Matrix

| Story | Contract | Unit | Integration | E2E | Platform | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 Monorepo Setup & Backend Scaffold | `backend/` starts Axum server; `GET /health` returns `{"status":"ok"}`; unknown routes return error envelope; `frontend/` placeholder exists | no | manual | no | no | implemented | `_bmad-output/implementation-artifacts/1-1-monorepo-setup-and-backend-scaffold.md` |
| 1.2 Database Schema & Migrations | Startup creates SQLite DB and applies schema for `projects`, `tasks`, `sessions`, `runs`, `comments`; migration is idempotent | yes | manual | no | no | in_progress | `cargo test` in `backend/` passed on 2026-05-21; `_bmad-output/implementation-artifacts/1-2-database-schema-and-migrations.md`; `backend/src/db/mod.rs` tests |
| 1.3 Frontend Scaffold & Design Tokens | Vite latest available from npm registry on 2026-05-21 (`8.0.13`; `vite@9` not published) + React 19 + TypeScript strict scaffold in `frontend/`; `/api` proxied to `127.0.0.1:8080` in dev; `frontend/src/styles/tokens.css` defines all neutrals, brand, 9 status color triples, spacing, radius, shadow, and font tokens; `global.css` imports tokens and `main.tsx` loads `global.css` | no | manual | no | no | implemented | `npm install`, `npx tsc --noEmit`, `npm run build`, `cargo run`, `npm run dev`, `curl -i http://localhost:5173/api/health` passed on 2026-05-21; `_bmad-output/implementation-artifacts/1-3-frontend-scaffold-and-design-tokens.md` |
| 1.4 AppShell Layout & Routing | TopBar 52px + Sidebar 220px + Main Work Area layout; React Router v7 với routes `/dashboard`, `/board`, `*` → 404; active nav state; routes render bên trong AppShell (sidebar/topbar không re-mount) | no | no | manual | no | implemented | `npm install react-router@7.15.1`, `npx tsc --noEmit`, `npm run build`, Playwright Python/Chrome browser check trên `http://127.0.0.1:5173/` passed on 2026-05-21; `_bmad-output/implementation-artifacts/1-4-appshell-layout-and-routing.md` |
| 2.1 Project Management | Project CRUD and delete-with-tasks guard | no | no | no | no | planned | `_bmad-output/planning-artifacts/epics.md` |
| 2.2 Task CRUD & Agent Assignment | Task creation/edit/delete and agent assignment state transition | no | no | no | no | planned | `_bmad-output/planning-artifacts/epics.md` |
| 2.3 Task Board Kanban View | Each task appears in exactly one status column with status polling | no | no | no | no | planned | `_bmad-output/planning-artifacts/epics.md` |
| 2.4 Task Detail Panel | State-valid actions, session panel, and detail tabs | no | no | no | no | planned | `_bmad-output/planning-artifacts/epics.md` |
| 3.1 Start Session | AgentStrategy and CLI subprocess start with session ID capture | no | no | no | no | planned | `_bmad-output/planning-artifacts/epics.md` |
| 3.2 Session Exit Detection | Exit-code status mapping, cancel, browser-close independence, graceful shutdown | no | no | no | no | planned | `_bmad-output/planning-artifacts/epics.md` |
| 3.3 Resume Session & Comments | Resume existing session with comment input and sent tracking | no | no | no | no | planned | `_bmad-output/planning-artifacts/epics.md` |
| 3.4 Run Log Dual Storage | Full log file plus bounded DB tail | no | no | no | no | planned | `_bmad-output/planning-artifacts/epics.md` |

## Rule Evidence

- Unit proof bao phủ pure domain và application rules.
- Integration proof bao phủ backend enforcement, data integrity, provider
  behavior, jobs, hoặc service contracts.
- E2E proof bao phủ user-visible browser flows.
- Platform proof chỉ bao phủ shell, deployment, mobile, desktop, hoặc runtime
  behavior không thể chứng minh ở lower layers.
- Một story có thể được implemented mà không cần mọi proof column nếu story
  packet giải thích vì sao.
