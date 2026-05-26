import "./StatusBadge.css";
import type { TaskStatus } from "../types/task";

interface StatusBadgeProps {
  status: TaskStatus;
  size?: "sm" | "md" | "lg";
}

export const STATUS_DISPLAY = {
  draft: { label: "Draft", icon: "●" },
  ready: { label: "Ready", icon: "●" },
  assigned: { label: "Assigned", icon: "●" },
  running: { label: "Running", icon: "●" },
  paused: { label: "Paused", icon: "⏸" },
  "needs-review": { label: "Needs Review", icon: "⚑" },
  "changes-requested": { label: "Changes Requested", icon: "!" },
  completed: { label: "Completed", icon: "✓" },
  failed: { label: "Failed", icon: "✕" },
  cancelled: { label: "Cancelled", icon: "─" },
} as const satisfies Record<TaskStatus, { label: string; icon: string }>;

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const { label, icon } = STATUS_DISPLAY[status];
  const isPulse = status === "running";

  return (
    <span
      className={`app-status-badge app-status-badge--${status} app-status-badge--${size}`}
      aria-label={`Status: ${label}`}
    >
      <span
        className={
          isPulse ? "app-status-badge__dot app-status-badge__dot--pulse" : "app-status-badge__dot"
        }
        aria-hidden="true"
      >
        {icon}
      </span>
      {label}
    </span>
  );
}
