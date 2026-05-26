import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getTask } from "../api/tasks";
import type { Task } from "../types/task";

export const taskQueryKey = (projectId: string, taskId: string) =>
  ["task", projectId, taskId] as const;

export function useTask(
  projectId: string | null,
  taskId: string | null,
): UseQueryResult<Task, Error> {
  return useQuery({
    queryKey: taskQueryKey(projectId ?? "", taskId ?? ""),
    queryFn: () => {
      if (!projectId || !taskId) throw new Error("projectId and taskId required");
      return getTask(projectId, taskId);
    },
    enabled: projectId !== null && taskId !== null,
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 5000 : false,
  });
}
