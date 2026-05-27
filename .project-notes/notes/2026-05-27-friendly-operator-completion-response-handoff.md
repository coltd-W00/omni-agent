---
id: 2026-05-27-friendly-operator-completion-response-handoff
type: continuity
task: friendly-operator-completion-response-handoff
created_at: 2026-05-27
signal: Created party-mode Execution Handoff for friendly-operator final response convention; readiness PASS and scoped to AGENTS.md/CLAUDE.md prompt rules, not app runtime/UI.
areas:
- _bmad-output/implementation-artifacts/friendly-operator-completion-response-execution-handoff.md
decisions:
- Apply friendly-operator completion response as repo-level prompt/convention update in AGENTS.md and CLAUDE.md.
invariants:
- Final responses must disclose completion status, changed areas, reason/impact, verification, next command when useful, and Project Notes status.
risks:
- Executor may over-scope into UI/runtime log rendering or make responses too templated/marketing-like.
missing_tests:
- No automated tests required for handoff artifact; future executor should manually diff AGENTS.md/CLAUDE.md and provide sample success/partial/blocked final responses.
---

## task
friendly-operator-completion-response-handoff — 2026-05-27

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
