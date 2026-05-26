---
id: 2026-05-26-3-5b-comments-runs-and-logs-tabs-and-runtimeline
type: continuity
task: 3-5b-comments-runs-and-logs-tabs-and-runtimeline
created_at: 2026-05-26
signal: Story 3.5b implemented comments listing, run/log tabs, and RunTimeline.
areas:
- backend/src/services/comments.rs
- frontend/src/features/detail
- frontend/src/components/RunTimeline.tsx
tags:
- story-3-5b
decisions:
- Added GET comments endpoint and combined comments route with get().post() while preserving POST behavior.
- RunTimeline derives MVP events from Run fields only; it does not parse raw log content.
- Logs Tab downloads the stored logTail blob only; full log streaming remains deferred.
invariants:
- Comments query does not poll; runs query polls only while task.status is running.
risks:
- focusedRunId must be cleared after LogsTab mount to avoid sticky cross-tab run filters.
- Frontend uses completed/cancelled terminal statuses while story prose sometimes says done/cancelled.
tests:
- command: cd backend && cargo fmt --check && cargo clippy -- -D warnings && cargo test
  covers: []
- command: cd frontend && npm run build && npm test
  covers: []
missing_tests:
- No full log streaming or structured event parsing tests; those are deferred work.
---

## task
3-5b-comments-runs-and-logs-tabs-and-runtimeline — 2026-05-26

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
