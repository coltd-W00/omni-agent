---
id: 2026-05-27-friendly-operator-final-response
type: continuity
task: friendly-operator-final-response
created_at: 2026-05-27
signal: Implemented friendly-operator final response convention in AGENTS.md and CLAUDE.md.
areas:
- AGENTS.md
- CLAUDE.md
tags:
- prompt-rules
- docs
decisions:
- Define final responses as concise operator handoffs with completion state, changed areas, impact, verification, next action when useful, and Project Notes line.
invariants:
- Implementation final responses must disclose failed tests, skipped verification, blockers, command errors, and raw-output requests directly.
risks:
- Overly templated wording can make simple Q&A noisy; section explicitly keeps read-only/no-change responses direct.
tests:
- command: git diff -- AGENTS.md CLAUDE.md
  covers:
  - diff scoped to final-response convention in AGENTS.md and CLAUDE.md
- command: git diff --check -- AGENTS.md CLAUDE.md
  covers:
  - Markdown diff has no whitespace errors
missing_tests:
- No automated test validates prompt/documentation conventions; manual diff review is the acceptance check.
---

## task
friendly-operator-final-response — 2026-05-27

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
