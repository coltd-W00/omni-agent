export interface Project {
  id: string;
  name: string;
  key: string;
  workspacePath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  key: string;
  workspacePath: string;
}

export interface UpdateProjectInput {
  name: string;
  workspacePath: string;
}
