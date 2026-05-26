import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Dashboard from "./Dashboard";

// Mock hooks
vi.mock("../../hooks/useAggregatedTasks");
vi.mock("../../contexts/TaskDetailContext");
vi.mock("react-router", () => ({
  useNavigate: vi.fn(),
}));

import { useAggregatedTasks } from "../../hooks/useAggregatedTasks";
import { useTaskDetail } from "../../contexts/TaskDetailContext";
import { useNavigate } from "react-router";
import type { Task } from "../../types/task";
import type { Project } from "../../types/project";

const mockUseAggregatedTasks = vi.mocked(useAggregatedTasks);
const mockUseTaskDetail = vi.mocked(useTaskDetail);
const mockUseNavigate = vi.mocked(useNavigate);

// Helpers to make mock projects & tasks
const MOCK_PROJECT: Project = {
  id: "p1",
  name: "Project One",
  key: "PROJ1",
  createdAt: "2026-05-26T00:00:00",
  updatedAt: "2026-05-26T00:00:00",
};

function makeTask(id: string, status: Task["status"], title: string, updatedAt = "2026-05-26T10:00:00"): Task & { project: Project } {
  return {
    id,
    projectId: "p1",
    seq: parseInt(id),
    title,
    description: `Desc ${id}`,
    acceptanceCriteria: null,
    agent: "claude",
    role: "coder",
    status,
    createdAt: "2026-05-26T00:00:00",
    updatedAt,
    project: MOCK_PROJECT,
  };
}

