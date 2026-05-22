import "./ProjectIcon.css";
import type { Project } from "../../types/project";

interface ProjectIconProps {
  project: Project;
}

export default function ProjectIcon({ project }: ProjectIconProps) {
  const abbr = project.key.slice(0, 2);
  return (
    <span className="project-icon" aria-hidden="true">
      {abbr}
    </span>
  );
}
