import { useState } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import Button from "../../components/Button";
import EmptyState from "../../components/EmptyState";
import { useToast } from "../../components/Toast";
import { useResumeSession } from "../../hooks/useResumeSession";
import { ApiError } from "../../api/client";
import { listRuns } from "../../api/runs";
import { summaryStatusLabel, formatRelativeTime } from "./summaryStatus";
import type { Task } from "../../types/task";
import type { Run } from "../../types/run";
import "./SummaryTab.css";

interface SummaryTabProps {
  projectId: string;
  task: Task;
  onSwitchTab: (tab: "summary" | "comments" | "runs" | "logs" | "settings") => void;
}

export default function SummaryTab({ projectId, task, onSwitchTab }: SummaryTabProps) {
  // Runs query: Paused/Failed = terminal states, running = polling, else disabled.
  const isRunsFetchEnabled = ["paused", "failed", "running"].includes(task.status);
  const runsQuery = useQuery({
    queryKey: ["runs", projectId, task.id],
    queryFn: () => listRuns(projectId, task.id),
    enabled: isRunsFetchEnabled,
    refetchInterval: task.status === "running" ? 5000 : false,
  });

  const latestRun = runsQuery.data?.[0];

  const renderContent = () => {
    if (task.status === "running") {
      return (
        <LiveStatusFeedBlock
          latestRun={latestRun}
          onSwitchTab={onSwitchTab}
        />
      );
    }

    if (["paused", "failed"].includes(task.status)) {
      return (
        <>
          <CurrentStatusBlock task={task} />
          <LastAgentSummaryBlock
            runsQuery={runsQuery}
            onSwitchTab={onSwitchTab}
          />
          <NextSuggestedActionBlock
            projectId={projectId}
            task={task}
          />
        </>
      );
    }

    // For other statuses (assigned, needs-review, changes-requested, completed, cancelled),
    // we only render the CurrentStatusBlock at the top.
    if (summaryStatusLabel(task.status) !== null) {
      return <CurrentStatusBlock task={task} />;
    }

    return null;
  };

  return (
    <div className="summary-tab">
      {/* Top blocks */}
      {renderContent()}

      {/* Existing Description & AC content */}
      <div className="summary-tab__details">
        {task.description && (
          <div className="task-detail-panel__field">
            <div className="task-detail-panel__field-label">Description</div>
            <div className="task-detail-panel__field-value">{task.description}</div>
          </div>
        )}
        {task.acceptanceCriteria && (
          <div className="task-detail-panel__field">
            <div className="task-detail-panel__field-label">Acceptance Criteria</div>
            <div className="task-detail-panel__field-value">{task.acceptanceCriteria}</div>
          </div>
        )}
        {!task.description && !task.acceptanceCriteria && (
          <EmptyState
            variant="inline"
            icon=""
            heading="No details yet"
            description="Add a description or acceptance criteria to this task."
          />
        )}
      </div>
    </div>
  );
}

/* --- Current Status Block --- */
function CurrentStatusBlock({ task }: { task: Task }) {
  const label = summaryStatusLabel(task.status);
  if (!label) return null;

  return (
    <section className="summary-block" aria-labelledby="summary-status-heading">
      <h3 id="summary-status-heading" className="summary-block-heading">
        Current Status
      </h3>
      <p className="summary-status-label">{label}</p>
    </section>
  );
}

/* --- Last Agent Summary Block --- */
interface LastAgentSummaryBlockProps {
  runsQuery: UseQueryResult<Run[], Error>;
  onSwitchTab: SummaryTabProps["onSwitchTab"];
}

function LastAgentSummaryBlock({ runsQuery, onSwitchTab }: LastAgentSummaryBlockProps) {
  const { data: runs, isLoading, isError } = runsQuery;

  return (
    <section className="summary-block" aria-labelledby="summary-last-run-heading">
      <h3 id="summary-last-run-heading" className="summary-block-heading">
        Last Agent Summary
      </h3>
      {isLoading && <p className="summary-placeholder">Loading last run…</p>}
      {isError && <p className="summary-placeholder">Could not load last run details.</p>}
      {!isLoading && !isError && (!runs || runs.length === 0) && (
        <p className="summary-placeholder">No runs yet for this task.</p>
      )}
      {!isLoading && !isError && runs && runs.length > 0 && (
        <div className="summary-last-run-details">
          {(() => {
            const run = runs[0];
            const agentLabel =
              run.input && run.input.includes("agent:")
                ? "Codex CLI" // Or extract from input if needed, but heuristic is fine
                : "Claude CLI"; 

            // Lines truncation logic for log tail preview
            let logPreview = "";
            if (run.logTail) {
              const lines = run.logTail.split("\n");
              if (lines.length > 10) {
                logPreview = lines.slice(0, 10).join("\n") + "\n…";
              } else {
                logPreview = run.logTail;
              }
            }

            const timeString = new Date(run.endedAt ?? run.startedAt).toLocaleString();

            return (
              <>
                <div className="summary-last-run-meta">
                  <span className="summary-last-run-meta-item mono-text">Run #{run.runNumber}</span>
                  <span className="summary-last-run-meta-divider">·</span>
                  <span className="summary-last-run-meta-item">{timeString}</span>
                  <span className="summary-last-run-meta-divider">·</span>
                  <span className="summary-last-run-meta-item">agent: {agentLabel}</span>
                  {run.exitCode !== null && (
                    <>
                      <span className="summary-last-run-meta-divider">·</span>
                      <span className="summary-last-run-meta-item">exit: {run.exitCode}</span>
                    </>
                  )}
                </div>
                {logPreview && (
                  <pre className="summary-log-preview">{logPreview}</pre>
                )}
                <button
                  type="button"
                  className="summary-tab-link-btn"
                  onClick={() => onSwitchTab("logs")}
                >
                  View full log in Logs tab →
                </button>
              </>
            );
          })()}
        </div>
      )}
    </section>
  );
}

