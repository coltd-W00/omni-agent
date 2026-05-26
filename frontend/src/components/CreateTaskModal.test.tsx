import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "./Toast";
import CreateTaskModal from "./CreateTaskModal";
import { createTask } from "../api/tasks";
import { ApiError } from "../api/client";
import { ActiveProjectProvider } from "../features/project/ActiveProjectContext";

vi.mock("../api/tasks", () => ({ createTask: vi.fn(), listTasks: vi.fn() }));
vi.mock("../hooks/useAgents", () => ({
  useAgents: () => ({
    data: [{ name: "claude", enabled: true }],
    isLoading: false,
  }),
}));

// JSDOM polyfill for HTMLDialogElement
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  }
});

beforeEach(() => {
  vi.mocked(createTask).mockReset();
});

function renderModal(
  onClose = vi.fn(),
  opts: { open?: boolean; projectId?: string | null } = {},
) {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={qc}>
      <ActiveProjectProvider>
        <ToastProvider>
          <CreateTaskModal
            open={opts.open ?? true}
            projectId={opts.projectId ?? "proj-1"}
            onClose={onClose}
          />
        </ToastProvider>
      </ActiveProjectProvider>
    </QueryClientProvider>,
  );
}

describe("CreateTaskModal", () => {
  it("open=true → renders dialog with heading, fields, and buttons", () => {
    renderModal();
    expect(screen.getByRole("heading", { name: "Create Task" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Task" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("Create Task button disabled when both fields empty", () => {
    renderModal();
    expect(screen.getByRole("button", { name: "Create Task" })).toBeDisabled();
  });

  it("blur empty Title field → inline error shown", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByLabelText("Title"));
    await user.tab(); // blur
    expect(
      screen.getByText("Task title must be 1–200 characters"),
    ).toBeInTheDocument();
  });

  it("blur empty Description field → inline error shown", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByLabelText("Description"));
    await user.tab(); // blur
    expect(
      screen.getByText("Task description must be 1–5000 characters"),
    ).toBeInTheDocument();
  });

  it("successful submit → calls createTask, shows toast, calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    vi.mocked(createTask).mockResolvedValue({
      id: "PROJ-001",
      projectId: "proj-1",
      seq: 1,
      title: "Test task",
      description: "Some description",
      acceptanceCriteria: null,
      agent: "claude",
      role: "coder",
      status: "assigned",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    renderModal(onClose);

    await user.type(screen.getByLabelText("Title"), "Test task");
    await user.type(screen.getByLabelText("Description"), "Some description");
    await user.selectOptions(screen.getByLabelText("Agent"), "claude");
    await user.click(screen.getByRole("button", { name: "Create Task" }));

    await waitFor(() => {
      expect(vi.mocked(createTask)).toHaveBeenCalledWith("proj-1", {
        title: "Test task",
        description: "Some description",
        acceptanceCriteria: undefined,
        agent: "claude",
        role: "coder",
      });
    });
    await waitFor(() => {
      expect(screen.getByText("Task PROJ-001 created")).toBeInTheDocument();
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("API error invalid_task_title → inline title error", async () => {
    const user = userEvent.setup();
    vi.mocked(createTask).mockRejectedValue(
      new ApiError(422, "invalid_task_title", "Title is too short"),
    );
    renderModal();

    await user.type(screen.getByLabelText("Title"), "Hi");
    await user.type(screen.getByLabelText("Description"), "A description");
    await user.selectOptions(screen.getByLabelText("Agent"), "claude");
    await user.click(screen.getByRole("button", { name: "Create Task" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Title is too short");
    });
  });

  it("Cancel button → dialog closes → onClose called", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
