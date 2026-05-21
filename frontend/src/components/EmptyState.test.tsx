import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import EmptyState from "./EmptyState";

describe("EmptyState", () => {
  it("full variant with CTA renders button", () => {
    const onCtaClick = vi.fn();
    render(
      <EmptyState
        icon="📂"
        heading="No projects yet"
        description="Create your first project"
        ctaLabel="New Project"
        onCtaClick={onCtaClick}
        variant="full"
      />,
    );
    expect(screen.getByRole("button", { name: "New Project" })).toBeInTheDocument();
  });

  it("inline variant without icon when icon=''", () => {
    const { container } = render(
      <EmptyState
        icon=""
        heading="No tasks here"
        variant="inline"
      />,
    );
    const icon = container.querySelector(".app-empty-state__icon");
    expect(icon).not.toBeInTheDocument();
  });

  it("onCtaClick called when button clicked", async () => {
    const user = userEvent.setup();
    const onCtaClick = vi.fn();
    render(
      <EmptyState
        icon="📂"
        heading="Empty board"
        ctaLabel="Add task"
        onCtaClick={onCtaClick}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Add task" }));
    expect(onCtaClick).toHaveBeenCalledOnce();
  });

  it("heading and description render", () => {
    render(
      <EmptyState
        icon="📋"
        heading="Nothing here yet"
        description="Try adding some items"
      />,
    );
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
    expect(screen.getByText("Try adding some items")).toBeInTheDocument();
  });
});
