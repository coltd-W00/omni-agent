---
id: 2026-05-26-3-4-run-log-dual-storage
type: continuity
task: 3-4-run-log-dual-storage
created_at: 2026-05-26
signal: Story 3.4 implemented run log dual-storage plus runs read API
areas:
- backend/src/services
- backend/src/handlers
- frontend/src/api
tags:
- story-3-4
- runs
- logging
decisions:
- Keep Run.session_id for SQL mapping but skip JSON serialization to preserve the 8-field runs API contract.
invariants:
- Full logs remain on disk; DB stores only log_tail capped by existing read_log_tail behavior.
risks:
- stderr writer and stdout completion run as separate tasks, so tests wait for completion before asserting tail content.
tests:
- command: cd backend && cargo fmt --check && cargo clippy -- -D warnings && cargo test
  covers: []
- command: cd frontend && npm run build && npm test
  covers:
  - GET runs list/get API happy paths and 404 cases
  - stderr lines are prefixed and included in log file and log_tail
  - runs persist after SQLite pool reopen
  - session start response stays below 500ms while subprocess writes output
missing_tests:
- No dedicated resume_session stderr integration test; start_session covers the shared stderr writer and resume uses the same spawn helper.
---

## task
3-4-run-log-dual-storage — 2026-05-26

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
