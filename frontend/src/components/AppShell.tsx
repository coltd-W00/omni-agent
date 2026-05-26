import { Outlet } from "react-router";
import { useCallback } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import SkipLink from "./SkipLink";
import { TaskDetailProvider } from "../contexts/TaskDetailContext";
import TaskDetailPanel from "../features/detail/TaskDetailPanel";
import {
  SearchOverlayProvider,
  useSearchOverlay,
} from "../contexts/SearchOverlayContext";
import {
  NewTaskModalProvider,
  useNewTaskModal,
} from "../contexts/NewTaskModalContext";
import SearchOverlay from "../features/search/SearchOverlay";
import CreateTaskModal from "./CreateTaskModal";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useActiveProjectId } from "../features/project/ActiveProjectContext";
import { useToast } from "./Toast";
import "./AppShell.css";

function AppShellInner() {
  const { open: searchOpen, openOverlay, closeOverlay } = useSearchOverlay();
  const { open: newTaskOpen, openModal, closeModal } = useNewTaskModal();
  const activeProjectId = useActiveProjectId();
  const { showToast } = useToast();

  const handleNewTask = useCallback(() => {
    if (!activeProjectId) {
      showToast({ tone: "error", message: "Select a project first" });
      return;
    }
    openModal();
  }, [activeProjectId, openModal, showToast]);

  useKeyboardShortcuts({
    onSearch: openOverlay,
    onNewTask: handleNewTask,
  });

  return (
    <div className="app-shell">
      <SkipLink />
      <TopBar />
      <div className="app-shell__body">
        <Sidebar />
        <main
          id="main-content"
          tabIndex={-1}
          className="app-shell__main"
          role="main"
        >
          <Outlet />
        </main>
      </div>
      <TaskDetailPanel />
      <SearchOverlay open={searchOpen} onClose={closeOverlay} />
      <CreateTaskModal
        open={newTaskOpen}
        projectId={activeProjectId}
        onClose={closeModal}
      />
    </div>
  );
}

export default function AppShell() {
  return (
    <TaskDetailProvider>
      <SearchOverlayProvider>
        <NewTaskModalProvider>
          <AppShellInner />
        </NewTaskModalProvider>
      </SearchOverlayProvider>
    </TaskDetailProvider>
  );
}

