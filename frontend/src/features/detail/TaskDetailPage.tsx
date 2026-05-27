import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import "./TaskDetailPage.css";
import "./TaskDetailPanel.css";
import StatusBadge from "../../components/StatusBadge";
import AgentAvatar from "../../components/AgentAvatar";
import Button from "../../components/Button";
import { useToast } from "../../components/Toast";
import { useRunList } from "../../hooks/useRunList";
import { useCommentList } from "../../hooks/useCommentList";
import { useResumeSession } from "../../hooks/useResumeSession";
import { ApiError } from "../../api/client";
import { ActionBar } from "./TaskDetailActions";
import { buildChatTimeline, type ChatEvent } from "./chatTimeline";
import type { Task, TaskStatus } from "../../types/task";
import type { Project } from "../../types/project";
import type { Run } from "../../types/run";

const RESUMABLE_STATUSES = new Set<TaskStatus>(["paused", "failed"]);

function runnerLabel(status: TaskStatus): string {
  switch (status) {
    case "running":
      return "Running";
    case "paused":
      return "Paused";
    case "failed":
      return "Exited";
    case "completed":
    case "cancelled":
      return "Exited";
    case "assigned":
      return "Idle";
    default:
      return "—";
  }
}

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return date.toLocaleDateString();
}

function agentDisplayLabel(task: Task): string {
  if (task.agent === "claude") return "Claude CLI";
  if (task.agent === "codex") return "Codex CLI";
  if (task.agent) return task.agent;
  return "—";
}

function roleDisplayLabel(role: string | null): string {
  if (!role) return "—";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatTerminalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function runStatus(run: Run): "running" | "completed" | "failed" {
  if (run.exitCode === null && run.endedAt === null) return "running";
  return run.exitCode === 0 ? "completed" : "failed";
}

function commandForRun(task: Task, run: Run): string {
  const agent = task.agent === "claude" || task.agent === "codex" ? task.agent : "agent";
  const role = task.role ? ` --role ${task.role}` : "";
  return `${agent} run ${task.id}${role}${run.input ? ` --prompt "${run.input}"` : ""}`;
}

function previewLog(logTail: string | null): string {
  if (!logTail) return "(no output captured yet)";
  const lines = logTail.trim().split("\n").map(formatTranscriptLine);
  const visible = lines.slice(-80);
  return visible.join("\n");
}

function formatTranscriptLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return line;

  try {
    const root = JSON.parse(trimmed) as Record<string, unknown>;
    const payload = root.payload;
    if (root.type !== "event_msg" || payload === null || typeof payload !== "object") {
      return line;
    }

    const event = payload as Record<string, unknown>;
    if (event.type === "agent_message" && typeof event.message === "string") {
      const phase = typeof event.phase === "string" ? `:${event.phase}` : "";
      return `agent${phase}> ${event.message}`;
    }

    if (event.type === "token_count" && event.info && typeof event.info === "object") {
      const info = event.info as Record<string, unknown>;
      const usage = info.total_token_usage;
      if (usage && typeof usage === "object") {
        const tokenUsage = usage as Record<string, unknown>;
        return `usage> input=${tokenUsage.input_tokens ?? 0} output=${tokenUsage.output_tokens ?? 0} total=${tokenUsage.total_tokens ?? 0}`;
      }
    }
  } catch {
    return line;
  }

  return line;
}

function finalOutputFrom(task: Task, runs: Run[], events: ChatEvent[]): string {
  const latestAgentEvent = [...events].reverse().find((event) => event.kind === "agent");
  if (latestAgentEvent) return latestAgentEvent.content;

  const latestRunWithOutput = [...runs]
    .sort((a, b) => b.runNumber - a.runNumber)
    .find((run) => run.logTail?.trim());
  if (latestRunWithOutput?.logTail) return previewLog(latestRunWithOutput.logTail);

  if (task.status === "running") return "Agent is still running. Final output is not available yet.";
  return "No final agent output captured yet.";
}

function ConversationSnapshot({
  task,
  finalOutput,
}: {
  task: Task;
  finalOutput: string;
}) {
  return (
    <section className="tdp__chat-snapshot" aria-label="Input and final output">
      <div className="tdp__chat-stream">
        <article className="tdp__chat-message tdp__chat-message--user">
          <div className="tdp__chat-message-meta">You</div>
          <div className="tdp__chat-message-body">
            <h2>{task.title}</h2>
            <p>{task.description}</p>
            {task.acceptanceCriteria && (
              <div className="tdp__acceptance">
                <span>Acceptance criteria</span>
                <p>{task.acceptanceCriteria}</p>
              </div>
            )}
          </div>
        </article>

        <article className="tdp__chat-message tdp__chat-message--agent">
          <div className="tdp__chat-message-meta">{agentDisplayLabel(task)}</div>
          <div className="tdp__chat-message-body">
            <p>{finalOutput}</p>
          </div>
        </article>
      </div>
    </section>
  );
}

