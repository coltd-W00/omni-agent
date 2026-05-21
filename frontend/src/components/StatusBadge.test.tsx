import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import StatusBadge from "./StatusBadge";
import type { TaskStatus } from "../types/task";

const ALL_STATUSES: Array<{ status: TaskStatus; label: string }> = [
  { status: "draft", label: "Draft" },
  { status: "ready", label: "Ready" },
  { status: "assigned", label: "Assigned" },
  { status: "running", label: "Running" },
  { status: "needs-review", label: "Needs Review" },
  { status: "changes-requested", label: "Changes Requested" },
  { status: "completed", label: "Completed" },
  { status: "failed", label: "Failed" },
  { status: "cancelled", label: "Cancelled" },
];

describe("StatusBadge", () => {
  it.each(ALL_STATUSES)(
    "renders label and correct class for $status",
    ({ status, label }) => {
      const { container } = render(<StatusBadge status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(container.firstChild).toHaveClass(`app-status-badge--${status}`);
    },
  );

  it.each(ALL_STATUSES)(
    "aria-label contains 'Status: {Label}' for $status",
    ({ status, label }) => {
      const { container } = render(<StatusBadge status={status} />);
      expect(container.firstChild).toHaveAttribute(
        "aria-label",
        `Status: ${label}`,
      );
    },
  );

  it("running variant has pulse class on dot", () => {
    const { container } = render(<StatusBadge status="running" />);
    const dot = container.querySelector(".app-status-badge__dot");
    expect(dot).toHaveClass("app-status-badge__dot--pulse");
  });
});
