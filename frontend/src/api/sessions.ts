import { apiFetch } from "./client";
import type { StartSessionResponse } from "../types/session";

export const startSession = (projectId: string, taskId: string) =>
  apiFetch<StartSessionResponse>(
    `/projects/${projectId}/tasks/${taskId}/sessions/start`,
    { method: "POST", body: JSON.stringify({}) },
  );
