import { apiFetch } from "./client";
import type { StartSessionResponse } from "../types/session";

export const startSession = (projectId: string, taskId: string) =>
  apiFetch<StartSessionResponse>(
    `/projects/${projectId}/tasks/${taskId}/sessions/start`,
    { method: "POST", body: JSON.stringify({}) },
  );

export interface ResumeSessionResponse {
  sessionPk: string;
  taskId: string;
  sessionId: string;
  status: "running";
  runId: string;
  runNumber: number;
  runInput: string;
  commentId: string | null;
  commentSent: boolean | null;
  startedAt: string;
}

export const resumeSession = (
  projectId: string,
  taskId: string,
  comment?: string,
) => {
  const body: Record<string, string> = {};
  if (comment !== undefined) {
    body.comment = comment;
  }
  return apiFetch<ResumeSessionResponse>(
    `/projects/${projectId}/tasks/${taskId}/sessions/resume`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
};

export const completeSession = (projectId: string, taskId: string) =>
  apiFetch<{ taskId: string; status: string; message: string }>(
    `/projects/${projectId}/tasks/${taskId}/sessions/complete`,
    { method: "POST", body: JSON.stringify({}) },
  );

export const cancelSession = (projectId: string, taskId: string) =>
  apiFetch<{ taskId: string; status: string; message: string }>(
    `/projects/${projectId}/tasks/${taskId}/sessions/cancel`,
    { method: "POST", body: JSON.stringify({}) },
  );
