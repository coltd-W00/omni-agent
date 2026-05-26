import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TaskDetailPanel from "./TaskDetailPanel";
import { TaskDetailProvider, useTaskDetail } from "../../contexts/TaskDetailContext";
import { ToastProvider } from "../../components/Toast";
import { ApiError } from "../../api/client";
import type { Task } from "../../types/task";
import type { Project } from "../../types/project";

// Mock sessions API so mutation doesn't make real network calls
vi.mock("../../api/sessions", () => ({
  startSession: vi.fn(),
  resumeSession: vi.fn(),
}));

import { startSession, resumeSession } from "../../api/sessions";

const MOCK_PROJECT: Project = {
  id: "proj-1",
  name: "OmniAgent",
  key: "OMNI",
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

// Helper: renders TaskDetailPanel inside required providers and optionally opens a task via a trigger.
function renderWithTask(task?: Task, project: Project = MOCK_PROJECT) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

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
  it("clicking Comments tab shows No comments yet empty state", () => {
    renderWithTask(makeTask());
    fireEvent.click(screen.getByTestId("open-trigger"));
    fireEvent.click(screen.getByRole("tab", { name: "Comments" }));
    expect(screen.getByText("No comments yet")).toBeInTheDocument();
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

  // ─── Story 3.3: Resume Session wiring tests ─────────────────────────────

  it("clicking Resume Session calls resumeSession with comment and clears textarea", async () => {
    const mockResumeSession = vi.mocked(resumeSession);
    mockResumeSession.mockResolvedValue({
      sessionPk: "pk-123",
      taskId: "OMNI-001",
      sessionId: "cli-sess-aaa",
      status: "running" as const,
      runId: "run-456",
      runNumber: 2,
      runInput: "Check email edge case",
      commentId: "comment-1",
      commentSent: true,
      startedAt: "2026-01-01T00:00:00Z",
    });

    renderWithTask(makeTask({ id: "OMNI-001", projectId: "proj-1", status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));

    const textarea = screen.getByPlaceholderText(/Add a comment or instruction for the agent/i);
    fireEvent.change(textarea, { target: { value: "Check email edge case" } });

    const btn = screen.getByRole("button", { name: "Resume Session" });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockResumeSession).toHaveBeenCalledWith("proj-1", "OMNI-001", "Check email edge case");
      expect(textarea).toHaveValue("");
      expect(screen.getByText(/Resumed OMNI-001 with comment/i)).toBeInTheDocument();
    });
  });

  it("clicking Resume Session without comment works", async () => {
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

  it("shows warning toast on session_already_active warning", async () => {
    const mockResumeSession = vi.mocked(resumeSession);
    mockResumeSession.mockRejectedValue(
      new ApiError(409, "session_already_active", "Session is already running"),
    );

    renderWithTask(makeTask({ status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    fireEvent.click(screen.getByRole("button", { name: "Resume Session" }));

    await waitFor(() => {
      expect(screen.getByText("Session is already running")).toBeInTheDocument();
    });
  });

  it("shows error toast on agent_not_found error", async () => {
    const mockResumeSession = vi.mocked(resumeSession);
    mockResumeSession.mockRejectedValue(
      new ApiError(400, "agent_not_found", "Agent binary not found on PATH"),
    );

    renderWithTask(makeTask({ status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));
    fireEvent.click(screen.getByRole("button", { name: "Resume Session" }));

    await waitFor(() => {
      expect(screen.getByText("Agent binary not found on PATH")).toBeInTheDocument();
    });
  });

  it("resume button is disabled while mutation is pending", async () => {
    const mockResumeSession = vi.mocked(resumeSession);
    mockResumeSession.mockImplementation(() => new Promise(() => {}));

    renderWithTask(makeTask({ status: "paused" }));
    fireEvent.click(screen.getByTestId("open-trigger"));

    const btn = screen.getByRole("button", { name: "Resume Session" });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Resume Session" })).toBeDisabled();
    });
  });
});