describe("Dashboard Component", () => {
  const mockOpenTask = vi.fn();
  const mockRefetch = vi.fn();
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    // System time mock to be deterministic for relative times
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-26T12:00:00")); // Noon (Good afternoon)

    mockUseTaskDetail.mockReturnValue({
      selectedTask: null,
      selectedProject: null,
      openTask: mockOpenTask,
      closeTask: vi.fn(),
    });
    mockUseNavigate.mockReturnValue(mockNavigate);
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("should render loading state (skeletons)", () => {
    mockUseAggregatedTasks.mockReturnValue({
      tasks: [],
      projects: [],
      isPending: true,
      isError: false,
      hasPartialError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<Dashboard />);

    const route = screen.getByTestId("dashboard-route");
    expect(route).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(/Good afternoon/i)).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-stats-bar")).toBeInTheDocument();
  });

  it("should render error state", () => {
    mockUseAggregatedTasks.mockReturnValue({
      tasks: [],
      projects: [],
      isPending: false,
      isError: true,
      hasPartialError: false,
      error: new Error("Server disconnect"),
      refetch: mockRefetch,
    });

    render(<Dashboard />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Couldn't load dashboard")).toBeInTheDocument();
    expect(screen.getByText("Server disconnect")).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(retryButton);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it("should render no projects state", () => {
    mockUseAggregatedTasks.mockReturnValue({
      tasks: [],
      projects: [],
      isPending: false,
      isError: false,
      hasPartialError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<Dashboard />);

    expect(screen.getByText("No projects yet")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-stats-bar")).not.toBeInTheDocument();
  });

  it("should render all caught up empty state when there are projects but no active tasks", () => {
    mockUseAggregatedTasks.mockReturnValue({
      tasks: [],
      projects: [MOCK_PROJECT],
      isPending: false,
      isError: false,
      hasPartialError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<Dashboard />);

    expect(screen.getByText("You're all caught up!")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-stats-bar")).toBeInTheDocument();

    const goButton = screen.getByRole("button", { name: "Go to Board" });
    fireEvent.click(goButton);
    expect(mockNavigate).toHaveBeenCalledWith("/board");
  });

  it("should render dashboard elements and verify order of sections", () => {
    const tasks = [
      makeTask("1", "needs-review", "Needs Review Task", "2026-05-26T11:45:00"),
      makeTask("2", "failed", "Failed Task", "2026-05-26T11:30:00"),
      makeTask("3", "running", "Running Task", "2026-05-26T11:15:00"),
      makeTask("4", "ready", "Ready Task", "2026-05-26T11:00:00"),
      makeTask("5", "completed", "Completed Task", "2026-05-26T11:50:00"),
    ];

    mockUseAggregatedTasks.mockReturnValue({
      tasks,
      projects: [MOCK_PROJECT],
      isPending: false,
      isError: false,
      hasPartialError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<Dashboard />);

    // 1. Stats Bar Assertions (Active, Needs Review, Running, Completed)
    // Active counts tasks with status in: assigned, running, paused, needs-review, changes-requested -> needs-review, running -> 2 active tasks
    // Completed Today counts tasks with status = completed and updatedAt >= start of today (mocked to 2026-05-26T00:00:00Z). Completed task is updatedAt 11:50:00Z. So 1 completed.
    const statsBar = screen.getByTestId("dashboard-stats-bar");
    expect(statsBar).toHaveTextContent("Active Tasks2");
    expect(statsBar).toHaveTextContent("Needs Review1");
    expect(statsBar).toHaveTextContent("Running Agents1");
    expect(statsBar).toHaveTextContent("Completed Today1");

    // 2. Sections Order Assertions
    const headings = screen.getAllByRole("heading", { level: 2 });
    const headingTexts = headings.map((h) => h.textContent);
    
    // Expected order: Needs Your Review, Failed & Blocked, Running Sessions, Ready to Assign, Completed Recently
    expect(headingTexts).toEqual([
      "Needs Your Review",
      "Failed & Blocked",
      "Running Sessions",
      "Ready to Assign",
      "Completed Recently",
    ]);

    // 3. Section skip: if no failed tasks, Failed & Blocked section should be omitted
    cleanup();
    const tasksWithoutFailed = tasks.filter((t) => t.status !== "failed");
    mockUseAggregatedTasks.mockReturnValue({
      tasks: tasksWithoutFailed,
      projects: [MOCK_PROJECT],
      isPending: false,
      isError: false,
      hasPartialError: false,
      error: null,
      refetch: mockRefetch,
    });
    
    render(<Dashboard />);
    const headingsUpdated = screen.getAllByRole("heading", { level: 2 });
    expect(headingsUpdated.map((h) => h.textContent)).not.toContain("Failed & Blocked");
  });

  it("should open task panel when card items are clicked", () => {
    const reviewTask = makeTask("1", "needs-review", "Needs Review Task");
    const failedTask = makeTask("2", "failed", "Failed Task");

    mockUseAggregatedTasks.mockReturnValue({
      tasks: [reviewTask, failedTask],
      projects: [MOCK_PROJECT],
      isPending: false,
      isError: false,
      hasPartialError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<Dashboard />);

    // Click Open Review
    const openReviewButton = screen.getByRole("button", { name: "Open Review" });
    fireEvent.click(openReviewButton);
    expect(mockOpenTask).toHaveBeenCalledWith(reviewTask, MOCK_PROJECT);

    // Click Resume Session
    const resumeButton = screen.getByRole("button", { name: "Resume Session" });
    fireEvent.click(resumeButton);
    expect(mockOpenTask).toHaveBeenCalledWith(failedTask, MOCK_PROJECT);
  });

  it("should support accessibility properties on sections and cards", () => {
    const reviewTask = makeTask("1", "needs-review", "Needs Review Task");
    mockUseAggregatedTasks.mockReturnValue({
      tasks: [reviewTask],
      projects: [MOCK_PROJECT],
      isPending: false,
      isError: false,
      hasPartialError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<Dashboard />);

    // Root route ID mapping
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveAttribute("id", "dashboard-heading");

    // Section accessible name
    const section = screen.getByRole("region", { name: "Needs Your Review" });
    expect(section).toBeInTheDocument();

    // Review Card role
    const card = screen.getByRole("article");
    expect(card).toHaveAttribute("tabindex", "0");
  });
});
