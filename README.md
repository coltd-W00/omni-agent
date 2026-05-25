# omni-agent

omni-agent là local task board cho AI CLI agents. Product goal là quản lý task,
agent assignment, session resume, comments, và run logs cho Codex/Claude CLI
sessions mà không mất context.

## Status

Implementation đã bắt đầu.

- Product planning artifacts nằm trong `_bmad-output/planning-artifacts/`.
- Living product docs nằm trong `docs/product/`.
- Backend foundation đã có trong `backend/`.
- Frontend foundation đã có trong `frontend/`: Vite React TypeScript scaffold,
  design tokens, global CSS, và dev proxy `/api` tới backend.

## Current Backend

```bash
cd backend
cargo run
```

Expected local server:

- `GET http://127.0.0.1:8080/health`
- response: `{"status":"ok"}`

On startup the backend creates `~/.omni-agent/omni-agent.db` and applies SQLx
migrations from `backend/src/db/migrations/`.

## Current Frontend

```bash
cd frontend
npm install
npm run dev
```

Expected local server:

- `http://localhost:5173/`
- `GET http://localhost:5173/api/health` proxies to backend `/health` while
  Story 1.1 backend routes are still unprefixed.

## Documentation

Read in this order:

1. `AGENTS.md`
2. `docs/ARCHITECTURE.md`
