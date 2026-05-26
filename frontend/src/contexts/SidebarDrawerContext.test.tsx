import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  SidebarDrawerProvider,
  useSidebarDrawer,
} from "./SidebarDrawerContext";

function Consumer() {
  const { isOpen, open, close, toggle } = useSidebarDrawer();
  return (
    <>
      <span>{isOpen ? "open" : "closed"}</span>
      <button type="button" onClick={open}>Open</button>
      <button type="button" onClick={close}>Close</button>
      <button type="button" onClick={toggle}>Toggle</button>
    </>
  );
}

describe("SidebarDrawerContext", () => {
  it("opens, closes, and toggles drawer state", async () => {
    const user = userEvent.setup();

    render(
      <SidebarDrawerProvider>
        <Consumer />
      </SidebarDrawerProvider>
    );

    expect(screen.getByText("closed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText("open")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByText("closed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Toggle" }));
    expect(screen.getByText("open")).toBeInTheDocument();
  });

  it("throws outside provider", () => {
    expect(() => render(<Consumer />)).toThrow(
      "useSidebarDrawer must be used within SidebarDrawerProvider"
    );
  });
});
