import { Outlet } from "react-router";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { TaskDetailProvider } from "../contexts/TaskDetailContext";
import TaskDetailPanel from "../features/detail/TaskDetailPanel";
import "./AppShell.css";

export default function AppShell() {
  return (
    <TaskDetailProvider>
      <div className="app-shell">
        <TopBar />
        <div className="app-shell__body">
          <Sidebar />
          <main className="app-shell__main" role="main">
            <Outlet />
          </main>
        </div>
        <TaskDetailPanel />
      </div>
    </TaskDetailProvider>
  );
}