/* --- Next Suggested Action Block --- */
function NextSuggestedActionBlock({ projectId, task }: { projectId: string; task: Task }) {
  const [commentText, setCommentText] = useState("");
  const { showToast } = useToast();
  const resumeMut = useResumeSession(projectId, task.id);

  const handleResume = () => {
    const trimmed = commentText.trim();
    const commentArg = trimmed === "" ? undefined : trimmed;

    resumeMut.mutate(commentArg, {
      onSuccess: () => {
        setCommentText("");
        showToast({
          tone: "success",
          message: commentArg
            ? `Resumed ${task.id} with comment`
            : `Session resumed for ${task.id}`,
        });
      },
      onError: (err) => {
        const msg = err instanceof ApiError ? err.message : "Failed to resume session";
        const tone =
          err instanceof ApiError && err.code === "session_already_active"
            ? "warning"
            : "error";
        showToast({ tone, message: msg });
      },
    });
  };

  return (
    <section className="summary-block" aria-labelledby="summary-next-action-heading">
      <h3 id="summary-next-action-heading" className="summary-block-heading">
        Next Suggested Action
      </h3>
      <div className="summary-next-action-content">
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Add instructions for next run…"
          rows={3}
          aria-label="Comment for next run"
          disabled={resumeMut.isPending}
          className="summary-comment-textarea"
        />
        <div className="summary-next-action-actions">
          <Button
            variant="primary"
            size="md"
            onClick={handleResume}
            disabled={resumeMut.isPending}
            aria-label="Resume Session"
          >
            {resumeMut.isPending ? "Starting…" : "Resume Session"}
          </Button>
        </div>
        <p className="summary-action-hint">Click Resume to continue this session.</p>
      </div>
    </section>
  );
}

/* --- Live Status Feed Block --- */
interface LiveStatusFeedBlockProps {
  latestRun: any;
  onSwitchTab: SummaryTabProps["onSwitchTab"];
}

function LiveStatusFeedBlock({ latestRun, onSwitchTab }: LiveStatusFeedBlockProps) {
  const steps: Array<{
    label: string;
    timestamp: string;
    state: "completed" | "in-progress";
  }> = [];

  if (latestRun) {
    steps.push({
      label: "Starting session…",
      timestamp: latestRun.startedAt,
      state: "completed",
    });

    if (latestRun.input && latestRun.input !== "retry") {
      steps.push({
        label: "Sending comment to agent",
        timestamp: latestRun.startedAt,
        state: "completed",
      });
    }

    if (latestRun.endedAt === null) {
      steps.push({
        label: "Agent running…",
        timestamp: latestRun.startedAt,
        state: "in-progress",
      });
    }
  } else {
    // Race window or empty list runs initially while loading
    steps.push({
      label: "Starting session…",
      timestamp: new Date().toISOString(),
      state: "in-progress",
    });
  }

  return (
    <section className="summary-block" aria-labelledby="summary-live-feed-heading" data-testid="live-status-feed">
      <h3 id="summary-live-feed-heading" className="summary-block-heading">
        <span className="summary-status-dot summary-status-dot--running" aria-hidden="true" />
        Live Status
      </h3>
      <ol className="summary-live-feed-list" aria-live="polite" aria-atomic="false">
        {steps.map((step, idx) => (
          <li key={idx} className={`summary-live-feed-step summary-live-feed-step--${step.state}`}>
            <span className={`summary-feed-dot summary-feed-dot--${step.state}`} aria-hidden="true" />
            <span className="summary-feed-label">{step.label}</span>
            <span className="summary-feed-time">{formatRelativeTime(step.timestamp)}</span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="summary-tab-link-btn"
        onClick={() => onSwitchTab("runs")}
      >
        See full timeline in Runs tab →
      </button>
    </section>
  );
}
