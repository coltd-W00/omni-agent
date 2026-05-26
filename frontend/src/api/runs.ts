import { apiFetch } from "./client";
import type { Run } from "../types/run";

export const listRuns = (projectId: string, taskId: string) =>
  apiFetch<Run[]>(
    `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/runs`,
  );

export const getRun = (projectId: string, taskId: string, runId: string) =>
  apiFetch<Run>(
    `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/runs/${encodeURIComponent(runId)}`,
  );
