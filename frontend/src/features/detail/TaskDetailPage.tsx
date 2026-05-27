import { useState } from "react";
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
import { ApiError } from "../../api/client";
import CommentsTabPanel from "./CommentsTabPanel";
import LogsTabPanel from "./LogsTabPanel";
import RunsTabPanel from "./RunsTabPanel";
import SummaryTab from "./SummaryTab";
import { ActionBar, SessionPanel, HAS_SESSION_STATUSES } from "./TaskDetailActions";
import type { Task } from "../../types/task";
import type { Project } from "../../types/project";

type PageTab = "summary" | "comments" | "runs" | "logs" | "settings";

const TABS: ReadonlyArray<{ value: PageTab; label: string }> = [
  { value: "summary", label: "Summary" },
  { value: "comments", label: "Comments" },
  { value: "runs", label: "Runs" },
  { value: "logs", label: "Logs" },
  { value: "settings", label: "Settings" },
];

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

interface TaskDetailPageProps {
  task: Task;
  project: Project;
}

export default function TaskDetailPage({ task, project }: TaskDetailPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<PageTab>("summary");
  const [focusedRunId, setFocusedRunId] = useState<string | null>(null);

  const agentRuntime = task.agent === "claude" || task.agent === "codex" ? task.agent : undefined;
  const agentName = task.agent ?? task.role ?? "unassigned";
  const hasSession = HAS_SESSION_STATUSES.has(task.status);

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

      {/* Page header */}
      <header className="tdp__header">
        <div className="tdp__header-main">
          <div className="tdp__header-meta">
            <StatusBadge status={task.status} size="lg" />
            <span className="tdp__project-label">{project.name}</span>
            {!project.workspacePath && (
              <span className="tdp__workspace-missing">Workspace missing</span>
            )}
          </div>
          <h1 className="tdp__title">{task.title}</h1>
          <div className="tdp__agent-row">
            <AgentAvatar name={agentName} runtime={agentRuntime} size="sm" />
            <span className="tdp__agent-name">{agentName}</span>
            <span className="tdp__task-id-label">{task.id}</span>
          </div>
        </div>

        {/* Inline action bar for assigned/paused/failed */}
        <ActionBar project={project} task={task} className="tdp__header-actions" />
      </header>

      {/* Body: tabs + sidebar */}
      <div className="tdp__body">
        {/* Main content */}
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
              <SummaryTab projectId={project.id} task={task} onSwitchTab={handleSwitchTab} />
            )}
            {activeTab === "comments" && (
              <CommentsTabPanel task={task} projectId={project.id} />
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

        {/* Right sidebar: session info */}
        {hasSession && (
          <aside className="tdp__sidebar" aria-label="Session information">
            <SessionPanel
              task={task}
              className="tdp__session"
              titleClassName="tdp__section-title"
            />
          </aside>
        )}
      </div>
    </div>
  );
}
