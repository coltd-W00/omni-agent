import type { KeyboardEvent } from "react";
import type { Task } from "../../types/task";
import type { Project } from "../../types/project";
import { formatRelativeTime } from "./formatters";
import "./dashboard-compact-row.css";

interface CompletedRecentlyRowProps {
  task: Task & { project: Project };
  onOpen: () => void;
}

export default function CompletedRecentlyRow({ task, onOpen }: CompletedRecentlyRowProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onOpen();
    } else if (e.key === " ") {
      e.preventDefault();
    }
  };

  const handleKeyUp = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };

  const relativeTime = formatRelativeTime(task.updatedAt);

  return (
    <div
      tabIndex={0}
      role="button"
      className="dashboard-compact-row dashboard-compact-row--completed"
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      <span
        className="dashboard-compact-row__check"
        aria-hidden="true"
        style={{ color: "var(--status-completed-text)" }}
      >
        ✓
      </span>
      <span className="dashboard-compact-row__title">{task.title}</span>
      <span className="dashboard-compact-row__project-key">{task.project.key}</span>
      <span className="dashboard-compact-row__time">
        Completed {relativeTime}
      </span>
    </div>
  );
}
