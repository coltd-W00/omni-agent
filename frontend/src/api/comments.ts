import { apiFetch } from "./client";
import type { Comment } from "../types/comment";

export const listComments = (projectId: string, taskId: string) =>
  apiFetch<Comment[]>(
    `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/comments`,
  );

export async function addComment(
  projectId: string,
  taskId: string,
  content: string,
): Promise<Comment> {
  return apiFetch<Comment>(
    `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ content }),
    },
  );
}
