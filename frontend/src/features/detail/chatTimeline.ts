import type { Comment } from "../../types/comment";
import type { Run } from "../../types/run";

export type ChatEvent =
  | {
      kind: "user";
      id: string;
      content: string;
      timestamp: string;
      sent: boolean;
    }
  | {
      kind: "agent";
      id: string;
      content: string;
      timestamp: string;
      phase?: string;
      runNumber: number;
    };

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
  cachedInput: number;
}

export interface ChatTimeline {
  events: ChatEvent[];
  tokenUsage: TokenUsage;
  hasTokenData: boolean;
}

type ParsedLine =
  | {
      type: "agent_message";
      content: string;
      phase?: string;
      timestamp?: string;
    }
  | {
      type: "token_count";
      usage: TokenUsage;
      timestamp?: string;
    }
  | null;

function parseJsonLine(line: string): ParsedLine {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed[0] !== "{") return null;
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (value === null || typeof value !== "object") return null;
  const root = value as Record<string, unknown>;
  if (root.type !== "event_msg") return null;
  const timestamp = typeof root.timestamp === "string" ? root.timestamp : undefined;
  const payload = root.payload;
  if (payload === null || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;

  if (p.type === "agent_message" && typeof p.message === "string") {
    return {
      type: "agent_message",
      content: p.message,
      phase: typeof p.phase === "string" ? p.phase : undefined,
      timestamp,
    };
  }

  if (p.type === "token_count" && p.info && typeof p.info === "object") {
    const info = p.info as Record<string, unknown>;
    const totalUsage = info.total_token_usage;
    if (totalUsage && typeof totalUsage === "object") {
      const u = totalUsage as Record<string, unknown>;
      return {
        type: "token_count",
        usage: {
          input: typeof u.input_tokens === "number" ? u.input_tokens : 0,
          output: typeof u.output_tokens === "number" ? u.output_tokens : 0,
          total: typeof u.total_tokens === "number" ? u.total_tokens : 0,
          cachedInput: typeof u.cached_input_tokens === "number" ? u.cached_input_tokens : 0,
        },
        timestamp,
      };
    }
  }

  return null;
}

interface ParsedRun {
  messages: { content: string; timestamp: string; phase?: string }[];
  tokenUsage: TokenUsage | null;
  rawFallback: string | null;
}

function parseRunLog(run: Run): ParsedRun {
  if (!run.logTail) return { messages: [], tokenUsage: null, rawFallback: null };
  const lines = run.logTail.split("\n");
  const messages: { content: string; timestamp: string; phase?: string }[] = [];
  let tokenUsage: TokenUsage | null = null;
  let parsedAny = false;

  for (const line of lines) {
    const parsed = parseJsonLine(line);
    if (parsed === null) continue;
    parsedAny = true;
    if (parsed.type === "agent_message") {
      messages.push({
        content: parsed.content,
        timestamp: parsed.timestamp ?? run.endedAt ?? run.startedAt,
        phase: parsed.phase,
      });
    } else if (parsed.type === "token_count") {
      // last token_count wins (it's cumulative for the session)
      tokenUsage = parsed.usage;
    }
  }

  const rawFallback = parsedAny ? null : run.logTail.trim() || null;
  return { messages, tokenUsage, rawFallback };
}

export function buildChatTimeline(comments: Comment[], runs: Run[]): ChatTimeline {
  const events: ChatEvent[] = [];

  for (const c of comments) {
    events.push({
      kind: "user",
      id: `comment-${c.id}`,
      content: c.content,
      timestamp: c.createdAt,
      sent: c.sent,
    });
  }

  const runsAsc = [...runs].sort((a, b) => a.runNumber - b.runNumber);
  let aggregated: TokenUsage = { input: 0, output: 0, total: 0, cachedInput: 0 };
  let hasTokenData = false;

  for (const run of runsAsc) {
    const { messages, tokenUsage, rawFallback } = parseRunLog(run);

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      events.push({
        kind: "agent",
        id: `${run.id}-msg-${i}`,
        content: m.content,
        timestamp: m.timestamp,
        phase: m.phase,
        runNumber: run.runNumber,
      });
    }

    if (messages.length === 0 && rawFallback) {
      events.push({
        kind: "agent",
        id: `${run.id}-raw`,
        content: rawFallback,
        timestamp: run.endedAt ?? run.startedAt,
        runNumber: run.runNumber,
      });
    }

    if (tokenUsage) {
      hasTokenData = true;
      // total_token_usage is cumulative across the codex session; take the max
      // so we always reflect the latest observed totals even if a later run truncated logs.
      if (tokenUsage.total > aggregated.total) {
        aggregated = tokenUsage;
      }
    }
  }

  events.sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
    return ta - tb;
  });

  return { events, tokenUsage: aggregated, hasTokenData };
}

export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1)}k`;
  }
  const m = n / 1_000_000;
  return `${m >= 100 ? Math.round(m) : m.toFixed(1)}M`;
}
