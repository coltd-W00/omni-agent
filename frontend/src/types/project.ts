export interface Project {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  key: string;
}
