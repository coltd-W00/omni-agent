// TODO(Story 2.x): add Breadcrumb, Search, Notification bell, User avatar (UX-DR9 / UX section 2.3).
import { useState } from "react";
import Button from "./Button";
import CreateTaskModal from "./CreateTaskModal";
import { useActiveProjectId } from "../features/project/ActiveProjectContext";

export default function TopBar() {
  const [open, setOpen] = useState(false);
  const activeProjectId = useActiveProjectId();

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
          onClick={() => setOpen(true)}
        >
          + New Task
        </Button>
      </div>
      <CreateTaskModal
        open={open}
        projectId={activeProjectId}
        onClose={() => setOpen(false)}
      />
    </header>
  );
}
