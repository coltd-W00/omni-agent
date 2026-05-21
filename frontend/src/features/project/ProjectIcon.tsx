import type { Project } from "../../types/project";

interface ProjectIconProps {
  project: Project;
}

export default function ProjectIcon({ project }: ProjectIconProps) {
  const abbr = project.key.slice(0, 2);
  return (
    <span
      className="project-icon"
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 24,
        height: 24,
        borderRadius: "var(--radius-sm)",
        background: "var(--brand-light)",
        color: "var(--brand-primary)",
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {abbr}
    </span>
  );
}
