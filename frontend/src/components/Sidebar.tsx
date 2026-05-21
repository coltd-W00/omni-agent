// TODO(Story 4.3): collapse sidebar to icon-only at ≤1280px (UX-DR20).
// TODO(Story 2.x): add Inbox, Review Queue, AGENTS section, Settings (UX section 2.2).
import { NavLink } from "react-router";

const itemClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "app-sidebar__item app-sidebar__item--active" : "app-sidebar__item";

export default function Sidebar() {
  return (
    <aside className="app-sidebar" role="navigation" aria-label="Primary">
      <div className="app-sidebar__header">OmniAgent</div>
      <button
        type="button"
        className="app-sidebar__project-switcher"
        data-testid="project-switcher-placeholder"
        disabled
        aria-label="Default Project, coming in Story 2.1"
        title="Coming in Story 2.1"
      >
        Default Project ⌄
      </button>
      <div className="app-sidebar__nav">
        <ul>
          <li>
            <NavLink to="/dashboard" className={itemClass}>
              Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink to="/board" className={itemClass}>
              All Tasks
            </NavLink>
          </li>
        </ul>
      </div>
      <div
        className="app-sidebar__avatar"
        data-testid="user-avatar-placeholder"
        role="img"
        aria-label="User avatar placeholder: L"
      >
        <span className="app-sidebar__avatar-circle" aria-hidden="true">
          L
        </span>
      </div>
    </aside>
  );
}
