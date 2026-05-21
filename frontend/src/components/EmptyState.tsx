import "./EmptyState.css";
import Button from "./Button";

interface EmptyStateProps {
  icon: string;
  heading: string;
  description?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  variant?: "full" | "inline";
}

export default function EmptyState({
  icon,
  heading,
  description,
  ctaLabel,
  onCtaClick,
  variant = "full",
}: EmptyStateProps) {
  if (import.meta.env.DEV && heading === "No data found") {
    console.warn(
      "EmptyState heading should explain why state is empty — see ux-design-specification.md §9.1",
    );
  }

  const showCta = ctaLabel !== undefined && onCtaClick !== undefined;

  if (variant === "inline") {
    return (
      <div className="app-empty-state app-empty-state--inline">
        {icon !== "" && (
          <div className="app-empty-state__icon" aria-hidden="true">
            {icon}
          </div>
        )}
        <div className="app-empty-state__heading">{heading}</div>
        {description && (
          <div className="app-empty-state__description">{description}</div>
        )}
        {showCta && (
          <Button variant="secondary" size="sm" onClick={onCtaClick}>
            {ctaLabel}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="app-empty-state app-empty-state--full">
      <div className="app-empty-state__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="app-empty-state__heading">{heading}</div>
      {description && (
        <div className="app-empty-state__description">{description}</div>
      )}
      {showCta && (
        <Button variant="primary" size="md" onClick={onCtaClick}>
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}
