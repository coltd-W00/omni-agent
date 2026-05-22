import { apiFetch } from "./client";
import type { Task, TaskAgent, TaskRole } from "../types/task";

export interface CreateTaskInput {
  title: string;
  description: string;
  acceptanceCriteria?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  acceptanceCriteria?: string | null;
}

export interface AssignAgentInput {
  agent: TaskAgent;
  role: TaskRole;
}

export const listTasks = (projectId: string) =>
  apiFetch<Task[]>(`/projects/${encodeURIComponent(projectId)}/tasks`);

export const getTask = (projectId: string, taskId: string) =>
  apiFetch<Task>(
    `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`,
  );

export const createTask = (projectId: string, input: CreateTaskInput) =>
  apiFetch<Task>(`/projects/${encodeURIComponent(projectId)}/tasks`, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateTask = (
  projectId: string,
  taskId: string,
  input: UpdateTaskInput,
) =>
  apiFetch<Task>(
    `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );

export const assignAgent = (
  projectId: string,
  taskId: string,
  input: AssignAgentInput,
) =>
  apiFetch<Task>(
    `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/assign`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

export const deleteTask = (projectId: string, taskId: string) =>
  apiFetch<void>(
    `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "DELETE",
    },
  );
