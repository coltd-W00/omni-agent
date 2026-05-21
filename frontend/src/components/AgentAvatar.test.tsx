import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import AgentAvatar from "./AgentAvatar";

describe("AgentAvatar", () => {
  it("renders initials from name 'backend-coder' → 'BC'", () => {
    render(<AgentAvatar name="backend-coder" />);
    expect(screen.getByLabelText("backend-coder")).toHaveTextContent("BC");
  });

  it("runtime overlay renders when runtime='codex'", () => {
    const { container } = render(
      <AgentAvatar name="coder" runtime="codex" />,
    );
    const overlay = container.querySelector(
      ".app-agent-avatar__runtime--codex",
    );
    expect(overlay).toBeInTheDocument();
  });

  it("aria-label includes name and runtime label", () => {
    render(<AgentAvatar name="planner" runtime="claude" />);
    expect(
      screen.getByLabelText("planner, runtime: Claude CLI"),
    ).toBeInTheDocument();
  });
});
