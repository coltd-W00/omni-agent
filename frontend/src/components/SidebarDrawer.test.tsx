import { MemoryRouter } from "react-router";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SidebarDrawer from "./SidebarDrawer";
import { SidebarDrawerProvider, useSidebarDrawer } from "../contexts/SidebarDrawerContext";

function OpenButton() {
  const { open } = useSidebarDrawer();
  return <button type="button" onClick={open}>Open drawer</button>;
}

function renderDrawer() {
  return render(
    <MemoryRouter>
      <SidebarDrawerProvider>
        <OpenButton />
        <SidebarDrawer />
      </SidebarDrawerProvider>
    </MemoryRouter>
  );
}

describe("SidebarDrawer", () => {
  it("does not render while closed", () => {
    renderDrawer();

    expect(screen.queryByTestId("sidebar-drawer")).not.toBeInTheDocument();
  });

  it("opens with navigation links and backdrop", async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(screen.getByRole("button", { name: "Open drawer" }));

    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveClass(
      "app-sidebar-drawer"
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All Tasks" })).toBeInTheDocument();
    expect(screen.getByTestId("drawer-backdrop")).toBeInTheDocument();
  });

  it("closes on Escape and backdrop click", async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(screen.getByRole("button", { name: "Open drawer" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("sidebar-drawer")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open drawer" }));
    await user.click(screen.getByTestId("drawer-backdrop"));
    expect(screen.queryByTestId("sidebar-drawer")).not.toBeInTheDocument();
  });

  it("closes after selecting a nav link", async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(screen.getByRole("button", { name: "Open drawer" }));
    await user.click(screen.getByRole("link", { name: "All Tasks" }));

    expect(screen.queryByTestId("sidebar-drawer")).not.toBeInTheDocument();
  });

  it("focuses the first nav link when opened", async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(screen.getByRole("button", { name: "Open drawer" }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Dashboard" })).toHaveFocus();
    });
  });

  it("traps focus from close button back to last link", async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(screen.getByRole("button", { name: "Open drawer" }));

    const drawer = screen.getByTestId("sidebar-drawer");
    const closeButton = screen.getByRole("button", { name: "Close navigation menu" });
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Dashboard" })).toHaveFocus();
    });

    closeButton.focus();
    fireEvent.keyDown(drawer, { key: "Tab", shiftKey: true });

    expect(screen.getByRole("link", { name: "All Tasks" })).toHaveFocus();
  });
});
