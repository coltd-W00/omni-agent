---
id: 2026-05-27-task-detail-chat-redesign-with-agent-replies
type: continuity
task: task-detail-chat-redesign-with-agent-replies
created_at: 2026-05-27
signal: Chat tab on Task Detail Page now shows both user comments and agent CLI replies, with a session token usage strip.
areas:
- frontend/src/features/detail/chatTimeline.ts
- frontend/src/features/detail/CommentsTabPanel.tsx
- frontend/src/features/detail/CommentsTabPanel.css
- frontend/src/features/detail/TaskDetailPage.tsx
- frontend/src/features/detail/TaskDetailPage.css
tags:
- chat
- task-detail
- ux
- token-usage
decisions:
- Implemented chat timeline as a frontend-only parser over existing Run.logTail
  data (no backend changes). Codex emits JSON event_msg lines; we extract
  agent_message and token_count events. For non-JSON output (Claude, plain
  logs), the entire logTail is rendered as a single agent message bubble.
- Token usage is taken from codex total_token_usage which is already cumulative
  per session, so we display the max observed across runs without re-aggregation.
- Reused the existing CommentsTabPanel component instead of creating a new
  ChatPanel. The previous comment rendering is preserved (Sent ✓ / Pending
  labels) so existing tests still pass; agent bubbles are appended alongside
  user bubbles in the same list and sorted by timestamp.
- TaskDetailPage layout was tightened: the 9-card stat grid became a single
  compact horizontal strip, the standalone "Next action" row was inlined into
  the title row, and the tab content now flex-fills the remaining viewport
  so the chat scroll area dominates the page.
- Composer behaviour is unchanged on the slide-in panel (TaskDetailPanel);
  on the full-page route the composer is hidden in favour of the bottom
  FollowupPrompt (existing behaviour preserved).
invariants:
- ChatMessage rendering preserves the original "Sent to agent ✓" and
  "Pending · will be sent on next Resume" labels relied on by existing
  TaskDetailPanel tests.
- Chat timeline events are always sorted ascending by ISO timestamp; runs
  are processed in ascending run_number for stable ordering.
- chat-panel layout requires its parent (.tdp__tab-content) to set
  display:flex/column + min-height:0 so the scroll area can size correctly.
risks:
- logTail is capped at the latest 10KB / 100 lines per run; very long
  agent turns may only show the final agent_message events. Earlier
  intermediate messages from the same run will be missing until a
  full-log endpoint is added.
- Token usage relies on codex JSON. For Claude (no JSON), token strip
  displays em dashes. Backend currently does not persist token counts.
- The auto-scroll-to-bottom effect uses scrollIntoView which scrolls the
  nearest scroll ancestor; on very small viewports this could scroll the
  page rather than the messages list. Acceptable for now.
tests:
- command: cd frontend && npx vitest run src/features/detail/chatTimeline.test.ts
  covers:
  - buildChatTimeline parsing of codex agent_message events
  - buildChatTimeline aggregation of token_count totals
  - plain-text fallback for non-JSON logs
  - chronological interleaving of comments and agent messages
  - formatTokens k/M suffixes
- command: cd frontend && npm run build
  covers:
  - TypeScript typecheck on all touched files
missing_tests:
- No UI test asserts the rendered chat timeline (interleaved user + agent
  bubbles + token strip) inside CommentsTabPanel — the existing
  TaskDetailPanel tests fail on main due to a pre-existing Router context
  issue, so they were not extended.
- No e2e/browser smoke for the redesigned full-page layout.
supersedes:
- 2026-05-26-3-5b-comments-runs-and-logs-tabs-and-runtimeline (chat tab
  now also surfaces agent log content; logs tab and run timeline behaviour
  are unchanged).
---

## task

Make the Task Detail "Chat" tab a real two-way conversation: display agent
CLI replies alongside user comments, give the chat the dominant area of the
page, and surface session token usage (total / in / out).

## deviations

- Did not add a backend endpoint or new Run column for token usage. Codex
  already writes `total_token_usage` into the JSON log tail, which is
  sufficient for the requested display.
- Did not show the initial task description as a leading user bubble; the
  existing title block already conveys the original prompt and the user did
  not request it.

## traps

- `useNavigate()` in `TaskDetailPanel.tsx` causes pre-existing failures in
  `TaskDetailPanel.test.tsx` because the test setup does not wrap with a
  Router. This is on `main` already and is not caused by this change. Total
  test counts were unchanged (67 pre-existing failures on both main and this
  branch); the 10 new `chatTimeline` tests all pass.

## dead_ends

None.

## validation_delta

As expected. Build + chatTimeline unit tests green. Pre-existing
TaskDetailPanel/TaskBoard suites continue to fail with the same Router
context error they had on main.

## next_agent_hint

If a longer-history view is needed, add a backend endpoint that streams the
full log file (currently only the truncated tail is exposed). To persist
token usage across sessions, add `input_tokens`, `output_tokens`,
`total_tokens` columns on `runs` and update the Codex spawner to parse
`token_count` events. The frontend `buildChatTimeline` parser can then read
from those fields instead of the logTail.
