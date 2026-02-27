import { useState, useEffect, useCallback, useRef } from "react";
import clsx from "clsx";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { useTags } from "../../hooks/useTags";
import { useNotes } from "../../hooks/useNotes";
import { useUIStore } from "../../stores/uiStore";
import { TagTree } from "../sidebar/TagTree";
import { WorkspaceSelector } from "../sidebar/WorkspaceSelector";
import { ContextMenu, type ContextMenuItem } from "../ui/ContextMenu";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { importMarkdownFiles, getSyncStatus } from "../../lib/tauri";
import type { SyncState } from "../../types/sync";
import type { TagTreeNode } from "../../types/tag";

export function Sidebar() {
  const { tagTree, selectedTags, selectTag, toggleTag, clearTags, pinTag, renameTag, deleteTag } = useTags();
  const { createNote, showTrash, setShowTrash, loadNotes } = useNotes();
  const toggleThemePicker = useUIStore((s) => s.toggleThemePicker);
  const toggleActivityPanel = useUIStore((s) => s.toggleActivityPanel);
  const isActivityPanelOpen = useUIStore((s) => s.isActivityPanelOpen);
  const toggleGraphView = useUIStore((s) => s.toggleGraphView);
  const isGraphViewOpen = useUIStore((s) => s.isGraphViewOpen);
  const toggleSettings = useUIStore((s) => s.toggleSettings);
  const toggleTaskPanel = useUIStore((s) => s.toggleTaskPanel);
  const isTaskPanelOpen = useUIStore((s) => s.isTaskPanelOpen);
  const toggleAgentDashboard = useUIStore((s) => s.toggleAgentDashboard);
  const isAgentDashboardOpen = useUIStore((s) => s.isAgentDashboardOpen);

  const [syncStatus, setSyncStatus] = useState<SyncState>({
    is_syncing: false,
    last_sync: null,
    error: null,
    files_synced: 0,
  });

  useEffect(() => {
    getSyncStatus().then(setSyncStatus).catch(() => {});

    const unlistenPromise = listen("sync-status-changed", () => {
      getSyncStatus().then(setSyncStatus).catch(() => {});
    });

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  const handleAllNotes = () => {
    clearTags();
    setShowTrash(false);
  };

  const handleTrash = () => {
    clearTags();
    setShowTrash(true);
  };

  const handleAllNotesClick = () => {
    handleAllNotes();
    loadNotes({ trashed: false, sort_by: "updated_at", sort_order: "desc" });
  };

  const handleTrashClick = () => {
    handleTrash();
    loadNotes({ trashed: true, sort_by: "updated_at", sort_order: "desc" });
  };

  const handleTagClick = (tag: string, shiftKey: boolean) => {
    setShowTrash(false);
    if (shiftKey) {
      // Shift+click: toggle this tag in/out of the selection
      toggleTag(tag);
      const newTags = selectedTags.includes(tag)
        ? selectedTags.filter((t) => t !== tag)
        : [...selectedTags, tag];
      if (newTags.length === 0) {
        loadNotes({ trashed: false, sort_by: "updated_at", sort_order: "desc" });
      } else {
        loadNotes({ tags: newTags, trashed: false, sort_by: "updated_at", sort_order: "desc" });
      }
    } else {
      // Normal click: if already the only selected tag, deselect; otherwise select only this one
      if (selectedTags.length === 1 && selectedTags[0] === tag) {
        clearTags();
        loadNotes({ trashed: false, sort_by: "updated_at", sort_order: "desc" });
      } else {
        selectTag(tag);
        loadNotes({ tags: [tag], trashed: false, sort_by: "updated_at", sort_order: "desc" });
      }
    }
  };

  const handleImport = async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });

    if (selected) {
      const paths = Array.isArray(selected) ? selected : [selected];
      await importMarkdownFiles(paths);
      loadNotes({ trashed: false, sort_by: "updated_at", sort_order: "desc" });
    }
  };

  // Tag context menu state
  const [tagContextMenu, setTagContextMenu] = useState<{
    x: number;
    y: number;
    node: TagTreeNode;
  } | null>(null);

  // Rename dialog state
  const [renameDialog, setRenameDialog] = useState<{
    oldName: string;
    fullPath: string;
  } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Confirm delete dialog state
  const [confirmDelete, setConfirmDelete] = useState<{
    name: string;
    noteCount: number;
  } | null>(null);

  const handleTagContextMenu = useCallback((e: React.MouseEvent, node: TagTreeNode) => {
    e.preventDefault();
    setTagContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const tagContextMenuItems: ContextMenuItem[] = tagContextMenu ? [
    {
      label: tagContextMenu.node.isPinned ? "Unpin Tag" : "Pin Tag",
      icon: tagContextMenu.node.isPinned ? "\u25CB" : "\u{1F4CC}",
      action: () => {
        pinTag(tagContextMenu.node.fullPath, !tagContextMenu.node.isPinned);
      },
    },
    {
      label: "Rename Tag",
      icon: "\u270E",
      action: () => {
        setRenameDialog({ oldName: tagContextMenu.node.name, fullPath: tagContextMenu.node.fullPath });
        setRenameValue(tagContextMenu.node.name);
        setTimeout(() => renameInputRef.current?.focus(), 50);
      },
    },
    {
      label: "Delete Tag",
      icon: "\u{1F5D1}",
      action: () => {
        setConfirmDelete({
          name: tagContextMenu.node.fullPath,
          noteCount: tagContextMenu.node.noteCount,
        });
      },
      variant: "danger" as const,
      separator: true,
    },
  ] : [];

  const handleRenameSubmit = async () => {
    if (!renameDialog || !renameValue.trim()) return;
    const oldFull = renameDialog.fullPath;
    // Build new full path: replace the last segment
    const parts = oldFull.split("/");
    parts[parts.length - 1] = renameValue.trim();
    const newFull = parts.join("/");
    if (newFull !== oldFull) {
      await renameTag(oldFull, newFull);
      loadNotes({ trashed: false, sort_by: "updated_at", sort_order: "desc" });
    }
    setRenameDialog(null);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    await deleteTag(confirmDelete.name);
    loadNotes({ trashed: false, sort_by: "updated_at", sort_order: "desc" });
    setConfirmDelete(null);
  };

  const syncDotColor = syncStatus.error
    ? "bg-red-500"
    : syncStatus.is_syncing
      ? "bg-yellow-500 animate-pulse"
      : syncStatus.last_sync
        ? "bg-green-500"
        : "bg-gray-400";

  const syncLabel = syncStatus.error
    ? "Sync error"
    : syncStatus.is_syncing
      ? "Syncing..."
      : syncStatus.last_sync
        ? "Synced"
        : "Not synced";

  return (
    <div className="h-full bg-bear-sidebar flex flex-col select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <h1 className="text-[15px] font-semibold text-bear-text tracking-tight">
          Bruin
        </h1>
        <button
          onClick={createNote}
          title="New Note"
          className="w-6 h-6 flex items-center justify-center rounded text-bear-text-secondary hover:text-bear-text hover:bg-bear-hover transition-colors duration-150"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <line x1="7" y1="2" x2="7" y2="12" />
            <line x1="2" y1="7" x2="12" y2="7" />
          </svg>
        </button>
      </div>

      {/* Workspace selector */}
      <div className="px-2 pb-1">
        <WorkspaceSelector />
      </div>

      {/* Nav items */}
      <div className="px-2 flex flex-col gap-0.5">
        <button
          onClick={handleAllNotesClick}
          className={clsx(
            "flex items-center gap-2 w-full text-left px-2 py-1.5 text-[13px] rounded transition-colors duration-150",
            !showTrash && selectedTags.length === 0
              ? "bg-bear-active text-bear-text"
              : "text-bear-text-secondary hover:bg-bear-hover hover:text-bear-text",
          )}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          >
            <rect x="2" y="2" width="10" height="10" rx="1.5" />
            <line x1="4.5" y1="5" x2="9.5" y2="5" />
            <line x1="4.5" y1="7.5" x2="9.5" y2="7.5" />
            <line x1="4.5" y1="10" x2="7.5" y2="10" />
          </svg>
          All Notes
        </button>
        <button
          onClick={handleTrashClick}
          className={clsx(
            "flex items-center gap-2 w-full text-left px-2 py-1.5 text-[13px] rounded transition-colors duration-150",
            showTrash
              ? "bg-bear-active text-bear-text"
              : "text-bear-text-secondary hover:bg-bear-hover hover:text-bear-text",
          )}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          >
            <path d="M3 4h8l-.7 8H3.7L3 4z" />
            <line x1="2" y1="4" x2="12" y2="4" />
            <path d="M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1" />
          </svg>
          Trash
        </button>
        <button
          onClick={toggleActivityPanel}
          className={clsx(
            "flex items-center gap-2 w-full text-left px-2 py-1.5 text-[13px] rounded transition-colors duration-150",
            isActivityPanelOpen
              ? "bg-bear-active text-bear-text"
              : "text-bear-text-secondary hover:bg-bear-hover hover:text-bear-text",
          )}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          >
            <path d="M2 3h10M2 7h7M2 11h5" />
          </svg>
          Activity
        </button>
        <button
          onClick={toggleGraphView}
          className={clsx(
            "flex items-center gap-2 w-full text-left px-2 py-1.5 text-[13px] rounded transition-colors duration-150",
            isGraphViewOpen
              ? "bg-bear-active text-bear-text"
              : "text-bear-text-secondary hover:bg-bear-hover hover:text-bear-text",
          )}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          >
            <circle cx="4" cy="4" r="2" />
            <circle cx="10" cy="4" r="2" />
            <circle cx="7" cy="10" r="2" />
            <line x1="5.5" y1="5.2" x2="7" y2="8.5" />
            <line x1="8.5" y1="5.2" x2="7" y2="8.5" />
          </svg>
          Knowledge Graph
        </button>
        <button
          onClick={toggleTaskPanel}
          className={clsx(
            "flex items-center gap-2 w-full text-left px-2 py-1.5 text-[13px] rounded transition-colors duration-150",
            isTaskPanelOpen
              ? "bg-bear-active text-bear-text"
              : "text-bear-text-secondary hover:bg-bear-hover hover:text-bear-text",
          )}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          >
            <rect x="2" y="2" width="10" height="3" rx="1" />
            <rect x="2" y="6.5" width="10" height="3" rx="1" />
            <line x1="4" y1="11.5" x2="10" y2="11.5" />
          </svg>
          Tasks
        </button>
        <button
          onClick={toggleAgentDashboard}
          className={clsx(
            "flex items-center gap-2 w-full text-left px-2 py-1.5 text-[13px] rounded transition-colors duration-150",
            isAgentDashboardOpen
              ? "bg-bear-active text-bear-text"
              : "text-bear-text-secondary hover:bg-bear-hover hover:text-bear-text",
          )}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          >
            <circle cx="7" cy="4.5" r="2.5" />
            <path d="M2.5 12c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
          </svg>
          Agents
        </button>
      </div>

      {/* Divider */}
      <div className="mx-3 my-2 border-t border-bear-border" />

      {/* Tags */}
      <div className="px-2 mb-1">
        <p className="px-2 text-[11px] uppercase tracking-wider text-bear-text-muted font-medium">
          Tags
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-2">
        <TagTree
          tree={tagTree}
          selectedTags={selectedTags}
          onSelectTag={handleTagClick}
          onContextMenu={handleTagContextMenu}
        />
      </div>

      {/* Footer: sync status + import + settings gear */}
      <div className="px-3 py-2 border-t border-bear-border flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={clsx("w-1.5 h-1.5 rounded-full", syncDotColor)} />
          <span className="text-[11px] text-bear-text-muted">{syncLabel}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleImport}
            title="Import Markdown Files"
            className="w-6 h-6 flex items-center justify-center rounded text-bear-text-muted hover:text-bear-text hover:bg-bear-hover transition-colors duration-150"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 2v8" />
              <path d="M4 7l3 3 3-3" />
              <path d="M2 12h10" />
            </svg>
          </button>
          <button
            onClick={toggleThemePicker}
            title="Themes (Cmd+T)"
            className="w-6 h-6 flex items-center justify-center rounded text-bear-text-muted hover:text-bear-text hover:bg-bear-hover transition-colors duration-150"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="7" cy="7" r="2.2" />
              <path d="M7 1.5v1.2M7 11.3v1.2M1.5 7h1.2M11.3 7h1.2M2.8 2.8l.85.85M10.35 10.35l.85.85M11.2 2.8l-.85.85M3.65 10.35l-.85.85" />
            </svg>
          </button>
          <button
            onClick={toggleSettings}
            title="Settings (Cmd+,)"
            className="w-6 h-6 flex items-center justify-center rounded text-bear-text-muted hover:text-bear-text hover:bg-bear-hover transition-colors duration-150"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5.7 1.5h2.6l.3 1.7.9.4 1.5-.8 1.8 1.8-.8 1.5.4.9 1.7.3v2.6l-1.7.3-.4.9.8 1.5-1.8 1.8-1.5-.8-.9.4-.3 1.7H5.7l-.3-1.7-.9-.4-1.5.8-1.8-1.8.8-1.5-.4-.9-1.7-.3V5.7l1.7-.3.4-.9-.8-1.5L3 1.2l1.5.8.9-.4.3-1.7z" />
              <circle cx="7" cy="7" r="2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tag context menu */}
      {tagContextMenu && (
        <ContextMenu
          x={tagContextMenu.x}
          y={tagContextMenu.y}
          items={tagContextMenuItems}
          onClose={() => setTagContextMenu(null)}
        />
      )}

      {/* Rename tag dialog */}
      {renameDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 animate-fade-in"
            onClick={() => setRenameDialog(null)}
          />
          <div className="relative bg-bear-sidebar border border-bear-border rounded-xl shadow-2xl p-6 w-[360px] animate-scale-in">
            <h3 className="text-[15px] font-semibold text-bear-text mb-3">
              Rename Tag
            </h3>
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") setRenameDialog(null);
              }}
              className="w-full bg-bear-bg border border-bear-border rounded-lg px-3 py-2 text-[13px] text-bear-text outline-none focus:border-bear-accent transition-colors"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setRenameDialog(null)}
                className="px-3.5 py-1.5 text-[13px] rounded-lg border border-bear-border text-bear-text-secondary hover:bg-bear-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSubmit}
                className="px-3.5 py-1.5 text-[13px] rounded-lg font-medium bg-bear-accent hover:bg-bear-accent-hover text-white transition-colors"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete tag dialog */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Tag?"
        message={confirmDelete
          ? `Tag "${confirmDelete.name}" will be removed from ${confirmDelete.noteCount} note${confirmDelete.noteCount === 1 ? "" : "s"}. Notes themselves will not be deleted.`
          : ""}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
