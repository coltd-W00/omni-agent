import { Link } from "react-router";

export default function NotFoundRoute() {
  return (
    <section data-testid="not-found-route">
      <h1 style={{ fontSize: "var(--font-size-heading-l)", margin: 0 }}>404 — Page not found</h1>
      <p style={{ color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>
        Route không tồn tại.{" "}
        <Link to="/dashboard" style={{ color: "var(--brand-primary)" }}>
          Quay lại Dashboard
        </Link>
        .
      </p>
    </section>
  );
}
