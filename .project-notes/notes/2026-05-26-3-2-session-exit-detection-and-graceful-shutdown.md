---
id: 2026-05-26-3-2-session-exit-detection-and-graceful-shutdown
type: continuity
task: 3-2-session-exit-detection-and-graceful-shutdown
created_at: 2026-05-26
signal: 'Story 3.2 implemented: subprocess exit detection, cancel endpoint, graceful shutdown'
areas:
- backend/src/services
tags:
- session-lifecycle
decisions:
- 'Option C for subprocess ownership: background task takes ChildStdout, on EOF locks map and removes Child to call wait()'
invariants:
- subprocess_map.remove() returns None means cancel/shutdown already handled it — skip DB updates if task status is Cancelled or Paused
risks:
- 'Race condition: cancel handler kills subprocess before background task EOF — handled via SQL WHERE guards on status transitions'
---

## task
3-2-session-exit-detection-and-graceful-shutdown — 2026-05-26

## deviations
None

## traps
No E2E test for SIGTERM graceful shutdown (requires spawning real server process + SIGTERM + wait exit). Unit-style flush_running_tasks_updates_db covers the SQL logic only.
mock-agent-fail.sh uses `set -e` which means `exit 1` terminates correctly, but the script does NOT sleep — subprocess exits immediately after printing session ID.

## dead_ends
None

## validation_delta
All 119 tests pass (76 unit + 17 sessions integration + 7 projects + 19 tasks). exit_code stored as i64 in DB/model but complete_run takes i32 — cast happens silently via sqlx bind, no issue.

## next_agent_hint
Story 3.3 (resume session + comment tracking) should build on session.status='paused'/'closed' transitions established here. Background task uses run_id passed from start_session — story 3.3 must track new run_id for each resume similarly.
