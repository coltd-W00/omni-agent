import { apiFetch } from "./client";
import type { AgentConfig, AgentTestResult, CreateAgentInput, UpdateAgentInput } from "../types/agent";

export const listAgents = () => apiFetch<AgentConfig[]>("/agents");

export const createAgent = (input: CreateAgentInput) =>
  apiFetch<AgentConfig>("/agents", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateAgent = (name: string, input: UpdateAgentInput) =>
  apiFetch<AgentConfig>(`/agents/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });

export const deleteAgent = (name: string) =>
  apiFetch<void>(`/agents/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });

export const testAgent = (name: string) =>
  apiFetch<AgentTestResult>(`/agents/${encodeURIComponent(name)}/test`, {
    method: "POST",
  });
