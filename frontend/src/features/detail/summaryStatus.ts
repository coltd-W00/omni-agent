import type { TaskStatus } from "../../types/task";

export function summaryStatusLabel(status: TaskStatus): string | null {
  switch (status) {
    case "running":
      return "Running — agent is processing this task";
    case "paused":
      return "Paused — last run ended cleanly. Ready to resume.";
    case "failed":
      return "Failed — last run exited with a non-zero code. Review and resume.";
    case "needs-review":
      return "Needs Review — agent finished and is awaiting your review.";
    case "changes-requested":
      return "Changes Requested — your review has been sent back to the agent.";
    case "completed":
      return "Completed — task is done.";
    case "cancelled":
      return "Cancelled — session was killed.";
    case "assigned":
      return "Assigned — ready to start the first session.";
    case "ready":
    case "draft":
    default:
      return null;
  }
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
