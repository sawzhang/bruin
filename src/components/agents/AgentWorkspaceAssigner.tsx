import { useState, useEffect } from "react";
import { useAgentStore } from "../../stores/agentStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import * as tauri from "../../lib/tauri";

export function AgentWorkspaceAssigner({ agentId }: { agentId: string }) {
  const { agents } = useAgentStore();
  const { workspaces } = useWorkspaceStore();
  const [bindings, setBindings] = useState<Array<{ agent_id: string; workspace_id: string; role: string; created_at: string }>>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState("");

  const agent = agents.find((a) => a.id === agentId);

  useEffect(() => {
    tauri.getAgentWorkspaces(agentId).then(setBindings).catch(() => {});
  }, [agentId]);

  const handleBind = async () => {
    if (!selectedWorkspace) return;
    const binding = await tauri.bindAgentWorkspace(agentId, selectedWorkspace);
    setBindings([...bindings, binding]);
    setSelectedWorkspace("");
  };

  const handleUnbind = async (workspaceId: string) => {
    await tauri.unbindAgentWorkspace(agentId, workspaceId);
    setBindings(bindings.filter((b) => b.workspace_id !== workspaceId));
  };

  const boundWorkspaceIds = new Set(bindings.map((b) => b.workspace_id));
  const availableWorkspaces = workspaces.filter((w) => !boundWorkspaceIds.has(w.id));

  if (!agent) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] text-bear-text-muted">
        Workspaces for <span className="font-medium text-bear-text">{agent.name}</span>
      </p>

      {bindings.map((binding) => {
        const ws = workspaces.find((w) => w.id === binding.workspace_id);
        return (
          <div key={binding.workspace_id} className="flex items-center justify-between px-2 py-1 bg-bear-hover rounded">
            <span className="text-[12px] text-bear-text">{ws?.name ?? binding.workspace_id}</span>
            <button
              onClick={() => handleUnbind(binding.workspace_id)}
              className="text-[11px] text-bear-text-muted hover:text-red-400"
            >
              Remove
            </button>
          </div>
        );
      })}

      {availableWorkspaces.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedWorkspace}
            onChange={(e) => setSelectedWorkspace(e.target.value)}
            className="flex-1 bg-bear-hover border border-bear-border rounded px-2 py-1 text-[12px] text-bear-text outline-none"
          >
            <option value="">Add workspace...</option>
            {availableWorkspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>{ws.name}</option>
            ))}
          </select>
          <button
            onClick={handleBind}
            disabled={!selectedWorkspace}
            className="px-2 py-1 text-[11px] bg-bear-accent text-white rounded disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
