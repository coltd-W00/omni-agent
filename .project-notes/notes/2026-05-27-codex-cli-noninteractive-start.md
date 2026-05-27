---
id: 2026-05-27-codex-cli-noninteractive-start
type: continuity
task: codex-cli-noninteractive-start
created_at: 2026-05-27
signal: Codex task start now uses non-interactive codex exec to avoid stdin-is-not-a-terminal failures.
areas:
- backend/src/agent
- backend/tests
tags:
- bug
decisions:
- Use codex exec --json - for Codex start sessions instead of launching the interactive TUI.
- Use codex exec resume --json <session_id> - when resuming Codex with a comment.
invariants:
- OmniAgent spawns CLI agents as subprocesses without a TTY; Codex commands used by backend must be non-interactive.
risks:
- Codex CLI JSON event schema may change; session_id capture still depends on stdout JSON or filesystem fallback.
tests:
- command: cargo test --manifest-path backend/Cargo.toml
  covers:
  - Codex start sessions avoid interactive TUI stdin terminal failure
  - Codex strategy command args use non-interactive exec mode
missing_tests:
- No live integration test invokes the real Codex CLI because it may require auth/network/model execution.
---

## task
codex-cli-noninteractive-start — 2026-05-27

## deviations
None

## traps
Do not call bare `codex` from backend subprocess code; the default path is the interactive TUI and requires a terminal.

## dead_ends
None

## validation_delta
As expected

## next_agent_hint
If Codex start/resume breaks again, first inspect `codex --help`, `codex exec --help`, and `codex exec resume --help` because CLI command shapes can drift between releases.
