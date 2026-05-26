import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SearchOverlay from "./SearchOverlay";
import { useAggregatedTasks } from "../../hooks/useAggregatedTasks";
import { useTaskDetail } from "../../contexts/TaskDetailContext";

vi.mock("../../hooks/useAggregatedTasks");
vi.mock("../../contexts/TaskDetailContext");

const mockUseAggregatedTasks = vi.mocked(useAggregatedTasks);
const mockUseTaskDetail = vi.mocked(useTaskDetail);

const mockProject = {
  id: "p1",
  name: "OmniProject",
  key: "OMNI",
  createdAt: "",
  updatedAt: "",
};

const mockTasks = [
  {
    id: "OMNI-1",
    projectId: "p1",
    seq: 1,
    title: "Verify login redirect",
    description: "Verify that user is redirected properly",
    acceptanceCriteria: null,
    agent: null,
    role: null,
    status: "ready" as const,
    createdAt: "2026-05-26T10:00:00Z",
    updatedAt: "2026-05-26T10:00:00Z",
    project: mockProject,
  },
  {
    id: "OMNI-2",
    projectId: "p1",
    seq: 2,
    title: "Fix focus trap",
    description: "Fix focus trap issues inside modal dialogs",
    acceptanceCriteria: null,
    agent: null,
    role: null,
    status: "running" as const,
    createdAt: "2026-05-26T11:00:00Z",
    updatedAt: "2026-05-26T11:00:00Z",
    project: mockProject,
  },
];

describe("SearchOverlay", () => {
  let openTaskMock: any;
  let closeTaskMock: any;
  let onCloseMock: any;

  beforeEach(() => {
    vi.resetAllMocks();
    openTaskMock = vi.fn();
    closeTaskMock = vi.fn();
    onCloseMock = vi.fn();

    mockUseTaskDetail.mockReturnValue({
      selectedTask: null,
      selectedProject: null,
      openTask: openTaskMock,
      closeTask: closeTaskMock,
    });

    mockUseAggregatedTasks.mockReturnValue({
      tasks: mockTasks,
      projects: [mockProject],
      isPending: false,
      isError: false,
      hasPartialError: false,
      error: null,
      refetch: vi.fn(),
    });

    if (typeof HTMLDialogElement !== "undefined") {
      HTMLDialogElement.prototype.showModal = vi.fn(function (this: any) {
        this.open = true;
      });
      HTMLDialogElement.prototype.close = vi.fn(function (this: any) {
        if (this.open) {
          this.open = false;
          const event = new Event("close");
          this.dispatchEvent(event);
        }
      });
    }
  });

  it("renders when open and shows 5 recently updated tasks on empty query", () => {
    render(<SearchOverlay open={true} onClose={onCloseMock} />);
    expect(
      screen.getByPlaceholderText("Search tasks, agents, sessions…")
    ).toBeInTheDocument();
    expect(screen.getByText("Verify login redirect")).toBeInTheDocument();
    expect(screen.getByText("Fix focus trap")).toBeInTheDocument();
  });

  it("filters tasks based on title, id or project name", async () => {
    const user = userEvent.setup();
    render(<SearchOverlay open={true} onClose={onCloseMock} />);

    const input = screen.getByPlaceholderText("Search tasks, agents, sessions…");
    await user.type(input, "login");

    expect(screen.getByText("Verify login redirect")).toBeInTheDocument();
    expect(screen.queryByText("Fix focus trap")).not.toBeInTheDocument();
  });

  it("allows navigation with arrow keys and selecting with Enter", async () => {
    const user = userEvent.setup();
    render(<SearchOverlay open={true} onClose={onCloseMock} />);

    const input = screen.getByPlaceholderText("Search tasks, agents, sessions…");
    input.focus();

    // Since mockTasks has OMNI-2 with newer updatedAt (11:00:00), it sorts to the top (index 0).
    // OMNI-1 with older updatedAt (10:00:00) is at index 1.
    // Initially selectedIndex is 0 (OMNI-2).
    // Pressing ArrowDown moves to index 1 (OMNI-1).
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(openTaskMock).toHaveBeenCalledWith(mockTasks[0], mockProject);
  });
});
