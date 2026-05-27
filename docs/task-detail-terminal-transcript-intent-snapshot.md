# Intent Snapshot

## Current Intent

- Make the `task detail` screen feel like a real agent run instead of a static task information page.
- Split the main screen into two primary areas:
  - Left: a chat-style panel showing only the original `user input` and the agent's final output.
  - Right: a terminal-style transcript showing the full process of the agent run.
- Keep the right side visually close to a real terminal while making the transcript easier to scan than raw logs.

## Desired Outcome

- When opening a task detail, the user can immediately understand:
  - what request started the task;
  - what final answer the agent produced;
  - what the agent did during the run.
- The right panel should look and feel like a terminal:
  - dark background;
  - monospace text;
  - prompt-like lines;
  - command/output blocks;
  - clear run statuses.
- The transcript should be curated and grouped by meaningful events instead of dumping raw log noise.

## Boundaries to Keep

- Do not turn this screen into a general task dashboard.
- Do not overload the left chat panel with metadata.
- Do not make the terminal panel feel like a normal card-based UI; it should preserve a terminal-like surface.
- Do not require replay animation for the first version.
- Do not implement a full terminal emulator unless a later requirement explicitly needs it.

## Confirmed Decisions

- Use the **Curated Terminal Transcript** direction.
- The left panel focuses only on input/output summary.
- The right panel owns the full agent process transcript.
- Transcript events should be grouped by step/event type instead of shown as unstructured raw text.

## Current Assumptions

- The app has, or will have, access to task data including the original user request, final response, and agent run transcript/events.
- If the transcript currently exists only as raw text, a lightweight mapping layer may be needed to render blocks like `command`, `output`, `status`, `edit`, and `test`.
- The goal is realism plus readability, not byte-for-byte terminal fidelity.

## Evaluation Criteria

- The first impression clearly communicates that this is an agent task detail screen.
- The right panel reads visually as a terminal.
- The user can scan what the agent did without being buried in raw log noise.
- The two-column layout is clear: left for conversation summary, right for execution transcript.
- Long transcript output remains usable through scrolling or folding behavior.

## Open Points

- Is the transcript source currently structured events or raw text?
- Should the screen support live-running tasks later, or only completed task replay?
- Should long output blocks be scroll-only, collapsed by default, or manually foldable?

## Next Thinking Points

- Define the minimum event types needed for the terminal transcript.
- Choose the terminal visual language: prompt prefix, timestamp style, status colors, and block spacing.
- Decide how to handle large output blocks and failed command output.
