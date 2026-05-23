import { describe, it, expect } from "vitest";
import { taskToCardProps, formatRelativeTime } from "./taskToCardProps";
import type { Task } from "../../types/task";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "OMNI-001",
    title: "Fix login",
    status: "draft",
    agent: null,
    role: null,
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

const PROJECT = { key: "OMNI" };

describe("taskToCardProps", () => {
  it("task with agent claude and role coder → agent.name=coder, agent.runtime=claude", () => {
    const task = makeTask({ agent: "claude", role: "coder" });
    const result = taskToCardProps(task, PROJECT);
    expect(result.agent.name).toBe("coder");
    expect(result.agent.runtime).toBe("claude");
  });

  it("task with agent codex and role null → agent.name=codex, agent.runtime=codex", () => {
    const task = makeTask({ agent: "codex", role: null });
    const result = taskToCardProps(task, PROJECT);
    expect(result.agent.name).toBe("codex");
    expect(result.agent.runtime).toBe("codex");
  });

  it("task with agent null and role null → agent.name=unassigned, agent.runtime=codex", () => {
    const task = makeTask({ agent: null, role: null });
    const result = taskToCardProps(task, PROJECT);
    expect(result.agent.name).toBe("unassigned");
    expect(result.agent.runtime).toBe("codex");
  });

  it("sessionState is always no-session", () => {
    const result = taskToCardProps(makeTask({ agent: "claude", role: "coder" }), PROJECT);
    expect(result.sessionState).toBe("no-session");
  });

  it("commentsCount is always 0", () => {
    const result = taskToCardProps(makeTask(), PROJECT);
    expect(result.commentsCount).toBe(0);
  });
});

describe("formatRelativeTime", () => {
  it("30s ago → just now", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const iso = "2026-01-01T11:59:30Z";
    expect(formatRelativeTime(iso, now)).toBe("just now");
  });

  it("5 min ago → 5m", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const iso = "2026-01-01T11:55:00Z";
    expect(formatRelativeTime(iso, now)).toBe("5m");
  });

  it("3h ago → 3h", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const iso = "2026-01-01T09:00:00Z";
    expect(formatRelativeTime(iso, now)).toBe("3h");
  });

  it("2 days ago → 2d", () => {
    const now = new Date("2026-01-03T12:00:00Z");
    const iso = "2026-01-01T12:00:00Z";
    expect(formatRelativeTime(iso, now)).toBe("2d");
  });

  it("2 weeks ago → 2w", () => {
    const now = new Date("2026-01-15T12:00:00Z");
    const iso = "2026-01-01T12:00:00Z";
    expect(formatRelativeTime(iso, now)).toBe("2w");
  });

  it("2 months ago → ISO date string YYYY-MM-DD", () => {
    const now = new Date("2026-03-01T12:00:00Z");
    const iso = "2026-01-01T12:00:00Z";
    expect(formatRelativeTime(iso, now)).toBe("2026-01-01");
  });
});
