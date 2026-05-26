import { useMutation, useQueryClient } from "@tanstack/react-query";
import { assignAgent } from "../api/tasks";
import type { AssignAgentInput } from "../api/tasks";

export function useAssignAgent(projectId: string | null, taskId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignAgentInput) => {
      if (!projectId || !taskId) throw new Error("projectId and taskId required");
      return assignAgent(projectId, taskId, input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      if (taskId) {
        void qc.invalidateQueries({ queryKey: ["task", projectId, taskId] });
      }
    },
  });
}
