import clsx from "clsx";
import { useTags } from "../../hooks/useTags";
import { useNotes } from "../../hooks/useNotes";
import { TagTree } from "../sidebar/TagTree";

export function Sidebar() {
  const { tagTree, selectedTag, selectTag } = useTags();
  const { createNote, showTrash, setShowTrash, loadNotes } = useNotes();

  const handleAllNotes = () => {
    selectTag(null);
    setShowTrash(false);
  };

  const handleTrash = () => {
    selectTag(null);
    setShowTrash(true);
  };

  const handleSelectTag = (tag: string | null) => {
    setShowTrash(false);
    selectTag(tag);
  };

  // Reload notes when switching views
  const handleAllNotesClick = () => {
    handleAllNotes();
    loadNotes({ trashed: false, sort_by: "updated_at", sort_order: "desc" });
  };

  const handleTrashClick = () => {
    handleTrash();
    loadNotes({ trashed: true, sort_by: "updated_at", sort_order: "desc" });
  };

  const handleTagClick = (tag: string | null) => {
    handleSelectTag(tag);
    if (tag) {
      loadNotes({ tag, trashed: false, sort_by: "updated_at", sort_order: "desc" });
    } else {
      loadNotes({ trashed: false, sort_by: "updated_at", sort_order: "desc" });
    }
  };

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

      {/* Nav items */}
      <div className="px-2 flex flex-col gap-0.5">
        <button
          onClick={handleAllNotesClick}
          className={clsx(
            "flex items-center gap-2 w-full text-left px-2 py-1.5 text-[13px] rounded transition-colors duration-150",
            !showTrash && !selectedTag
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
          selectedTag={selectedTag}
          onSelectTag={handleTagClick}
        />
      </div>

      {/* Sync status */}
      <div className="px-3 py-2 border-t border-bear-border">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-[11px] text-bear-text-muted">Synced</span>
        </div>
      </div>
    </div>
  );
}
