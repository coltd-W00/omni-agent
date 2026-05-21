export const TaskStatus = {
  Draft: "draft",
  Ready: "ready",
  Assigned: "assigned",
  Running: "running",
  NeedsReview: "needs-review",
  ChangesRequested: "changes-requested",
  Completed: "completed",
  Failed: "failed",
  Cancelled: "cancelled",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export interface Task {
  id: string; // e.g. "ERP-CB-001"
  title: string;
  status: TaskStatus;
}
