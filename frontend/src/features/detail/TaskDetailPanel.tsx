import { useEffect, useRef, useState } from "react";
import "./TaskDetailPanel.css";
import StatusBadge from "../../components/StatusBadge";
import AgentAvatar from "../../components/AgentAvatar";
import Button from "../../components/Button";
import EmptyState from "../../components/EmptyState";
import { useTaskDetail } from "../../contexts/TaskDetailContext";
import { useToast } from "../../components/Toast";
import { useStartSession } from "../../hooks/useStartSession";
import { ApiError } from "../../api/client";
import type { Task, TaskStatus } from "../../types/task";

type PanelTab = "summary" | "comments" | "runs" | "logs" | "settings";

const TABS: ReadonlyArray<{ value: PanelTab; label: string }> = [
  { value: "summary", label: "Summary" },
  { value: "comments", label: "Comments" },
  { value: "runs", label: "Runs" },
  { value: "logs", label: "Logs" },
  { value: "settings", label: "Settings" },
];

// Session panel shows for tasks that have reached Running or later in the lifecycle.
const HAS_SESSION_STATUSES = new Set<TaskStatus>([
  "running",
  "paused",
  "needs-review",
  "changes-requested",
  "completed",
  "failed",
]);

interface ActionBarProps {
  projectId: string;
  task: Task;
}

function ActionBar({ projectId, task }: ActionBarProps) {
  const { showToast } = useToast();
  const startMut = useStartSession(projectId, task.id);

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

  if (task.status === "assigned") {
    return (
      <div className="task-detail-panel__action-bar">
        <Button
          variant="primary"
          size="md"
          onClick={handleStart}
          disabled={startMut.isPending}
        >
          Start Session
        </Button>
      </div>
    );
  }
  if (task.status === "paused" || task.status === "failed") {
    return (
      <div className="task-detail-panel__action-bar">
        <Button variant="primary" size="md">Resume Session</Button>
        <Button variant="secondary" size="md">Mark Done</Button>
        <Button variant="ghost" size="md">Cancel</Button>
      </div>
    );
  }
  return null;
}

interface SessionPanelProps {
  task: Task;
}

function SessionPanel({ task }: SessionPanelProps) {
  const [showId, setShowId] = useState(false);

  if (!HAS_SESSION_STATUSES.has(task.status)) return null;

  const agentLabel =
    task.agent === "claude" ? "Claude CLI" : task.agent === "codex" ? "Codex CLI" : "—";

  return (
    <div className="task-detail-panel__session" data-testid="session-panel">
      <span className="task-detail-panel__section-title">Session</span>
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

export default function TaskDetailPanel() {
  const { selectedTask, selectedProject, closeTask } = useTaskDetail();
  const [activeTab, setActiveTab] = useState<PanelTab>("summary");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isOpen = selectedTask !== null;

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
  }, [selectedTask?.id]);

  if (!isOpen || !selectedTask || !selectedProject) return null;

  const task = selectedTask;
  const project = selectedProject;
  const agentRuntime: "codex" | "claude" = task.agent ?? "codex";
  const agentName = task.role ?? task.agent ?? "unassigned";

  return (
    <>
      {/* Backdrop — click closes panel (AC-1) */}
      <div
        className="task-detail-panel__backdrop"
        aria-hidden="true"
        onClick={closeTask}
        data-testid="panel-backdrop"
      />

      {/* Slide-in panel (AC-1) */}
      <aside
        className="task-detail-panel"
        role="complementary"
        aria-label={`Task detail: ${task.title}`}
        data-testid="task-detail-panel"
      >
        {/* Close button */}
        <button
          ref={closeButtonRef}
          className="task-detail-panel__close"
          type="button"
          aria-label="Close task detail panel"
          onClick={closeTask}
        >
          ✕
        </button>

        {/* Header (AC-2) */}
        <div className="task-detail-panel__header">
          <span className="task-detail-panel__task-id">{task.id}</span>
          <h2 className="task-detail-panel__title">{task.title}</h2>
          <div className="task-detail-panel__header-meta">
            <StatusBadge status={task.status} size="lg" />
            <span className="task-detail-panel__project-info">{project.name}</span>
          </div>
          <div className="task-detail-panel__agent-info">
            <AgentAvatar name={agentName} runtime={agentRuntime} size="sm" />
            <span>{agentName}</span>
          </div>
        </div>

        {/* Action Bar (AC-3 to AC-6) */}
        <ActionBar projectId={project.id} task={task} />

        {/* Session Panel (AC-7, AC-8) */}
        <SessionPanel task={task} />

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
            <div className="task-detail-panel__summary">
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
          )}
          {activeTab === "comments" && (
            <div className="task-detail-panel__comments">
              {/* AC-10: Comments empty state */}
              <EmptyState
                variant="inline"
                icon="💬"
                heading="No comments yet"
                description="Comments and instructions sent to the agent will appear here."
              />
            </div>
          )}
          {activeTab === "runs" && (
            <EmptyState
              variant="inline"
              icon=""
              heading="No runs yet"
              description="Session runs will appear here."
            />
          )}
          {activeTab === "logs" && (
            <EmptyState
              variant="inline"
              icon=""
              heading="No logs yet"
              description="Session logs will appear here."
            />
          )}
          {activeTab === "settings" && (
            <EmptyState
              variant="inline"
              icon=""
              heading="Settings"
              description="Task settings will be available here."
            />
          )}
        </div>
      </aside>
    </>
  );
}
