import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import type { Task } from "../types/task";
import type { Project } from "../types/project";

interface TaskDetailState {
  task: Task | null;
  project: Project | null;
}

interface TaskDetailContextValue {
  selectedTask: Task | null;
  selectedProject: Project | null;
  openTask: (task: Task, project: Project) => void;
  closeTask: () => void;
}

const TaskDetailContext = createContext<TaskDetailContextValue | null>(null);

export function TaskDetailProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TaskDetailState>({ task: null, project: null });

  const openTask = (task: Task, project: Project) => setState({ task, project });
  const closeTask = () => setState({ task: null, project: null });

  return (
    <TaskDetailContext.Provider value={{ selectedTask: state.task, selectedProject: state.project, openTask, closeTask }}>
      {children}
    </TaskDetailContext.Provider>
  );
}

export function useTaskDetail(): TaskDetailContextValue {
  const ctx = useContext(TaskDetailContext);
  if (!ctx) throw new Error("useTaskDetail must be used within TaskDetailProvider");
  return ctx;
}
