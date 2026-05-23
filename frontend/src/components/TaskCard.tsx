import "./TaskCard.css";
import type { KeyboardEvent } from "react";
import type { Task } from "../types/task";
import type { SessionState } from "../types/session";
import AgentAvatar from "./AgentAvatar";
import SessionBadge from "./SessionBadge";

interface TaskCardProps {
  task: Task;
  project: { key: string; color?: string };
  agent: { name: string; runtime: "codex" | "claude" };
  sessionState: SessionState;
  commentsCount: number;
  lastActivity: string;
  onClick?: () => void;
}

export default function TaskCard({
  task,
  project,
  agent,
  sessionState,
  commentsCount,
  lastActivity,
  onClick,
}: TaskCardProps) {
  const isClickable = onClick !== undefined;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onClick?.();
    } else if (e.key === " ") {
      e.preventDefault();
    }
  };

  const handleKeyUp = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      className={`app-task-card${isClickable ? " app-task-card--clickable" : ""}`}
      role={isClickable ? "button" : "article"}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? onClick : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      onKeyUp={isClickable ? handleKeyUp : undefined}
    >
      {/* Header row: project tag + agent avatar */}
      <div className="app-task-card__header">
        <span className="app-task-card__project-tag">
          {project.key.toUpperCase()}
        </span>
        <AgentAvatar name={agent.name} runtime={agent.runtime} size="sm" />
      </div>

      {/* Title */}
      <h3 className="app-task-card__title">{task.title}</h3>

      {/* Session row */}
      <div className="app-task-card__session">
        <SessionBadge state={sessionState} />
      </div>

      {/* Footer */}
      <div className="app-task-card__footer">
        <span>● {commentsCount} comments</span>
        <span className="app-task-card__spacer" />
        <span>{lastActivity}</span>
      </div>
    </div>
  );
}
