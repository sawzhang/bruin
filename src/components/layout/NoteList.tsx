import { useState, useMemo, useCallback, useRef, useEffect, memo } from "react";
import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import { useNotes } from "../../hooks/useNotes";
import { useTagStore } from "../../stores/tagStore";
import type { NoteListItem, NoteState } from "../../types/note";
import * as tauri from "../../lib/tauri";
import { ContextMenu, type ContextMenuItem } from "../ui/ContextMenu";
import { ConfirmDialog } from "../ui/ConfirmDialog";

const STATE_DOT_COLORS: Record<NoteState, string> = {
  draft: "bg-gray-400",
  review: "bg-yellow-500",
  published: "bg-green-500",
};

const STATE_LABELS: Record<NoteState, string> = {
  draft: "Draft",
  review: "Review",
  published: "Published",
};

const ITEM_HEIGHT = 88; // approximate height of each note item in px
const OVERSCAN = 5; // extra items to render above/below viewport

// Memoized individual note item to avoid re-rendering unchanged items
const NoteItem = memo(function NoteItem({
  note,
  isSelected,
  onSelect,
  onContextMenu,
}: {
  note: NoteListItem;
  isSelected: boolean;
  onSelect: (id: string, shiftKey: boolean) => void;
  onContextMenu: (e: React.MouseEvent, note: NoteListItem) => void;
}) {
  return (
    <button
      data-testid="note-item"
      data-note-id={note.id}
      onClick={(e) => onSelect(note.id, e.shiftKey)}
      onContextMenu={(e) => onContextMenu(e, note)}
      className={clsx(
        "w-full text-left px-3 py-2.5 border-b border-bear-border/50 transition-colors duration-150 group",
        isSelected ? "bg-bear-active" : "hover:bg-bear-hover",
      )}
    >
      <div className="flex items-center gap-1.5">
        {note.is_pinned && (
          <svg
            data-testid="note-pin-icon"
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="currentColor"
            className="text-bear-accent shrink-0"
          >
            <circle cx="5" cy="5" r="3" />
          </svg>
        )}
        <span
          className={clsx(
            "w-2 h-2 rounded-full shrink-0",
            STATE_DOT_COLORS[note.state],
          )}
          title={note.state}
        />
        <span className="text-[14px] font-medium text-bear-text truncate flex-1">
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
    </button>
  );
});

// Trash view note item with restore and delete actions
const TrashNoteItem = memo(function TrashNoteItem({
  note,
  isSelected,
  onSelect,
  onRestore,
  onDelete,
}: {
  note: NoteListItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      data-testid="note-item"
      data-note-id={note.id}
      className={clsx(
        "w-full text-left px-3 py-2.5 border-b border-bear-border/50 transition-colors duration-150 group",
        isSelected ? "bg-bear-active" : "hover:bg-bear-hover",
      )}
    >
      <button
        onClick={() => onSelect(note.id)}
        className="w-full text-left"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[14px] font-medium text-bear-text truncate flex-1 opacity-60">
            {note.title || "Untitled"}
          </span>
        </div>
        <p className="text-[12px] text-bear-text-secondary mt-0.5 line-clamp-2 leading-relaxed opacity-50">
          {note.preview || "No content"}
        </p>
      </button>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[11px] text-bear-text-muted">
          {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
        </span>
        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onRestore(note.id); }}
            className="text-[11px] px-2 py-0.5 rounded border border-bear-border text-bear-text-secondary hover:text-green-400 hover:border-green-500/50 transition-colors"
            title="Restore note"
          >
            Restore
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
            className="text-[11px] px-2 py-0.5 rounded border border-bear-border text-bear-text-secondary hover:text-red-400 hover:border-red-500/50 transition-colors"
            title="Delete permanently"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
});

