import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resumeSession } from "../api/sessions";
import type { Task } from "../types/task";

export function useResumeSession(projectId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (comment?: string) => resumeSession(projectId, taskId, comment),
    onMutate: async () => {
      // 1. Cancel any outgoing refetches so they don't overwrite our optimistic update
      await qc.cancelQueries({ queryKey: ["task", projectId, taskId] });
      await qc.cancelQueries({ queryKey: ["tasks", projectId] });

      // 2. Snapshot the previous value
      const prevTask = qc.getQueryData<Task>(["task", projectId, taskId]);
      const prevTasks = qc.getQueryData<Task[]>(["tasks", projectId]);

      // 3. Optimistically update to the new value
      if (prevTask) {
        qc.setQueryData<Task>(["task", projectId, taskId], {
          ...prevTask,
          status: "running",
        });
      }
      if (prevTasks) {
        qc.setQueryData<Task[]>(
          ["tasks", projectId],
          prevTasks.map((t) => (t.id === taskId ? { ...t, status: "running" } : t)),
        );
      }

      // 4. Return context with the snapshots
      return { prevTask, prevTasks };
    },
    onError: (_err, _comment, context) => {
      // Rollback to the previous state
      if (context?.prevTask) {
        qc.setQueryData(["task", projectId, taskId], context.prevTask);
      }
      if (context?.prevTasks) {
        qc.setQueryData(["tasks", projectId], context.prevTasks);
      }
      // Re-sync with server
      void qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      void qc.invalidateQueries({ queryKey: ["task", projectId, taskId] });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      void qc.invalidateQueries({ queryKey: ["task", projectId, taskId] });
      void qc.invalidateQueries({ queryKey: ["runs", projectId, taskId] });
    },
  });
}

