import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import "./TaskDetailPage.css";
import "./TaskDetailPanel.css";
import StatusBadge from "../../components/StatusBadge";
import AgentAvatar from "../../components/AgentAvatar";
import Button from "../../components/Button";
import ConfirmationDialog from "../../components/ConfirmationDialog";
import EmptyState from "../../components/EmptyState";
import { useToast } from "../../components/Toast";
import { useDeleteTask } from "../../hooks/useTasks";
import { useRunList } from "../../hooks/useRunList";
import { useCommentList } from "../../hooks/useCommentList";
import { useResumeSession } from "../../hooks/useResumeSession";
import { ApiError } from "../../api/client";
import CommentsTabPanel from "./CommentsTabPanel";
import LogsTabPanel from "./LogsTabPanel";
import RunsTabPanel from "./RunsTabPanel";
import SummaryTab from "./SummaryTab";
import { ActionBar } from "./TaskDetailActions";
import type { Task, TaskStatus } from "../../types/task";
import type { Project } from "../../types/project";

type PageTab = "summary" | "comments" | "runs" | "logs" | "settings";

const TABS: ReadonlyArray<{ value: PageTab; label: string }> = [
  { value: "comments", label: "Chat" },
  { value: "logs", label: "Terminal" },
  { value: "summary", label: "Overview" },
  { value: "runs", label: "Activity" },
  { value: "settings", label: "Settings" },
];

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

