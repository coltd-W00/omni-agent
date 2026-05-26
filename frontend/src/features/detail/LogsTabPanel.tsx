import { useEffect, useMemo, useRef, useState } from "react";
import Button from "../../components/Button";
import EmptyState from "../../components/EmptyState";
import { useRunList } from "../../hooks/useRunList";
import type { Run } from "../../types/run";
import type { Task } from "../../types/task";
import "./LogsTabPanel.css";

type PanelTab = "summary" | "comments" | "runs" | "logs" | "settings";

interface LogsTabPanelProps {
  task: Task;
  projectId: string;
  focusedRunId: string | null;
  clearFocusedRunId: () => void;
  onSwitchTab: (tab: PanelTab, runId?: string) => void;
}

function agentLabel(task: Task): string {
  if (task.agent === "claude") return "Claude CLI";
  if (task.agent === "codex") return "Codex CLI";
  return "Unassigned";
}

function runStatus(run: Run): string {
  if (run.exitCode === null && run.endedAt === null) return "Running";
  return run.exitCode === 0 ? "Completed" : "Failed";
}

function downloadRunLog(taskId: string, run: Run) {
  const blob = new Blob([run.logTail ?? ""], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `omni-agent-${taskId}-run${run.runNumber}.log`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export default function LogsTabPanel({
  task,
  projectId,
  focusedRunId,
  clearFocusedRunId,
  onSwitchTab,
}: LogsTabPanelProps) {
  const runsQuery = useRunList(projectId, task.id, task.status);
  const [selectedRunFilter, setSelectedRunFilter] = useState<"all" | string>("all");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const runs = runsQuery.data ?? [];
  const hasAnyLogTail = runs.some((run) => run.logTail !== null);

  useEffect(() => {
    if (!focusedRunId) return;
    const exists = runs.some((run) => run.id === focusedRunId);
    setSelectedRunFilter(exists ? focusedRunId : "all");
    window.setTimeout(() => {
      sectionRefs.current[focusedRunId]?.scrollIntoView?.({
        block: "start",
        behavior: "smooth",
      });
      clearFocusedRunId();
    }, 0);
  }, [focusedRunId, runs, clearFocusedRunId]);

  const filteredRuns = useMemo(() => {
    if (selectedRunFilter === "all") return runs;
    return runs.filter((run) => run.id === selectedRunFilter);
  }, [runs, selectedRunFilter]);

  return (
    <div className="logs-tab-panel">
      <div className="logs-disclaimer" role="note">
        <p>This tab contains raw technical output. For a human-readable summary, see the Summary tab.</p>
        <button
          type="button"
          className="logs-disclaimer-link"
          onClick={() => onSwitchTab("summary")}
        >
          → Switch to Summary tab
        </button>
      </div>

      {runsQuery.isLoading && <p className="logs-tab-panel__placeholder">Loading runs…</p>}
      {runsQuery.isError && (
        <div className="logs-tab-panel__error">
          <p>Could not load runs.</p>
          <Button variant="ghost" size="sm" onClick={() => void runsQuery.refetch()}>
            Retry
          </Button>
        </div>
      )}
      {!runsQuery.isLoading && !runsQuery.isError && (runs.length === 0 || !hasAnyLogTail) && (
        <EmptyState
          variant="inline"
          icon=""
          heading="No logs yet"
          description="Run output will appear here when an agent starts producing output."
        />
      )}
      {!runsQuery.isLoading && !runsQuery.isError && runs.length > 0 && hasAnyLogTail && (
        <>
          <div className="logs-filter">
            <label htmlFor="logs-run-filter">Filter by run</label>
            <select
              id="logs-run-filter"
              value={selectedRunFilter}
              onChange={(event) => setSelectedRunFilter(event.target.value)}
            >
              <option value="all">All runs</option>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  Run #{run.runNumber} ({runStatus(run)})
                </option>
              ))}
            </select>
          </div>

          <div className="logs-section-list">
            {filteredRuns.map((run) => (
              <section
                key={run.id}
                ref={(node) => {
                  sectionRefs.current[run.id] = node;
                }}
                className="logs-section"
              >
                <div className="logs-section-header">
                  <span>
                    Run #{run.runNumber} · {agentLabel(task)} ·{" "}
                    {run.endedAt ? new Date(run.endedAt).toLocaleString() : "running"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Download log for Run #${run.runNumber}`}
                    onClick={() => downloadRunLog(task.id, run)}
                  >
                    Download
                  </Button>
                </div>
                <pre
                  className="logs-section-pre"
                  aria-label={`Log content for Run #${run.runNumber}`}
                >
                  {run.logTail ?? "(no output captured yet)"}
                </pre>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
