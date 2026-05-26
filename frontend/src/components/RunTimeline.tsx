import Button from "./Button";
import { useToast } from "./Toast";
import { ApiError } from "../api/client";
import { useResumeSession } from "../hooks/useResumeSession";
import { formatDuration } from "../utils/time";
import type { Run } from "../types/run";
import type { Task } from "../types/task";
import "./RunTimeline.css";

interface RunTimelineProps {
  run: Run;
  task: Task;
  projectId: string;
  onViewRawClick: (runId: string) => void;
}

type TimelineEvent = {
  type: "session_start" | "session_running" | "session_end";
  label: string;
  timestamp: string | null;
  dotColor: "green" | "violet-pulse" | "red";
  subLabel?: string;
};

function agentLabel(task: Task): string {
  if (task.agent === "claude") return "Claude CLI";
  if (task.agent === "codex") return "Codex CLI";
  return "Unassigned";
}

function runStatusLabel(run: Run, task: Task): string {
  if (run.exitCode === null && run.endedAt === null) return "Running";
  if (task.status === "cancelled" && run.exitCode !== 0) return "Cancelled";
  return run.exitCode === 0 ? "Completed" : "Failed";
}

function deriveEvents(run: Run, task: Task): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      type: "session_start",
      label: "Session started",
      timestamp: run.startedAt,
      dotColor: "green",
    },
  ];

  if (run.exitCode === null && run.endedAt === null) {
    events.push({
      type: "session_running",
      label: "Agent running…",
      timestamp: null,
      dotColor: "violet-pulse",
    });
  } else if (run.endedAt !== null) {
    const isCancelled = task.status === "cancelled";
    const isSuccess = run.exitCode === 0;
    events.push({
      type: "session_end",
      label: isCancelled
        ? "Session cancelled"
        : isSuccess
          ? "Session completed"
          : "Session failed",
      timestamp: run.endedAt,
      dotColor: isSuccess && !isCancelled ? "green" : "red",
      subLabel:
        !isSuccess && run.exitCode !== null ? `Exit code: ${run.exitCode}` : undefined,
    });
  }

  return events;
}

export default function RunTimeline({
  run,
  task,
  projectId,
  onViewRawClick,
}: RunTimelineProps) {
  const { showToast } = useToast();
  const resumeMut = useResumeSession(projectId, task.id);
  const events = deriveEvents(run, task);
  const isLive = run.exitCode === null && run.endedAt === null;
  const isFailed = run.endedAt !== null && run.exitCode !== null && run.exitCode > 0;
  const showSuggestedAction = isFailed && task.status !== "cancelled";

  const handleResumeFromTimeline = () => {
    resumeMut.mutate(undefined, {
      onSuccess: () => {
        showToast({ tone: "success", message: `Session resumed for ${task.id}` });
      },
      onError: (err) => {
        const message = err instanceof ApiError ? err.message : "Failed to resume session";
        const tone =
          err instanceof ApiError && err.code === "session_already_active"
            ? "warning"
            : "error";
        showToast({ tone, message });
      },
    });
  };

  return (
    <div className="run-timeline" aria-live={isLive ? "polite" : undefined}>
      <div className="run-timeline-header">
        <div>
          <div className="run-timeline-title">
            Run #{run.runNumber} · {task.title}
          </div>
          <div className="run-timeline-meta">
            {agentLabel(task)} · {task.role ?? "unassigned"}
          </div>
        </div>
        <div className="run-timeline-summary">
          {new Date(run.startedAt).toLocaleString()} →{" "}
          {run.endedAt ? new Date(run.endedAt).toLocaleString() : "running"} ·{" "}
          {formatDuration(run.startedAt, run.endedAt)} · {runStatusLabel(run, task)}
        </div>
      </div>

      <ol className="run-timeline-list" role="list" aria-label={`Timeline for Run #${run.runNumber}`}>
        {events.map((event) => (
          <li key={event.type} className="run-timeline-step" role="listitem">
            <span
              className={`run-timeline-dot run-timeline-dot--${event.dotColor}`}
              aria-hidden="true"
            />
            <span className="run-timeline-label">{event.label}</span>
            <span className="run-timeline-timestamp">
              {event.timestamp ? new Date(event.timestamp).toLocaleString() : "in progress"}
              {event.subLabel && (
                <span className="run-timeline-sublabel">{event.subLabel}</span>
              )}
            </span>
          </li>
        ))}
      </ol>

      <button
        type="button"
        className="run-timeline-view-raw"
        onClick={() => onViewRawClick(run.id)}
      >
        View raw output →
      </button>

      {showSuggestedAction && (
        <div className="run-timeline-suggested-action" role="note">
          <p className="run-timeline-suggested-action-title">⚠ This run failed.</p>
          <p className="run-timeline-suggested-action-hint">
            Common cause: session terminated unexpectedly or agent error.
          </p>
          <div className="run-timeline-suggested-action-buttons">
            <Button
              variant="primary"
              size="sm"
              onClick={handleResumeFromTimeline}
              disabled={resumeMut.isPending}
            >
              Resume Session
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onViewRawClick(run.id)}
            >
              View Error Logs
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
