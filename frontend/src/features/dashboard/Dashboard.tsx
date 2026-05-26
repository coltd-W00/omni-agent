import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useAggregatedTasks } from "../../hooks/useAggregatedTasks";
import { useTaskDetail } from "../../contexts/TaskDetailContext";
import EmptyState from "../../components/EmptyState";
import Button from "../../components/Button";
import DashboardStatsBar from "./DashboardStatsBar";
import DashboardSection from "./DashboardSection";
import NeedsReviewCard from "./NeedsReviewCard";
import FailedBlockedCard from "./FailedBlockedCard";
import RunningSessionCard from "./RunningSessionCard";
import ReadyToAssignRow from "./ReadyToAssignRow";
import CompletedRecentlyRow from "./CompletedRecentlyRow";
import {
  formatDashboardGreeting,
  formatDashboardDate,
  DASHBOARD_GREETING_NAME,
} from "./formatters";
import {
  tasksNeedsYourReview,
  tasksFailedAndBlocked,
  tasksRunningSessions,
  tasksReadyToAssign,
  tasksCompletedRecently,
} from "./taskClassification";
import "./Dashboard.css";

export default function Dashboard() {
  const {
    tasks,
    projects,
    isPending,
    isError,
    hasPartialError,
    error,
    refetch,
  } = useAggregatedTasks();

  const { openTask } = useTaskDetail();
  const navigate = useNavigate();

  // Freezing "now" per render to avoid misalignment in relative times
  const now = useMemo(() => new Date(), []);

  const greeting = formatDashboardGreeting(now);
  const dateStr = formatDashboardDate(now);

  const needsReviewTasks = useMemo(() => tasksNeedsYourReview(tasks), [tasks]);
  const failedTasks = useMemo(() => tasksFailedAndBlocked(tasks), [tasks]);
  const runningTasks = useMemo(() => tasksRunningSessions(tasks), [tasks]);
  const readyTasks = useMemo(() => tasksReadyToAssign(tasks), [tasks]);
  const completedTasks = useMemo(() => tasksCompletedRecently(tasks, now), [tasks, now]);

  const hasAnySection =
    needsReviewTasks.length +
      failedTasks.length +
      runningTasks.length +
      readyTasks.length +
      completedTasks.length >
    0;

  const subtitleHelper = (count: number, singular: string, plural: string) => {
    return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
  };

  // Loading State
  if (isPending) {
    return (
      <section
        data-testid="dashboard-route"
        aria-busy="true"
        aria-labelledby="dashboard-heading"
        className="dashboard dashboard--loading"
      >
        <header className="dashboard__header">
          <h1 id="dashboard-heading" className="dashboard__header-greeting">
            {greeting}, {DASHBOARD_GREETING_NAME} 👋
          </h1>
          <p className="dashboard__header-date">{dateStr}</p>
        </header>

        <DashboardStatsBar tasks={[]} isLoading={true} />

        <div className="dashboard__sections">
          {[1, 2, 3].map((i) => (
            <div key={i} className="dashboard-skeleton-section">
              <div className="dashboard-skeleton-section__header">
                <div className="dashboard-skeleton-section__title" />
                <div className="dashboard-skeleton-section__subtitle" />
              </div>
              <div className="dashboard-skeleton-section__content">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="dashboard-skeleton-card" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Error State
  if (isError) {
    return (
      <section
        data-testid="dashboard-route"
        aria-labelledby="dashboard-error-heading"
        className="dashboard dashboard--error"
      >
        <div role="alert" className="dashboard__error-container">
          <h1 id="dashboard-error-heading" className="dashboard__error-title">
            Couldn't load dashboard
          </h1>
          <p className="dashboard__error-message">{error?.message || "An unknown error occurred"}</p>
          <Button variant="secondary" onClick={refetch}>
            Try again
          </Button>
        </div>
      </section>
    );
  }

  // No Projects State
  if (projects.length === 0) {
    return (
      <section
        data-testid="dashboard-route"
        aria-labelledby="dashboard-heading"
        className="dashboard dashboard--empty"
      >
        <h1 id="dashboard-heading" className="visually-hidden">
          Dashboard
        </h1>
        <EmptyState
          variant="full"
          icon="📁"
          heading="No projects yet"
          description="Create your first project from the sidebar to start tracking tasks."
          ctaLabel="Create your first project"
          onCtaClick={() => {
            document.querySelector<HTMLButtonElement>('[data-testid="project-switcher"]')?.focus();
          }}
        />
      </section>
    );
  }

  // Happy Path
  return (
    <section
      data-testid="dashboard-route"
      aria-labelledby="dashboard-heading"
      className="dashboard"
    >
      <header className="dashboard__header">
        <h1 id="dashboard-heading" className="dashboard__header-greeting">
          {greeting}, {DASHBOARD_GREETING_NAME} 👋
        </h1>
        <p className="dashboard__header-date">{dateStr}</p>
      </header>

      {hasPartialError && (
        <div role="status" className="dashboard__partial-error-banner">
          <span>Some projects' tasks couldn't be loaded &mdash; try again</span>
          <Button variant="secondary" size="sm" onClick={refetch}>
            Try again
          </Button>
        </div>
      )}

      <DashboardStatsBar tasks={tasks} isLoading={false} />

      {!hasAnySection ? (
        <div className="dashboard__empty-state">
          <EmptyState
            variant="full"
            icon="🎉"
            heading="You're all caught up!"
            description="No tasks need your attention right now."
            ctaLabel="Go to Board"
            onCtaClick={() => navigate("/board")}
          />
        </div>
      ) : (
        <div className="dashboard__sections">
          {/* Section 1: Needs Your Review */}
          {needsReviewTasks.length > 0 && (
            <DashboardSection
              slug="needs-review"
              title="Needs Your Review"
              subtitle={subtitleHelper(
                needsReviewTasks.length,
                "task waiting for your decision",
                "tasks waiting for your decision"
              )}
              variant="card-grid"
            >
              {needsReviewTasks.map((t) => (
                <NeedsReviewCard
                  key={t.id}
                  task={t}
                  onOpen={() => openTask(t, t.project)}
                  onDismiss={() => {
                    /* TODO(epic-5): wire dismissal */
                  }}
                />
              ))}
            </DashboardSection>
          )}

          {/* Section 2: Failed & Blocked */}
          {failedTasks.length > 0 && (
            <DashboardSection
              slug="failed-blocked"
              title="Failed & Blocked"
              subtitle={subtitleHelper(
                failedTasks.length,
                "task needs attention",
                "tasks need attention"
              )}
              variant="card-grid"
            >
              {failedTasks.map((t) => (
                <FailedBlockedCard
                  key={t.id}
                  task={t}
                  onResume={() => openTask(t, t.project)}
                  onViewDetails={() => openTask(t, t.project)}
                />
              ))}
            </DashboardSection>
          )}

          {/* Section 3: Running Sessions */}
          {runningTasks.length > 0 && (
            <DashboardSection
              slug="running-sessions"
              title="Running Sessions"
              subtitle={subtitleHelper(
                runningTasks.length,
                "session active",
                "sessions active"
              )}
              variant="card-grid"
            >
              {runningTasks.map((t) => (
                <RunningSessionCard
                  key={t.id}
                  task={t}
                  onViewProgress={() => openTask(t, t.project)}
                />
              ))}
            </DashboardSection>
          )}

          {/* Section 4: Ready to Assign */}
          {readyTasks.length > 0 && (
            <DashboardSection
              slug="ready-to-assign"
              title="Ready to Assign"
              subtitle={subtitleHelper(
                readyTasks.length,
                "task ready to assign",
                "tasks ready to assign"
              )}
              variant="compact-list"
            >
              <ul role="list" className="dashboard__list-container">
                {readyTasks.map((t) => (
                  <li key={t.id}>
                    <ReadyToAssignRow
                      task={t}
                      onAssign={() => openTask(t, t.project)}
                    />
                  </li>
                ))}
              </ul>
            </DashboardSection>
          )}

          {/* Section: Recent Agent Activity — defer until runs API (Story 3.4) merged */}

          {/* Section 6: Completed Recently */}
          {completedTasks.length > 0 && (
            <DashboardSection
              slug="completed-recently"
              title="Completed Recently"
              subtitle={subtitleHelper(
                completedTasks.length,
                "task completed in last 24h",
                "tasks completed in last 24h"
              )}
              variant="compact-list"
            >
              <ul role="list" className="dashboard__list-container">
                {completedTasks.map((t) => (
                  <li key={t.id} role="listitem">
                    <CompletedRecentlyRow
                      task={t}
                      onOpen={() => openTask(t, t.project)}
                    />
                  </li>
                ))}
              </ul>
            </DashboardSection>
          )}
        </div>
      )}
    </section>
  );
}
