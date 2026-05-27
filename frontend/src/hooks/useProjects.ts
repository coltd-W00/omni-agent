import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "../api/projects";
import type { Project } from "../types/project";
import { useActiveProjectId, useSetActiveProject } from "../features/project/ActiveProjectContext";
import { useToast } from "../components/Toast";
import { ApiError } from "../api/client";

export function useProjectsQuery() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();
  const setActiveProject = useSetActiveProject();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: projectsApi.create,
    onSuccess: (project: Project) => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      setActiveProject(project.id);
      showToast({ tone: "success", message: "Project created" });
    },
    onError: (error: unknown) => {
      if (
        error instanceof ApiError &&
        [
          "project_key_taken",
          "invalid_project_key",
          "invalid_project_name",
          "invalid_workspace_path",
        ].includes(error.code)
      ) {
        // Let caller handle field-level errors (project_key_taken, invalid_project_key)
        return;
      }
      showToast({ tone: "error", message: "Failed to create project" });
    },
  });
}

export function useUpdateProjectMutation() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof projectsApi.update>[1] }) =>
      projectsApi.update(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      showToast({ tone: "success", message: "Project updated" });
    },
    onError: (error: unknown) => {
      if (
        error instanceof ApiError &&
        ["invalid_project_name", "invalid_workspace_path"].includes(error.code)
      ) {
        return;
      }
      showToast({ tone: "error", message: "Failed to update project" });
    },
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();
  const activeProjectId = useActiveProjectId();
  const setActiveProject = useSetActiveProject();
  const { showToast } = useToast();
  type DeleteProjectVariables = { id: string; force?: boolean };

  return useMutation({
    mutationFn: ({ id, force = false }: DeleteProjectVariables) =>
      projectsApi.remove(id, force),
    onSuccess: (_data: void, variables: DeleteProjectVariables) => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      if (variables.id === activeProjectId) {
        // Fallback will happen in useResolvedActiveProject after refetch
        setActiveProject(null);
      }
      showToast({ tone: "success", message: "Project deleted" });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.code === "project_has_tasks") {
        return;
      }
      showToast({ tone: "error", message: "Failed to delete project" });
    },
  });
}

export function useResolvedActiveProject(): Project | null {
  const query = useProjectsQuery();
  const activeProjectId = useActiveProjectId();
  const setActiveProject = useSetActiveProject();

  const resolvedProject = useMemo(() => {
    if (!query.isSuccess || !query.data) return null;

    const projects = query.data;
    if (projects.length === 0) return null;

    if (!activeProjectId) return projects[0];

    return projects.find((p) => p.id === activeProjectId) ?? projects[0];
  }, [activeProjectId, query.data, query.isSuccess]);

  useEffect(() => {
    if (!query.isSuccess || !query.data) return;

    const nextId = resolvedProject?.id ?? null;
    if (activeProjectId !== nextId) {
      setActiveProject(nextId);
    }
  }, [activeProjectId, query.data, query.isSuccess, resolvedProject?.id, setActiveProject]);

  return resolvedProject;
}
