// TODO(Story 2.x): add Inbox, Review Queue, AGENTS section, Settings (UX section 2.2).
import { NavLink } from "react-router";
import ProjectSwitcher from "../features/project/ProjectSwitcher";

const itemClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "app-sidebar__item app-sidebar__item--active" : "app-sidebar__item";

export default function Sidebar() {
  return (
    <aside className="app-sidebar" role="navigation" aria-label="Primary">
      <div className="app-sidebar__header">OmniAgent</div>
      <ProjectSwitcher />
      <div className="app-sidebar__nav">
        <ul>
          <li>
            <NavLink to="/dashboard" className={itemClass} title="Dashboard">
              <span className="app-sidebar__item-icon" aria-hidden="true">
                📊
              </span>
              <span className="app-sidebar__item-label">Dashboard</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/board" className={itemClass} title="All Tasks">
              <span className="app-sidebar__item-icon" aria-hidden="true">
                📋
              </span>
              <span className="app-sidebar__item-label">All Tasks</span>
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
