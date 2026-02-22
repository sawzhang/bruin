import { useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { useAgentStore } from "../../stores/agentStore";
import { useTaskStore } from "../../stores/taskStore";
import { useUIStore } from "../../stores/uiStore";

export function AgentDashboard() {
  const isOpen = useUIStore((s) => s.isAgentDashboardOpen);
  const toggleDashboard = useUIStore((s) => s.toggleAgentDashboard);
  const { agents, loadAgents } = useAgentStore();
  const { tasks, loadTasks } = useTaskStore();

  useEffect(() => {
    if (isOpen) {
      loadAgents();
      loadTasks();
    }
  }, [isOpen, loadAgents, loadTasks]);

  if (!isOpen) return null;

  const activeAgents = agents.filter((a) => a.is_active);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={toggleDashboard}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[600px] max-h-[80vh] bg-bear-sidebar border border-bear-border rounded-xl shadow-2xl overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-bear-border">
          <h2 className="text-[16px] font-semibold text-bear-text">Agent Dashboard</h2>
          <button onClick={toggleDashboard} className="text-bear-text-muted hover:text-bear-text text-[18px]">
            &times;
          </button>
        </div>

        <div className="px-6 py-4 flex flex-col gap-4">
          {activeAgents.length === 0 ? (
            <p className="text-[13px] text-bear-text-muted text-center py-8">
              No active agents. Register agents in Settings.
            </p>
          ) : (
            activeAgents.map((agent) => {
              const agentTasks = tasks.filter((t) => t.assigned_agent_id === agent.id);
              const todoCount = agentTasks.filter((t) => t.status === "todo").length;
              const inProgressCount = agentTasks.filter((t) => t.status === "in_progress").length;
              const doneCount = agentTasks.filter((t) => t.status === "done").length;

              return (
                <div key={agent.id} className="p-3 bg-bear-hover rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-[14px] font-medium text-bear-text">{agent.name}</span>
                    {agent.capabilities.length > 0 && (
                      <div className="flex gap-1 ml-auto">
                        {agent.capabilities.slice(0, 3).map((cap) => (
                          <span key={cap} className="text-[10px] px-1.5 py-0.5 rounded bg-bear-tag-bg text-bear-tag">
                            {cap}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {agent.description && (
                    <p className="text-[12px] text-bear-text-muted mb-2">{agent.description}</p>
                  )}
                  <div className="flex gap-3 text-[11px]">
                    <span className="text-bear-text-secondary">
                      <span className="text-yellow-500">{todoCount}</span> todo
                    </span>
                    <span className="text-bear-text-secondary">
                      <span className="text-blue-500">{inProgressCount}</span> in progress
                    </span>
                    <span className="text-bear-text-secondary">
                      <span className="text-green-500">{doneCount}</span> done
                    </span>
                  </div>
                  <p className="text-[10px] text-bear-text-muted mt-1">
                    Registered {formatDistanceToNow(new Date(agent.created_at), { addSuffix: true })}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
