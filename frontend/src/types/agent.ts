export type AgentProtocol = "claude" | "codex";

export interface AgentTestResult {
  ok: boolean;
  message: string;
  testedAt: string;
}

export interface AgentConfig {
  name: string;
  protocol: AgentProtocol;
  binary: string;
  enabled: boolean;
  builtIn: boolean;
  lastTest?: AgentTestResult;
}

export interface CreateAgentInput {
  name: string;
  protocol: AgentProtocol;
  binary: string;
}

export interface UpdateAgentInput {
  protocol?: AgentProtocol;
  binary: string;
  enabled: boolean;
}
