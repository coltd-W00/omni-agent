import { useMutation, useQueryClient } from "@tanstack/react-query";
import { completeSession } from "../api/sessions";

export function useCompleteSession(projectId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => completeSession(projectId, taskId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      void qc.invalidateQueries({ queryKey: ["task", projectId, taskId] });
    },
  });
}
