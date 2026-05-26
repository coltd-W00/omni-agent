import type { KeyboardEvent, MouseEvent } from "react";
import type { Task } from "../../types/task";
import type { Project } from "../../types/project";
import Button from "../../components/Button";
import DashboardStatusBadge from "./DashboardStatusBadge";
import { agentLabel, formatRelativeTime } from "./formatters";
import "./DashboardCards.css";

interface FailedBlockedCardProps {
  task: Task & { project: Project };
  onResume: () => void;
  onViewDetails: () => void;
}

export default function FailedBlockedCard({
  task,
  onResume,
  onViewDetails,
}: FailedBlockedCardProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onViewDetails();
    } else if (e.key === " ") {
      e.preventDefault();
    }
  };

  const handleKeyUp = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === " ") {
      e.preventDefault();
      onViewDetails();
    }
  };

  const handleCardClick = () => {
    onViewDetails();
  };

  const handleResumeClick = (e: MouseEvent) => {
    e.stopPropagation();
    onResume();
  };

  const handleDetailsClick = (e: MouseEvent) => {
    e.stopPropagation();
    onViewDetails();
  };

  const relativeTime = formatRelativeTime(task.updatedAt);
  const displayRole = task.role ?? "—";
  const displayAgent = agentLabel(task.agent);

  return (
    <article
      tabIndex={0}
      role="article"
      className="dashboard-card dashboard-failed-card"
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      <div className="dashboard-card__badge-wrapper">
        <DashboardStatusBadge status="failed" labelOverride="BLOCKED" size="md" />
      </div>
      <h3 className="dashboard-card__title">{task.title}</h3>
      <div className="dashboard-card__meta">
        {task.project.key} &middot; {displayRole} / {displayAgent}
      </div>
      <p className="dashboard-card__reason">
        Session terminated unexpectedly
      </p>
      <div className="dashboard-card__activity">
        Last active: {relativeTime}
      </div>
      <div className="dashboard-card__actions">
        <Button variant="primary" size="sm" onClick={handleResumeClick}>
          Resume Session
        </Button>
        <Button variant="secondary" size="sm" onClick={handleDetailsClick}>
          View Details
        </Button>
      </div>
    </article>
  );
}