function SettingsTab({
  projectId,
  task,
  onDeleted,
}: {
  projectId: string;
  task: Task;
  onDeleted: () => void;
}) {
  const [pendingDelete, setPendingDelete] = useState(false);
  const { showToast } = useToast();
  const deleteMut = useDeleteTask(projectId, task.id);

  if (task.status !== "draft") {
    return (
      <EmptyState
        variant="inline"
        icon=""
        heading="Settings"
        description="Task settings are only available for draft tasks."
      />
    );
  }

  const handleConfirmDelete = () => {
    deleteMut.mutate(undefined, {
      onSuccess: () => {
        setPendingDelete(false);
        showToast({ tone: "success", message: `Task ${task.id} deleted` });
        onDeleted();
      },
      onError: (error: unknown) => {
        const message = error instanceof ApiError ? error.message : "Failed to delete task";
        showToast({ tone: "error", message });
        setPendingDelete(false);
      },
    });
  };

  return (
    <div className="task-detail-panel__settings">
      <section className="task-detail-panel__settings-section">
        <h3 className="task-detail-panel__settings-heading">Danger zone</h3>
        <p className="task-detail-panel__settings-copy">
          Delete this draft task permanently.
        </p>
        <Button
          variant="destructive"
          size="md"
          onClick={() => setPendingDelete(true)}
          disabled={deleteMut.isPending}
        >
          Delete task
        </Button>
      </section>

      <ConfirmationDialog
        open={pendingDelete}
        title="Delete task"
        description={`Delete "${task.title}"? This cannot be undone.`}
        confirmLabel="Delete task"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(false)}
        confirmLoading={deleteMut.isPending}
      />
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
  const [activeTab, setActiveTab] = useState<PageTab>("comments");
  const [focusedRunId, setFocusedRunId] = useState<string | null>(null);

  const agentRuntime = task.agent === "claude" || task.agent === "codex" ? task.agent : undefined;
  const agentName = task.agent ?? task.role ?? "unassigned";
  const showFollowup = RESUMABLE_STATUSES.has(task.status);

  const runsQuery = useRunList(project.id, task.id, task.status);
  const commentsQuery = useCommentList(project.id, task.id);

  const totalRuns = runsQuery.data?.length ?? 0;
  const totalComments = commentsQuery.data?.length ?? 0;
  const evidenceLabel = useMemo(() => {
    if (runsQuery.isPending) return "—";
    if (totalRuns === 0) return "No evidence";
    return `${totalRuns} run${totalRuns === 1 ? "" : "s"}`;
  }, [runsQuery.isPending, totalRuns]);

  const handleSwitchTab = (tab: PageTab, runId?: string) => {
    setActiveTab(tab);
    if (runId !== undefined) setFocusedRunId(runId);
  };

  const handleDeleted = () => {
    void navigate("/board");
  };

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

      {/* Title row */}
      <header className="tdp__title-row">
        <h1 className="tdp__title">{task.title}</h1>
        <div className="tdp__title-meta">
          <AgentAvatar name={agentName} runtime={agentRuntime} size="sm" />
          <span className="tdp__agent-name">{agentName}</span>
          {!project.workspacePath && (
            <span className="tdp__workspace-missing">Workspace missing</span>
          )}
        </div>
      </header>

      {/* Stat card grid */}
      <section className="tdp__stat-grid" aria-label="Task summary">
        <StatCard
          label="Workflow"
          value={<StatusBadge status={task.status} size="sm" />}
        />
        <StatCard
          label="Runner"
          value={runnerLabel(task.status)}
        />
        <StatCard
          label="Evidence"
          value={evidenceLabel}
          title={totalRuns > 0 ? `${totalRuns} run${totalRuns === 1 ? "" : "s"} recorded` : undefined}
        />
        <StatCard label="Agent" value={agentDisplayLabel(task)} />
        <StatCard
          label="Task ID"
          value={<span className="tdp__stat-mono">{task.id}</span>}
          title={task.id}
        />
        <StatCard
          label="Updated"
          value={formatUpdated(task.updatedAt)}
          title={new Date(task.updatedAt).toLocaleString()}
        />
        <StatCard label="Runs" value={runsQuery.isPending ? "—" : String(totalRuns)} />
        <StatCard label="Comments" value={commentsQuery.isPending ? "—" : String(totalComments)} />
        <StatCard label="Role" value={roleDisplayLabel(task.role)} />
      </section>

      {/* NEXT ACTION row */}
      {(task.status === "assigned" || RESUMABLE_STATUSES.has(task.status)) && (
        <section className="tdp__next-action" aria-label="Next action">
          <div className="tdp__next-action-label">Next action</div>
          <div className="tdp__next-action-row">
            <ActionBar
              project={project}
              task={task}
              className="tdp__next-action-buttons"
              includeResume
            />
          </div>
        </section>
      )}

      {/* Body: tabs + content */}
      <div className="tdp__body">
        <div className="tdp__main">
          <div className="tdp__tabs" role="tablist" aria-label="Task detail tabs">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                role="tab"
                type="button"
                className={`tdp__tab${activeTab === tab.value ? " tdp__tab--active" : ""}`}
                aria-selected={activeTab === tab.value}
                aria-controls="tdp-tabcontent"
                onClick={() => setActiveTab(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            id="tdp-tabcontent"
            className="tdp__tab-content"
            role="tabpanel"
            aria-label={`${TABS.find((t) => t.value === activeTab)?.label ?? ""} tab content`}
          >
            {activeTab === "summary" && (
              <SummaryTab
                projectId={project.id}
                task={task}
                onSwitchTab={handleSwitchTab}
                hideStatusBlocks
              />
            )}
            {activeTab === "comments" && (
              <CommentsTabPanel task={task} projectId={project.id} hideComposer />
            )}
            {activeTab === "runs" && (
              <RunsTabPanel task={task} projectId={project.id} onSwitchTab={handleSwitchTab} />
            )}
            {activeTab === "logs" && (
              <LogsTabPanel
                task={task}
                projectId={project.id}
                focusedRunId={focusedRunId}
                clearFocusedRunId={() => setFocusedRunId(null)}
                onSwitchTab={handleSwitchTab}
              />
            )}
            {activeTab === "settings" && (
              <SettingsTab projectId={project.id} task={task} onDeleted={handleDeleted} />
            )}
          </div>
        </div>
      </div>

      {/* Bottom follow-up prompt (paused/failed only) */}
      {showFollowup && <FollowupPrompt projectId={project.id} task={task} />}
    </div>
  );
}