export function NoteList() {
  const {
    notes, selectedNoteIds, selectNote, selectNoteRange,
    showTrash, restoreNote, trashNote, deleteNote, pinNote, loadNotes, setNoteState,
  } = useNotes();
  const selectedTags = useTagStore((s) => s.selectedTags);

  // Handle click with shift support
  const handleNoteClick = useCallback((id: string, shiftKey: boolean) => {
    if (shiftKey) {
      selectNoteRange(id);
    } else {
      selectNote(id);
    }
  }, [selectNote, selectNoteRange]);
  const [searchFilter, setSearchFilter] = useState("");
  const [debouncedFilter, setDebouncedFilter] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [isSemanticSearch, setIsSemanticSearch] = useState(false);
  const [semanticResults, setSemanticResults] = useState<
    Array<{ id: string; title: string; preview: string; similarity: number; tags: string[] }>
  >([]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    note: NoteListItem;
  } | null>(null);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  // Debounce search input (150ms)
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchFilter(value);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setDebouncedFilter(value);
      }, 150);
    },
    [],
  );

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  // Semantic search effect
  useEffect(() => {
    if (!isSemanticSearch || !debouncedFilter.trim()) {
      setSemanticResults([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { generateEmbedding } = await import("../../lib/embeddings");
        const embedding = await generateEmbedding(debouncedFilter);
        if (embedding.length === 0 || cancelled) return;
        const results = await tauri.semanticSearch(embedding, 20);
        if (!cancelled) setSemanticResults(results);
      } catch {
        // Model not available
      }
    })();
    return () => { cancelled = true; };
  }, [isSemanticSearch, debouncedFilter]);

  // Context menu handler for normal note list
  const handleContextMenu = useCallback((e: React.MouseEvent, note: NoteListItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, note });
  }, []);

  // Build context menu items for a note (or multi-selection)
  const contextMenuItems = useMemo((): ContextMenuItem[] => {
    if (!contextMenu) return [];
    const note = contextMenu.note;
    // If right-clicked note is in multi-selection, operate on all; otherwise just this one
    const isMulti = selectedNoteIds.length > 1 && selectedNoteIds.includes(note.id);
    const targetIds = isMulti ? selectedNoteIds : [note.id];
    const count = targetIds.length;

    if (isMulti) {
      // Multi-selection context menu
      return [
        {
          label: `Pin ${count} Notes`,
          icon: "\u{1F4CC}",
          action: async () => {
            for (const id of targetIds) await tauri.pinNote(id, true);
            loadNotes({ trashed: false, sort_by: "updated_at", sort_order: "desc" });
          },
        },
        {
          label: `Move ${count} Notes to Trash`,
          icon: "\u{1F5D1}",
          separator: true,
          action: async () => {
            for (const id of targetIds) await tauri.trashNote(id);
            loadNotes({ trashed: false, sort_by: "updated_at", sort_order: "desc" });
          },
          variant: "danger" as const,
        },
        ...(selectedTags.length === 1 ? [{
          label: `Remove Tag #${selectedTags[0]} from ${count} Notes`,
          icon: "\u{2716}",
          separator: true,
          action: async () => {
            const filterTag = selectedTags[0];
            for (const id of targetIds) {
              try {
                const full = await tauri.getNote(id);
                const newTags = full.tags.filter((t: string) => t !== filterTag);
                await tauri.updateNote({ id, tags: newTags });
              } catch { /* ignore */ }
            }
            loadNotes({ tags: [filterTag], trashed: false, sort_by: "updated_at", sort_order: "desc" });
          },
        }] : []),
      ];
    }

    // Single note context menu
    const items: ContextMenuItem[] = [
      {
        label: note.is_pinned ? "Unpin" : "Pin to Top",
        icon: note.is_pinned ? "\u25CB" : "\u{1F4CC}",
        action: () => pinNote(note.id),
      },
      {
        label: "Copy",
        icon: "\u{1F4CB}",
        action: async () => {
          try {
            const full = await tauri.getNote(note.id);
            await navigator.clipboard.writeText(full.content);
          } catch { /* ignore */ }
        },
      },
      {
        label: "Copy Link",
        icon: "\u{1F517}",
        action: () => {
          navigator.clipboard.writeText(`bruin://note/${note.id}`);
        },
      },
      {
        label: "Copy Note ID",
        icon: "\u{2139}",
        action: () => {
          navigator.clipboard.writeText(note.id);
        },
      },
      {
        label: "Export Note...",
        icon: "\u{21E1}",
        separator: true,
        action: async () => {
          try {
            const md = await tauri.exportNoteMarkdown(note.id);
            const blob = new Blob([md], { type: "text/markdown" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${note.title || "untitled"}.md`;
            a.click();
            URL.revokeObjectURL(url);
          } catch { /* ignore */ }
        },
      },
      {
        label: "Move to Trash",
        icon: "\u{1F5D1}",
        separator: true,
        action: () => trashNote(note.id),
        variant: "danger" as const,
      },
    ];

    const nextState = note.state === "draft" ? "review" : note.state === "review" ? "published" : "draft";
    items.push({
      label: `Set ${STATE_LABELS[nextState]}`,
      icon: "\u{25C9}",
      separator: true,
      action: () => setNoteState(note.id, nextState),
    });

    items.push({
      label: "Duplicate Note",
      icon: "\u{29C9}",
      action: async () => {
        try {
          const full = await tauri.getNote(note.id);
          await tauri.createNote({
            title: `${full.title} (copy)`,
            content: full.content,
            tags: full.tags,
          });
          loadNotes({ trashed: false, sort_by: "updated_at", sort_order: "desc" });
        } catch { /* ignore */ }
      },
    });

    if (selectedTags.length === 1) {
      const filterTag = selectedTags[0];
      if (note.tags.includes(filterTag)) {
        items.push({
          label: `Remove Tag #${filterTag}`,
          icon: "\u{2716}",
          separator: true,
          action: async () => {
            try {
              const full = await tauri.getNote(note.id);
              const newTags = full.tags.filter((t: string) => t !== filterTag);
              await tauri.updateNote({ id: note.id, tags: newTags });
              loadNotes({ tags: [filterTag], trashed: false, sort_by: "updated_at", sort_order: "desc" });
            } catch { /* ignore */ }
          },
        });
      }
    }

    return items;
  }, [contextMenu, selectedNoteIds, pinNote, trashNote, setNoteState, loadNotes, selectedTags]);

  // Confirm permanent delete for a single note
  const handleConfirmDelete = useCallback((noteId: string) => {
    const note = notes.find((n) => n.id === noteId);
    setConfirmDialog({
      title: "Delete Permanently?",
      message: `"${note?.title || "Untitled"}" will be permanently deleted. This action cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        deleteNote(noteId, true);
        setConfirmDialog(null);
      },
    });
  }, [notes, deleteNote]);

  // Empty trash
  const handleEmptyTrash = useCallback(() => {
    setConfirmDialog({
      title: "Empty Trash?",
      message: `All ${notes.length} note${notes.length === 1 ? "" : "s"} in trash will be permanently deleted. This cannot be undone.`,
      confirmLabel: "Empty Trash",
      onConfirm: async () => {
        for (const note of notes) {
          await deleteNote(note.id, true);
        }
        setConfirmDialog(null);
        loadNotes({ trashed: true, sort_by: "updated_at", sort_order: "desc" });
      },
    });
  }, [notes, deleteNote, loadNotes]);

  // Memoize filtered + sorted list
  const sorted = useMemo(() => {
    const filter = debouncedFilter.trim().toLowerCase();
    const filtered = filter
      ? notes.filter(
          (n) =>
            n.title.toLowerCase().includes(filter) ||
            n.preview.toLowerCase().includes(filter),
        )
      : notes;

    // Pre-parse dates for faster sorting
    return [...filtered]
      .map((n) => ({ ...n, _ts: new Date(n.updated_at).getTime() }))
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return b._ts - a._ts;
      });
  }, [notes, debouncedFilter]);

  // Virtualized rendering state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollTop(scrollRef.current.scrollTop);
    }
  }, []);

  // Calculate visible window
  const totalHeight = sorted.length * ITEM_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    sorted.length,
    Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN,
  );
  const visibleItems = sorted.slice(startIndex, endIndex);
  const offsetY = startIndex * ITEM_HEIGHT;

  // For small lists (< 100 items), skip virtualization overhead
  const useVirtualization = sorted.length > 100;

  return (
    <div data-testid="note-list-panel" className="h-full bg-bear-list flex flex-col">
      {/* Search input */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex gap-1.5">
          <input
            data-testid="note-search-input"
            type="text"
            value={searchFilter}
            onChange={handleSearchChange}
            placeholder={isSemanticSearch ? "Semantic search..." : "Search notes..."}
            className="flex-1 bg-bear-bg border border-bear-border rounded px-2.5 py-1.5 text-[13px] text-bear-text placeholder:text-bear-text-muted outline-none focus:border-bear-accent transition-colors duration-150"
          />
          <button
            onClick={() => setIsSemanticSearch(!isSemanticSearch)}
            title={isSemanticSearch ? "Switch to text search" : "Switch to semantic search"}
            className={clsx(
              "px-2 py-1.5 rounded border text-[11px] transition-colors",
              isSemanticSearch
                ? "border-bear-accent text-bear-accent bg-bear-accent/10"
                : "border-bear-border text-bear-text-muted hover:text-bear-text hover:bg-bear-hover",
            )}
          >
            AI
          </button>
        </div>
      </div>

      {/* Trash header with empty button */}
      {showTrash && notes.length > 0 && (
        <div className="px-3 pb-2 flex items-center justify-between">
          <span className="text-[12px] text-bear-text-muted">
            {notes.length} note{notes.length === 1 ? "" : "s"} in trash
          </span>
          <button
            onClick={handleEmptyTrash}
            className="text-[11px] px-2 py-0.5 rounded text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Empty Trash
          </button>
        </div>
      )}

      {/* Semantic search results */}
      {isSemanticSearch && semanticResults.length > 0 && debouncedFilter.trim() && (
        <div className="flex-1 overflow-y-auto">
          {semanticResults.map((result) => (
            <button
              key={result.id}
              onClick={() => selectNote(result.id)}
              className={clsx(
                "w-full text-left px-3 py-2.5 border-b border-bear-border/50 transition-colors duration-150",
                selectedNoteIds.includes(result.id) ? "bg-bear-active" : "hover:bg-bear-hover",
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-medium text-bear-text truncate">
                  {result.title || "Untitled"}
                </span>
                <span className="text-[10px] text-bear-accent ml-auto shrink-0">
                  {Math.round(result.similarity * 100)}%
                </span>
              </div>
              <p className="text-[12px] text-bear-text-secondary mt-0.5 line-clamp-2 leading-relaxed">
                {result.preview || "No content"}
              </p>
              {result.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-1">
                  {result.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-bear-tag-bg text-bear-tag"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Notes list */}
      {(!isSemanticSearch || !debouncedFilter.trim() || semanticResults.length === 0) && (
      <div
        data-testid="note-list"
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onScroll={useVirtualization ? handleScroll : undefined}
      >
        {sorted.length === 0 && (
          <div data-testid="note-list-empty" className="px-3 py-8 text-center">
            <p className="text-[13px] text-bear-text-muted">
              {showTrash ? "Trash is empty" : "No notes"}
            </p>
            {showTrash && (
              <p className="text-[11px] text-bear-text-muted mt-1">
                Deleted notes will appear here
              </p>
            )}
          </div>
        )}
        {showTrash ? (
          // Trash view with restore/delete buttons
          sorted.map((note) => (
            <TrashNoteItem
              key={note.id}
              note={note}
              isSelected={selectedNoteIds.includes(note.id)}
              onSelect={selectNote}
              onRestore={restoreNote}
              onDelete={handleConfirmDelete}
            />
          ))
        ) : useVirtualization ? (
          <div style={{ height: totalHeight, position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: offsetY,
                left: 0,
                right: 0,
              }}
            >
              {visibleItems.map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  isSelected={selectedNoteIds.includes(note.id)}
                  onSelect={handleNoteClick}
                  onContextMenu={handleContextMenu}
                />
              ))}
            </div>
          </div>
        ) : (
          sorted.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              isSelected={selectedNoteIds.includes(note.id)}
              onSelect={handleNoteClick}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        open={!!confirmDialog}
        title={confirmDialog?.title ?? ""}
        message={confirmDialog?.message ?? ""}
        confirmLabel={confirmDialog?.confirmLabel ?? "Confirm"}
        variant="danger"
        onConfirm={confirmDialog?.onConfirm ?? (() => {})}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
