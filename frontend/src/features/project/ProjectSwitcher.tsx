import "./ProjectSwitcher.css";
import { useEffect, useRef, useState } from "react";
import type { Project } from "../../types/project";
import {
  useProjectsQuery,
  useDeleteProjectMutation,
  useResolvedActiveProject,
} from "../../hooks/useProjects";
import { useSetActiveProject } from "./ActiveProjectContext";
import ConfirmationDialog from "../../components/ConfirmationDialog";
import ProjectIcon from "./ProjectIcon";
import CreateProjectModal from "./CreateProjectModal";
import { ApiError } from "../../api/client";

export default function ProjectSwitcher() {
  const [open, setOpen] = useState(false);
  const [overflowOpenId, setOverflowOpenId] = useState<string | null>(null);
  const [projectPendingDelete, setProjectPendingDelete] = useState<Project | null>(null);
  const [projectPendingEdit, setProjectPendingEdit] = useState<Project | null>(null);
  const [deleteNeedsForce, setDeleteNeedsForce] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const query = useProjectsQuery();
  const activeProject = useResolvedActiveProject();
  const setActiveProject = useSetActiveProject();
  const deleteMutation = useDeleteProjectMutation();

  // Close dropdown on click outside
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setOverflowOpenId(null);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setOverflowOpenId(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleSelectProject = (id: string) => {
    setActiveProject(id);
    setOpen(false);
    setOverflowOpenId(null);
  };

  const handleOverflowClick = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setOverflowOpenId(overflowOpenId === projectId ? null : projectId);
  };

  const handleDeleteClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setOverflowOpenId(null);
    setOpen(false);
    setDeleteNeedsForce(false);
    setProjectPendingDelete(project);
  };

  const handleEditClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setOverflowOpenId(null);
    setOpen(false);
    setProjectPendingEdit(project);
  };

  const handleConfirmDelete = () => {
    if (!projectPendingDelete || deleteMutation.isPending) return;
    deleteMutation.mutate({
      id: projectPendingDelete.id,
      force: deleteNeedsForce,
    }, {
      onSuccess: () => {
        setProjectPendingDelete(null);
        setDeleteNeedsForce(false);
      },
      onError: (error: unknown) => {
        if (error instanceof ApiError && error.code === "project_has_tasks") {
          setDeleteNeedsForce(true);
          return;
        }
        setProjectPendingDelete(null);
        setDeleteNeedsForce(false);
      },
    });
  };

  const triggerLabel = activeProject
    ? `Active project: ${activeProject.name}`
    : "No project — create one";

  return (
    <div className="project-switcher" ref={containerRef}>
      {/* Trigger button */}
      <button
        type="button"
        className="project-switcher__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        onClick={() => setOpen((v) => !v)}
      >
        {activeProject && <ProjectIcon project={activeProject} />}
        <span className="project-switcher__trigger-name">
          {activeProject ? activeProject.name : "No project — create one"}
        </span>
        <span className="project-switcher__chevron" aria-hidden="true">⌄</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="project-switcher__dropdown" role="menu">
          {query.isLoading && (
            <div className="project-switcher__loading">Loading projects…</div>
          )}

          {query.isError && (
            <div className="project-switcher__error">
              Failed to load projects.{" "}
              <button
                type="button"
                className="project-switcher__retry-btn"
                onClick={() => void query.refetch()}
              >
                Try again.
              </button>
            </div>
          )}

          {query.isSuccess && (
            <>
              {query.data.length === 0 ? (
                <div className="project-switcher__empty">
                  No projects yet. Create one to get started.
                </div>
              ) : (
                <ul className="project-switcher__list" role="none">
                  {query.data.map((project) => (
                    <li key={project.id} className="project-switcher__list-item">
                      <button
                        type="button"
                        role="menuitem"
                        className={
                          "project-switcher__item" +
                          (activeProject?.id === project.id
                            ? " project-switcher__item--active"
                            : "")
                        }
                        onClick={() => handleSelectProject(project.id)}
                      >
                        <ProjectIcon project={project} />
                        <span className="project-switcher__item-name">{project.name}</span>
                        <span className="project-switcher__item-key">{project.key}</span>
                      </button>
                      <button
                        type="button"
                        className="project-switcher__overflow-btn"
                        aria-label={`More options for ${project.name}`}
                        aria-haspopup="menu"
                        aria-expanded={overflowOpenId === project.id}
                        onClick={(e) => handleOverflowClick(e, project.id)}
                      >
                        ⋯
                      </button>

                      {overflowOpenId === project.id && (
                        <div className="project-switcher__overflow-menu" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            className="project-switcher__overflow-menu-item"
                            onClick={(e) => handleEditClick(e, project)}
                          >
                            Edit project
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="project-switcher__overflow-menu-item project-switcher__overflow-menu-item--destructive"
                            onClick={(e) => handleDeleteClick(e, project)}
                          >
                            Delete project
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="project-switcher__divider" role="separator" />
            </>
          )}

          <button
            type="button"
            className="project-switcher__new-project-btn"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setShowCreateModal(true);
            }}
          >
            + New Project
          </button>
        </div>
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      <CreateProjectModal
        open={projectPendingEdit !== null}
        project={projectPendingEdit}
        onClose={() => setProjectPendingEdit(null)}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={projectPendingDelete !== null}
        title="Delete project"
        description={
          projectPendingDelete
            ? deleteNeedsForce
              ? `"${projectPendingDelete.name}" has tasks. Delete the project and all related tasks, sessions, runs, and comments? This cannot be undone.`
              : `Are you sure you want to delete "${projectPendingDelete.name}"? This cannot be undone.`
            : ""
        }
        confirmLabel={deleteNeedsForce ? "Delete project and tasks" : "Delete project"}
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setProjectPendingDelete(null);
          setDeleteNeedsForce(false);
        }}
        confirmLoading={deleteMutation.isPending}
      />
    </div>
  );
}
