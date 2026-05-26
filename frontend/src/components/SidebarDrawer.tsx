import { useEffect, useRef } from "react";
import { NavLink } from "react-router";
import { useSidebarDrawer } from "../contexts/SidebarDrawerContext";
import { useFocusTrap } from "../hooks/useFocusTrap";
import "./SidebarDrawer.css";

const itemClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "app-sidebar-drawer__item app-sidebar-drawer__item--active"
    : "app-sidebar-drawer__item";

export default function SidebarDrawer() {
  const { isOpen, close } = useSidebarDrawer();
  const drawerRef = useRef<HTMLElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  useEffect(() => {
    if (isOpen) firstLinkRef.current?.focus();
  }, [isOpen]);

  useFocusTrap(drawerRef, isOpen);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="app-sidebar-drawer__backdrop"
        aria-hidden="true"
        onClick={close}
        data-testid="drawer-backdrop"
      />
      <aside
        ref={drawerRef}
        className="app-sidebar-drawer"
        role="navigation"
        aria-label="Primary"
        data-testid="sidebar-drawer"
      >
        <div className="app-sidebar-drawer__header">
          <span>OmniAgent</span>
          <button
            type="button"
            className="app-sidebar-drawer__close"
            aria-label="Close navigation menu"
            onClick={close}
          >
            ✕
          </button>
        </div>
        <ul className="app-sidebar-drawer__nav">
          <li>
            <NavLink
              to="/dashboard"
              ref={firstLinkRef}
              className={itemClass}
              onClick={close}
            >
              <span className="app-sidebar-drawer__item-icon" aria-hidden="true">
                📊
              </span>
              <span>Dashboard</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/board" className={itemClass} onClick={close}>
              <span className="app-sidebar-drawer__item-icon" aria-hidden="true">
                📋
              </span>
              <span>All Tasks</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/agents" className={itemClass} onClick={close}>
              <span className="app-sidebar-drawer__item-icon" aria-hidden="true">
                AI
              </span>
              <span>Agents</span>
            </NavLink>
          </li>
        </ul>
      </aside>
    </>
  );
}
