import "./CreateTaskModal.css";
import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import Button from "./Button";
import { useToast } from "./Toast";
import { useCreateTask } from "../hooks/useTasks";
import { ApiError } from "../api/client";

interface CreateTaskModalProps {
  open: boolean;
  projectId: string | null;
  onClose: () => void;
}

export default function CreateTaskModal({
  open,
  projectId,
  onClose,
}: CreateTaskModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ac, setAc] = useState("");
  const [errors, setErrors] = useState<{
    title?: string;
    description?: string;
    acceptanceCriteria?: string;
  }>({});

  const createMutation = useCreateTask(projectId);
  const { showToast } = useToast();

  // Sync open prop → showModal / close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setAc("");
      setErrors({});
    }
  }, [open]);

  // Esc + backdrop close → call onClose
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      onClose();
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  // Keyboard Esc handler (jsdom fallback)
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

  const submitDisabled =
    title.trim() === "" ||
    description.trim() === "" ||
    createMutation.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitDisabled) return;
    setErrors({});

    try {
      const task = await createMutation.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        acceptanceCriteria:
          ac.trim() === "" ? undefined : ac.trim(),
      });
      showToast({ tone: "success", message: `Task ${task.id} created` });
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "invalid_task_title") {
          setErrors((prev) => ({ ...prev, title: err.message }));
        } else if (err.code === "invalid_task_description") {
          setErrors((prev) => ({ ...prev, description: err.message }));
        } else if (err.code === "invalid_task_acceptance_criteria") {
          setErrors((prev) => ({
            ...prev,
            acceptanceCriteria: err.message,
          }));
        } else if (err.code === "project_not_found") {
          showToast({
            tone: "error",
            message:
              "Project no longer exists. Please select another project.",
          });
          onClose();
        } else {
          showToast({ tone: "error", message: err.message });
        }
      } else {
        showToast({ tone: "error", message: "Failed to create task" });
      }
    }
  }

  const dialog = (
    <dialog
      ref={dialogRef}
      className="app-create-task-modal"
      aria-modal="true"
      aria-labelledby="create-task-heading"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          dialogRef.current?.close();
        }
      }}
    >
      <h2 id="create-task-heading" className="app-create-task-modal__title">
        Create Task
      </h2>

      <form
        className="app-create-task-modal__form"
        onSubmit={(e) => void handleSubmit(e)}
        aria-labelledby="create-task-heading"
      >
        {/* Title */}
        <div className="app-create-task-modal__field">
          <label
            htmlFor="create-task-title"
            className="app-create-task-modal__label app-create-task-modal__label--required"
          >
            Title
          </label>
          <input
            id="create-task-title"
            type="text"
            className={`app-create-task-modal__input${errors.title ? " app-create-task-modal__input--error" : ""}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() === "") {
                setErrors((prev) => ({
                  ...prev,
                  title: "Task title must be 1–200 characters",
                }));
              } else {
                setErrors((prev) => ({ ...prev, title: undefined }));
              }
            }}
            maxLength={200}
            placeholder="e.g. Fix login redirect"
            autoFocus
          />
          {errors.title ? (
            <span className="app-create-task-modal__error" role="alert">
              {errors.title}
            </span>
          ) : (
            <span className="app-create-task-modal__hint">
              1–200 characters
            </span>
          )}
        </div>

        {/* Description */}
        <div className="app-create-task-modal__field">
          <label
            htmlFor="create-task-description"
            className="app-create-task-modal__label app-create-task-modal__label--required"
          >
            Description
          </label>
          <textarea
            id="create-task-description"
            className={`app-create-task-modal__textarea${errors.description ? " app-create-task-modal__textarea--error" : ""}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              if (description.trim() === "") {
                setErrors((prev) => ({
                  ...prev,
                  description: "Task description must be 1–5000 characters",
                }));
              } else {
                setErrors((prev) => ({ ...prev, description: undefined }));
              }
            }}
            rows={4}
            maxLength={5000}
            placeholder="Describe the task in detail"
          />
          {errors.description ? (
            <span className="app-create-task-modal__error" role="alert">
              {errors.description}
            </span>
          ) : (
            <span className="app-create-task-modal__hint">
              1–5000 characters
            </span>
          )}
        </div>

        {/* Acceptance Criteria (optional) */}
        <div className="app-create-task-modal__field">
          <label
            htmlFor="create-task-ac"
            className="app-create-task-modal__label"
          >
            Acceptance Criteria
          </label>
          <textarea
            id="create-task-ac"
            className={`app-create-task-modal__textarea${errors.acceptanceCriteria ? " app-create-task-modal__textarea--error" : ""}`}
            value={ac}
            onChange={(e) => setAc(e.target.value)}
            rows={3}
            maxLength={5000}
            placeholder="Optional — describe the conditions for completion"
          />
          {errors.acceptanceCriteria ? (
            <span className="app-create-task-modal__error" role="alert">
              {errors.acceptanceCriteria}
            </span>
          ) : (
            <span className="app-create-task-modal__hint">
              Optional — up to 5000 characters
            </span>
          )}
        </div>

        <div className="app-create-task-modal__footer">
          <Button
            variant="ghost"
            size="md"
            type="button"
            onClick={() => dialogRef.current?.close()}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            disabled={submitDisabled}
            loading={createMutation.isPending}
          >
            Create Task
          </Button>
        </div>
      </form>
    </dialog>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return ReactDOM.createPortal(dialog, document.body);
}
