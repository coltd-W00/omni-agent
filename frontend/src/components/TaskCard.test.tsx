import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import TaskCard from "./TaskCard";

const DEFAULT_TASK = {
  id: "ERP-CB-001",
  title: "Implement login flow",
  status: "running" as const,
};

function renderCard(onClick?: () => void) {
  return render(
    <TaskCard
      task={DEFAULT_TASK}
      project={{ key: "erp-cb" }}
      agent={{ name: "backend-coder", runtime: "codex" }}
      sessionState="active"
      commentsCount={3}
      lastActivity="2h"
      onClick={onClick}
    />,
  );
}

describe("TaskCard", () => {
  it("renders title, project key, agent name, comments count, lastActivity", () => {
    renderCard();
    expect(screen.getByText("Implement login flow")).toBeInTheDocument();
    expect(screen.getByText("ERP-CB")).toBeInTheDocument();
    expect(screen.getByLabelText(/backend-coder/)).toBeInTheDocument();
    expect(screen.getByText(/3 comments/)).toBeInTheDocument();
    expect(screen.getByText("2h")).toBeInTheDocument();
  });

  it("onClick called when user clicks card", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderCard(onClick);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("Enter key triggers onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderCard(onClick);
    screen.getByRole("button").focus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("Space key triggers onClick on keyup", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderCard(onClick);
    screen.getByRole("button").focus();
    await user.keyboard("[Space>]");
    expect(onClick).not.toHaveBeenCalled();
    await user.keyboard("[/Space]");
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("title truncate class applied", () => {
    renderCard();
    expect(screen.getByRole("heading", { level: 3 })).toHaveClass(
      "app-task-card__title",
    );
  });

  it("role='button' only when onClick provided", () => {
    const { rerender } = renderCard(vi.fn());
    expect(screen.getByRole("button")).toBeInTheDocument();
    rerender(
      <TaskCard
        task={DEFAULT_TASK}
        project={{ key: "erp-cb" }}
        agent={{ name: "backend-coder", runtime: "codex" }}
        sessionState="active"
        commentsCount={3}
        lastActivity="2h"
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