function TerminalTranscript({
  task,
  runs,
  isLoading,
  isError,
  onRetry,
}: {
  task: Task;
  runs: Run[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  return (
    <section className="tdp__terminal" aria-label="Agent terminal transcript">
      <div className="tdp__terminal-bar">
        <span className="tdp__terminal-dot tdp__terminal-dot--red" aria-hidden="true" />
        <span className="tdp__terminal-dot tdp__terminal-dot--yellow" aria-hidden="true" />
        <span className="tdp__terminal-dot tdp__terminal-dot--green" aria-hidden="true" />
        <span className="tdp__terminal-title">agent-run:{task.id}</span>
      </div>

      <div className="tdp__terminal-scroll">
        {isLoading && <p className="tdp__terminal-muted">loading runs...</p>}
        {isError && (
          <div className="tdp__terminal-error">
            <p>could not load run transcript.</p>
            <Button variant="ghost" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </div>
        )}
        {!isLoading && !isError && runs.length === 0 && (
          <div className="tdp__terminal-block">
            <div className="tdp__terminal-line">
              <span className="tdp__terminal-prompt">$</span>
              <span>waiting for agent run...</span>
            </div>
            <p className="tdp__terminal-muted">No execution transcript has been recorded yet.</p>
          </div>
        )}
        {!isLoading &&
          !isError &&
          runs.map((run) => {
            const status = runStatus(run);
            return (
              <article key={run.id} className="tdp__terminal-block">
                <div className="tdp__terminal-line">
                  <span className="tdp__terminal-prompt">$</span>
                  <span>{commandForRun(task, run)}</span>
                </div>
                <div className={`tdp__terminal-status tdp__terminal-status--${status}`}>
                  <span>{formatTerminalTime(run.startedAt)}</span>
                  <span>run #{run.runNumber}</span>
                  <span>{status}</span>
                  {run.exitCode !== null && <span>exit {run.exitCode}</span>}
                </div>
                <pre className="tdp__terminal-output">{previewLog(run.logTail)}</pre>
              </article>
            );
          })}
      </div>
    </section>
  );
}

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  title?: string;
}

function StatCard({ label, value, title }: StatCardProps) {
  return (
    <div className="tdp__stat-card" title={title}>
      <div className="tdp__stat-label">{label}</div>
      <div className="tdp__stat-value">{value}</div>
    </div>
  );
}

interface FollowupPromptProps {
  projectId: string;
  task: Task;
}

function FollowupPrompt({ projectId, task }: FollowupPromptProps) {
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
    <div className="tdp__followup" data-testid="task-detail-followup">
      <textarea
        value={commentText}
        onChange={(e) => setCommentText(e.target.value)}
        placeholder="Type a follow-up prompt."
        rows={2}
        aria-label="Follow-up prompt"
        disabled={resumeMut.isPending}
        className="tdp__followup-textarea summary-comment-textarea"
      />
      <div className="tdp__followup-actions">
        <Button
          variant="primary"
          size="md"
          onClick={handleResume}
          disabled={resumeMut.isPending}
          aria-label="Resume Session"
          data-action="resume-session"
        >
          {resumeMut.isPending ? "Resuming…" : "Resume"}
        </Button>
      </div>
    </div>
  );
}

interface TaskDetailPageProps {
  task: Task;
  project: Project;
}

export default function TaskDetailPage({ task, project }: TaskDetailPageProps) {
  const navigate = useNavigate();

  const agentRuntime = task.agent === "claude" || task.agent === "codex" ? task.agent : undefined;
  const agentName = task.agent ?? task.role ?? "unassigned";
  const showFollowup = RESUMABLE_STATUSES.has(task.status);

  const runsQuery = useRunList(project.id, task.id, task.status);
  const commentsQuery = useCommentList(project.id, task.id);
  const timeline = useMemo(
    () => buildChatTimeline(commentsQuery.data ?? [], runsQuery.data ?? []),
    [commentsQuery.data, runsQuery.data],
  );

  const totalRuns = runsQuery.data?.length ?? 0;
  const totalComments = commentsQuery.data?.length ?? 0;
  const finalOutput = useMemo(
    () => finalOutputFrom(task, runsQuery.data ?? [], timeline.events),
    [task, runsQuery.data, timeline.events],
  );
  const evidenceLabel = useMemo(() => {
    if (runsQuery.isPending) return "—";
    if (totalRuns === 0) return "No evidence";
    return `${totalRuns} run${totalRuns === 1 ? "" : "s"}`;
  }, [runsQuery.isPending, totalRuns]);

  return (
    <div className="tdp" data-testid="task-detail-page">
      {/* Nav row */}
      <nav className="tdp__nav" aria-label="Task breadcrumb">
        <button
          type="button"
          className="tdp__back-btn"
          onClick={() => void navigate(-1)}
          aria-label="Go back"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        <span className="tdp__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="tdp__breadcrumb-project">{project.name}</span>
        <span className="tdp__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="tdp__breadcrumb-task-id">{task.id}</span>
      </nav>

      {/* Title row with inline next-action buttons */}
      <header className="tdp__title-row">
        <div className="tdp__title-block">
          <h1 className="tdp__title">{task.title}</h1>
          <div className="tdp__title-meta">
            <AgentAvatar name={agentName} runtime={agentRuntime} size="sm" />
            <span className="tdp__agent-name">{agentName}</span>
            {!project.workspacePath && (
              <span className="tdp__workspace-missing">Workspace missing</span>
            )}
          </div>
        </div>
        {(task.status === "assigned" || RESUMABLE_STATUSES.has(task.status)) && (
          <div className="tdp__title-actions" aria-label="Next action">
            <ActionBar
              project={project}
              task={task}
              className="tdp__next-action-buttons"
              includeResume
            />
          </div>
        )}
      </header>

      <div className="tdp__workspace">
        <ConversationSnapshot task={task} finalOutput={finalOutput} />
        <TerminalTranscript
          task={task}
          runs={runsQuery.data ?? []}
          isLoading={runsQuery.isLoading}
          isError={runsQuery.isError}
          onRetry={() => void runsQuery.refetch()}
        />
      </div>

      {/* Bottom follow-up prompt (paused/failed only) */}
      {showFollowup && <FollowupPrompt projectId={project.id} task={task} />}
    </div>
  );
}
