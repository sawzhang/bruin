import { useState } from "react";
import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import { useNotes } from "../../hooks/useNotes";

export function NoteList() {
  const { notes, selectedNoteId, selectNote, showTrash, restoreNote } =
    useNotes();
  const [searchFilter, setSearchFilter] = useState("");

  const filteredNotes = searchFilter.trim()
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
          n.preview.toLowerCase().includes(searchFilter.toLowerCase()),
      )
    : notes;

  // Sort: pinned first, then by updated_at
  const sorted = [...filteredNotes].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return (
    <div className="h-full bg-bear-list flex flex-col">
      {/* Search input */}
      <div className="px-3 pt-3 pb-2">
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Search notes..."
          className="w-full bg-bear-bg border border-bear-border rounded px-2.5 py-1.5 text-[13px] text-bear-text placeholder:text-bear-text-muted outline-none focus:border-bear-accent transition-colors duration-150"
        />
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <p className="px-3 py-4 text-[12px] text-bear-text-muted text-center">
            {showTrash ? "Trash is empty" : "No notes"}
          </p>
        )}
        {sorted.map((note) => (
          <button
            key={note.id}
            onClick={() => selectNote(note.id)}
            className={clsx(
              "w-full text-left px-3 py-2.5 border-b border-bear-border/50 transition-colors duration-150",
              selectedNoteId === note.id
                ? "bg-bear-active"
                : "hover:bg-bear-hover",
            )}
          >
            <div className="flex items-center gap-1.5">
              {note.is_pinned && (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="currentColor"
                  className="text-bear-accent shrink-0"
                >
                  <circle cx="5" cy="5" r="3" />
                </svg>
              )}
              <span className="text-[14px] font-medium text-bear-text truncate">
                {note.title || "Untitled"}
              </span>
            </div>
            <p className="text-[12px] text-bear-text-secondary mt-0.5 line-clamp-2 leading-relaxed">
              {note.preview || "No content"}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-bear-text-muted">
                {formatDistanceToNow(new Date(note.updated_at), {
                  addSuffix: true,
                })}
              </span>
              {note.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {note.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-bear-tag-bg text-bear-tag"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {showTrash && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  restoreNote(note.id);
                }}
                className="mt-1 text-[11px] text-bear-accent hover:text-bear-accent-hover"
              >
                Restore
              </button>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
