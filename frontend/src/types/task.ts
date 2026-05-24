export const TaskStatus = {
  Draft: "draft",
  Ready: "ready",
  Assigned: "assigned",
  Running: "running",
  Paused: "paused",
  NeedsReview: "needs-review",
  ChangesRequested: "changes-requested",
  Completed: "completed",
  Failed: "failed",
  Cancelled: "cancelled",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskAgent = {
  Codex: "codex",
  Claude: "claude",
} as const;
export type TaskAgent = (typeof TaskAgent)[keyof typeof TaskAgent];

export const TaskRole = {
  Coder: "coder",
  Reviewer: "reviewer",
  Planner: "planner",
  Debugger: "debugger",
  Refactorer: "refactorer",
} as const;
export type TaskRole = (typeof TaskRole)[keyof typeof TaskRole];

export interface Task {
  id: string;
  projectId: string;
  seq: number;
  title: string;
  description: string;
  acceptanceCriteria: string | null;
  agent: TaskAgent | null;
  role: TaskRole | null;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}
