// TODO(Story 1.4): replace probe with AppShell (sidebar + topbar + routing).
export default function App() {
  return (
    <main style={{ padding: "var(--space-6)" }}>
      <h1 style={{ color: "var(--brand-primary)", margin: 0 }}>omni-agent</h1>
      <p style={{ color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>
        Frontend scaffold verified. Design tokens loaded from
        <code> styles/tokens.css</code>.
      </p>
      <span
        style={{
          display: "inline-block",
          marginTop: "var(--space-4)",
          padding: "var(--space-1) var(--space-3)",
          borderRadius: "var(--radius-sm)",
          background: "var(--status-running-bg)",
          color: "var(--status-running-text)",
          border: "1px solid var(--status-running-border)",
          fontSize: "var(--font-size-caption)",
        }}
      >
        ● Running (token probe)
      </span>
    </main>
  );
}
