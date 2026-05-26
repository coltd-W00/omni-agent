// TODO(Story 2.x): add Breadcrumb, Search, Notification bell, User avatar (UX-DR9 / UX section 2.3).
import Button from "./Button";
import { useActiveProjectId } from "../features/project/ActiveProjectContext";
import { useNewTaskModal } from "../contexts/NewTaskModalContext";

export default function TopBar() {
  const activeProjectId = useActiveProjectId();
  const { openModal } = useNewTaskModal();

  return (
    <header className="app-top-bar" role="banner">
      <span className="app-top-bar__brand">omni-agent</span>
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

