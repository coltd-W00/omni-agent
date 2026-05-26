import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createAgent, deleteAgent, listAgents, testAgent, updateAgent } from "../api/agents";
import type { CreateAgentInput, UpdateAgentInput } from "../types/agent";

export const agentsQueryKey = ["agents"] as const;

export function useAgents() {
  return useQuery({
    queryKey: agentsQueryKey,
    queryFn: listAgents,
  });
}

export function useCreateAgentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAgentInput) => createAgent(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: agentsQueryKey });
    },
  });
}

export function useUpdateAgentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, input }: { name: string; input: UpdateAgentInput }) =>
      updateAgent(name, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: agentsQueryKey });
    },
  });
}

export function useDeleteAgentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => deleteAgent(name),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: agentsQueryKey });
    },
  });
}

export function useTestAgentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => testAgent(name),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: agentsQueryKey });
    },
  });
}
