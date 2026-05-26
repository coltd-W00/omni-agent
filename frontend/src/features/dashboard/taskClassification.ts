import type { Task, TaskStatus } from "../../types/task";

export const ACTIVE_STATUSES: ReadonlySet<TaskStatus> = new Set([
  "assigned",
  "running",
  "paused",
  "needs-review",
  "changes-requested",
]);

export const NEEDS_REVIEW_STATUSES: ReadonlySet<TaskStatus> = new Set([
  "needs-review",
  "changes-requested",
]);

export const READY_TO_ASSIGN_STATUSES: ReadonlySet<TaskStatus> = new Set([
  "ready",
  "assigned",
]);

const sortByUpdatedAtDesc = <T extends { updatedAt: string }>(items: T[]): T[] => {
  return [...items].sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
};

export function countActive(tasks: Task[]): number {
  return tasks.filter((t) => ACTIVE_STATUSES.has(t.status)).length;
}

export function countNeedsReview(tasks: Task[]): number {
  return tasks.filter((t) => NEEDS_REVIEW_STATUSES.has(t.status)).length;
}

export function countRunning(tasks: Task[]): number {
  return tasks.filter((t) => t.status === "running").length;
}

export function countCompletedToday(tasks: Task[], now: Date = new Date()): number {
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  return tasks.filter((t) => {
    return t.status === "completed" && new Date(t.updatedAt).getTime() >= startOfToday;
  }).length;
}

export function tasksNeedsYourReview<T extends Task>(tasks: T[]): T[] {
  const filtered = tasks.filter((t) => NEEDS_REVIEW_STATUSES.has(t.status));
  return sortByUpdatedAtDesc(filtered);
}

export function tasksFailedAndBlocked<T extends Task>(tasks: T[]): T[] {
  const filtered = tasks.filter((t) => t.status === "failed");
  return sortByUpdatedAtDesc(filtered);
}

export function tasksRunningSessions<T extends Task>(tasks: T[]): T[] {
  const filtered = tasks.filter((t) => t.status === "running");
  return sortByUpdatedAtDesc(filtered);
}

export function tasksReadyToAssign<T extends Task>(tasks: T[]): T[] {
  const filtered = tasks.filter((t) => READY_TO_ASSIGN_STATUSES.has(t.status));
  return sortByUpdatedAtDesc(filtered);
}

export function tasksCompletedRecently<T extends Task>(tasks: T[], now: Date = new Date()): T[] {
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
  const filtered = tasks.filter((t) => {
    return t.status === "completed" && new Date(t.updatedAt).getTime() >= cutoff;
  });
  return sortByUpdatedAtDesc(filtered);
}
