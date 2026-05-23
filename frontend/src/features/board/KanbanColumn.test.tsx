import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import KanbanColumn from "./KanbanColumn";

describe("KanbanColumn", () => {
  it("running column with isRunning=true → dot has pulse class", () => {
    const { container } = render(
      <KanbanColumn statusValue="running" label="Running" count={2} isRunning={true}>
        <div>child</div>
      </KanbanColumn>,
    );
    expect(container.querySelector(".kanban-column__dot--pulse")).not.toBeNull();
  });

  it("ready column with isRunning=false → dot does NOT have pulse class", () => {
    const { container } = render(
      <KanbanColumn statusValue="ready" label="Ready" count={1} isRunning={false}>
        <div>child</div>
      </KanbanColumn>,
    );
    expect(container.querySelector(".kanban-column__dot--pulse")).toBeNull();
  });

  it("renders count badge with correct text and aria-label", () => {
    render(
      <KanbanColumn statusValue="draft" label="Backlog" count={5} isRunning={false}>
        <div>child</div>
      </KanbanColumn>,
    );
    const countEl = screen.getByLabelText("5 tasks");
    expect(countEl).toBeInTheDocument();
    expect(countEl.textContent).toBe("5");
  });

  it("renders h2 heading with correct label", () => {
    render(
      <KanbanColumn statusValue="draft" label="Backlog" count={0} isRunning={false}>
        <div>child</div>
      </KanbanColumn>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Backlog" })).toBeInTheDocument();
  });

  it("renders children in body", () => {
    render(
      <KanbanColumn statusValue="completed" label="Completed" count={1} isRunning={false}>
        <div>test-child</div>
      </KanbanColumn>,
    );
    expect(screen.getByText("test-child")).toBeInTheDocument();
  });
});
