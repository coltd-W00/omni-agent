import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import TaskDetailPage from "./TaskDetailPage";
import type { Project } from "../../types/project";
import type { Run } from "../../types/run";
import type { Task } from "../../types/task";

vi.mock("../../hooks/useRunList", () => ({
  useRunList: vi.fn(),
}));

vi.mock("../../hooks/useCommentList", () => ({
  useCommentList: vi.fn(),
}));

vi.mock("../../hooks/useResumeSession", () => ({
  useResumeSession: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

vi.mock("../../components/Toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

import { useRunList } from "../../hooks/useRunList";
import { useCommentList } from "../../hooks/useCommentList";

const project: Project = {
  id: "proj-1",
  name: "OmniAgent",
  key: "OMNI",
  workspacePath: "/tmp/omni",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const task: Task = {
  id: "OMNI-001",
  projectId: "proj-1",
  seq: 1,
  title: "Implement transcript detail",
  description: "Show the original request and the agent result.",
  acceptanceCriteria: "Terminal transcript is visible.",
  agent: "codex",
  role: "coder",
  status: "completed",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const run: Run = {
  id: "run-1",
  runNumber: 1,
  input: "implement detail screen",
  exitCode: 0,
  logPath: "/tmp/run.log",
  logTail: [
    '{"type":"event_msg","timestamp":"2026-05-27T10:00:00Z","payload":{"type":"agent_message","message":"Implemented terminal transcript.","phase":"final"}}',
    "npm --prefix frontend run build",
  ].join("\n"),
  startedAt: "2026-05-27T09:58:00Z",
  endedAt: "2026-05-27T10:01:00Z",
};

function mockQueries(runs: Run[] = [run]) {
  vi.mocked(useRunList).mockReturnValue({
    data: runs,
    isLoading: false,
    isError: false,
    isPending: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useRunList>);
  vi.mocked(useCommentList).mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    isPending: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useCommentList>);
}

describe("TaskDetailPage", () => {
  it("renders conversation snapshot beside a terminal transcript", () => {
    mockQueries();

    render(
      <MemoryRouter>
        <TaskDetailPage task={task} project={project} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Input and final output")).toHaveTextContent(
      "Show the original request and the agent result.",
    );
    expect(screen.getByLabelText("Input and final output")).toHaveTextContent(
      "Implemented terminal transcript.",
    );
    expect(screen.getByLabelText("Agent terminal transcript")).toHaveTextContent(
      "codex run OMNI-001 --role coder",
    );
    expect(screen.getByLabelText("Agent terminal transcript")).toHaveTextContent(
      "npm --prefix frontend run build",
    );
  });
});
