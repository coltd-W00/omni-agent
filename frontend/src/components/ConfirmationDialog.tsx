import "./ConfirmationDialog.css";
import { useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import Button from "./Button";

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "destructive" | "primary";
  /**
   * Called when the user clicks Confirm.
   * If this callback throws/rejects, the dialog will NOT auto-close.
   * Caller must call setOpen(false) after successful handling.
   */
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "primary",
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = "app-confirm-dialog-title";
  const descId = "app-confirm-dialog-desc";

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

  // Listen to close event (Esc / backdrop / programmatic) → call onCancel
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onCancel();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onCancel]);

  // JSDOM doesn't implement native Escape → cancel → close flow for <dialog>.
  // Add document-level keydown listener to handle Escape manually.
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

  const dialog = (
    <dialog
      ref={dialogRef}
      className="app-confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
    >
      <h2 id={titleId} className="app-confirm-dialog__title">
        {title}
      </h2>
      {description && (
        <p id={descId} className="app-confirm-dialog__description">
          {description}
        </p>
      )}
      <div className="app-confirm-dialog__footer">
        {/* Cancel is first in DOM order */}
        <Button
          variant="ghost"
          size="md"
          autoFocus
          onClick={() => {
            dialogRef.current?.close();
          }}
        >
          {cancelLabel ?? "Cancel"}
        </Button>
        <Button
          variant={variant === "destructive" ? "destructive" : "primary"}
          size="md"
          onClick={() => {
            void onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );

  return ReactDOM.createPortal(dialog, document.body);
}
