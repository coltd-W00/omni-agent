import { useEffect, useRef, useState, useMemo } from "react";
import ReactDOM from "react-dom";
import { useAggregatedTasks } from "../../hooks/useAggregatedTasks";
import { useTaskDetail } from "../../contexts/TaskDetailContext";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import type { Task } from "../../types/task";
import type { Project } from "../../types/project";
import "./SearchOverlay.css";

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

type TaskWithProject = Task & { project: Project };

export default function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggeringElementRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { tasks } = useAggregatedTasks();
  const { openTask } = useTaskDetail();

  // Filter tasks based on query
  const results = useMemo<TaskWithProject[]>(() => {
    const q = query.trim().toLowerCase();
    if (q === "") {
      // If empty query, show 5 most recently updated tasks
      return [...tasks]
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
        .slice(0, 5);
    }
    return tasks
      .filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          t.project.name.toLowerCase().includes(q)
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      .slice(0, 10);
  }, [tasks, query]);

  // Sync open prop → showModal / close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      triggeringElementRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialog.showModal();
      setQuery("");
      setSelectedIndex(0);
    } else if (!open && dialog.open) {
      dialog.close();
      const triggeringElement = triggeringElementRef.current;
      if (triggeringElement && triggeringElement.isConnected) {
        setTimeout(() => triggeringElement.focus(), 0);
      }
      triggeringElementRef.current = null;
    }
  }, [open]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(results.length > 0 ? 0 : -1);
  }, [results]);

  // Listen for native close event (Esc / backdrop) → call onClose
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  // Escape keydown listener (JSDOM fallback)
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dialogRef.current?.close();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleSelectResult = (item: TaskWithProject) => {
    openTask(item, item.project);
    dialogRef.current?.close();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && selectedIndex >= 0 && results[selectedIndex]) {
      e.preventDefault();
      handleSelectResult(results[selectedIndex]);
    }
  };

  const dialog = (
    <dialog
      ref={dialogRef}
      className="app-search-overlay"
      aria-modal="true"
      aria-labelledby="search-heading"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          dialogRef.current?.close();
        }
      }}
      data-testid="search-overlay"
    >
      <h2 id="search-heading" className="visually-hidden">
        Search Tasks
      </h2>

      <div className="app-search-overlay__header">
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Search tasks, agents, sessions…"
          aria-label="Search tasks"
          className="app-search-overlay__input"
        />
      </div>

      <div className="app-search-overlay__content">
        {results.length > 0 ? (
          <ul role="listbox" className="app-search-overlay__results">
            {results.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <li
                  key={item.id}
                  role="option"
                  aria-selected={isSelected}
                  className={`app-search-overlay__result${
                    isSelected ? " app-search-overlay__result--selected" : ""
                  }`}
                  onClick={() => handleSelectResult(item)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectResult(item);
                    }
                  }}
                >
                  <div className="app-search-overlay__task-header">
                    <span className="app-search-overlay__task-id">
                      {item.id}
                    </span>
                    <span className="app-search-overlay__task-title">
                      {item.title}
                    </span>
                  </div>
                  <div className="app-search-overlay__task-meta">
                    <span className="app-search-overlay__project-tag">
                      {item.project.name}
                    </span>
                    <span className="app-search-overlay__divider">•</span>
                    <StatusBadge status={item.status} size="sm" />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            variant="inline"
            icon="🔍"
            heading={`No matches for "${query}"`}
            description="Try checking the spelling or search with different keywords."
          />
        )}
      </div>
    </dialog>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return ReactDOM.createPortal(dialog, document.body);
}
