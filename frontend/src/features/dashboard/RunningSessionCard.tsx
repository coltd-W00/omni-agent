import type { KeyboardEvent, MouseEvent } from "react";
import type { Task } from "../../types/task";
import type { Project } from "../../types/project";
import StatusBadge from "../../components/StatusBadge";
import Button from "../../components/Button";
import { agentLabel, formatRelativeTime } from "./formatters";
import "./DashboardCards.css";

interface RunningSessionCardProps {
  task: Task & { project: Project };
  onViewProgress: () => void;
}

export default function RunningSessionCard({
  task,
  onViewProgress,
}: RunningSessionCardProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onViewProgress();
    } else if (e.key === " ") {
      e.preventDefault();
    }
  };

  const handleKeyUp = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === " ") {
      e.preventDefault();
      onViewProgress();
    }
  };

  const handleCardClick = () => {
    onViewProgress();
  };

  const handleProgressClick = (e: MouseEvent) => {
    e.stopPropagation();
    onViewProgress();
  };

  const relativeTime = formatRelativeTime(task.updatedAt);
  const displayRole = task.role ?? "—";
  const displayAgent = agentLabel(task.agent);

  return (
    <article
      tabIndex={0}
      role="article"
      className="dashboard-card dashboard-running-card"
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      <div className="dashboard-card__badge-wrapper">
        <StatusBadge status="running" size="md" />
      </div>
      <h3 className="dashboard-card__title">{task.title}</h3>
      <div className="dashboard-card__meta">
        <div className="dashboard-card__meta-project">{task.project.key}</div>
        <div className="dashboard-card__meta-details">
          {displayRole} &middot; {displayAgent}
        </div>
      </div>
      <div className="dashboard-card__activity">
        Started {relativeTime}
      </div>
      <div className="dashboard-card__actions">
        <Button variant="primary" size="sm" onClick={handleProgressClick}>
          View Progress
        </Button>
      </div>
    </article>
  );
}
