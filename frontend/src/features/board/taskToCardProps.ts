import type { Task } from "../../types/task";

export interface TaskCardPropsAdapted {
  task: { id: string; title: string; status: Task["status"] };
  project: { key: string };
  agent: { name: string; runtime: "codex" | "claude" };
  sessionState: "no-session" | "active" | "resumable" | "closed";
  commentsCount: number;
  lastActivity: string;
}

export function taskToCardProps(
  task: Task,
  project: { key: string },
  now: Date = new Date(),
): TaskCardPropsAdapted {
  const runtime: "codex" | "claude" = task.agent === "claude" ? "claude" : "codex";
  const name = task.role ?? task.agent ?? "unassigned";
  return {
    task: { id: task.id, title: task.title, status: task.status },
    project: { key: project.key },
    agent: { name, runtime },
    sessionState: "no-session",
    commentsCount: 0,
    lastActivity: formatRelativeTime(task.updatedAt ?? new Date(0).toISOString(), now),
  };
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  return then.toISOString().slice(0, 10);
}
