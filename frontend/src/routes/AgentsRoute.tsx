import { useEffect, useState, type FormEvent } from "react";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import { ApiError } from "../api/client";
import {
  useAgents,
  useCreateAgentMutation,
  useDeleteAgentMutation,
  useTestAgentMutation,
  useUpdateAgentMutation,
} from "../hooks/useAgents";
import type { AgentConfig, AgentProtocol } from "../types/agent";
import "./AgentsRoute.css";

function protocolLabel(protocol: AgentProtocol) {
  return protocol === "claude" ? "claude-like" : "codex-like";
}

function AgentCard({ agent }: { agent: AgentConfig }) {
  const updateMutation = useUpdateAgentMutation();
  const deleteMutation = useDeleteAgentMutation();
  const testMutation = useTestAgentMutation();
  const [binary, setBinary] = useState(agent.binary);
  const [protocol, setProtocol] = useState<AgentProtocol>(agent.protocol);
  const [enabled, setEnabled] = useState(agent.enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBinary(agent.binary);
    setProtocol(agent.protocol);
    setEnabled(agent.enabled);
    setError(null);
  }, [agent]);

  const dirty = binary !== agent.binary || protocol !== agent.protocol || enabled !== agent.enabled;
  const canSave = dirty && binary.trim() !== "" && !updateMutation.isPending;

  const handleSave = () => {
    setError(null);
    updateMutation.mutate(
      {
        name: agent.name,
        input: {
          protocol: agent.builtIn ? undefined : protocol,
          binary: binary.trim(),
          enabled,
        },
      },
      {
        onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to save agent"),
      },
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(agent.name, {
      onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to delete agent"),
    });
  };

  return (
    <article className="agents-route__card">
      <div className="agents-route__card-header">
        <div>
          <h2>{agent.name}</h2>
          <span className="agents-route__meta">
            {agent.builtIn ? "Built-in" : "Custom"} · {protocolLabel(agent.protocol)}
          </span>
        </div>
        <label className="agents-route__toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Enabled
        </label>
      </div>

      <label className="agents-route__field">
        Binary path
        <input value={binary} onChange={(event) => setBinary(event.target.value)} />
      </label>

      {!agent.builtIn && (
        <label className="agents-route__field">
          Base protocol
          <select value={protocol} onChange={(event) => setProtocol(event.target.value as AgentProtocol)}>
            <option value="claude">claude-like</option>
            <option value="codex">codex-like</option>
          </select>
        </label>
      )}

      <div className="agents-route__test-result" aria-live="polite">
        {agent.lastTest ? (
          <span className={agent.lastTest.ok ? "agents-route__ok" : "agents-route__error"}>
            {agent.lastTest.ok ? "OK" : "Error"}: {agent.lastTest.message} · {new Date(agent.lastTest.testedAt).toLocaleString()}
          </span>
        ) : (
          <span>Not tested yet</span>
        )}
      </div>

      {error && <p className="agents-route__error" role="alert">{error}</p>}

      <div className="agents-route__actions">
        <Button variant="secondary" onClick={() => testMutation.mutate(agent.name)} loading={testMutation.isPending}>
          Test connection
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={!canSave} loading={updateMutation.isPending}>
          Save
        </Button>
        {!agent.builtIn && (
          <Button variant="destructive" onClick={handleDelete} loading={deleteMutation.isPending}>
            Delete
          </Button>
        )}
      </div>
    </article>
  );
}

function AddAgentCard() {
  const createMutation = useCreateAgentMutation();
  const [name, setName] = useState("");
  const [binary, setBinary] = useState("");
  const [protocol, setProtocol] = useState<AgentProtocol>("claude");
  const [error, setError] = useState<string | null>(null);
  const disabled = !name.trim() || !binary.trim() || createMutation.isPending;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (disabled) return;
    setError(null);
    createMutation.mutate(
      { name: name.trim(), binary: binary.trim(), protocol },
      {
        onSuccess: () => {
          setName("");
          setBinary("");
          setProtocol("claude");
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to add agent"),
      },
    );
  };

  return (
    <form className="agents-route__card agents-route__card--add" onSubmit={handleSubmit}>
      <h2>Add custom agent</h2>
      <label className="agents-route__field">
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="gemini" />
      </label>
      <label className="agents-route__field">
        Base protocol
        <select value={protocol} onChange={(event) => setProtocol(event.target.value as AgentProtocol)}>
          <option value="claude">claude-like</option>
          <option value="codex">codex-like</option>
        </select>
      </label>
      <label className="agents-route__field">
        Binary path
        <input value={binary} onChange={(event) => setBinary(event.target.value)} placeholder="/usr/local/bin/agent" />
      </label>
      {error && <p className="agents-route__error" role="alert">{error}</p>}
      <div className="agents-route__actions">
        <Button type="submit" disabled={disabled} loading={createMutation.isPending}>
          Add agent
        </Button>
      </div>
    </form>
  );
}

export default function AgentsRoute() {
  const agentsQuery = useAgents();

  return (
    <section className="agents-route" aria-labelledby="agents-route-title">
      <div className="agents-route__header">
        <div>
          <h1 id="agents-route-title">Agents</h1>
          <p>Configure runtime binaries, availability, and custom agent protocols.</p>
        </div>
      </div>

      {agentsQuery.isLoading && <EmptyState icon="" heading="Loading agents" description="Reading ~/.omni-agent/config.json" />}
      {agentsQuery.isError && <EmptyState icon="" heading="Could not load agents" description={agentsQuery.error.message} />}
      {agentsQuery.data && (
        <div className="agents-route__grid">
          {agentsQuery.data.map((agent) => <AgentCard key={agent.name} agent={agent} />)}
          <AddAgentCard />
        </div>
      )}
    </section>
  );
}
