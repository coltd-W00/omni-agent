---
id: 2026-05-26-pnotes-quality-commands
type: continuity
task: pnotes-quality-commands
created_at: 2026-05-26
signal: Add pnotes quality status and quality record CLI commands to check/record review progress.
areas:
- .agents/skills/project-notes/pnotes-cli
tags:
- cli
- project-notes
decisions:
- Support parsing both RFC3339 datetimes and YYYY-MM-DD dates in CLI for review boundary checks.
- Preserve the exact markdown structure of the quality review log during serialization.
- Update the command reference in pnotes guide to include the new quality commands.
tests:
- command: cargo test
  covers:
  - parse_datetime split_frontmatter_and_body test_guide_content
---

## task
pnotes-quality-commands — 2026-05-26

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
