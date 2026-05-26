import { Navigate, Route, Routes } from "react-router";
import AppShell from "./components/AppShell";
import BoardRoute from "./routes/BoardRoute";
import DashboardRoute from "./routes/DashboardRoute";
import AgentsRoute from "./routes/AgentsRoute";
import NotFoundRoute from "./routes/NotFoundRoute";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route path="/board" element={<BoardRoute />} />
        <Route path="/agents" element={<AgentsRoute />} />
        <Route path="*" element={<NotFoundRoute />} />
      </Route>
    </Routes>
  );
}
