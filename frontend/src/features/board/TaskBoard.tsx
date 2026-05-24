import TaskCard from "../../components/TaskCard";
import EmptyState from "../../components/EmptyState";
import Button from "../../components/Button";
import KanbanColumn from "./KanbanColumn";
import { taskToCardProps } from "./taskToCardProps";
import { useTasks } from "../../hooks/useTasks";
import { useResolvedActiveProject } from "../../hooks/useProjects";
import { useTaskDetail } from "../../contexts/TaskDetailContext";
import type { Task } from "../../types/task";
import "./TaskBoard.css";

type BoardStatus = "draft" | "ready" | "assigned" | "running" | "needs-review" | "changes-requested" | "completed" | "failed";

const COLUMNS: ReadonlyArray<{ value: BoardStatus; label: string }> = [
  { value: "draft", label: "Backlog" },
  { value: "ready", label: "Ready" },
  { value: "assigned", label: "Assigned" },
  { value: "running", label: "Running" },
  { value: "needs-review", label: "Needs Review" },
  { value: "changes-requested", label: "Changes Requested" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Blocked" },
];

function groupByStatus(tasks: Task[]): Partial<Record<BoardStatus, Task[]>> {
  const out: Partial<Record<BoardStatus, Task[]>> = {};
  for (const t of tasks) {
    if (t.status === "cancelled" || t.status === "paused") continue;
    const key = t.status as BoardStatus;
    (out[key] ??= []).push(t);
  }
  return out;
}

export default function TaskBoard() {
  const activeProject = useResolvedActiveProject();
  const projectId = activeProject?.id ?? null;
  const { data: tasks, isPending, isError, error, refetch } = useTasks(projectId);
  const { openTask } = useTaskDetail();

  if (activeProject === null) {
    return (
      <section className="task-board task-board--empty" data-testid="board-route" aria-labelledby="task-board-heading">
        <h1 id="task-board-heading" className="visually-hidden">Task Board</h1>
        <EmptyState
          variant="full"
          icon="📁"
          heading="No projects yet"
          description="Create your first project from the sidebar to start tracking tasks."
          ctaLabel="Create your first project"
          onCtaClick={() => {
            document.querySelector<HTMLButtonElement>('[data-testid="project-switcher"]')?.focus();
          }}
        />
      </section>
    );
  }

  if (isPending) {
    return (
      <section className="task-board" data-testid="board-route" aria-labelledby="task-board-heading" aria-busy="true">
        <h1 id="task-board-heading" className="visually-hidden">Task Board</h1>
        <div className="task-board__columns">
          {COLUMNS.map((col) => (
            <KanbanColumn key={col.value} statusValue={col.value} label={col.label} count={0} isRunning={col.value === "running"}>
              <div className="task-card-skeleton" aria-hidden="true" />
              <div className="task-card-skeleton" aria-hidden="true" />
            </KanbanColumn>
          ))}
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="task-board task-board--error" data-testid="board-route" aria-labelledby="task-board-heading">
        <h1 id="task-board-heading" className="visually-hidden">Task Board</h1>
        <div role="alert" className="task-board__error">
          <h2>Couldn't load tasks</h2>
          <p>{error?.message ?? "Unknown error"}</p>
          <Button variant="secondary" size="md" onClick={() => void refetch()}>Try again</Button>
        </div>
      </section>
    );
  }

  const tasksList = tasks ?? [];

  if (tasksList.length === 0) {
    return (
      <section className="task-board task-board--empty" data-testid="board-route" aria-labelledby="task-board-heading">
        <h1 id="task-board-heading" className="visually-hidden">Task Board</h1>
        <EmptyState
          variant="full"
          icon="📋"
          heading="No tasks yet in this project"
          description="Create your first task using the + New Task button in the top bar."
        />
      </section>
    );
  }

  const grouped = groupByStatus(tasksList);

  return (
    <section className="task-board" data-testid="board-route" aria-labelledby="task-board-heading">
      <h1 id="task-board-heading" className="visually-hidden">Task Board</h1>
      <div className="task-board__columns">
        {COLUMNS.map((col) => {
          const colTasks = grouped[col.value] ?? [];
          return (
            <KanbanColumn
              key={col.value}
              statusValue={col.value}
              label={col.label}
              count={colTasks.length}
              isRunning={col.value === "running" && (grouped["running"]?.length ?? 0) > 0}
            >
              {colTasks.length === 0 ? (
                <EmptyState variant="inline" icon="" heading="No tasks here" description="Tasks will appear when they reach this stage." />
              ) : (
                colTasks.map((t) => {
                  const props = taskToCardProps(t, { key: activeProject.key });
                  return (
                    <TaskCard
                      key={t.id}
                      task={props.task}
                      project={props.project}
                      agent={props.agent}
                      sessionState={props.sessionState}
                      commentsCount={props.commentsCount}
                      lastActivity={props.lastActivity}
                      onClick={() => openTask(t, activeProject)}
                    />
                  );
                })
              )}
            </KanbanColumn>
          );
        })}
      </div>
    </section>
  );
}
