export const SessionState = {
  NoSession: "no-session",
  Active: "active",
  Resumable: "resumable",
  Closed: "closed",
} as const;
export type SessionState = (typeof SessionState)[keyof typeof SessionState];
