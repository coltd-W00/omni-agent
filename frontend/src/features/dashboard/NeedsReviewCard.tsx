import type { KeyboardEvent, MouseEvent } from "react";
import type { Task } from "../../types/task";
import type { Project } from "../../types/project";
import StatusBadge from "../../components/StatusBadge";
import Button from "../../components/Button";
import { agentLabel, formatRelativeTime } from "./formatters";
import "./DashboardCards.css";

interface NeedsReviewCardProps {
  task: Task & { project: Project };
  onOpen: () => void;
  onDismiss: () => void;
}

export default function NeedsReviewCard({
  task,
  onOpen,
  onDismiss,
}: NeedsReviewCardProps) {
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

  const handleCardClick = () => {
    onOpen();
  };

  const handleOpenClick = (e: MouseEvent) => {
    e.stopPropagation();
    onOpen();
  };

  const handleDismissClick = (e: MouseEvent) => {
    e.stopPropagation();
    onDismiss();
  };

  const relativeTime = formatRelativeTime(task.updatedAt);
  const displayRole = task.role ?? "—";
  const displayAgent = agentLabel(task.agent);

  return (
    <article
      tabIndex={0}
      role="article"
      className="dashboard-card dashboard-needs-review-card"
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      <div className="dashboard-card__badge-wrapper">
        <StatusBadge status={task.status} size="md" />
      </div>
      <h3 className="dashboard-card__title">{task.title}</h3>
      <div className="dashboard-card__meta">
        {task.project.key} &middot; {displayRole} / {displayAgent}
      </div>
      <div className="dashboard-card__activity">
        Agent completed {relativeTime}
      </div>
      <div className="dashboard-card__actions">
        <Button variant="primary" size="sm" onClick={handleOpenClick}>
          Open Review
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismissClick}
          aria-label={`Dismiss review for ${task.title}`}
        >
          Dismiss
        </Button>
      </div>
    </article>
  );
}
