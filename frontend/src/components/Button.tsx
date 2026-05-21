import "./Button.css";
import type React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  type?: "button" | "submit" | "reset";
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  type = "button",
  disabled,
  children,
  onClick,
  className,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const classes = [
    "app-button",
    `app-button--${variant}`,
    `app-button--${size}`,
    loading ? "app-button--loading" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-busy={loading ? "true" : undefined}
      onClick={isDisabled ? undefined : onClick}
      {...rest}
    >
      {loading && (
        <span className="app-button__spinner" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
