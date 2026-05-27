import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import "./TaskDetailPanel.css";
import StatusBadge from "../../components/StatusBadge";
import AgentAvatar from "../../components/AgentAvatar";
import Button from "../../components/Button";
import ConfirmationDialog from "../../components/ConfirmationDialog";
import EmptyState from "../../components/EmptyState";
import { useTaskDetail } from "../../contexts/TaskDetailContext";
import { useToast } from "../../components/Toast";
import { useDeleteTask } from "../../hooks/useTasks";
import { ApiError } from "../../api/client";
import { useTask } from "../../hooks/useTask";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import CommentsTabPanel from "./CommentsTabPanel";
import LogsTabPanel from "./LogsTabPanel";
import RunsTabPanel from "./RunsTabPanel";
import SummaryTab from "./SummaryTab";
import { ActionBar, SessionPanel } from "./TaskDetailActions";
import type { Task } from "../../types/task";
import type { Project } from "../../types/project";

type PanelTab = "summary" | "comments" | "runs" | "logs" | "settings";

const TABS: ReadonlyArray<{ value: PanelTab; label: string }> = [
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

export default function TaskDetailPanel() {
  const { selectedTask, selectedProject, closeTask } = useTaskDetail();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<PanelTab>("summary");
  const [focusedRunId, setFocusedRunId] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const isOpen = selectedTask !== null;
  const breakpoint = useBreakpoint();
  const showBackdrop = breakpoint !== "desktop-l";

  // Trap focus when panel is open
  useFocusTrap(panelRef, isOpen);

  // AC-7: call useTask with polling when running
  const taskQuery = useTask(selectedProject?.id ?? null, selectedTask?.id ?? null);

  useEffect(() => {
    if (taskQuery.isError && selectedTask) {
      console.warn("useTask query failed, using stale snapshot", taskQuery.error);
    }
  }, [taskQuery.isError, taskQuery.error, selectedTask]);

  const task = taskQuery.data ?? selectedTask;
  const project = selectedProject;

  // Handle Escape key (AC-1)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTask();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeTask]);

  // Focus close button when panel opens
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  // Reset tab when task changes (AC-9)
  useEffect(() => {
    setActiveTab("summary");
    setFocusedRunId(null);
  }, [selectedTask?.id]);

  if (!isOpen || !task || !project) return null;

  const handleSwitchTab = (tab: PanelTab, runId?: string) => {
    setActiveTab(tab);
    if (runId !== undefined) setFocusedRunId(runId);
  };

  const handleOpenFullPage = () => {
    closeTask();
    void navigate(`/tasks/${project.id}/${task.id}`);
  };

  const agentRuntime = task.agent === "claude" || task.agent === "codex" ? task.agent : undefined;
  const agentName = task.agent ?? task.role ?? "unassigned";

  return (
    <>
      {showBackdrop && (
        <div
          className="task-detail-panel__backdrop"
          aria-hidden="true"
          onClick={closeTask}
          data-testid="panel-backdrop"
        />
      )}

      {/* Slide-in panel (AC-1) */}
      <aside
        ref={panelRef}
        className="task-detail-panel"
        role="complementary"
        aria-label={`Task detail: ${task.title}`}
        data-testid="task-detail-panel"
      >
        {/* Panel controls: open full page + close */}
        <div className="task-detail-panel__controls">
          <button
            className="task-detail-panel__open-full"
            type="button"
            aria-label="Open task detail full page"
            onClick={handleOpenFullPage}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M8 1.5H12.5M12.5 1.5V6M12.5 1.5L7 7M5.5 2.5H2.5C1.95 2.5 1.5 2.95 1.5 3.5V11.5C1.5 12.05 1.95 12.5 2.5 12.5H10.5C11.05 12.5 11.5 12.05 11.5 11.5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            ref={closeButtonRef}
            className="task-detail-panel__close"
            type="button"
            aria-label="Close task detail panel"
            onClick={closeTask}
          >
            ✕
          </button>
        </div>

        {/* Header (AC-2) */}
        <div className="task-detail-panel__header">
          <span className="task-detail-panel__task-id">{task.id}</span>
          <h2 className="task-detail-panel__title">{task.title}</h2>
          <div className="task-detail-panel__header-meta">
            <StatusBadge status={task.status} size="lg" />
            <span className="task-detail-panel__project-info">{project.name}</span>
            {!project.workspacePath && (
              <span className="task-detail-panel__workspace-missing">Workspace missing</span>
            )}
          </div>
          <div className="task-detail-panel__agent-info">
            <AgentAvatar name={agentName} runtime={agentRuntime} size="sm" />
            <span>{agentName}</span>
          </div>
        </div>

        {/* Action Bar (AC-3 to AC-6) */}
        <ActionBar project={project} task={task} className="task-detail-panel__action-bar" />

        {/* Session Panel (AC-7, AC-8) */}
        <SessionPanel task={task} className="task-detail-panel__session" />

        {/* Tab bar (AC-9) */}
        <div className="task-detail-panel__tabs" role="tablist" aria-label="Task detail tabs">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              type="button"
              className={`task-detail-panel__tab${activeTab === tab.value ? " task-detail-panel__tab--active" : ""}`}
              aria-selected={activeTab === tab.value}
              aria-controls="task-detail-panel-tabcontent"
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div
          id="task-detail-panel-tabcontent"
          className="task-detail-panel__content"
          role="tabpanel"
          aria-label={`${TABS.find((t) => t.value === activeTab)?.label ?? ""} tab content`}
        >
          {activeTab === "summary" && (
            <SummaryTab
              projectId={project.id}
              task={task}
              onSwitchTab={handleSwitchTab}
            />
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
            <SettingsTab projectId={project.id} task={task} onDeleted={closeTask} />
          )}
        </div>
      </aside>
    </>
  );
}
