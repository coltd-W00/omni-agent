import { useQuery } from "@tanstack/react-query";
import { listComments } from "../api/comments";

export function useCommentList(projectId: string | null, taskId: string | null) {
  return useQuery({
    queryKey: ["comments", projectId, taskId],
    queryFn: () => listComments(projectId!, taskId!),
    enabled: !!projectId && !!taskId,
  });
}
