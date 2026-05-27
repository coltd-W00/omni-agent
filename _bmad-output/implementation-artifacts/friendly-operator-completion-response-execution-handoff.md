# Execution Handoff

## 1. Objective

Standardize final task responses so they read like a concise operator handoff: clear status, practical impact, changed areas, verification, and next action. Keep the response technically honest and short, without dumping raw logs unless the user explicitly asks for output.

## 2. Final Decision

Readiness gate: **PASS**.

Implement this as a repo-level response convention update, not an app runtime/UI change.

- Primary target: `AGENTS.md`.
- Mirror target: `CLAUDE.md`, because it currently carries the same working rules.
- Do not modify frontend/backend runtime code, log storage, SSE/polling, or post-task UI rendering unless a later investigation proves final responses are transformed by the app.
- The convention is `friendly operator`: concise Vietnamese handoff, practical and implementation-focused, with explicit verification and gaps.

## 3. Original Request Alignment

- Thay đổi/Mở rộng so với yêu cầu gốc: converts the intent snapshot into an implementable prompt/convention change with measurable response contract and examples.
- Thu hẹp/Trì hoãn: defers UI renderer, runtime log pipeline, app state changes, and broad agent behavior refactors.

## 4. Implementation Scope

- **In Scope:**
  - Update repo communication/final-response rules in `AGENTS.md`.
  - Mirror equivalent wording in `CLAUDE.md`.
  - Add a small final-response contract covering success, partial success/test gap, blocked/error, and read-only/no-change cases.
  - Preserve existing Vietnamese language rule and Project Notes Completion Gate.
  - Include compact before/after or sample final responses as validation evidence.

- **Out of Scope:**
  - Frontend/backend code changes.
  - UI post-task renderer changes.
  - Runtime logs/raw-output transformation.
  - SSE/WebSocket/global state changes.
  - Marketing-style copy, celebration tone, or verbose completion reports.
  - Changing unrelated skills or agent workflows unless directly needed by `AGENTS.md`/`CLAUDE.md` consistency.

## 5. Target Files / Areas To Inspect Or Modify

| Area / File Path | Expected Work |
|---|---|
| `AGENTS.md` | Add/adjust final response convention for `friendly operator` handoff while preserving existing language, working style, and Project Notes requirements. |
| `CLAUDE.md` | Mirror the same convention if file content remains intentionally aligned with `AGENTS.md`. |
| `friendly-operator-completion-response-intent-snapshot.md` | Use as source context only; do not mutate unless explicitly asked. |
| `_bmad-output/project-context.md` | Inspect only if executor needs to confirm existing generated rules; do not update unless the project context generation workflow is intentionally rerun. |

## 6. Technical Contracts

- **Data / State Contract:** None. This is a documentation/prompt convention change only.

- **Action / Guard Contract:**
  - Final responses after implementation output must answer:
    1. what changed,
    2. why it changed,
    3. how it was verified or why verification was not run,
    4. what the user should run or know next,
    5. Project Notes status line.
  - If work is incomplete, blocked, partially verified, or tests failed, the response must say that directly and must not imply completion.
  - If the user asks to see command output, relay the important output or key lines instead of hiding it behind a generic summary.
  - For pure Q&A/read-only work, avoid forcing a mechanical implementation summary; still be concise and clear.

- **UI / UX Contract:** None for the product UI. The user-facing text style contract is:
  - Vietnamese by default.
  - Friendly but operational, not emotional.
  - Prefer one or two short paragraphs for small tasks.
  - Use bullets only when they improve scanning.
  - Keep raw logs summarized unless exact output is requested or needed to explain failure.

- **API / Backend Contract:** None.

- **Response Shape Contract:**
  - Success with code/config/test changes:
    - mention completion state;
    - mention changed files/areas;
    - mention reason/impact;
    - mention verification command(s);
    - mention next command only if useful;
    - include required `Project notes: ...` line.
  - Partial success or skipped verification:
    - mention what is done;
    - mention what was not verified and why;
    - avoid “done” wording unless the remaining gap is clearly non-blocking.
  - Blocked/error:
    - state blocked/not complete;
    - name the blocker and the exact decision/input needed;
    - include any useful command/error excerpt without dumping full logs.
  - No code changed:
    - answer directly;
    - use `Project notes: skipped — no code/config/test/script/behavior changed` if the task otherwise requires a notes line.

## 7. Execution Plan For Future Executor

1. Inspect `AGENTS.md` and `CLAUDE.md` around communication, working style, and final-response sections.
2. Add the smallest wording change that defines `friendly operator` final responses without duplicating the whole file.
3. Ensure the new wording preserves existing repo rules: Vietnamese default, concise/practical tone, surgical changes, and Project Notes Completion Gate.
4. Add 3-4 compact sample final responses or checklist bullets if that is the least ambiguous way to lock the convention.
5. Validate with a manual before/after review against the intent snapshot.
6. Create the required project continuity note for the documentation/prompt change and inspect it before final response.

## 8. Verification & Risks

- **Acceptance Criteria:**
  - `AGENTS.md` clearly defines final response behavior for `friendly operator`.
  - `CLAUDE.md` remains consistent with `AGENTS.md` unless executor finds it is intentionally divergent.
  - The convention covers success, partial/skipped verification, blocked/error, and read-only/no-change responses.
  - Existing Project Notes Completion Gate remains mandatory and visible.
  - Final-response wording explicitly forbids hiding errors, failed tests, skipped commands, or raw-output requests.
  - No frontend/backend runtime behavior changes are introduced.

- **Required Tests / Validation:**
  - No automated test required if only Markdown instructions change.
  - Run `git diff -- AGENTS.md CLAUDE.md` and manually verify the diff is scoped to response convention.
  - Provide before/after sample response for at least:
    - completed implementation;
    - completed with tests not run;
    - blocked/error.
  - Confirm final response includes `Project notes: created <path>` or a valid skip reason.

- **Regression Risks:**
  - Making final responses too templated for simple Q&A.
  - Making “friendly” sound like marketing or celebration.
  - Accidentally weakening the requirement to disclose failed/skipped verification.
  - Duplicating rules in a way that later makes `AGENTS.md` and `CLAUDE.md` drift.

- **Evidence Required:**
  - Paths changed.
  - Manual diff summary.
  - Sample final response snippets or checklist showing the new convention.
  - Project notes continuity file path and inspected content.

## 9. Do Not Do

- Do not change app frontend/backend runtime code for this request.
- Do not rewrite logs, log storage, or raw-output handling.
- Do not add SSE/WebSocket/global state behavior.
- Do not hide failed tests, skipped tests, command failures, or blockers.
- Do not turn final responses into marketing copy, praise, or long narrative.
- Do not remove the Project Notes Completion Gate.
- Do not refactor unrelated agent skills or prompt files.
