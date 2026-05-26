import { apiFetch } from "./client";

export interface Comment {
  id: string;
  taskId: string;
  content: string;
  sent: boolean;
  createdAt: string;
}

export async function addComment(
  projectId: string,
  taskId: string,
  content: string,
): Promise<Comment> {
  return apiFetch<Comment>(
    `/projects/${projectId}/tasks/${taskId}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ content }),
    },
  );
}
