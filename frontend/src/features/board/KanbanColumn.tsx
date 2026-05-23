import type { ReactNode } from "react";
import "./KanbanColumn.css";

interface KanbanColumnProps {
  statusValue: "draft" | "ready" | "assigned" | "running" | "needs-review" | "changes-requested" | "completed" | "failed";
  label: string;
  count: number;
  isRunning: boolean;
  children: ReactNode;
}

export default function KanbanColumn({ statusValue, label, count, isRunning, children }: KanbanColumnProps) {
  return (
    <section className={`kanban-column kanban-column--${statusValue}`} aria-labelledby={`kanban-${statusValue}-heading`}>
      <header className="kanban-column__header">
        <span
          className={`kanban-column__dot${isRunning ? " kanban-column__dot--pulse" : ""}`}
          aria-hidden="true"
        />
        <h2 id={`kanban-${statusValue}-heading`} className="kanban-column__title">{label}</h2>
        <span className="kanban-column__count" aria-label={`${count} tasks`}>{count}</span>
      </header>
      <div className="kanban-column__body">{children}</div>
    </section>
  );
}
