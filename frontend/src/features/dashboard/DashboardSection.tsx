import type { ReactNode } from "react";
import "./DashboardSection.css";

interface DashboardSectionProps {
  slug: string;
  title: string;
  subtitle: string;
  variant: "card-grid" | "compact-list";
  children: ReactNode;
}

export default function DashboardSection({
  slug,
  title,
  subtitle,
  variant,
  children,
}: DashboardSectionProps) {
  return (
    <section
      aria-labelledby={`dashboard-section-${slug}`}
      className={`dashboard-section dashboard-section--${variant}`}
    >
      <header className="dashboard-section__header">
        <h2 id={`dashboard-section-${slug}`} className="dashboard-section__title">
          {title}
        </h2>
        <p className="dashboard-section__subtitle">{subtitle}</p>
      </header>
      <div className="dashboard-section__content">{children}</div>
    </section>
  );
}
