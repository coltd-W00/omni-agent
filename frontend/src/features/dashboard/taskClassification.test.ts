import { describe, it, expect } from "vitest";
import type { Task } from "../../types/task";
import {
  countActive,
  countNeedsReview,
  countRunning,
  countCompletedToday,
  tasksNeedsYourReview,
  tasksFailedAndBlocked,
  tasksRunningSessions,
  tasksReadyToAssign,
  tasksCompletedRecently,
} from "./taskClassification";

// Helper to create task fixture
function createTask(id: string, status: Task["status"], updatedAt: string): Task {
  return {
    id,
    projectId: "p1",
    seq: 1,
    title: `Task ${id}`,
    description: "",
    acceptanceCriteria: null,
    agent: null,
    role: null,
    status,
    createdAt: updatedAt,
    updatedAt,
  };
}

describe("taskClassification", () => {
  const tasks: Task[] = [
    createTask("1", "draft", "2026-05-26T10:00:00Z"),
    createTask("2", "ready", "2026-05-26T11:00:00Z"),
    createTask("3", "assigned", "2026-05-26T12:00:00Z"),
    createTask("4", "running", "2026-05-26T13:00:00Z"),
    createTask("5", "paused", "2026-05-26T14:00:00Z"),
    createTask("6", "needs-review", "2026-05-26T15:00:00Z"),
    createTask("7", "changes-requested", "2026-05-26T16:00:00Z"),
    createTask("8", "completed", "2026-05-26T17:00:00Z"),
    createTask("9", "failed", "2026-05-26T18:00:00Z"),
    createTask("10", "cancelled", "2026-05-26T19:00:00Z"),
  ];

  it("should count active tasks correctly", () => {
    // Active statuses: assigned, running, paused, needs-review, changes-requested
    expect(countActive(tasks)).toBe(5);
  });

  it("should count needs review tasks correctly", () => {
    // Needs review statuses: needs-review, changes-requested
    expect(countNeedsReview(tasks)).toBe(2);
  });

  it("should count running tasks correctly", () => {
    expect(countRunning(tasks)).toBe(1);
  });

  it("should count completed today tasks correctly", () => {
    const mockNow = new Date(2026, 4, 26, 20, 0, 0);
    const completedTasks = [
      createTask("completed-today", "completed", new Date(2026, 4, 26, 10, 0, 0).toISOString()),
      createTask("completed-yesterday", "completed", new Date(2026, 4, 25, 23, 59, 0).toISOString()),
    ];
    expect(countCompletedToday(completedTasks, mockNow)).toBe(1);
  });

  it("should filter and sort needs-review tasks", () => {
    const results = tasksNeedsYourReview(tasks);
    expect(results.length).toBe(2);
    // Descending order by updatedAt: 7 (16:00) then 6 (15:00)
    expect(results[0].id).toBe("7");
    expect(results[1].id).toBe("6");
  });

  it("should filter and sort failed tasks", () => {
    const results = tasksFailedAndBlocked(tasks);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("9");
  });

  it("should filter and sort running tasks", () => {
    const results = tasksRunningSessions(tasks);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("4");
  });

  it("should filter and sort ready-to-assign tasks", () => {
    // Ready or Assigned
    const results = tasksReadyToAssign(tasks);
    expect(results.length).toBe(2);
    // Descending order: 3 (12:00) then 2 (11:00)
    expect(results[0].id).toBe("3");
    expect(results[1].id).toBe("2");
  });

  it("should filter and sort completed recently tasks within 24 hours", () => {
    const mockNow = new Date("2026-05-26T20:00:00Z");
    const mixCompleted = [
      createTask("c1", "completed", "2026-05-26T18:00:00Z"), // 2 hours ago
      createTask("c2", "completed", "2026-05-25T21:00:00Z"), // 23 hours ago
      createTask("c3", "completed", "2026-05-25T19:00:00Z"), // 25 hours ago
    ];
    const results = tasksCompletedRecently(mixCompleted, mockNow);
    expect(results.length).toBe(2);
    expect(results[0].id).toBe("c1");
    expect(results[1].id).toBe("c2");
  });
});
