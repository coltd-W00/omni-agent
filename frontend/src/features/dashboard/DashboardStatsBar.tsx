import type { Task } from "../../types/task";
import {
  countActive,
  countNeedsReview,
  countRunning,
  countCompletedToday,
} from "./taskClassification";
import "./DashboardStatsBar.css";

interface DashboardStatsBarProps {
  tasks: Task[];
  isLoading: boolean;
}

export default function DashboardStatsBar({ tasks, isLoading }: DashboardStatsBarProps) {
  const activeCount = countActive(tasks);
  const needsReviewCount = countNeedsReview(tasks);
  const runningCount = countRunning(tasks);
  const completedTodayCount = countCompletedToday(tasks);

  const stats = [
    { label: "Active Tasks", count: activeCount },
    { label: "Needs Review", count: needsReviewCount },
    { label: "Running Agents", count: runningCount },
    { label: "Completed Today", count: completedTodayCount },
  ];

  return (
    <dl
      className="dashboard-stats-bar"
      aria-busy={isLoading ? "true" : undefined}
      data-testid="dashboard-stats-bar"
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`dashboard-stat-card ${isLoading ? "dashboard-stat-card--loading" : ""}`}
          role="status"
          aria-label={`${stat.label}: ${isLoading ? "Loading" : stat.count}`}
        >
          <dt className="dashboard-stat-card__label">{stat.label}</dt>
          <dd className="dashboard-stat-card__count">
            {isLoading ? "\u2014" : stat.count}
          </dd>
        </div>
      ))}
    </dl>
  );
}
