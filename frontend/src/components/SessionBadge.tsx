import "./SessionBadge.css";
import type { SessionState } from "../types/session";

interface SessionBadgeProps {
  state: SessionState;
}

const STATE_DISPLAY = {
  "no-session": { label: "─ No session", ariaLabel: "Session: No session" },
  active: { label: "● Active", ariaLabel: "Session: Active" },
  resumable: { label: "↩ Resumable", ariaLabel: "Session: Resumable" },
  closed: { label: "✓ Closed", ariaLabel: "Session: Closed" },
} as const satisfies Record<SessionState, { label: string; ariaLabel: string }>;

export default function SessionBadge({ state }: SessionBadgeProps) {
  const { label, ariaLabel } = STATE_DISPLAY[state];
  const isActive = state === "active";

  return (
    <span
      className={`app-session-badge app-session-badge--${state}`}
      aria-label={ariaLabel}
    >
      {isActive ? (
        <>
          <span className="app-session-badge__dot" aria-hidden="true">
            ●
          </span>
          {" Active"}
        </>
      ) : (
        label
      )}
    </span>
  );
}
