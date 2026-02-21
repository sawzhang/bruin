import { useState } from "react";
import clsx from "clsx";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useNoteStore } from "../../stores/noteStore";

export function WorkspaceSelector() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const setCurrentWorkspace = useWorkspaceStore((s) => s.setCurrentWorkspace);
  const loadNotes = useNoteStore((s) => s.loadNotes);
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);

  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);

  const handleSelect = (id: string | null) => {
    setCurrentWorkspace(id);
    setIsOpen(false);
    loadNotes({
      trashed: false,
      sort_by: "updated_at",
      sort_order: "desc",
      workspace_id: id ?? undefined,
    });
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createWorkspace(newName.trim());
    setNewName("");
    setIsCreating(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 w-full px-2 py-1 text-[11px] text-bear-text-secondary hover:text-bear-text rounded hover:bg-bear-hover transition-colors duration-150"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        >
          <rect x="1" y="2" width="10" height="8" rx="1" />
          <path d="M1 4h10" />
        </svg>
        <span className="truncate">
          {currentWorkspace ? currentWorkspace.name : "All Workspaces"}
        </span>
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="ml-auto shrink-0"
        >
          <path d="M2 3l2 2 2-2" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-bear-bg border border-bear-border rounded shadow-lg py-1 max-h-48 overflow-y-auto">
          <button
            onClick={() => handleSelect(null)}
            className={clsx(
              "w-full text-left px-3 py-1.5 text-[12px] hover:bg-bear-hover transition-colors",
              !currentWorkspaceId && "text-bear-accent font-medium",
            )}
          >
            All Workspaces
          </button>
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => handleSelect(ws.id)}
              className={clsx(
                "w-full text-left px-3 py-1.5 text-[12px] hover:bg-bear-hover transition-colors truncate",
                currentWorkspaceId === ws.id && "text-bear-accent font-medium",
              )}
            >
              {ws.name}
            </button>
          ))}

          <div className="border-t border-bear-border mt-1 pt-1">
            {isCreating ? (
              <div className="px-2 flex gap-1">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") setIsCreating(false);
                  }}
                  placeholder="Workspace name"
                  className="flex-1 bg-bear-bg border border-bear-border rounded px-1.5 py-0.5 text-[11px] outline-none focus:border-bear-accent"
                  autoFocus
                />
                <button
                  onClick={handleCreate}
                  className="text-[11px] text-bear-accent hover:text-bear-accent-hover px-1"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="w-full text-left px-3 py-1.5 text-[12px] text-bear-text-muted hover:bg-bear-hover transition-colors"
              >
                + New Workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
