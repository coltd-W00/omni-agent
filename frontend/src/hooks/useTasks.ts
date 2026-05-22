import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTask, listTasks } from "../api/tasks";
import type { CreateTaskInput } from "../api/tasks";

export const tasksQueryKey = (projectId: string | null) =>
  ["tasks", projectId] as const;

export function useTasks(projectId: string | null) {
  return useQuery({
    queryKey: tasksQueryKey(projectId),
    queryFn: () => {
      if (!projectId) throw new Error("projectId required");
      return listTasks(projectId);
    },
    enabled: projectId !== null,
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
