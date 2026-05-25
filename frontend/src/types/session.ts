export const SessionStatus = {
  None: "none",
  Running: "running",
  Paused: "paused",
  Closed: "closed",
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export interface Session {
  id: string;
  taskId: string;
  agent: "claude" | "codex";
  sessionId: string | null;
  status: SessionStatus;
  createdAt: string;
  lastActive: string;
}

export interface StartSessionResponse {
  sessionPk: string;
  taskId: string;
  sessionId: string | null;
  sessionIdMissing: boolean;
  status: SessionStatus;
  createdAt: string;
}

// Legacy export kept for backward compatibility
export const SessionState = {
  NoSession: "no-session",
  Active: "active",
  Resumable: "resumable",
  Closed: "closed",
} as const;
export type SessionState = (typeof SessionState)[keyof typeof SessionState];
