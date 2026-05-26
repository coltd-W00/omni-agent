import { useQuery } from "@tanstack/react-query";
import { listRuns } from "../api/runs";
import type { TaskStatus } from "../types/task";

export function useRunList(
  projectId: string | null,
  taskId: string | null,
  taskStatus: TaskStatus | null,
) {
  return useQuery({
    queryKey: ["runs", projectId, taskId],
    queryFn: () => listRuns(projectId!, taskId!),
    enabled: !!projectId && !!taskId,
    refetchInterval: () => (taskStatus === "running" ? 5000 : false),
  });
}
