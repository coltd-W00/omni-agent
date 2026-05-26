import { useEffect } from "react";

export interface KeyboardShortcutHandlers {
  onSearch: () => void;
  onNewTask: () => void;
}

export function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  const contentEditable = target.getAttribute("contenteditable");
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable ||
    contentEditable === "true" ||
    contentEditable === ""
  );
}

export function useKeyboardShortcuts({
  onSearch,
  onNewTask,
}: KeyboardShortcutHandlers): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isEditableElement(e.target)) return;

      const isMeta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (isMeta && key === "k") {
        e.preventDefault();
        onSearch();
        return;
      }

      if (isMeta && key === "n") {
        e.preventDefault();
        onNewTask();
        return;
      }

      if (!isMeta && !e.altKey && !e.shiftKey && key === "r") {
        const btn = document.querySelector<HTMLButtonElement>(
          '[data-action="resume-session"]:not([disabled])'
        );
        if (btn) {
          e.preventDefault();
          btn.click();
        }
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onSearch, onNewTask]);
}
