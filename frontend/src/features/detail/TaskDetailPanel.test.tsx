import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TaskDetailPanel from "./TaskDetailPanel";
import { TaskDetailProvider, useTaskDetail } from "../../contexts/TaskDetailContext";
import { ToastProvider } from "../../components/Toast";
import { ApiError } from "../../api/client";
import type { Task } from "../../types/task";
import type { Project } from "../../types/project";
import { mockViewport } from "../../test-utils/matchMedia";

// Mock sessions API so mutation doesn't make real network calls
vi.mock("../../api/sessions", () => ({
  startSession: vi.fn(),
  resumeSession: vi.fn(),
  completeSession: vi.fn(),
  cancelSession: vi.fn(),
}));

vi.mock("../../api/tasks", () => ({
  getTask: vi.fn(),
  listTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  assignAgent: vi.fn(),
  deleteTask: vi.fn(),
}));

vi.mock("../../api/runs", () => ({
  listRuns: vi.fn(),
  getRun: vi.fn(),
}));

vi.mock("../../api/comments", () => ({
  listComments: vi.fn(),
  addComment: vi.fn(),
}));

import { startSession, resumeSession, completeSession, cancelSession } from "../../api/sessions";
import { deleteTask, getTask } from "../../api/tasks";
import { listRuns } from "../../api/runs";
import { addComment, listComments } from "../../api/comments";
import type { Comment } from "../../types/comment";
import type { Run } from "../../types/run";

const MOCK_PROJECT: Project = {
  id: "proj-1",
  name: "OmniAgent",
  key: "OMNI",
  workspacePath: "/tmp",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "OMNI-001",
    projectId: "proj-1",
    seq: 1,
    title: "Fix login redirect",
    description: "The login redirect is broken.",
    acceptanceCriteria: "User is redirected after login.",
    agent: "claude",
    role: "coder",
    status: "draft",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "comment-1",
    taskId: "OMNI-001",
    content: "Check edge case",
    sent: true,
    createdAt: "2026-05-25T10:00:00+00:00",
    ...overrides,
  };
}

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: "run-1",
    runNumber: 1,
    input: "retry",
    exitCode: 0,
    logPath: "/tmp/run.log",
    logTail: "Line 1\nLine 2",
    startedAt: "2026-05-25T10:00:00+00:00",
    endedAt: "2026-05-25T10:05:00+00:00",
    ...overrides,
  };
}

