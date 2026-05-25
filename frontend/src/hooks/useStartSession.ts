import { useMutation, useQueryClient } from "@tanstack/react-query";
import { startSession } from "../api/sessions";

export function useStartSession(projectId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => startSession(projectId, taskId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      void qc.invalidateQueries({ queryKey: ["task", projectId, taskId] });
    },
  });
}
