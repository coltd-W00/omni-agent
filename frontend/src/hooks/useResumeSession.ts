import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resumeSession } from "../api/sessions";

export function useResumeSession(projectId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (comment?: string) => resumeSession(projectId, taskId, comment),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      void qc.invalidateQueries({ queryKey: ["task", projectId, taskId] });
    },
  });
}
