import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";

interface NewTaskModalContextValue {
  open: boolean;
  openModal: () => void;
  closeModal: () => void;
}

const NewTaskModalContext = createContext<NewTaskModalContextValue | null>(null);

export function NewTaskModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  return (
    <NewTaskModalContext.Provider value={{ open, openModal, closeModal }}>
      {children}
    </NewTaskModalContext.Provider>
  );
}

export function useNewTaskModal() {
  const ctx = useContext(NewTaskModalContext);
  if (!ctx) {
    throw new Error(
      "useNewTaskModal must be used within NewTaskModalProvider"
    );
  }
  return ctx;
}
