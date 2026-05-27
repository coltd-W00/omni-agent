---
id: 2026-05-27-task-detail-editor-workbench-intent-snapshot
type: continuity
task: task-detail-editor-workbench-intent-snapshot
created_at: 2026-05-27
signal: Created intent snapshot for task detail editor/workbench redesign with left chat input, collapsible left menu, and closable right transcript panel.
areas:
- docs
tags:
- handoff
decisions:
- Rework task detail as an editor/workbench screen rather than patching the previous layout.
- Keep chat input scoped to the left/main chat pane only.
- Make the right transcript/output area a secondary panel that can open and close.
- Require word wrapping and no horizontal scroll for chat output and transcript panes.
invariants:
- Left menu collapse/expand is separate from right transcript panel open/close.
- Task detail should feel like editor/chat/terminal panes, not dashboard cards.
risks:
- Future implementation may accidentally keep the right transcript as a permanently fixed column instead of a closable panel.
- Long command output may reintroduce horizontal overflow unless tested with long unbroken strings.
missing_tests:
- No implementation tests yet because this task only created an intent snapshot document.
---

## task
task-detail-editor-workbench-intent-snapshot — 2026-05-27

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
