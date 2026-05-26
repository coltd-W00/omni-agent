import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import type { Task } from "../types/task";
import type { Project } from "../types/project";

interface TaskDetailState {
  task: Task | null;
  project: Project | null;
  triggeringElement: HTMLElement | null;
}

interface TaskDetailContextValue {
  selectedTask: Task | null;
  selectedProject: Project | null;
  openTask: (
    task: Task,
    project: Project,
    triggeringElement?: HTMLElement
  ) => void;
  closeTask: () => void;
}

const TaskDetailContext = createContext<TaskDetailContextValue | null>(null);

export function TaskDetailProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TaskDetailState>({
    task: null,
    project: null,
    triggeringElement: null,
  });

  const openTask = useCallback(
    (task: Task, project: Project, triggeringElement?: HTMLElement) => {
      const trigger =
        triggeringElement ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null);
      setState({ task, project, triggeringElement: trigger });
    },
    []
  );

  const closeTask = useCallback(() => {
    setState((prev) => {
      if (prev.triggeringElement && prev.triggeringElement.isConnected) {
        const el = prev.triggeringElement;
        setTimeout(() => el.focus(), 0);
      }
      return { task: null, project: null, triggeringElement: null };
    });
  }, []);

  return (
    <TaskDetailContext.Provider
      value={{
        selectedTask: state.task,
        selectedProject: state.project,
        openTask,
        closeTask,
      }}
    >
      {children}
    </TaskDetailContext.Provider>
  );
}


export function useTaskDetail(): TaskDetailContextValue {
  const ctx = useContext(TaskDetailContext);
  if (!ctx) throw new Error("useTaskDetail must be used within TaskDetailProvider");
  return ctx;
}
