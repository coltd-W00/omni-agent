import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "./Toast";
import TopBar from "./TopBar";
import { useActiveProjectId } from "../features/project/ActiveProjectContext";

vi.mock("../features/project/ActiveProjectContext", () => ({
  useActiveProjectId: vi.fn(),
}));
vi.mock("../api/tasks", () => ({ createTask: vi.fn(), listTasks: vi.fn() }));

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
  vi.mocked(useActiveProjectId).mockReturnValue(null);
});

function renderTopBar() {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <TopBar />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("TopBar", () => {
  it("renders brand name and + New Task button", () => {
    renderTopBar();
    expect(screen.getByText("omni-agent")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "+ New Task" }),
    ).toBeInTheDocument();
  });

  it("button disabled when no active project", () => {
    vi.mocked(useActiveProjectId).mockReturnValue(null);
    renderTopBar();
    expect(screen.getByRole("button", { name: "+ New Task" })).toBeDisabled();
  });

  it("button enabled when active project is set", () => {
    vi.mocked(useActiveProjectId).mockReturnValue("proj-1");
    renderTopBar();
    expect(
      screen.getByRole("button", { name: "+ New Task" }),
    ).not.toBeDisabled();
  });

  it("click + New Task → CreateTaskModal dialog opens", async () => {
    const user = userEvent.setup();
    vi.mocked(useActiveProjectId).mockReturnValue("proj-1");
    renderTopBar();
    await user.click(screen.getByRole("button", { name: "+ New Task" }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Create Task" }),
      ).toBeInTheDocument();
    });
  });
});
