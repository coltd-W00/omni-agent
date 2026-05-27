import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createTask, deleteTask, listTasks } from "../api/tasks";
import type { CreateTaskInput } from "../api/tasks";
import type { Task } from "../types/task";
import { taskQueryKey } from "./useTask";

export const tasksQueryKey = (projectId: string | null) =>
  ["tasks", projectId] as const;

export function useTasks(projectId: string | null): UseQueryResult<Task[], Error> {
  return useQuery({
    queryKey: tasksQueryKey(projectId),
    queryFn: () => {
      if (!projectId) throw new Error("projectId required");
      return listTasks(projectId);
    },
    enabled: projectId !== null,
    refetchInterval: (query) => {
      const tasks = query.state.data ?? [];
      const hasRunning = tasks.some((t) => t.status === "running");
      return hasRunning ? 5000 : false;
    },
  });
}

export function useCreateTask(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => {
      if (!projectId) throw new Error("projectId required");
      return createTask(projectId, input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tasksQueryKey(projectId) });
    },
  });
}

export function useDeleteTask(projectId: string | null, taskId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!projectId || !taskId) throw new Error("projectId and taskId required");
      return deleteTask(projectId, taskId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tasksQueryKey(projectId) });
      if (projectId && taskId) {
        void qc.invalidateQueries({ queryKey: taskQueryKey(projectId, taskId) });
      }
    },
  });
}
