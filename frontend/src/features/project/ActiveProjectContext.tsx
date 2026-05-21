import React, { createContext, useContext, useState } from "react";

const STORAGE_KEY = "omniAgent.activeProjectId";

interface ActiveProjectContextValue {
  activeProjectId: string | null;
  setActiveProject: (id: string | null) => void;
}

const ActiveProjectContext = createContext<ActiveProjectContextValue | null>(null);

export function ActiveProjectProvider({ children }: { children: React.ReactNode }) {
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const setActiveProject = (id: string | null) => {
    setActiveProjectIdState(id);
    try {
      if (id === null) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, id);
      }
    } catch {
      // localStorage unavailable (e.g. private browsing with strict settings)
    }
  };

  return (
    <ActiveProjectContext.Provider value={{ activeProjectId, setActiveProject }}>
      {children}
    </ActiveProjectContext.Provider>
  );
}

export function useActiveProjectId(): string | null {
  const ctx = useContext(ActiveProjectContext);
  if (!ctx) throw new Error("useActiveProjectId must be used within ActiveProjectProvider");
  return ctx.activeProjectId;
}

export function useSetActiveProject(): (id: string | null) => void {
  const ctx = useContext(ActiveProjectContext);
  if (!ctx) throw new Error("useSetActiveProject must be used within ActiveProjectProvider");
  return ctx.setActiveProject;
}
