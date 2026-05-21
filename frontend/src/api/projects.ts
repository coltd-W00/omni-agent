import { apiFetch } from "./client";
import type { CreateProjectInput, Project } from "../types/project";

export const projectsApi = {
  list: () => apiFetch<Project[]>("/projects"),
  create: (input: CreateProjectInput) =>
    apiFetch<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    apiFetch<void>(`/projects/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};
