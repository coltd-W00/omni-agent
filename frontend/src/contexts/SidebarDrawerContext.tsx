import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";

interface SidebarDrawerValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

const SidebarDrawerContext = createContext<SidebarDrawerValue | null>(null);

export function SidebarDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);
  const toggle = useCallback(() => setIsOpen((value) => !value), []);

  return (
    <SidebarDrawerContext.Provider
      value={{ isOpen, open, close, toggle, triggerRef }}
    >
      {children}
    </SidebarDrawerContext.Provider>
  );
}

export function useSidebarDrawer(): SidebarDrawerValue {
  const ctx = useContext(SidebarDrawerContext);
  if (!ctx) {
    throw new Error("useSidebarDrawer must be used within SidebarDrawerProvider");
  }
  return ctx;
}
