import { useEffect } from "react";
import { useWorkflowStore } from "../../stores/workflowStore";
import { useUIStore } from "../../stores/uiStore";

const CATEGORY_COLORS: Record<string, string> = {
  daily: "bg-blue-500/20 text-blue-400",
  research: "bg-purple-500/20 text-purple-400",
  project: "bg-green-500/20 text-green-400",
  general: "bg-gray-500/20 text-gray-400",
};

export function WorkflowBrowser() {
  const isOpen = useUIStore((s) => s.isWorkflowBrowserOpen);
  const toggleBrowser = useUIStore((s) => s.toggleWorkflowBrowser);
  const { workflows, isLoading, loadWorkflows } = useWorkflowStore();

  useEffect(() => {
    if (isOpen) loadWorkflows();
  }, [isOpen, loadWorkflows]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={toggleBrowser}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[520px] max-h-[70vh] bg-bear-sidebar border border-bear-border rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-bear-border">
          <h2 className="text-[16px] font-semibold text-bear-text">Workflows</h2>
          <button onClick={toggleBrowser} className="text-bear-text-muted hover:text-bear-text text-[18px]">
            &times;
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(70vh-60px)]">
          {isLoading && (
            <p className="px-6 py-8 text-[12px] text-bear-text-muted text-center">Loading...</p>
          )}

          {!isLoading && workflows.length === 0 && (
            <p className="px-6 py-8 text-[12px] text-bear-text-muted text-center">
              No workflow templates available
            </p>
          )}

          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              className="px-6 py-3 border-b border-bear-border/50 hover:bg-bear-hover cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[14px] font-medium text-bear-text">{workflow.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_COLORS[workflow.category] ?? CATEGORY_COLORS.general}`}>
                  {workflow.category}
                </span>
              </div>
              <p className="text-[12px] text-bear-text-muted mb-2">{workflow.description}</p>
              <div className="flex flex-col gap-1">
                {workflow.steps.map((step) => (
                  <div key={step.order} className="flex items-center gap-2 text-[11px]">
                    <span className="w-4 h-4 rounded-full bg-bear-hover flex items-center justify-center text-bear-text-muted shrink-0">
                      {step.order}
                    </span>
                    <span className="text-bear-text-secondary">{step.description}</span>
                    <span className="text-bear-text-muted ml-auto font-mono">{step.tool_name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
