import { useParams, useNavigate } from "react-router";
import { useTask } from "../hooks/useTask";
import { useProjectsQuery } from "../hooks/useProjects";
import TaskDetailPage from "../features/detail/TaskDetailPage";
import EmptyState from "../components/EmptyState";
import Button from "../components/Button";

export default function TaskDetailRoute() {
  const { projectId = "", taskId = "" } = useParams<{ projectId: string; taskId: string }>();
  const navigate = useNavigate();

  const taskQuery = useTask(projectId || null, taskId || null);
  const projectsQuery = useProjectsQuery();

  const project = projectsQuery.data?.find((p) => p.id === projectId) ?? null;

  const isPending = taskQuery.isPending || projectsQuery.isPending;
  const isError = taskQuery.isError || projectsQuery.isError || (!isPending && !project);

  if (isPending) {
    return (
      <div style={{ padding: "var(--space-8)", color: "var(--text-secondary)" }}>
        Loading…
      </div>
    );
  }

  if (isError || !taskQuery.data || !project) {
    return (
      <EmptyState
        variant="full"
        icon=""
        heading="Task not found"
        description="This task doesn't exist or you don't have access to it."
        ctaLabel="Back to board"
        onCtaClick={() => void navigate("/board")}
      />
    );
  }

  return <TaskDetailPage task={taskQuery.data} project={project} />;
}
