---
id: 2026-05-26-pnotes-logging-quality-signals
type: continuity
task: pnotes-logging-quality-signals
created_at: 2026-05-26
signal: pnotes now appends JSONL events to logs/pnotes-debug.jsonl; quality status reads last 20 events and outputs log_signals with concern flag.
areas:
- .agents/skills/project-notes/pnotes-cli
tags:
- pnotes
- quality
decisions:
- write_debug_event silently ignores all errors — calling command always succeeds.
- cmd_brief clones notes vec and pre-scores to get result_count without changing build_brief signature (12 test callsites preserved).
- compute_log_signals returns None when log file absent — log_signals section silently omitted from quality status output.
invariants:
- LOG_PATH='logs/pnotes-debug.jsonl' is CWD-relative, consistent with NOTES_DIR behavior.
- Thresholds recall_empty_result_rate > 0.25 and note_has_area_false_rate > 0.20 are arbitrary starting points — calibrate after ~50 real events.
tests:
- command: cd .agents/skills/project-notes/pnotes-cli && cargo test
  covers:
  - all 32 existing tests pass — no regressions
missing_tests:
- No unit test for compute_log_signals (metric calculation, concern flag logic).
- No test for write_debug_event file creation and append behavior.
---

## task
pnotes-logging-quality-signals — 2026-05-26

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
