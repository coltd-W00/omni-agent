import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TaskBoard from "./TaskBoard";
import type { Task } from "../../types/task";
import type { Project } from "../../types/project";

vi.mock("../../hooks/useProjects", () => ({
  useResolvedActiveProject: vi.fn(),
}));

vi.mock("../../hooks/useTasks", () => ({
  useTasks: vi.fn(),
  tasksQueryKey: (id: string | null) => ["tasks", id] as const,
}));

import { useResolvedActiveProject } from "../../hooks/useProjects";
import { useTasks } from "../../hooks/useTasks";

const mockUseResolvedActiveProject = vi.mocked(useResolvedActiveProject);
const mockUseTasks = vi.mocked(useTasks);

const MOCK_PROJECT: Project = { id: "proj-1", name: "OmniAgent", key: "OMNI", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "OMNI-001",
    projectId: "proj-1",
    seq: 1,
    title: "Fix login",
    description: "",
    acceptanceCriteria: null,
    agent: null,
    role: null,
    status: "draft",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderBoard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TaskBoard />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TaskBoard", () => {
  it("no active project → shows No projects yet empty state and CTA", () => {
    mockUseResolvedActiveProject.mockReturnValue(null);
    mockUseTasks.mockReturnValue({ data: undefined, isPending: false, isError: false, error: null, refetch: vi.fn() } as never);
    renderBoard();
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
    expect(screen.getByText("Create your first project")).toBeInTheDocument();
  });

  it("loading state → renders 8 column headings and 16 skeleton cards", () => {
    mockUseResolvedActiveProject.mockReturnValue(MOCK_PROJECT);
    mockUseTasks.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() } as never);
    const { container } = renderBoard();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(8);
    expect(container.querySelectorAll(".task-card-skeleton")).toHaveLength(16);
  });

  it("empty board → shows No tasks yet in this project", async () => {
    mockUseResolvedActiveProject.mockReturnValue(MOCK_PROJECT);
    mockUseTasks.mockReturnValue({ data: [], isPending: false, isError: false, error: null, refetch: vi.fn() } as never);
    renderBoard();
    expect(screen.getByText("No tasks yet in this project")).toBeInTheDocument();
  });

  it("error state → shows Couldn't load tasks + Try again button", async () => {
    mockUseResolvedActiveProject.mockReturnValue(MOCK_PROJECT);
    const mockError = new Error("boom");
    mockUseTasks.mockReturnValue({ data: undefined, isPending: false, isError: true, error: mockError, refetch: vi.fn() } as never);
    renderBoard();
    await waitFor(() => {
      expect(screen.getByText("Couldn't load tasks")).toBeInTheDocument();
    });
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("8 columns with 4 tasks distributed correctly", () => {
    mockUseResolvedActiveProject.mockReturnValue(MOCK_PROJECT);
    const tasks: Task[] = [
      makeTask({ id: "OMNI-001", status: "draft" }),
      makeTask({ id: "OMNI-002", status: "ready" }),
      makeTask({ id: "OMNI-003", status: "running" }),
      makeTask({ id: "OMNI-004", status: "completed" }),
    ];
    mockUseTasks.mockReturnValue({ data: tasks, isPending: false, isError: false, error: null, refetch: vi.fn() } as never);
    renderBoard();

    // Verify 8 columns are rendered
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings).toHaveLength(8);

    // Verify 4 task cards rendered (each task in exactly one column)
    const articles = screen.getAllByRole("article");
    expect(articles).toHaveLength(4);

    // Verify empty state for columns without tasks
    const emptyMessages = screen.getAllByText("No tasks here");
    expect(emptyMessages).toHaveLength(4); // 4 columns without tasks
  });

  it("cancelled task is hidden from board", () => {
    mockUseResolvedActiveProject.mockReturnValue(MOCK_PROJECT);
    const tasks: Task[] = [
      makeTask({ id: "OMNI-001", status: "completed" }),
      makeTask({ id: "OMNI-002", status: "cancelled" }),
    ];
    mockUseTasks.mockReturnValue({ data: tasks, isPending: false, isError: false, error: null, refetch: vi.fn() } as never);
    renderBoard();
    const articles = screen.getAllByRole("article");
    expect(articles).toHaveLength(1);
  });

  it("running column dot has pulse class when task is running", () => {
    mockUseResolvedActiveProject.mockReturnValue(MOCK_PROJECT);
    const tasks: Task[] = [makeTask({ id: "OMNI-001", status: "running" })];
    mockUseTasks.mockReturnValue({ data: tasks, isPending: false, isError: false, error: null, refetch: vi.fn() } as never);
    const { container } = renderBoard();
    expect(container.querySelector(".kanban-column--running .kanban-column__dot--pulse")).not.toBeNull();
  });

  it("TaskCard receives correct agent props from task with agent=claude and role=coder", () => {
    mockUseResolvedActiveProject.mockReturnValue(MOCK_PROJECT);
    const tasks: Task[] = [makeTask({ id: "OMNI-001", status: "draft", agent: "claude", role: "coder" })];
    mockUseTasks.mockReturnValue({ data: tasks, isPending: false, isError: false, error: null, refetch: vi.fn() } as never);
    renderBoard();

    // project key chip visible
    expect(screen.getByText("OMNI")).toBeInTheDocument();

    // agent name "coder" accessible via AgentAvatar aria-label
    expect(screen.getByLabelText(/coder/)).toBeInTheDocument();
  });
});
