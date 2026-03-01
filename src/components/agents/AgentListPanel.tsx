import { useState, useEffect } from "react";
import { useAgentStore } from "../../stores/agentStore";

export function AgentListPanel() {
  const { agents, isLoading, loadAgents, registerAgent, deactivateAgent } = useAgentStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleRegister = async () => {
    if (!name.trim()) return;
    await registerAgent(name.trim(), description.trim() || undefined);
    setName("");
    setDescription("");
    setShowForm(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] uppercase tracking-wider text-bear-text-muted font-medium">
          Agents
        </h3>
        <button
          data-testid="agent-register-toggle-btn"
          onClick={() => setShowForm(!showForm)}
          className="text-[12px] text-bear-accent hover:underline"
        >
          {showForm ? "Cancel" : "+ Register"}
        </button>
      </div>

      {showForm && (
        <div data-testid="agent-register-form" className="flex flex-col gap-2 p-3 bg-bear-hover rounded-lg">
          <input
            data-testid="agent-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Agent name (e.g. research-bot)"
            className="bg-bear-bg border border-bear-border rounded px-2 py-1.5 text-[13px] text-bear-text outline-none"
          />
          <input
            data-testid="agent-description-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="bg-bear-bg border border-bear-border rounded px-2 py-1.5 text-[13px] text-bear-text outline-none"
          />
          <button
            data-testid="agent-register-btn"
            onClick={handleRegister}
            disabled={!name.trim()}
            className="self-end px-3 py-1 text-[12px] bg-bear-accent text-white rounded hover:opacity-90 disabled:opacity-50"
          >
            Register
          </button>
        </div>
      )}

      {isLoading && (
        <p className="text-[12px] text-bear-text-muted">Loading agents...</p>
      )}

      {agents.length === 0 && !isLoading && (
        <p className="text-[12px] text-bear-text-muted">No agents registered yet</p>
      )}

      <div className="flex flex-col gap-1">
        {agents.map((agent) => (
          <div
            key={agent.id}
            data-testid="agent-item"
            className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-bear-hover"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${agent.is_active ? "bg-green-500" : "bg-gray-400"}`}
              />
              <div className="min-w-0">
                <p className="text-[13px] text-bear-text truncate">{agent.name}</p>
                {agent.description && (
                  <p className="text-[11px] text-bear-text-muted truncate">
                    {agent.description}
                  </p>
                )}
              </div>
            </div>
            {agent.is_active && (
              <button
                data-testid="agent-deactivate-btn"
                onClick={() => deactivateAgent(agent.id)}
                className="text-[11px] text-bear-text-muted hover:text-red-400 shrink-0"
                title="Deactivate"
              >
                &times;
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
