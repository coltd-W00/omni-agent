import type { KeyboardEvent, MouseEvent } from "react";
import type { Task } from "../../types/task";
import type { Project } from "../../types/project";
import Button from "../../components/Button";
import "./dashboard-compact-row.css";

interface ReadyToAssignRowProps {
  task: Task & { project: Project };
  onAssign: () => void;
}

export default function ReadyToAssignRow({ task, onAssign }: ReadyToAssignRowProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onAssign();
    } else if (e.key === " ") {
      e.preventDefault();
    }
  };

  const handleKeyUp = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === " ") {
      e.preventDefault();
      onAssign();
    }
  };

  const handleRowClick = () => {
    onAssign();
  };

  const handleButtonClick = (e: MouseEvent) => {
    e.stopPropagation();
    onAssign();
  };

  return (
    <div
      tabIndex={0}
      role="button"
      className="dashboard-compact-row dashboard-compact-row--ready"
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      <span
        className={`dashboard-compact-row__dot dashboard-compact-row__dot--${task.status}`}
        aria-hidden="true"
        style={{ backgroundColor: `var(--status-${task.status}-text)` }}
      />
      <span className="dashboard-compact-row__title">{task.title}</span>
      <span className="dashboard-compact-row__project-key">{task.project.key}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleButtonClick}
        aria-label={`Assign agent to ${task.title}`}
        className="dashboard-compact-row__action"
      >
        Assign Agent &rarr;
      </Button>
    </div>
  );
}
