import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelSession } from "../api/sessions";

export function useCancelSession(projectId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cancelSession(projectId, taskId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      void qc.invalidateQueries({ queryKey: ["task", projectId, taskId] });
    },
  });
}
