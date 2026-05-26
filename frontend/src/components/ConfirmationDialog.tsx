import "./ConfirmationDialog.css";
import { useRef, useEffect } from "react";
import type { MouseEvent } from "react";
import ReactDOM from "react-dom";
import Button from "./Button";

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "destructive" | "primary";
  confirmLoading?: boolean;
  confirmDisabled?: boolean;
  /**
   * Called when the user clicks Confirm.
   * If this callback throws/rejects, the dialog will NOT auto-close.
   * Caller must call setOpen(false) after successful handling.
   */
  onConfirm: (event: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "primary",
  confirmLoading = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeReasonRef = useRef<"cancel" | null>(null);
  const titleId = "app-confirm-dialog-title";
  const descId = "app-confirm-dialog-desc";

  const closeAsCancel = () => {
    closeReasonRef.current = "cancel";
    dialogRef.current?.close();
  };

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
      setTimeout(() => headingRef.current?.focus(), 10);
    } else if (!open && dialog.open) {
      closeReasonRef.current = null;
      dialog.close();
      const triggeringElement = triggeringElementRef.current;
      if (triggeringElement && triggeringElement.isConnected) {
        setTimeout(() => triggeringElement.focus(), 0);
      }
      triggeringElementRef.current = null;
    }
  }, [open]);

  // Only user-initiated close actions call onCancel; parent-controlled closes do not.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      if (closeReasonRef.current === "cancel") {
        onCancel();
      }
      closeReasonRef.current = null;
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onCancel]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = () => {
      closeReasonRef.current = "cancel";
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, []);

  // JSDOM doesn't implement native Escape → cancel → close flow for <dialog>.
  // Add document-level keydown listener to handle Escape manually.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeReasonRef.current = "cancel";
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
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeAsCancel();
        }
      }}
    >
      <h2
        ref={headingRef}
        tabIndex={-1}
        id={titleId}
        className="app-confirm-dialog__title"
        style={{ outline: "none" }}
      >
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
          onClick={closeAsCancel}
        >
          {cancelLabel ?? "Cancel"}
        </Button>
        <Button
          variant={variant === "destructive" ? "destructive" : "primary"}
          size="md"
          loading={confirmLoading}
          disabled={confirmDisabled}
          onClick={(event) => {
            void onConfirm(event);
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return ReactDOM.createPortal(dialog, document.body);
}
