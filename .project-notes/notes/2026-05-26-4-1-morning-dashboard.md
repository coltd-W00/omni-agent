---
id: 2026-05-26-4-1-morning-dashboard
type: continuity
task: 4-1-morning-dashboard
created_at: 2026-05-26
signal: "Implemented Morning Dashboard with parallel task aggregation, priority-ordered sections, loading/error/empty states, and full accessibility."
areas:
  - frontend/src/features/dashboard
  - frontend/src/hooks/useAggregatedTasks.ts
  - frontend/src/routes/DashboardRoute.tsx
  - frontend/src/components/StatusBadge.tsx
tags:
  - frontend
  - dashboard
  - task-aggregation
decisions:
  - "Aggregate task data concurrently across all projects using TanStack Query's useQueries hook to allow robust caching and parallel fetch."
  - "Localize timezone simulation in tests by parsing date strings without the 'Z' suffix to prevent GMT offset failures on local test environments (e.g., GMT+7)."
  - "Structure dashboard cards (Review, Failed, Running) with semantic role='article' instead of role='button' to prevent accessible name calculation collisions in RTL screen queries."
  - "Use persist inline status banner for partial task loading failures instead of toast notifications to ensure persistence until a retry succeeds."
invariants:
  - "Strict priority order of dashboard sections: Needs Your Review > Failed & Blocked > Running Sessions > Ready to Assign > Completed Recently."
  - "Empty sections are completely skipped; no empty headers or placeholder states are rendered inside sections."
  - "Status classification sets (ACTIVE_STATUSES, NEEDS_REVIEW_STATUSES, READY_TO_ASSIGN_STATUSES) must match canonical kebab-case keys in TaskStatus."
  - "Dashboard action buttons (Resume Session, View Details, Assign Agent, Open Review) solely open the Task Detail Panel and propagate events correctly; they do not perform execution actions directly."
  - "No new backend API contracts or database schema changes are introduced."
risks:
  - "Timezone mismatch in relative time calculations if system mock time uses UTC while Date methods use local offset."
  - "Partial query errors can block the whole dashboard if not gracefully separated; mitigated by separating isError (projects fail or all tasks fail) and hasPartialError (some tasks fail)."
tests:
  - command: "cd frontend && npm test"
    covers:
      - "taskClassification counts active, needs-review, running, and completed-today tasks correctly"
      - "taskClassification filters and sorts completed recently tasks within 24h"
      - "formatters handles dashboard greeting ranges (5h, 11h, 12h, 17h, 18h, 0h, 4h)"
      - "formatters maps agent type to human readable name (claude -> Claude CLI)"
      - "useAggregatedTasks loads tasks from multiple projects in parallel and maps project references"
      - "useAggregatedTasks triggers hasPartialError when some queries fail and refetches correctly"
      - "Dashboard renders loading skeletons and sets aria-busy='true'"
      - "Dashboard renders sections in correct priority order and skips empty ones"
      - "Dashboard action buttons open detail panel with (task, project) parameters"
      - "Dashboard handles error alerts and refetch on failures"
      - "Dashboard renders You're all caught up empty state when there are projects but no active tasks"
      - "Dashboard renders No projects yet empty state and focuses project-switcher when projects array is empty"
      - "Dashboard maintains correct semantic HTML structure (h1 id dashboard-heading, section aria-labelledby)"
missing_tests:
  - "No automated tests for visual regressions, horizontal scrolling overflow layout, or device-specific responsiveness."
  - "No browser-level E2E tests covering the complete redirect from '/' to '/dashboard'."
supersedes: []
---

## task
4-1-morning-dashboard — 78e1e300-ed9c-404e-a62d-69a00c527129

## deviations
None. All acceptance criteria (AC-1 to AC-13) implemented verbatim.

## traps
- **Timezone Offsets in Vitest**: Mixing UTC (with 'Z') and local time (without 'Z') in Date test configurations results in test failures on machines running under different timezones (e.g. GMT+7). Always mock system time and parse test dates using local timezone strings (without 'Z').
- **Accessible Name Calculation Collisions**: Using `role="button"` on card articles containing inner buttons causes React Testing Library getByRole queries to fail due to name collisions, since the article's accessible name aggregates all nested text. Keep `role="article"` on cards as specified in AC-4.
- **Stop Propagation**: Buttons inside clickable cards and rows must call `e.stopPropagation()` to prevent opening the Task Detail Panel twice or triggering parent click events.

## dead_ends
- **Sequential Fetching**: Initially considered using a simple array map to load tasks sequentially, but rejected in favor of TanStack Query `useQueries` to ensure true parallel data fetching and robust cache reuse.
- **Toast Notifications for Partial Errors**: Attempted using toast notifications for partial load errors, but deferred in favor of inline banner because toast is transient and partial error persists until retry.

## validation_delta
- TypeScript check passed: `cd frontend && npx tsc --noEmit` (Exit 0)
- All unit & integration tests passed: `cd frontend && npm test` (Exit 0, 176 tests passed)
- Lint check skipped: no eslint config found in the frontend workspace.

## next_agent_hint
- When implementing run log activity / timeline events in Epic 3 (e.g., Story 3.5b), remember to insert the "Recent Agent Activity" section into `Dashboard.tsx` where marked by the placeholder comment (`/* Section: Recent Agent Activity — defer... */`).
- The Dismiss button in `NeedsReviewCard` is a no-op stub that receives `onDismiss` from `Dashboard.tsx`. Wire this button to dismissal logic once Epic 5 APIs are available.
