import { useState } from "react";
import Button from "../../components/Button";
import EmptyState from "../../components/EmptyState";
import RunTimeline from "../../components/RunTimeline";
import { useRunList } from "../../hooks/useRunList";
import { formatDuration, formatRelativeTime } from "../../utils/time";
import type { Run } from "../../types/run";
import type { Task } from "../../types/task";
import "./RunsTabPanel.css";

type PanelTab = "summary" | "comments" | "runs" | "logs" | "settings";

interface RunsTabPanelProps {
  task: Task;
  projectId: string;
  onSwitchTab: (tab: PanelTab, runId?: string) => void;
}

function agentLabel(task: Task): string {
  if (task.agent === "claude") return "Claude CLI";
  if (task.agent === "codex") return "Codex CLI";
  return "Unassigned";
}

function statusInfo(run: Run) {
  if (run.exitCode === null && run.endedAt === null) {
    return {
      variant: "running",
      icon: "●",
      label: `Running · ${formatRelativeTime(run.startedAt)}`,
    };
  }
  if (run.exitCode === 0) {
    return {
      variant: "completed",
      icon: "✓",
      label: `Completed · ${run.endedAt ? formatRelativeTime(run.endedAt) : "just now"}`,
    };
  }
  return {
    variant: "failed",
    icon: "✕",
    label: `Failed · ${run.endedAt ? formatRelativeTime(run.endedAt) : "just now"}`,
  };
}

function exitText(run: Run): string {
  if (run.exitCode === null) return "(not finished)";
  if (run.exitCode === 0) return "0 (success)";
  return `${run.exitCode} (failed)`;
}

function formatOutputPreview(logTail: string | null): string {
  if (!logTail) return "(no output captured yet)";
  return logTail
    .split("\n")
    .slice(-5)
    .map((line) => (line.length > 80 ? `${line.slice(0, 80)}…` : line))
    .join("\n");
}

export default function RunsTabPanel({ task, projectId, onSwitchTab }: RunsTabPanelProps) {
  const runsQuery = useRunList(projectId, task.id, task.status);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [showTimelineForRunId, setShowTimelineForRunId] = useState<string | null>(null);
  const runs = runsQuery.data ?? [];

  if (runsQuery.isLoading) {
    return <p className="runs-tab-panel__placeholder">Loading runs…</p>;
  }

  if (runsQuery.isError) {
    return (
      <div className="runs-tab-panel__error">
        <p>Could not load runs.</p>
        <Button variant="ghost" size="sm" onClick={() => void runsQuery.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <EmptyState
        variant="inline"
        icon=""
        heading="No runs yet"
        description="Session runs will appear here."
      />
    );
  }

  return (
    <ul className="run-list" role="list">
      {runs.map((run) => {
        const isExpanded = expandedRunId === run.id;
        const status = statusInfo(run);
        return (
          <li key={run.id} className="run-list-row">
            <button
              type="button"
              role="button"
              className="run-list-row-button"
              aria-expanded={isExpanded}
              aria-controls={`run-detail-${run.id}`}
              onClick={() => setExpandedRunId((id) => (id === run.id ? null : run.id))}
            >
              <span className="run-list-row-number">Run #{run.runNumber}</span>
              <span className="run-list-row-agent">{agentLabel(task)} · {task.role ?? "unassigned"}</span>
              <span className={`run-list-row-status run-list-row-status--${status.variant}`}>
                <span className="run-list-row-status-icon" aria-hidden="true">{status.icon}</span>
                {status.label}
              </span>
            </button>
            {isExpanded && (
              <div id={`run-detail-${run.id}`} className="run-list-row-detail">
                <div className="run-list-row-field">
                  <span>Input:</span>
                  <span>{run.input ?? "(none)"}</span>
                </div>
                <div className="run-list-row-field run-list-row-field--stacked">
                  <span>Output:</span>
                  <pre>{formatOutputPreview(run.logTail)}</pre>
                </div>
                <div className="run-list-row-field">
                  <span>Duration:</span>
                  <span>{formatDuration(run.startedAt, run.endedAt)}</span>
                </div>
                <div className="run-list-row-field">
                  <span>Exit:</span>
                  <span>{exitText(run)}</span>
                </div>
                <div className="run-list-row-actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`View timeline for Run #${run.runNumber}`}
                    onClick={() =>
                      setShowTimelineForRunId((id) => (id === run.id ? null : run.id))
                    }
                  >
                    View Timeline
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`View logs for Run #${run.runNumber}`}
                    onClick={() => onSwitchTab("logs", run.id)}
                  >
                    View Logs
                  </Button>
                </div>
                {showTimelineForRunId === run.id && (
                  <RunTimeline
                    run={run}
                    task={task}
                    projectId={projectId}
                    onViewRawClick={(runId) => onSwitchTab("logs", runId)}
                  />
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
