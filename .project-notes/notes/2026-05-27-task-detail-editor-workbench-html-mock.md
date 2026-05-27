---
id: 2026-05-27-task-detail-editor-workbench-html-mock
type: continuity
task: task-detail-editor-workbench-html-mock
created_at: 2026-05-27
signal: Created standalone HTML mock for task detail editor/workbench review with collapsible left menu, left-scoped chat input, and closable right transcript panel.
areas:
- docs
tags:
- mock
decisions:
- Use a standalone docs HTML mock rather than editing production frontend code.
- Model right transcript/output as a closable secondary panel.
- Keep chat composer inside the main chat pane only.
invariants:
- Mock should preserve word wrapping and avoid horizontal scrolling in chat and transcript output surfaces.
- Left menu collapse/expand remains independent from right transcript open/close.
risks:
- Playwright browser verification could not run because e2e node_modules/@playwright/test is not installed.
tests:
- command: node -e static inspection of docs/task-detail-editor-workbench-mock.html
  covers:
  - Verified mock file is ASCII and contains menu-collapsed/transcript-closed states plus pre-wrap/overflow-wrap rules.
missing_tests:
- No browser screenshot or scrollWidth/clientWidth verification because Playwright dependencies are not installed.
---

## task
task-detail-editor-workbench-html-mock — 2026-05-27

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
