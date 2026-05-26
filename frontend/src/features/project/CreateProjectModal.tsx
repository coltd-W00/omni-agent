import "./CreateProjectModal.css";
import { useEffect, useRef, useState } from "react";
import Button from "../../components/Button";
import { useCreateProjectMutation } from "../../hooks/useProjects";
import { ApiError } from "../../api/client";

const KEY_REGEX = /^[A-Z][A-Z0-9]{1,7}$/;

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateProjectModal({ open, onClose }: CreateProjectModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  const mutation = useCreateProjectMutation();

  const triggeringElementRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

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
      // Reset form state
      setName("");
      setKey("");
      setNameError(null);
      setKeyError(null);
      // Focus heading
      setTimeout(() => headingRef.current?.focus(), 10);
    } else if (!open && dialog.open) {
      dialog.close();
      const triggeringElement = triggeringElementRef.current;
      if (triggeringElement && triggeringElement.isConnected) {
        setTimeout(() => triggeringElement.focus(), 0);
      }
      triggeringElementRef.current = null;
    }
  }, [open]);

  // Listen for native close event (Esc / backdrop) → call onClose
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  const validateName = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return "Name is required";
    if (trimmed.length > 80) return "Name must be 1–80 characters";
    return null;
  };

  const validateKey = (value: string): string | null => {
    if (!KEY_REGEX.test(value)) {
      return "Key must be uppercase letters and digits, 2–8 characters";
    }
    return null;
  };

  const handleNameBlur = () => setNameError(validateName(name));
  const handleKeyBlur = () => setKeyError(validateKey(key));

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const upper = e.target.value.toUpperCase();
    setKey(upper);
    // Clear error while typing (re-validate on blur)
    if (keyError) setKeyError(null);
  };

  const hasErrors = !!nameError || !!keyError;
  const isEmpty = !name.trim() || !key;
  const isSubmitDisabled = hasErrors || isEmpty || mutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Final validation before submit
    const ne = validateName(name);
    const ke = validateKey(key);
    setNameError(ne);
    setKeyError(ke);
    if (ne || ke) return;

    mutation.mutate(
      { name: name.trim(), key },
      {
        onSuccess: () => {
          dialogRef.current?.close();
        },
        onError: (error: unknown) => {
          if (error instanceof ApiError) {
            if (error.code === "project_key_taken") {
              setKeyError("Project key already in use");
            } else if (error.code === "invalid_project_key") {
              setKeyError(error.message);
            } else if (error.code === "invalid_project_name") {
              setNameError(error.message);
            }
          }
        },
      },
    );
  };

  return (
    <dialog
      ref={dialogRef}
      className="create-project-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          dialogRef.current?.close();
        }
      }}
    >
      <h2
        ref={headingRef}
        tabIndex={-1}
        id="create-project-title"
        className="create-project-modal__title"
        style={{ outline: "none" }}
      >
        Create new project
      </h2>

      <form onSubmit={handleSubmit} noValidate>
        {/* Name field */}
        <div className="create-project-modal__field">
          <label className="create-project-modal__label" htmlFor="project-name">
            Name
          </label>
          <input
            ref={nameRef}
            id="project-name"
            type="text"
            className={
              "create-project-modal__input" +
              (nameError ? " create-project-modal__input--error" : "")
            }
            placeholder="OmniAgent Core"
            value={name}
            maxLength={80}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError(null);
            }}
            onBlur={handleNameBlur}
            aria-describedby={nameError ? "project-name-error" : undefined}
            aria-invalid={nameError ? "true" : undefined}
            required
          />
          {nameError && (
            <span id="project-name-error" className="create-project-modal__error" role="alert">
              {nameError}
            </span>
          )}
        </div>

        {/* Key field */}
        <div className="create-project-modal__field">
          <label className="create-project-modal__label" htmlFor="project-key">
            Key
          </label>
          <input
            id="project-key"
            type="text"
            className={
              "create-project-modal__input" +
              (keyError ? " create-project-modal__input--error" : "")
            }
            placeholder="OMNI"
            value={key}
            maxLength={8}
            onChange={handleKeyChange}
            onBlur={handleKeyBlur}
            aria-describedby={keyError ? "project-key-error" : "project-key-hint"}
            aria-invalid={keyError ? "true" : undefined}
            required
          />
          {keyError ? (
            <span id="project-key-error" className="create-project-modal__error" role="alert">
              {keyError}
            </span>
          ) : (
            <span id="project-key-hint" className="create-project-modal__hint">
              2–8 ký tự, chữ hoa và số
            </span>
          )}
        </div>

        <div className="create-project-modal__footer">
          <Button
            type="button"
            variant="ghost"
            onClick={() => dialogRef.current?.close()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={mutation.isPending}
            disabled={isSubmitDisabled}
          >
            Create project
          </Button>
        </div>
      </form>
    </dialog>
  );
}
