import { useState } from "react";
import Button from "../../components/Button";
import StatusBadge from "../../components/StatusBadge";
import { useToast } from "../../components/Toast";
import { useStartSession } from "../../hooks/useStartSession";
import { useCompleteSession } from "../../hooks/useCompleteSession";
import { useCancelSession } from "../../hooks/useCancelSession";
import { ApiError } from "../../api/client";
import type { Task, TaskStatus } from "../../types/task";
import type { Project } from "../../types/project";

// Session panel shows for tasks that have reached Running or later in the lifecycle.
export const HAS_SESSION_STATUSES = new Set<TaskStatus>([
  "running",
  "paused",
  "needs-review",
  "changes-requested",
  "completed",
  "failed",
]);

interface ActionBarProps {
  project: Project;
  task: Task;
  className?: string;
}

export function ActionBar({ project, task, className }: ActionBarProps) {
  const { showToast } = useToast();
  const startMut = useStartSession(project.id, task.id);
  const completeMut = useCompleteSession(project.id, task.id);
  const cancelMut = useCancelSession(project.id, task.id);
  const workspaceMissing = !project.workspacePath;
  const agentMissing = !task.agent;

  const handleStart = () => {
    startMut.mutate(undefined, {
      onSuccess: () => {
        showToast({ tone: "success", message: `Session started for ${task.id}` });
      },
      onError: (err) => {
        const msg = err instanceof ApiError ? err.message : "Failed to start session";
        showToast({ tone: "error", message: msg });
      },
    });
  };

  const handleComplete = () => {
    completeMut.mutate(undefined, {
      onSuccess: () => {
        showToast({ tone: "success", message: `Task ${task.id} marked as completed` });
      },
      onError: (err) => {
        const msg = err instanceof ApiError ? err.message : "Failed to complete task";
        showToast({ tone: "error", message: msg });
      },
    });
  };

  const handleCancel = () => {
    cancelMut.mutate(undefined, {
      onSuccess: () => {
        showToast({ tone: "success", message: `Task ${task.id} cancelled` });
      },
      onError: (err) => {
        const msg = err instanceof ApiError ? err.message : "Failed to cancel task";
        showToast({ tone: "error", message: msg });
      },
    });
  };

  const isPending = startMut.isPending || completeMut.isPending || cancelMut.isPending;

  if (task.status === "assigned") {
    return (
      <div className={className}>
        {workspaceMissing && (
          <span className="task-detail-panel__action-note">Workspace missing</span>
        )}
        <Button
          variant="primary"
          size="md"
          onClick={handleStart}
          disabled={isPending || workspaceMissing || agentMissing}
        >
          Start Session
        </Button>
      </div>
    );
  }
  if (task.status === "paused" || task.status === "failed") {
    return (
      <div className={className}>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Button
            variant="secondary"
            size="md"
            onClick={handleComplete}
            disabled={isPending}
          >
            Mark Done
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={handleCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }
  return null;
}

interface SessionPanelProps {
  task: Task;
  className?: string;
  titleClassName?: string;
}

export function SessionPanel({ task, className, titleClassName }: SessionPanelProps) {
  const [showId, setShowId] = useState(false);

  if (!HAS_SESSION_STATUSES.has(task.status)) return null;

  const agentLabel =
    task.agent === "claude" ? "Claude CLI" : task.agent === "codex" ? "Codex CLI" : "—";

  return (
    <div className={className} data-testid="session-panel">
      <span className={titleClassName ?? "task-detail-panel__section-title"}>Session</span>
      <div className="task-detail-panel__session-row">
        <span className="task-detail-panel__session-label">Agent</span>
        <span className="task-detail-panel__session-value">{agentLabel}</span>
      </div>
      <div className="task-detail-panel__session-row">
        <span className="task-detail-panel__session-label">Status</span>
        <StatusBadge status={task.status} size="sm" />
      </div>
      <div className="task-detail-panel__session-row">
        <span className="task-detail-panel__session-label">Created</span>
        <span className="task-detail-panel__session-value">
          {new Date(task.createdAt).toLocaleString()}
        </span>
      </div>
      <div className="task-detail-panel__session-row">
        <span className="task-detail-panel__session-label">Last active</span>
        <span className="task-detail-panel__session-value">
          {new Date(task.updatedAt).toLocaleString()}
        </span>
      </div>
      <div className="task-detail-panel__session-row">
        <span className="task-detail-panel__session-label">Session ID</span>
        <span className="task-detail-panel__session-value task-detail-panel__session-id">
          <span>{showId ? "—" : "••••••••••••"}</span>
          <button
            className="task-detail-panel__show-id-btn"
            type="button"
            onClick={() => setShowId((v) => !v)}
            aria-pressed={showId}
          >
            {showId ? "Hide ID" : "Show ID"}
          </button>
        </span>
      </div>
    </div>
  );
}
