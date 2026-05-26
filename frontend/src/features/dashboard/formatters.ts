import type { Task } from "../../types/task";
export { formatRelativeTime } from "../board/taskToCardProps";

export const DASHBOARD_GREETING_NAME = "Loc";

export function formatDashboardGreeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h >= 5 && h <= 11) {
    return "Good morning";
  }
  if (h >= 12 && h <= 17) {
    return "Good afternoon";
  }
  return "Good evening";
}

export function formatDashboardDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);
}

export function agentLabel(agent: Task["agent"]): string {
  if (agent === "claude") {
    return "Claude CLI";
  }
  if (agent === "codex") {
    return "Codex CLI";
  }
  return "Unassigned";
}
