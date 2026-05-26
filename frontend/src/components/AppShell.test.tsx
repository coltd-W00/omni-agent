import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import AppShell from "./AppShell";
import { ToastProvider } from "./Toast";
import { ActiveProjectProvider } from "../features/project/ActiveProjectContext";
import { mockViewport } from "../test-utils/matchMedia";

function renderAppShell() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ActiveProjectProvider>
          <MemoryRouter initialEntries={["/dashboard"]}>
            <Routes>
              <Route path="/" element={<AppShell />}>
                <Route path="dashboard" element={<div>Dashboard outlet</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </ActiveProjectProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe("AppShell responsive layout", () => {
  it("replaces the shell with mobile fallback below 768px", () => {
    mockViewport(375);

    const { container } = renderAppShell();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "OmniAgent works best on desktop"
    );
    expect(container.querySelector(".app-shell")).toBeNull();
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });

  it("shows topbar hamburger and removes sidebar from flow on tablet", () => {
    mockViewport(900);

    const { container } = renderAppShell();

    const hamburger = container.querySelector(".app-top-bar__hamburger");
    expect(hamburger).not.toBeNull();
    expect(hamburger).toHaveAttribute("aria-label", "Open navigation menu");
    expect(container.querySelector(".app-sidebar")).toBeNull();
    expect(screen.getByRole("main")).toHaveTextContent("Dashboard outlet");
  });

  it("renders the sidebar on desktop", () => {
    mockViewport(1440);

    const { container } = renderAppShell();

    expect(container.querySelector(".app-sidebar")).not.toBeNull();
    expect(container.querySelector(".app-top-bar__hamburger")).toBeNull();
  });
});
