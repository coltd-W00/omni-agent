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
import MobileFallback from "./MobileFallback";
import SidebarDrawer from "./SidebarDrawer";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useBreakpoint } from "../hooks/useBreakpoint";
import type { Breakpoint } from "../hooks/useBreakpoint";
import { SidebarDrawerProvider } from "../contexts/SidebarDrawerContext";
import { useTaskDetail } from "../contexts/TaskDetailContext";
import { useActiveProjectId } from "../features/project/ActiveProjectContext";
import { useToast } from "./Toast";
import "./AppShell.css";

function AppShellInner({ breakpoint }: { breakpoint: Breakpoint }) {
  const { open: searchOpen, openOverlay, closeOverlay } = useSearchOverlay();
  const { open: newTaskOpen, openModal, closeModal } = useNewTaskModal();
  const { selectedTask } = useTaskDetail();
  const activeProjectId = useActiveProjectId();
  const { showToast } = useToast();
  const shellClass = [
    "app-shell",
    selectedTask ? "app-shell--detail-open" : "",
    `app-shell--bp-${breakpoint}`,
  ]
    .filter(Boolean)
    .join(" ");

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
    <div className={shellClass}>
      <SkipLink />
      <TopBar />
      <div className="app-shell__body">
        {breakpoint !== "tablet" && <Sidebar />}
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
      {breakpoint === "tablet" && <SidebarDrawer />}
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
  const breakpoint = useBreakpoint();

  if (breakpoint === "mobile") return <MobileFallback />;

  return (
    <SidebarDrawerProvider>
      <TaskDetailProvider>
        <SearchOverlayProvider>
          <NewTaskModalProvider>
            <AppShellInner breakpoint={breakpoint} />
          </NewTaskModalProvider>
        </SearchOverlayProvider>
      </TaskDetailProvider>
    </SidebarDrawerProvider>
  );
}
