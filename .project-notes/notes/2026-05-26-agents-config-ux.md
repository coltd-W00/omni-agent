---
id: 2026-05-26-agents-config-ux
type: continuity
task: agents-config-ux
created_at: 2026-05-26
signal: Implemented /agents configuration screen with file-backed agent config API, custom agents, test connection, and enabled-agent filtering in task creation.
areas:
- frontend/src/routes/AgentsRoute.tsx
- backend/src/services/agent_config.rs
- frontend/src/components/CreateTaskModal.tsx
decisions:
- Store agent runtime config in ~/.omni-agent/config.json with built-in claude/codex defaults and custom agents reusing claude/codex protocols.
invariants:
- Disabled agents are hidden from task creation selection but existing task sessions can still resolve their configured strategy.
- Built-in claude/codex agents cannot be deleted; only binary path and enabled state are editable.
tests:
- command: cargo clippy --manifest-path backend/Cargo.toml -- -D warnings
  covers:
  - backend lint
- command: cargo test --manifest-path backend/Cargo.toml
  covers:
  - backend unit/integration tests
- command: npm --prefix frontend run build
  covers:
  - frontend typecheck/build
- command: npm --prefix frontend test -- --run
  covers:
  - frontend test suite
---

## task
agents-config-ux — 2026-05-26

## deviations
None

## traps
None

## dead_ends
None

## validation_delta
As expected

## next_agent_hint
See Handoff
