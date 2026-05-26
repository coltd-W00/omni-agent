// TODO(Story 2.x): add Breadcrumb, Search, Notification bell, User avatar (UX-DR9 / UX section 2.3).
import Button from "./Button";
import { useActiveProjectId } from "../features/project/ActiveProjectContext";
import { useNewTaskModal } from "../contexts/NewTaskModalContext";
import { useSidebarDrawer } from "../contexts/SidebarDrawerContext";
import { useIsTablet } from "../hooks/useBreakpoint";

export default function TopBar() {
  const activeProjectId = useActiveProjectId();
  const { openModal } = useNewTaskModal();
  const { toggle, triggerRef, isOpen } = useSidebarDrawer();
  const isTablet = useIsTablet();

  return (
    <header className="app-top-bar" role="banner">
      <div className="app-top-bar__leading">
        {isTablet && (
          <button
            type="button"
            ref={triggerRef}
            className="app-top-bar__hamburger"
            aria-label="Open navigation menu"
            aria-expanded={isOpen}
            onClick={toggle}
          >
            ☰
          </button>
        )}
        <span className="app-top-bar__brand">omni-agent</span>
      </div>
      <div className="app-top-bar__actions">
        <Button
          variant="primary"
          size="md"
          disabled={!activeProjectId}
          title={
            activeProjectId ? undefined : "Select a project first"
          }
          onClick={openModal}
        >
          + New Task
        </Button>
      </div>
    </header>
  );
}
