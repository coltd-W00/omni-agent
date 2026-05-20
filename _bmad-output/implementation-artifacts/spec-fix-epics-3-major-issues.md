---
title: 'Fix Epics — 3 Major Issues from Implementation Readiness Report'
type: fix
created: '2026-05-21'
status: 'done'
route: 'one-shot'
---

# Fix Epics — 3 Major Issues from Implementation Readiness Report

## Intent

**Problem:** Implementation readiness report (2026-05-21) identified 3 major issues in `epics.md` that would cause confusion or test failures during Phase 4 implementation: Story 2.1 combined two unrelated concerns; Story 2.2 had a forward dependency AC that would fail if implemented in order; Story 3.5 was too large (5–8 days estimate).

**Approach:** Split Story 2.1 into Story 2.0 (Shared UI Components) + Story 2.1 (Project CRUD); fix Story 2.2 AC to remove forward dependency; split Story 3.5 into Story 3.5a (Summary Tab + Optimistic Resume) + Story 3.5b (Comments, Runs, Logs + RunTimeline). Applied 6 patches from adversarial review (dependencies, duplicate AC removal, live timeline boundary clarification, Epic list header update).

## Suggested Review Order

1. [Epic 2 list header update](_bmad-output/planning-artifacts/epics.md) — verify Story 2.0 appears in Epic 2 overview
2. [Story 2.0 — Shared UI Components](_bmad-output/planning-artifacts/epics.md) — verify all component ACs moved here, `Depends on: Story 1.3 + 1.4`
3. [Story 2.1 — Project CRUD only](_bmad-output/planning-artifacts/epics.md) — verify `Depends on: Story 2.0`, no component ACs remain
4. [Story 2.2 — fixed AC](_bmad-output/planning-artifacts/epics.md) — verify "new task appears on the Task Board in the Draft column" (no Task Detail Panel reference)
5. [Story 3.5a — Summary Tab + Optimistic Resume](_bmad-output/planning-artifacts/epics.md) — verify live status feed language, depends on 3.1/3.2/3.3
6. [Story 3.5b — Comments, Runs, Logs + RunTimeline](_bmad-output/planning-artifacts/epics.md) — verify `Depends on: 3.3, 3.4, 3.5a, 2.4`
