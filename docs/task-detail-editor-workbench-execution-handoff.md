# Execution Handoff

## 1. Objective

Rework the full-page task detail view into an editor/workbench-style screen where the main chat/input area is the primary workspace and the run transcript is a secondary panel that can be opened or closed.

## 2. Final Decision

Implement the task detail workbench with the right transcript panel default **open** on desktop/tablet-wide viewports and default **closed** on mobile/narrow viewports. On desktop/tablet-wide, opening the transcript resizes/reflows the main chat pane rather than overlaying it. On mobile/narrow, opening the transcript uses an overlay/drawer. Transcript folding and new copy controls are out of scope for the MVP.

## 3. Original Request Alignment

- Thay đổi/Mở rộng so với yêu cầu gốc: chốt rõ responsive behavior cho transcript panel: desktop resize/reflow, mobile overlay/drawer.
- Thu hẹp/Trì hoãn (Đẩy vào phase sau): transcript folding, new copy controls, persistent layout preferences, advanced keyboard shortcuts, command palette, user-resizable split panes, API/backend/data-model changes.

## 4. Implementation Scope

- **In Scope:**
  - Convert `TaskDetailPage` from the current two-column/card-like layout into an editor/workbench layout.
  - Keep task context, final output, follow-up prompt, and primary actions in the main chat/workspace pane.
  - Add `rightPanelOpen` state for the transcript panel.
  - Add open/close controls for the right transcript panel.
  - Ensure transcript open/close state is independent from any left menu collapsed state if that menu exists in the implementation surface.
  - Make chat output and transcript output wrap long text without page-level horizontal scroll.
  - Preserve existing task detail data loading, action behavior, and transcript data source.
- **Out of Scope:**
  - New backend/API endpoints or persistence changes.
  - New task/run/comment data model fields.
  - Transcript folding by section/thread.
  - New copy controls. If a copy control already exists in production code, preserve it, but do not add one for this MVP.
  - Persistent user layout preferences.
  - Reworking `TaskDetailPanel` slide-in behavior except to fix direct regressions caused by shared styles.

## 5. Target Files / Areas To Inspect Or Modify

| Area / File Path | Expected Work |
|---|---|
| `docs/task-detail-editor-workbench-intent-snapshot.md` | Treat as intent source of truth. Do not edit unless implementation changes the approved scope. |
| `docs/task-detail-editor-workbench-mock.html` | Use as visual/interaction reference for pane structure, wrapping rules, and open/close behavior. Do not implement directly from mock IDs/classes. |
| `frontend/src/features/detail/TaskDetailPage.tsx` | Add local right transcript open/close state, transcript open/close controls, and responsive default initialization. Keep existing task/run/comment data flow. |
| `frontend/src/features/detail/TaskDetailPage.css` | Rework layout into workbench panes, implement desktop resize/reflow and mobile overlay/drawer, enforce `min-width: 0`, wrapping, and no page-level horizontal overflow. |
| `frontend/src/features/detail/TaskDetailPage.test.tsx` | Add/adjust tests for transcript toggle state, preserved task detail content/actions, and long-content wrapping where feasible in jsdom. |
| `frontend/src/features/detail/TaskDetailPanel.tsx` and `.css` | Inspect only for shared-style regressions. Do not redesign the slide-in detail panel as part of this task. |

## 6. Technical Contracts

- **Data / State Contract:**
  - Add local UI state: `rightPanelOpen: boolean`.
  - Default state:
    - desktop/tablet-wide viewport: `true`;
    - mobile/narrow viewport: `false`.
  - If using an existing breakpoint hook, align with the repo's current breakpoint names. If not, implement the smallest local viewport check needed for this screen.
  - The source of truth for transcript content remains `useRunList(project.id, task.id, task.status)`.
  - The source of truth for chat/final output remains `buildChatTimeline(...)` and `finalOutputFrom(...)`.
- **Action / Guard Contract:**
  - `toggleRightPanel()` toggles `rightPanelOpen`.
  - `openRightPanel()` sets `rightPanelOpen` to `true`.
  - `closeRightPanel()` sets `rightPanelOpen` to `false`.
  - Open/close controls must be available by button, keyboard focus, and accessible label.
  - Existing task actions in `ActionBar` and follow-up resume behavior must remain unchanged.
