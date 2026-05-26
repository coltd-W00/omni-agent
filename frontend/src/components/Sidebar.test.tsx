import { MemoryRouter } from "react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Sidebar from "./Sidebar";

vi.mock("../features/project/ProjectSwitcher", () => ({
  default: () => <div data-testid="project-switcher" />,
}));

describe("Sidebar", () => {
  it("renders nav links with icon spans and title attributes", () => {
    const { container } = render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    const boardLink = screen.getByRole("link", { name: "All Tasks" });

    expect(dashboardLink).toHaveAttribute("title", "Dashboard");
    expect(boardLink).toHaveAttribute("title", "All Tasks");
    expect(
      container.querySelector(".app-sidebar__item-icon[aria-hidden='true']")
    ).not.toBeNull();
  });
});
