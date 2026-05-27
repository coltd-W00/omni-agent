import { apiFetch } from "./client";
import type { CreateProjectInput, Project, UpdateProjectInput } from "../types/project";

export const projectsApi = {
  list: () => apiFetch<Project[]>("/projects"),
  create: (input: CreateProjectInput) =>
    apiFetch<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: UpdateProjectInput) =>
    apiFetch<Project>(`/projects/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  remove: (id: string, force = false) =>
    apiFetch<void>(`/projects/${encodeURIComponent(id)}${force ? "?force=true" : ""}`, {
      method: "DELETE",
    }),
};
