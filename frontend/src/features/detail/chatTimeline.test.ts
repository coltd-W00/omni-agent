import { describe, it, expect } from "vitest";
import { buildChatTimeline, formatTokens } from "./chatTimeline";
import type { Comment } from "../../types/comment";
import type { Run } from "../../types/run";

function comment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "c1",
    taskId: "OMNI-001",
    content: "hello",
    sent: true,
    createdAt: "2026-05-27T10:00:00Z",
    ...overrides,
  };
}

function run(overrides: Partial<Run> = {}): Run {
  return {
    id: "run-1",
    runNumber: 1,
    input: "retry",
    exitCode: 0,
    logPath: "/tmp/run.log",
    logTail: null,
    startedAt: "2026-05-27T10:00:01Z",
    endedAt: "2026-05-27T10:00:30Z",
    ...overrides,
  };
}

describe("buildChatTimeline", () => {
  it("returns empty timeline when no data", () => {
    const t = buildChatTimeline([], []);
    expect(t.events).toEqual([]);
    expect(t.tokenUsage).toEqual({ input: 0, output: 0, total: 0, cachedInput: 0 });
    expect(t.hasTokenData).toBe(false);
  });

  it("renders user comments as user events", () => {
    const t = buildChatTimeline(
      [comment({ id: "a", content: "Xin chào", sent: true })],
      [],
    );
    expect(t.events).toHaveLength(1);
    expect(t.events[0]).toMatchObject({ kind: "user", content: "Xin chào", sent: true });
  });

  it("parses codex agent_message events from run logTail", () => {
    const log = [
      JSON.stringify({
        timestamp: "2026-05-27T10:00:10Z",
        type: "event_msg",
        payload: { type: "agent_message", message: "Đã xong.", phase: "final_answer" },
      }),
    ].join("\n");

    const t = buildChatTimeline(
      [],
      [run({ id: "r1", runNumber: 1, logTail: log })],
    );
    expect(t.events).toHaveLength(1);
    expect(t.events[0]).toMatchObject({
      kind: "agent",
      content: "Đã xong.",
      phase: "final_answer",
      runNumber: 1,
    });
  });

  it("aggregates token usage from token_count events (max)", () => {
    const log = [
      JSON.stringify({
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: {
              input_tokens: 100,
              output_tokens: 20,
              total_tokens: 120,
              cached_input_tokens: 80,
            },
          },
        },
      }),
      JSON.stringify({
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: {
              input_tokens: 250,
              output_tokens: 40,
              total_tokens: 290,
              cached_input_tokens: 200,
            },
          },
        },
      }),
    ].join("\n");

    const t = buildChatTimeline([], [run({ logTail: log })]);
    expect(t.hasTokenData).toBe(true);
    expect(t.tokenUsage).toEqual({ input: 250, output: 40, total: 290, cachedInput: 200 });
  });

  it("falls back to raw logTail when no JSON events are parseable (e.g. Claude)", () => {
    const t = buildChatTimeline(
      [],
      [run({ id: "r1", runNumber: 1, logTail: "Plain agent output\nover multiple lines" })],
    );
    expect(t.events).toHaveLength(1);
    expect(t.events[0]).toMatchObject({
      kind: "agent",
      content: "Plain agent output\nover multiple lines",
      runNumber: 1,
    });
  });

  it("interleaves comments and agent messages chronologically", () => {
    const log = JSON.stringify({
      timestamp: "2026-05-27T10:00:05Z",
      type: "event_msg",
      payload: { type: "agent_message", message: "Reply A" },
    });
    const t = buildChatTimeline(
      [
        comment({ id: "u1", content: "First", createdAt: "2026-05-27T10:00:00Z" }),
        comment({ id: "u2", content: "Second", createdAt: "2026-05-27T10:00:10Z" }),
      ],
      [run({ id: "r1", runNumber: 1, logTail: log })],
    );
    expect(t.events.map((e) => (e.kind === "user" ? e.content : `[A] ${e.content}`))).toEqual([
      "First",
      "[A] Reply A",
      "Second",
    ]);
  });

  it("ignores non-event_msg lines and malformed JSON", () => {
    const log = [
      "not json at all",
      JSON.stringify({ type: "session_meta", payload: {} }),
      "{not closed",
      JSON.stringify({
        type: "event_msg",
        payload: { type: "agent_message", message: "ok" },
      }),
    ].join("\n");
    const t = buildChatTimeline([], [run({ logTail: log })]);
    expect(t.events).toHaveLength(1);
    expect(t.events[0]).toMatchObject({ kind: "agent", content: "ok" });
  });
});

describe("formatTokens", () => {
  it("formats small numbers as-is", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(999)).toBe("999");
  });

  it("formats thousands with k suffix", () => {
    expect(formatTokens(1000)).toBe("1.0k");
    expect(formatTokens(12500)).toBe("12.5k");
    expect(formatTokens(100_000)).toBe("100k");
  });

  it("formats millions with M suffix", () => {
    expect(formatTokens(1_500_000)).toBe("1.5M");
  });
});
