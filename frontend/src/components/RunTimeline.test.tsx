import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import RunTimeline from "./RunTimeline";
import { ToastProvider } from "./Toast";
import type { Run } from "../types/run";
import type { Task } from "../types/task";

const resumeMutate = vi.fn();

vi.mock("../hooks/useResumeSession", () => ({
  useResumeSession: () => ({
    mutate: resumeMutate,
    isPending: false,
  }),
}));

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: "run-1",
    runNumber: 1,
    input: "retry",
    exitCode: 0,
    logPath: "/tmp/run.log",
    logTail: "line 1",
    startedAt: "2026-05-25T10:00:00+00:00",
    endedAt: "2026-05-25T10:05:00+00:00",
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "OMNI-001",
    projectId: "proj-1",
    seq: 1,
    title: "Fix login",
    description: "Desc",
    acceptanceCriteria: null,
    agent: "codex",
    role: "coder",
    status: "paused",
    createdAt: "2026-05-25T10:00:00+00:00",
    updatedAt: "2026-05-25T10:00:00+00:00",
    ...overrides,
  };
}

function renderTimeline(
  run: Run = makeRun(),
  task: Task = makeTask(),
  onViewRawClick = vi.fn(),
) {
  render(
    <ToastProvider>
      <RunTimeline
        run={run}
        task={task}
        projectId="proj-1"
        onViewRawClick={onViewRawClick}
      />
    </ToastProvider>,
  );
  return { onViewRawClick };
}

describe("RunTimeline", () => {
  beforeEach(() => {
    resumeMutate.mockReset();
  });

  it("TT1: completed run renders session start and completed events", () => {
    renderTimeline(makeRun({ exitCode: 0 }));

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Session started")).toBeInTheDocument();
    expect(screen.getByText("Session completed")).toBeInTheDocument();
  });

  it("TT2: failed run renders failed event and suggested action block", () => {
    renderTimeline(makeRun({ exitCode: 1 }));

    expect(screen.getByText("Session failed")).toBeInTheDocument();
    expect(screen.getByText(/This run failed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume Session" })).toBeInTheDocument();
  });

  it("TT3: running run renders live event and polite aria-live", () => {
    renderTimeline(makeRun({ exitCode: null, endedAt: null }));

    expect(screen.getByText("Agent running…")).toBeInTheDocument();
    expect(screen.getByText("Agent running…").closest(".run-timeline")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("TT4: View raw output calls onViewRawClick with run id", () => {
    const onViewRawClick = vi.fn();
    renderTimeline(makeRun({ id: "run-raw" }), makeTask(), onViewRawClick);

    fireEvent.click(screen.getByRole("button", { name: "View raw output →" }));

    expect(onViewRawClick).toHaveBeenCalledWith("run-raw");
  });

  it("TT5: Resume Session calls resume mutation with no comment", () => {
    renderTimeline(makeRun({ exitCode: 1 }));

    fireEvent.click(screen.getByRole("button", { name: "Resume Session" }));

    expect(resumeMutate).toHaveBeenCalledWith(undefined, expect.any(Object));
  });

  it("TT6: cancelled task labels failed exit as cancelled", () => {
    renderTimeline(
      makeRun({ exitCode: 1 }),
      makeTask({ status: "cancelled" }),
    );

    expect(screen.getByText("Session cancelled")).toBeInTheDocument();
    expect(screen.queryByText("Session failed")).not.toBeInTheDocument();
  });
});