// Helper: renders TaskDetailPanel inside required providers and optionally opens a task via a trigger.
function renderWithTask(task?: Task, project: Project = MOCK_PROJECT) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const mockGetTask = vi.mocked(getTask);

  if (task) {
    mockGetTask.mockResolvedValue(task);
  } else {
    mockGetTask.mockRejectedValue(new Error("No task"));
  }

  function Opener() {
    const { openTask } = useTaskDetail();
    return task ? (
      <button
        type="button"
        data-testid="open-trigger"
        onClick={() => openTask(task, project)}
      >
        Open
      </button>
    ) : null;
  }
  render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <TaskDetailProvider>
          <Opener />
          <TaskDetailPanel />
        </TaskDetailProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("TaskDetailPanel", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockViewport(1280);
    vi.mocked(listRuns).mockResolvedValue([]);
    vi.mocked(listComments).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // D.1.1 — panel không render khi không có selectedTask
  it("does not render panel when no task is selected", () => {
    renderWithTask();
    expect(screen.queryByTestId("task-detail-panel")).not.toBeInTheDocument();
  });

  // D.1.2 — panel render với Task ID, Title, StatusBadge khi có selectedTask
  it("renders panel with Task ID, Title, and StatusBadge when task is open", () => {
    renderWithTask(makeTask({ id: "OMNI-042", title: "Fix login redirect", status: "draft" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    expect(screen.getByTestId("task-detail-panel")).toBeInTheDocument();
    expect(screen.getByText("OMNI-042")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Fix login redirect" })).toBeInTheDocument();
    // StatusBadge renders with aria-label
    expect(screen.getByLabelText("Status: Draft")).toBeInTheDocument();
  });

  // D.1.3 — Action Bar: "Start Session" when status=assigned
  it("renders 'Start Session' button when status is assigned", () => {
    renderWithTask(makeTask({ status: "assigned" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    expect(screen.getByRole("button", { name: "Start Session" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume Session" })).not.toBeInTheDocument();
  });

  it("disables Start Session and shows Workspace missing when project workspace is missing", () => {
    renderWithTask(makeTask({ status: "assigned" }), {
      ...MOCK_PROJECT,
      workspacePath: null,
    });
    fireEvent.click(screen.getByTestId("open-trigger"));
    expect(screen.getAllByText("Workspace missing").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Start Session" })).toBeDisabled();
  });

  // D.1.4 — Action Bar: no buttons when status=running
  it("renders no action buttons when status is running", () => {
    renderWithTask(makeTask({ status: "running" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    expect(screen.queryByRole("button", { name: "Start Session" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume Session" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark Done" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  // D.1.5 — Action Bar: 3 buttons when status=paused
  it("renders Resume Session, Mark Done, and Cancel when status is paused", () => {
    renderWithTask(makeTask({ status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    expect(screen.getByRole("button", { name: "Resume Session" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Done" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  // D.1.5 (variant) — 3 buttons when status=failed
  it("renders Resume Session, Mark Done, and Cancel when status is failed", () => {
    renderWithTask(makeTask({ status: "failed" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    expect(screen.getByRole("button", { name: "Resume Session" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Done" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  // D.1.6 — Action Bar: no buttons when status=completed
  it("renders no action buttons when status is completed", () => {
    renderWithTask(makeTask({ status: "completed" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    expect(screen.queryByRole("button", { name: "Start Session" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume Session" })).not.toBeInTheDocument();
  });

  // D.1.6 (variant) — no buttons when status=cancelled
  it("renders no action buttons when status is cancelled", () => {
    renderWithTask(makeTask({ status: "cancelled" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    expect(screen.queryByRole("button", { name: "Start Session" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume Session" })).not.toBeInTheDocument();
  });

  // D.1.7 — Session Panel visible when status=running, hidden when status=draft
  it("shows Session Panel when status is running", () => {
    renderWithTask(makeTask({ status: "running" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    expect(screen.getByTestId("session-panel")).toBeInTheDocument();
  });

  it("hides Session Panel when status is draft", () => {
    renderWithTask(makeTask({ status: "draft" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    expect(screen.queryByTestId("session-panel")).not.toBeInTheDocument();
  });

  it("hides Session Panel when status is assigned", () => {
    renderWithTask(makeTask({ status: "assigned" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    expect(screen.queryByTestId("session-panel")).not.toBeInTheDocument();
  });

  // D.1.8 — Show ID toggle
  it("'Show ID' toggle reveals and hides session ID", () => {
    renderWithTask(makeTask({ status: "running" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    const showBtn = screen.getByRole("button", { name: /show id/i });
    expect(showBtn).toBeInTheDocument();
    expect(screen.getByText("••••••••••••")).toBeInTheDocument();

    fireEvent.click(showBtn);
    expect(screen.getByRole("button", { name: /hide id/i })).toBeInTheDocument();
    expect(screen.queryByText("••••••••••••")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /hide id/i }));
    expect(screen.getByRole("button", { name: /show id/i })).toBeInTheDocument();
    expect(screen.getByText("••••••••••••")).toBeInTheDocument();
  });

  // D.1.9 — 5 tabs render, Summary active by default
  it("renders 5 tabs with Summary active by default", () => {
    renderWithTask(makeTask());
    fireEvent.click(screen.getByTestId("open-trigger"));
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(5);
    const labels = tabs.map((t) => t.textContent);
    expect(labels).toEqual(["Summary", "Comments", "Runs", "Logs", "Settings"]);
    const summaryTab = screen.getByRole("tab", { name: "Summary" });
    expect(summaryTab).toHaveAttribute("aria-selected", "true");
    expect(summaryTab.className).toContain("task-detail-panel__tab--active");
  });

  // D.1.10 — click Comments tab → "No comments yet" empty state
  it("clicking Comments tab shows No comments yet empty state", async () => {
    renderWithTask(makeTask());
    fireEvent.click(screen.getByTestId("open-trigger"));
    fireEvent.click(screen.getByRole("tab", { name: "Comments" }));
    expect(await screen.findByText("No comments yet")).toBeInTheDocument();
  });

  // D.1.11 — Esc key closes panel
  it("Esc key closes the panel", () => {
    renderWithTask(makeTask());
    fireEvent.click(screen.getByTestId("open-trigger"));
    expect(screen.getByTestId("task-detail-panel")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("task-detail-panel")).not.toBeInTheDocument();
  });

  // D.1.12 — click backdrop closes panel
  it("clicking backdrop closes the panel", () => {
    renderWithTask(makeTask());
    fireEvent.click(screen.getByTestId("open-trigger"));
    expect(screen.getByTestId("task-detail-panel")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("panel-backdrop"));
    expect(screen.queryByTestId("task-detail-panel")).not.toBeInTheDocument();
  });

  it("does not render backdrop at Desktop L", () => {
    mockViewport(1440);
    renderWithTask(makeTask());
    fireEvent.click(screen.getByTestId("open-trigger"));

    expect(screen.getByTestId("task-detail-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("panel-backdrop")).not.toBeInTheDocument();
  });

  it("renders backdrop below Desktop L", () => {
    mockViewport(1439);
    renderWithTask(makeTask());
    fireEvent.click(screen.getByTestId("open-trigger"));

    expect(screen.getByTestId("panel-backdrop")).toBeInTheDocument();
  });

  // Close button closes panel
  it("close button (✕) closes the panel", () => {
    renderWithTask(makeTask());
    fireEvent.click(screen.getByTestId("open-trigger"));
    fireEvent.click(screen.getByRole("button", { name: "Close task detail panel" }));
    expect(screen.queryByTestId("task-detail-panel")).not.toBeInTheDocument();
  });

  // Project name shown in header
  it("shows project name in header", () => {
    renderWithTask(makeTask(), { ...MOCK_PROJECT, name: "MyProject" });
    fireEvent.click(screen.getByTestId("open-trigger"));
    expect(screen.getByText("MyProject")).toBeInTheDocument();
  });

  // Summary tab content: description and AC
  it("shows description and AC in Summary tab", () => {
    renderWithTask(
      makeTask({
        description: "This is the task description.",
        acceptanceCriteria: "All tests pass.",
      }),
    );
    fireEvent.click(screen.getByTestId("open-trigger"));
    expect(screen.getByText("This is the task description.")).toBeInTheDocument();
    expect(screen.getByText("All tests pass.")).toBeInTheDocument();
  });

  // Session panel shows all four fields for paused task
  it("session panel shows Agent, Status, Created, Last active for paused task", () => {
    renderWithTask(makeTask({ status: "paused", agent: "claude" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    const panel = screen.getByTestId("session-panel");
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveTextContent("Claude CLI");
    expect(panel).toHaveTextContent("Created");
    expect(panel).toHaveTextContent("Last active");
  });

  // Mock console.warn to suppress EmptyState dev warning
  it("no action buttons for draft status", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderWithTask(makeTask({ status: "draft" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    expect(screen.queryByRole("button", { name: "Start Session" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume Session" })).not.toBeInTheDocument();
    warnSpy.mockRestore();
  });

  it("deletes a draft task from Settings tab after confirmation", async () => {
    vi.mocked(deleteTask).mockResolvedValue(undefined);
    renderWithTask(makeTask({ status: "draft" }));
    fireEvent.click(screen.getByTestId("open-trigger"));

    fireEvent.click(screen.getByRole("tab", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete task" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Delete task" }).at(-1)!);

    await waitFor(() => {
      expect(deleteTask).toHaveBeenCalledWith("proj-1", "OMNI-001");
    });
    await waitFor(() => {
      expect(screen.queryByTestId("task-detail-panel")).not.toBeInTheDocument();
    });
  });

  it("does not show delete task action for non-draft tasks", () => {
    renderWithTask(makeTask({ status: "assigned" }));
    fireEvent.click(screen.getByTestId("open-trigger"));

    fireEvent.click(screen.getByRole("tab", { name: "Settings" }));
    expect(screen.queryByRole("button", { name: "Delete task" })).not.toBeInTheDocument();
    expect(screen.getByText("Task settings are only available for draft tasks.")).toBeInTheDocument();
  });

  // ─── Story 3.1: Start Session wiring tests ───────────────────────────────

  it("clicking Start Session calls startSession with correct args", async () => {
    const mockStartSession = vi.mocked(startSession);
    // Resolve after a tick so mutation completes
    mockStartSession.mockResolvedValue({
      sessionPk: "pk-123",
      taskId: "OMNI-001",
      sessionId: null,
      sessionIdMissing: false,
      status: "running" as const,
      createdAt: "2026-01-01T00:00:00Z",
    });

    renderWithTask(makeTask({ id: "OMNI-001", projectId: "proj-1", status: "assigned" }));
    fireEvent.click(screen.getByTestId("open-trigger"));

    const btn = screen.getByRole("button", { name: "Start Session" });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockStartSession).toHaveBeenCalledWith("proj-1", "OMNI-001");
    });
  });

  it("shows success toast after Start Session succeeds", async () => {
    const mockStartSession = vi.mocked(startSession);
    mockStartSession.mockResolvedValue({
      sessionPk: "pk-456",
      taskId: "OMNI-001",
      sessionId: null,
      sessionIdMissing: false,
      status: "running" as const,
      createdAt: "2026-01-01T00:00:00Z",
    });

    renderWithTask(makeTask({ id: "OMNI-001", status: "assigned" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    fireEvent.click(screen.getByRole("button", { name: "Start Session" }));

    await waitFor(() => {
      expect(screen.getByText(/Session started for OMNI-001/i)).toBeInTheDocument();
    });
  });

  it("shows error toast with API message on agent_not_found error", async () => {
    const mockStartSession = vi.mocked(startSession);
    mockStartSession.mockRejectedValue(
      new ApiError(400, "agent_not_found", "Agent binary not found on PATH"),
    );

    renderWithTask(makeTask({ status: "assigned" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    fireEvent.click(screen.getByRole("button", { name: "Start Session" }));

    await waitFor(() => {
      expect(
        screen.getByText("Agent binary not found on PATH"),
      ).toBeInTheDocument();
    });
  });

  it("shows fallback error toast on non-ApiError", async () => {
    const mockStartSession = vi.mocked(startSession);
    mockStartSession.mockRejectedValue(new Error("Network failure"));

    renderWithTask(makeTask({ status: "assigned" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    fireEvent.click(screen.getByRole("button", { name: "Start Session" }));

    await waitFor(() => {
      expect(screen.getByText("Failed to start session")).toBeInTheDocument();
    });
  });

  it("button is disabled while mutation is pending", async () => {
    const mockStartSession = vi.mocked(startSession);
    // Never resolves during test
    mockStartSession.mockImplementation(() => new Promise(() => {}));

    renderWithTask(makeTask({ status: "assigned" }));
    fireEvent.click(screen.getByTestId("open-trigger"));

    const btn = screen.getByRole("button", { name: "Start Session" });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Start Session" })).toBeDisabled();
    });
  });

  it("clicking Mark Done calls completeSession and shows success toast", async () => {
    const mockCompleteSession = vi.mocked(completeSession);
    mockCompleteSession.mockResolvedValue({
      taskId: "OMNI-001",
      status: "completed",
      message: "Session completed successfully",
    });

    renderWithTask(makeTask({ id: "OMNI-001", projectId: "proj-1", status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));

    const btn = screen.getByRole("button", { name: "Mark Done" });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockCompleteSession).toHaveBeenCalledWith("proj-1", "OMNI-001");
      expect(screen.getByText(/Task OMNI-001 marked as completed/i)).toBeInTheDocument();
    });
  });

  it("clicking Cancel calls cancelSession and shows success toast", async () => {
    const mockCancelSession = vi.mocked(cancelSession);
    mockCancelSession.mockResolvedValue({
      taskId: "OMNI-001",
      status: "cancelled",
      message: "Session cancelled",
    });

    renderWithTask(makeTask({ id: "OMNI-001", projectId: "proj-1", status: "failed" }));
    fireEvent.click(screen.getByTestId("open-trigger"));

    const btn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockCancelSession).toHaveBeenCalledWith("proj-1", "OMNI-001");
      expect(screen.getByText(/Task OMNI-001 cancelled/i)).toBeInTheDocument();
    });
  });

  // ─── Story 3.5a: Session Summary Tab & Polling / Optimistic Resume Tests ─────────────────────────────

  // T1: Task paused → Summary tab render Current Status + Last Agent Summary + comment textarea + Resume button
  it("T1: renders Current Status, Last Agent Summary, comment textarea, and Resume button when status is paused", async () => {
    const mockListRuns = vi.mocked(listRuns);
    mockListRuns.mockResolvedValue([
      {
        id: "run-1",
        runNumber: 1,
        input: "Run instructions",
        exitCode: 0,
        logPath: "/path/to/log",
        logTail: "Line 1\nLine 2\nLine 3",
        startedAt: "2026-01-01T00:00:00Z",
        endedAt: "2026-01-01T00:05:00Z",
      },
    ]);

    renderWithTask(makeTask({ status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));

    // Check Current Status
    expect(screen.getByText("Current Status")).toBeInTheDocument();
    expect(screen.getByText("Paused — last run ended cleanly. Ready to resume.")).toBeInTheDocument();

    // Check Last Agent Summary (wait for listRuns query to load)
    await waitFor(() => {
      expect(screen.getByText("Last Agent Summary")).toBeInTheDocument();
      expect(screen.getByText(/Run #1/i)).toBeInTheDocument();
      expect(screen.getByText(/Line 1/i)).toBeInTheDocument();
    });

    // Check Next Suggested Action & comment textarea
    expect(screen.getByText("Next Suggested Action")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Add instructions for next run…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume Session" })).toBeInTheDocument();
  });

  // T2: Task failed → tương tự T1 nhưng status label khác
  it("T2: renders failed status label and exit code when status is failed", async () => {
    const mockListRuns = vi.mocked(listRuns);
    mockListRuns.mockResolvedValue([
      {
        id: "run-2",
        runNumber: 2,
        input: "retry",
        exitCode: 1,
        logPath: "/path/to/log2",
        logTail: "Error happened",
        startedAt: "2026-01-01T00:00:00Z",
        endedAt: "2026-01-01T00:05:00Z",
      },
    ]);

    renderWithTask(makeTask({ status: "failed" }));
    fireEvent.click(screen.getByTestId("open-trigger"));

    expect(screen.getByText("Failed — last run exited with a non-zero code. Review and resume.")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Run #2/i)).toBeInTheDocument();
      expect(screen.getByText(/exit: 1/i)).toBeInTheDocument();
      expect(screen.getByText("Error happened")).toBeInTheDocument();
    });
  });

  // T3: Task running → Summary tab render Live Status Feed (NO textarea/Resume button)
  it("T3: renders Live Status feed instead of comment inputs when status is running", async () => {
    const mockListRuns = vi.mocked(listRuns);
    mockListRuns.mockResolvedValue([
      {
        id: "run-3",
        runNumber: 3,
        input: "retry",
        exitCode: null,
        logPath: "/path/to/log3",
        logTail: "Running...",
        startedAt: "2026-01-01T00:00:00Z",
        endedAt: null,
      },
    ]);

    renderWithTask(makeTask({ status: "running" }));
    fireEvent.click(screen.getByTestId("open-trigger"));

    // Live status block should be rendered
    await waitFor(() => {
      expect(screen.getByTestId("live-status-feed")).toBeInTheDocument();
      expect(screen.getByText("Live Status")).toBeInTheDocument();
      expect(screen.getByText("Starting session…")).toBeInTheDocument();
      expect(screen.getByText("Agent running…")).toBeInTheDocument();
    });

    // Inputs should not be visible
    expect(screen.queryByPlaceholderText("Add instructions for next run…")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume Session" })).not.toBeInTheDocument();
  });

  // T4: Click Resume với textarea empty → mutation called with undefined comment
  it("T4: calls resumeSession with undefined comment when textarea is empty", async () => {
    const mockResumeSession = vi.mocked(resumeSession);
    mockResumeSession.mockResolvedValue({
      sessionPk: "pk-123",
      taskId: "OMNI-001",
      sessionId: "cli-sess-aaa",
      status: "running" as const,
      runId: "run-456",
      runNumber: 2,
      runInput: "retry",
      commentId: null,
      commentSent: null,
      startedAt: "2026-01-01T00:00:00Z",
    });

    renderWithTask(makeTask({ id: "OMNI-001", projectId: "proj-1", status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));

    const btn = screen.getByRole("button", { name: "Resume Session" });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockResumeSession).toHaveBeenCalledWith("proj-1", "OMNI-001", undefined);
      expect(screen.getByText(/Session resumed for OMNI-001/i)).toBeInTheDocument();
    });
  });

  // T5: Click Resume với textarea "  hello  " → mutation called with "hello" (trimmed)
  it("T5: calls resumeSession with trimmed comment when textarea has whitespace-wrapped text", async () => {
    const mockResumeSession = vi.mocked(resumeSession);
    mockResumeSession.mockResolvedValue({
      sessionPk: "pk-123",
      taskId: "OMNI-001",
      sessionId: "cli-sess-aaa",
      status: "running" as const,
      runId: "run-456",
      runNumber: 2,
      runInput: "hello",
      commentId: "comment-1",
      commentSent: true,
      startedAt: "2026-01-01T00:00:00Z",
    });

    renderWithTask(makeTask({ id: "OMNI-001", projectId: "proj-1", status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));

    const textarea = screen.getByPlaceholderText("Add instructions for next run…");
    fireEvent.change(textarea, { target: { value: "  hello  " } });

    const btn = screen.getByRole("button", { name: "Resume Session" });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockResumeSession).toHaveBeenCalledWith("proj-1", "OMNI-001", "hello");
      expect(textarea).toHaveValue("");
      expect(screen.getByText(/Resumed OMNI-001 with comment/i)).toBeInTheDocument();
    });
  });

  // T6: Optimistic update on click Resume → status badge immediately shows "Running"
  it("T6: immediately performs optimistic update to running status on resume click", async () => {
    const mockResumeSession = vi.mocked(resumeSession);
    mockResumeSession.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 150)));

    renderWithTask(makeTask({ id: "OMNI-001", projectId: "proj-1", status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));

    const btn = await screen.findByRole("button", { name: "Resume Session" });
    fireEvent.click(btn);

    // Wait for optimistic update to apply (runs in microtask because of await cancelQueries)
    await waitFor(() => {
      expect(screen.getAllByText("Running").length).toBeGreaterThan(0);
    });
  });

  // T7: Resume error rollback → status badge revert to paused + error toast shown
  it("T7: rolls back status badge to paused and displays error toast on resume failure", async () => {
    const mockResumeSession = vi.mocked(resumeSession);
    mockResumeSession.mockRejectedValue(new ApiError(500, "internal_error", "boom"));

    renderWithTask(makeTask({ id: "OMNI-001", projectId: "proj-1", status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));

    const btn = await screen.findByRole("button", { name: "Resume Session" });
    fireEvent.click(btn);

    await waitFor(() => {
      // Reverts to paused status badges
      expect(screen.queryByText("Running")).not.toBeInTheDocument();
      expect(screen.getAllByText("Paused").length).toBeGreaterThan(0);
      // Displays toast
      expect(screen.getByText("boom")).toBeInTheDocument();
    });
  });

  // T8: Resume 409 conflict → warning toast (not error)
  it("T8: shows warning toast on 409 session_already_active error", async () => {
    const mockResumeSession = vi.mocked(resumeSession);
    mockResumeSession.mockRejectedValue(
      new ApiError(409, "session_already_active", "Session already running"),
    );

    renderWithTask(makeTask({ id: "OMNI-001", projectId: "proj-1", status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));

    const btn = await screen.findByRole("button", { name: "Resume Session" });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText("Session already running")).toBeInTheDocument();
    });
  });

  // T9: Polling: task running → getTask called twice within 6 seconds
  it("T9: polls getTask API every 5 seconds when status is running", async () => {
    vi.useFakeTimers();
    const mockGetTask = vi.mocked(getTask);
    mockGetTask.mockResolvedValue(makeTask({ id: "OMNI-001", status: "running" }));

    renderWithTask(makeTask({ id: "OMNI-001", status: "running" }));
    fireEvent.click(screen.getByTestId("open-trigger"));

    // Wait for initial render / queries to fire
    await vi.advanceTimersByTimeAsync(0);
    mockGetTask.mockClear();

    // Advance 5500ms
    await vi.advanceTimersByTimeAsync(5500);

    // Should have polled again (second call)
    expect(mockGetTask).toHaveBeenCalled();
  });

  // T10: Polling stops when status changes to paused
  it("T10: stops polling getTask API when status transitions out of running", async () => {
    vi.useFakeTimers();
    const mockGetTask = vi.mocked(getTask);
    
    // First query return running, second return paused
    mockGetTask
      .mockResolvedValueOnce(makeTask({ id: "OMNI-001", status: "running" }))
      .mockResolvedValueOnce(makeTask({ id: "OMNI-001", status: "paused" }))
      .mockResolvedValue(makeTask({ id: "OMNI-001", status: "paused" }));

    renderWithTask(makeTask({ id: "OMNI-001", status: "running" }));
    fireEvent.click(screen.getByTestId("open-trigger"));

    await vi.advanceTimersByTimeAsync(0);
    mockGetTask.mockClear();

    // Trigger polling check
    await vi.advanceTimersByTimeAsync(5500);
    expect(mockGetTask).toHaveBeenCalledTimes(1); // Switched to paused

    mockGetTask.mockClear();

    // Advance another 5500ms, should NOT call a third time because status is now paused
    await vi.advanceTimersByTimeAsync(5500);
    expect(mockGetTask).not.toHaveBeenCalled();
  });

  // T11: Live Status Feed has aria-live="polite" attribute
  it("T11: includes aria-live='polite' in the Live Status feed container", async () => {
    const mockListRuns = vi.mocked(listRuns);
    mockListRuns.mockResolvedValue([
      {
        id: "run-3",
        runNumber: 3,
        input: "retry",
        exitCode: null,
        logPath: "/path/to/log3",
        logTail: "Running...",
        startedAt: "2026-01-01T00:00:00Z",
        endedAt: null,
      },
    ]);

    renderWithTask(makeTask({ status: "running" }));
    fireEvent.click(screen.getByTestId("open-trigger"));

    await waitFor(() => {
      const feedList = screen.getByTestId("live-status-feed").querySelector("ol");
      expect(feedList).toHaveAttribute("aria-live", "polite");
    });
  });

  // T12: Comment textarea reset ("") khi switch tab away rồi quay lại Summary
  it("T12: resets comment textarea content when switching tabs away and back", async () => {
    renderWithTask(makeTask({ status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));

    const textarea = await screen.findByPlaceholderText("Add instructions for next run…");
    fireEvent.change(textarea, { target: { value: "Draft instructions" } });
    expect(textarea).toHaveValue("Draft instructions");

    // Switch tab
    fireEvent.click(screen.getByRole("tab", { name: "Comments" }));
    expect(textarea).not.toBeInTheDocument();

    // Switch back
    fireEvent.click(screen.getByRole("tab", { name: "Summary" }));
    const retextarea = await screen.findByPlaceholderText("Add instructions for next run…");
    expect(retextarea).toHaveValue("");
  });

  it("TC1: Comments tab renders sent and pending comment labels", async () => {
    vi.mocked(listComments).mockResolvedValue([
      makeComment({ id: "c1", content: "First", sent: true }),
      makeComment({ id: "c2", content: "Second", sent: false }),
    ]);

    renderWithTask(makeTask({ status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    fireEvent.click(screen.getByRole("tab", { name: "Comments" }));

    expect(await screen.findByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByText("Sent to agent ✓")).toBeInTheDocument();
    expect(screen.getByText("Pending · will be sent on next Resume")).toBeInTheDocument();
  });

  it("TC2: Comments empty state still renders input section", async () => {
    renderWithTask(makeTask({ status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    fireEvent.click(screen.getByRole("tab", { name: "Comments" }));

    expect(await screen.findByText("No comments yet")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Add a comment or instruction for the agent...")).toBeInTheDocument();
  });

  it("TC3: submitting comment calls addComment and clears textarea", async () => {
    vi.mocked(addComment).mockResolvedValue(makeComment({ content: "hello", sent: false }));

    renderWithTask(makeTask({ status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    fireEvent.click(screen.getByRole("tab", { name: "Comments" }));

    const textarea = await screen.findByLabelText("New comment");
    fireEvent.change(textarea, { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Comment" }));

    await waitFor(() => {
      expect(addComment).toHaveBeenCalledWith("proj-1", "OMNI-001", "hello");
      expect(textarea).toHaveValue("");
    });
  });

  it("TC4: empty comment keeps mutation from firing", async () => {
    renderWithTask(makeTask({ status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    fireEvent.click(screen.getByRole("tab", { name: "Comments" }));

    expect(await screen.findByRole("button", { name: "Add Comment" })).toBeDisabled();
    expect(addComment).not.toHaveBeenCalled();
  });

  it("TC5: task_terminal add comment error shows API message", async () => {
    vi.mocked(addComment).mockRejectedValue(
      new ApiError(409, "task_terminal", "Comment cannot be added to terminal task"),
    );

    renderWithTask(makeTask({ status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    fireEvent.click(screen.getByRole("tab", { name: "Comments" }));

    fireEvent.change(await screen.findByLabelText("New comment"), { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Comment" }));

    expect(await screen.findByText("Comment cannot be added to terminal task")).toBeInTheDocument();
  });

  it("TC6: terminal task disables comment input", async () => {
    renderWithTask(makeTask({ status: "completed" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    fireEvent.click(screen.getByRole("tab", { name: "Comments" }));

    const textarea = await screen.findByPlaceholderText(/Comments disabled/);
    expect(textarea).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add Comment" })).toBeDisabled();
  });

  it("TR1: Runs tab renders runs in backend order", async () => {
    vi.mocked(listRuns).mockResolvedValue([
      makeRun({ id: "run-3", runNumber: 3, exitCode: null, endedAt: null }),
      makeRun({ id: "run-2", runNumber: 2 }),
      makeRun({ id: "run-1", runNumber: 1 }),
    ]);

    renderWithTask(makeTask({ status: "running" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    fireEvent.click(screen.getByRole("tab", { name: "Runs" }));

    const rows = await screen.findAllByRole("button", { name: /Run #/ });
    expect(rows[0]).toHaveTextContent("Run #3");
    expect(screen.getByText(/Running ·/)).toBeInTheDocument();
    expect(screen.getAllByText(/Completed ·/).length).toBeGreaterThan(0);
  });

  it("TR2: expanding a run shows detail fields", async () => {
    vi.mocked(listRuns).mockResolvedValue([makeRun({ input: "Add handling" })]);

    renderWithTask(makeTask({ status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    fireEvent.click(screen.getByRole("tab", { name: "Runs" }));
    fireEvent.click(await screen.findByRole("button", { name: /Run #1/ }));

    expect(screen.getByText("Input:")).toBeInTheDocument();
    expect(screen.getByText("Output:")).toBeInTheDocument();
    expect(screen.getByText("Duration:")).toBeInTheDocument();
    expect(screen.getByText("Exit:")).toBeInTheDocument();
  });

  it("TR3: expanding a second row collapses the first row", async () => {
    vi.mocked(listRuns).mockResolvedValue([
      makeRun({ id: "run-2", runNumber: 2, input: "second" }),
      makeRun({ id: "run-1", runNumber: 1, input: "first" }),
    ]);

    renderWithTask(makeTask({ status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    fireEvent.click(screen.getByRole("tab", { name: "Runs" }));
    const run2 = await screen.findByRole("button", { name: /Run #2/ });
    const run1 = screen.getByRole("button", { name: /Run #1/ });

    fireEvent.click(run2);
    expect(screen.getByText("second")).toBeInTheDocument();
    fireEvent.click(run1);
    expect(screen.queryByText("second")).not.toBeInTheDocument();
    expect(screen.getByText("first")).toBeInTheDocument();
  });

  it("TR4: empty runs shows empty state", async () => {
    renderWithTask(makeTask({ status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    fireEvent.click(screen.getByRole("tab", { name: "Runs" }));

    expect(await screen.findByText("No runs yet")).toBeInTheDocument();
  });

  it("TR5: View Logs switches to Logs tab and focuses selected run", async () => {
    vi.mocked(listRuns).mockResolvedValue([
      makeRun({ id: "run-2", runNumber: 2, logTail: "selected log" }),
      makeRun({ id: "run-1", runNumber: 1, logTail: "other log" }),
    ]);

    renderWithTask(makeTask({ status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    fireEvent.click(screen.getByRole("tab", { name: "Runs" }));
    fireEvent.click(await screen.findByRole("button", { name: /Run #2/ }));
    fireEvent.click(screen.getByRole("button", { name: "View logs for Run #2" }));

    expect(await screen.findByText(/This tab contains raw technical output/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("Filter by run")).toHaveValue("run-2");
    });
  });

  it("TR6: View Timeline mounts RunTimeline", async () => {
    vi.mocked(listRuns).mockResolvedValue([makeRun()]);

    renderWithTask(makeTask({ status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    fireEvent.click(screen.getByRole("tab", { name: "Runs" }));
    fireEvent.click(await screen.findByRole("button", { name: /Run #1/ }));
    fireEvent.click(screen.getByRole("button", { name: "View timeline for Run #1" }));

    expect(screen.getByRole("list", { name: /Timeline for Run #1/ })).toBeInTheDocument();
  });
});
