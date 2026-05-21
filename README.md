# omni-agent

omni-agent là local task board cho AI CLI agents. Product goal là quản lý task,
agent assignment, session resume, comments, và run logs cho Codex/Claude CLI
sessions mà không mất context.

## Status

Implementation đã bắt đầu.

- Harness v0 đã được cài để điều phối source-of-truth, stories, decisions, và
  validation evidence.
- Product planning artifacts nằm trong `_bmad-output/planning-artifacts/`.
- Living product docs nằm trong `docs/product/`.
- Backend foundation đã có trong `backend/`.
- Frontend hiện mới là placeholder; Vite React scaffold thuộc story sau.

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

## Documentation

Read in this order:

1. `AGENTS.md`
2. `docs/HARNESS.md`
3. `docs/FEATURE_INTAKE.md`
4. `docs/product/`
5. `docs/ARCHITECTURE.md`
6. `docs/stories/`
7. `docs/TEST_MATRIX.md`
8. `docs/decisions/`
