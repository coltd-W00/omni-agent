import type { TaskStatus } from "../../types/task";
import { STATUS_DISPLAY } from "../../components/StatusBadge";
import "../../components/StatusBadge.css";

interface DashboardStatusBadgeProps {
  status: TaskStatus;
  labelOverride?: string;
  size?: "sm" | "md" | "lg";
}

export default function DashboardStatusBadge({
  status,
  labelOverride,
  size = "md",
}: DashboardStatusBadgeProps) {
  const { label: defaultLabel, icon } = STATUS_DISPLAY[status];
  const label = labelOverride ?? defaultLabel;
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