- **UI / UX Contract:**
  - Main pane is the primary workspace: task context, chat/final output, and follow-up input stay visually scoped there.
  - Transcript pane is visually secondary: narrower than the main pane on desktop/tablet-wide and styled like terminal/output, not dashboard cards.
  - Desktop/tablet-wide:
    - transcript default open;
    - open transcript consumes a right pane and reflows/resizes main content;
    - closed transcript returns space to the main pane;
    - transcript must not overlay the main chat/input.
  - Mobile/narrow:
    - transcript default closed;
    - open transcript appears as overlay/drawer;
    - when transcript is closed, main input must not be covered or offset by the hidden panel.
  - Chat and transcript text use wrapping behavior equivalent to `white-space: pre-wrap`, `overflow-wrap: anywhere`, and `word-break: break-word` where appropriate.
  - Avoid page-level horizontal scroll. Vertical scrolling inside chat/transcript panes is expected.
- **API / Backend Contract:**
  - No API/backend changes.
  - No migrations.
  - No persistence for layout preferences in this MVP.

## 7. Execution Plan For Future Executor

1. Inspect `TaskDetailPage.tsx`, `TaskDetailPage.css`, and existing tests to identify current layout, data flow, and test patterns.
2. Add local transcript panel state and accessible open/close controls in `TaskDetailPage.tsx`.
3. Rework `TaskDetailPage.css` so the task detail root fills available height, uses main chat/workspace plus right transcript pane, and supports closed transcript state.
4. Add responsive behavior: desktop/tablet-wide uses reflow/resizing; mobile/narrow uses closed-by-default overlay/drawer.
5. Apply wrapping/overflow rules to chat message bodies, transcript command lines, and transcript output. Remove horizontal overflow from current `pre` output behavior.
6. Add focused tests for visible controls/state and preserved task detail behavior.
7. Validate manually with long chat text, long unbroken path/URL-like strings, empty transcript, loading transcript, and error transcript.

## 8. Verification & Risks

- **Acceptance Criteria:**
  - Desktop/tablet-wide opens task detail with the right transcript panel visible by default.
  - Mobile/narrow opens task detail with the right transcript panel closed by default.
  - Desktop transcript open/close resizes/reflows the main pane and never overlays the main chat/input.
  - Mobile transcript opens as overlay/drawer and closes back to an unobstructed main chat/input.
  - Chat/final output and transcript/output wrap long text and long unbroken strings inside their panes.
  - `document.documentElement.scrollWidth <= window.innerWidth` passes for desktop and mobile verification viewports.
  - Existing task title, status/action affordances, final output, run transcript loading/error/empty states, and follow-up resume behavior remain available according to existing task status rules.
  - The screen reads as an editor/workbench, not a dashboard/card grid.
- **Required Tests:**
  - `cd frontend && npm test -- TaskDetailPage.test.tsx`
  - `cd frontend && npm test -- TaskDetailPanel.test.tsx` if shared styles/components are touched.
  - `cd frontend && npm run build`
- **Regression Risks:**
  - Current `tdp__terminal-output` uses `white-space: pre` and `overflow: auto`, which can reintroduce horizontal scroll if not changed deliberately.
  - Fixed or minimum grid widths can make mobile/tablet layouts overflow unless `min-width: 0` is applied through pane containers.
  - New transcript state can accidentally reset on every render or couple to unrelated navigation/menu state.
  - Reworking CSS shared by `TaskDetailPanel` can regress the existing slide-in detail panel.
- **Evidence Required:**
  - Test command output for the required tests that were run.
  - Screenshots or equivalent visual evidence for: desktop default open, desktop transcript closed, mobile default closed, mobile transcript overlay open.
  - Browser console/DOM evidence that `document.documentElement.scrollWidth <= window.innerWidth` at desktop and mobile widths with long unbroken content.
  - Note any tests that could not run and why.

## 9. Do Not Do

- Do not implement backend/API/database changes.
- Do not add transcript folding.
- Do not add new copy controls.
- Do not add persisted layout preferences.
- Do not refactor unrelated task detail code or dashboard/board components.
- Do not redesign `TaskDetailPanel` unless a direct regression from shared code must be fixed.
- Do not leave chat input spanning into or under the transcript panel.
