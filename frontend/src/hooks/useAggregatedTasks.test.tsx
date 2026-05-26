import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAggregatedTasks } from "./useAggregatedTasks";
import type { ReactNode } from "react";

// Mock API clients
vi.mock("../api/tasks", () => ({
  listTasks: vi.fn(),
}));

vi.mock("../api/projects", () => ({
  projectsApi: {
    list: vi.fn(),
  },
}));

import { listTasks } from "../api/tasks";
import { projectsApi } from "../api/projects";

const mockListTasks = vi.mocked(listTasks);
const mockProjectsList = vi.mocked(projectsApi.list);

describe("useAggregatedTasks", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.resetAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("should aggregate tasks across multiple projects successfully", async () => {
    const projects = [
      { id: "p1", name: "Project 1", key: "P1", createdAt: "", updatedAt: "" },
      { id: "p2", name: "Project 2", key: "P2", createdAt: "", updatedAt: "" },
    ];
    const tasksP1 = [
      { id: "t1", projectId: "p1", seq: 1, title: "T1", description: "", acceptanceCriteria: null, agent: null, role: null, status: "ready" as const, createdAt: "", updatedAt: "" },
    ];
    const tasksP2 = [
      { id: "t2", projectId: "p2", seq: 2, title: "T2", description: "", acceptanceCriteria: null, agent: null, role: null, status: "completed" as const, createdAt: "", updatedAt: "" },
    ];

    mockProjectsList.mockResolvedValue(projects);
    mockListTasks.mockImplementation((projectId) => {
      if (projectId === "p1") return Promise.resolve(tasksP1);
      if (projectId === "p2") return Promise.resolve(tasksP2);
      return Promise.resolve([]);
    });

    const { result } = renderHook(() => useAggregatedTasks(), { wrapper });

    // Wait for projects query and then tasks queries to resolve
    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.isError).toBe(false);
    expect(result.current.hasPartialError).toBe(false);
    expect(result.current.projects).toEqual(projects);
    expect(result.current.tasks).toHaveLength(2);
    expect(result.current.tasks[0]).toEqual({ ...tasksP1[0], project: projects[0] });
    expect(result.current.tasks[1]).toEqual({ ...tasksP2[0], project: projects[1] });
  });

  it("should report partial error when some projects fail to fetch tasks", async () => {
    const projects = [
      { id: "p1", name: "Project 1", key: "P1", createdAt: "", updatedAt: "" },
      { id: "p2", name: "Project 2", key: "P2", createdAt: "", updatedAt: "" },
    ];
    const tasksP1 = [
      { id: "t1", projectId: "p1", seq: 1, title: "T1", description: "", acceptanceCriteria: null, agent: null, role: null, status: "ready" as const, createdAt: "", updatedAt: "" },
    ];

    mockProjectsList.mockResolvedValue(projects);
    mockListTasks.mockImplementation((projectId) => {
      if (projectId === "p1") return Promise.resolve(tasksP1);
      if (projectId === "p2") return Promise.reject(new Error("Failed to fetch p2"));
      return Promise.resolve([]);
    });

    const { result } = renderHook(() => useAggregatedTasks(), { wrapper });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.isError).toBe(false);
    expect(result.current.hasPartialError).toBe(true);
    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0]).toEqual({ ...tasksP1[0], project: projects[0] });
  });

  it("should report full error when projects list fails to fetch", async () => {
    mockProjectsList.mockRejectedValue(new Error("Network Error"));

    const { result } = renderHook(() => useAggregatedTasks(), { wrapper });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error?.message).toBe("Network Error");
  });
});
