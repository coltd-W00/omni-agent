import { Outlet } from "react-router";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import "./AppShell.css";

export default function AppShell() {
  return (
    <div className="app-shell">
      <TopBar />
      <div className="app-shell__body">
        <Sidebar />
        <main className="app-shell__main" role="main">
          <Outlet />
          {/* TODO(Story 2.4): mount Detail Panel slot here */}
        </main>
      </div>
    </div>
  );
}
