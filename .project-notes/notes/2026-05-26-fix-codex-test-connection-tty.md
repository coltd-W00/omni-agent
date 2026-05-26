---
id: 2026-05-26-fix-codex-test-connection-tty
type: continuity
task: fix-codex-test-connection-tty
created_at: 2026-05-26
signal: Codex agent Test connection now uses a non-interactive version probe instead of launching the terminal UI.
areas:
- backend/src/services/agent_config.rs
tags:
- bug
decisions:
- Agent Test connection probes binaries with --version and stdin null to avoid terminal UI startup.
invariants:
- Test connection must not require a TTY for Codex CLI.
risks:
- Custom agent wrappers that do not support --version may now fail Test connection even if they can run interactively.
tests:
- command: cargo test --manifest-path backend/Cargo.toml
  covers:
  - Codex Test connection avoids stdin is not a terminal
- command: cargo clippy --manifest-path backend/Cargo.toml -- -D warnings
  covers:
  - backend lint
---

## task
fix-codex-test-connection-tty — 2026-05-26

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
