import { useQueries } from "@tanstack/react-query";
import { useProjectsQuery } from "./useProjects";
import { listTasks } from "../api/tasks";
import type { Project } from "../types/project";
import type { Task } from "../types/task";

export interface AggregatedTasksResult {
  tasks: Array<Task & { project: Project }>;
  projects: Project[];
  isPending: boolean;
  isError: boolean;
  hasPartialError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useAggregatedTasks(): AggregatedTasksResult {
  const projectsQuery = useProjectsQuery();
  const projects = projectsQuery.data ?? [];

  const tasksQueries = useQueries({
    queries: projects.map((p) => ({
      queryKey: ["tasks", p.id] as const,
      queryFn: () => listTasks(p.id),
      enabled: projectsQuery.isSuccess,
    })),
  });

  const isPending =
    projectsQuery.isPending ||
    (projectsQuery.isSuccess &&
      tasksQueries.some((q) => q.isPending && q.fetchStatus !== "idle"));

  const allTasksError = tasksQueries.length > 0 && tasksQueries.every((q) => q.isError);
  const isError = projectsQuery.isError || allTasksError;
  const someTasksError = tasksQueries.some((q) => q.isError);
  const hasPartialError = projectsQuery.isSuccess && !allTasksError && someTasksError;
  const error: Error | null =
    (projectsQuery.error as Error | null) ??
    (tasksQueries.find((q) => q.error)?.error as Error | null) ??
    null;

  const tasks: Array<Task & { project: Project }> = [];
  tasksQueries.forEach((q, i) => {
    if (q.data) {
      for (const t of q.data) {
        tasks.push({ ...t, project: projects[i] });
      }
    }
  });

  const refetch = () => {
    if (projectsQuery.isError) {
      void projectsQuery.refetch();
    }
    tasksQueries.forEach((q) => {
      if (q.isError) {
        void q.refetch();
      }
    });
  };

  return {
    tasks,
    projects,
    isPending,
    isError,
    hasPartialError,
    error,
    refetch,
  };
}
