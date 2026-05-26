import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addComment } from "../api/comments";

export function useAddComment(projectId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => addComment(projectId, taskId, content),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["comments", projectId, taskId] });
    },
  });
}
