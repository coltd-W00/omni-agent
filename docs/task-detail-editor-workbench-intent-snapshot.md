# Intent Snapshot

## Current Intent

- Rework the `task detail` screen into an editor/workbench-style interface.
- Keep the primary chat/input experience on the left.
- Put transcript/output in a secondary panel on the right that can be opened and closed.
- Add a left-side menu control that supports collapse/expand.
- Make chat and transcript surfaces feel like real chat, editor, and terminal panes instead of generic card UI.

## Desired Outcome

- The user can focus on the main chat area without the right transcript panel always taking space.
- The right transcript/output panel can be opened when the user wants to inspect run details, then closed again.
- The chat input stays inside the left/main chat area only and never stretches into the right panel.
- Chat output and transcript output are readable for long technical content:
  - word wrap is enabled;
  - no horizontal scrolling;
  - long command output, logs, and messages stay inside their panes;
  - the visual treatment feels close to editor/chat/terminal surfaces.

## Boundaries to Keep

- Do not make this a dashboard-style page.
- Do not let the chat input span across both left and right areas.
- Do not keep the transcript as a permanently fixed right column.
- Do not use horizontal scroll for chat output or transcript text.
- Do not over-style the panes as decorative cards; prioritize practical editor-like readability.

## Confirmed Decisions

- The screen is being reworked, not lightly patched.
- The left menu should support collapse/expand behavior.
- The chat input belongs only to the left/main chat area.
- The right side is a secondary panel that can be opened and closed.
- Chat output and transcript output must wrap text and avoid horizontal scroll.

## Current Assumptions

- The main interaction on task detail is reading/responding in the chat area.
- The transcript/output panel is important, but secondary to the main chat focus.
- Collapse/expand for the left menu is separate from open/close behavior for the right transcript panel.
- The desired feel is closer to VS Code/editor panes plus chat/terminal surfaces than to a classic web app details page.

## Evaluation Criteria

- Opening task detail immediately presents a focused main chat workspace.
- The right transcript/output panel can be closed to reclaim space and opened when needed.
- The chat input remains visually scoped to the left/main pane at all supported widths.
- Long chat messages, terminal output, and transcript lines wrap cleanly.
- There is no horizontal scrollbar in chat output or transcript panes.
- The UI reads as an editor/workbench with real chat and terminal-like panes.

## Open Points

- Whether the right panel should default to open or closed.
- Whether the right panel should slide over content or resize the main chat area.
- Whether transcript blocks need folding/copy controls in the first implementation.

## Next Thinking Points

- Inspect the current task detail layout and identify the containers responsible for panel sizing and overflow.
- Define the minimum pane state model: left menu collapsed/expanded and right transcript open/closed.
- Verify the implementation with long unbroken strings, multi-line logs, and normal chat messages.
