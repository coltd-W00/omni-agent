import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SessionBadge from "./SessionBadge";
import type { SessionState } from "../types/session";

const STATES: Array<{ state: SessionState; label: string; ariaLabel: string }> =
  [
    { state: "no-session", label: "─ No session", ariaLabel: "Session: No session" },
    { state: "active", label: "Active", ariaLabel: "Session: Active" },
    { state: "resumable", label: "↩ Resumable", ariaLabel: "Session: Resumable" },
    { state: "closed", label: "✓ Closed", ariaLabel: "Session: Closed" },
  ];

describe("SessionBadge", () => {
  it.each(STATES)(
    "renders correct label and class for state $state",
    ({ state, label }) => {
      const { container } = render(<SessionBadge state={state} />);
      expect(screen.getByText(label, { exact: false })).toBeInTheDocument();
      expect(container.firstChild).toHaveClass(`app-session-badge--${state}`);
    },
  );

  it.each(STATES)(
    "aria-label contains state for $state",
    ({ state, ariaLabel }) => {
      const { container } = render(<SessionBadge state={state} />);
      expect(container.firstChild).toHaveAttribute("aria-label", ariaLabel);
    },
  );
});
