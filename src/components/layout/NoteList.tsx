import { useState, useMemo, useCallback, useRef, useEffect, memo } from "react";
import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import { useNotes } from "../../hooks/useNotes";
import type { NoteListItem, NoteState } from "../../types/note";
import * as tauri from "../../lib/tauri";

const STATE_DOT_COLORS: Record<NoteState, string> = {
  draft: "bg-gray-400",
  review: "bg-yellow-500",
  published: "bg-green-500",
};

const ITEM_HEIGHT = 88; // approximate height of each note item in px
const OVERSCAN = 5; // extra items to render above/below viewport

// Memoized individual note item to avoid re-rendering unchanged items
const NoteItem = memo(function NoteItem({
  note,
  isSelected,
  showTrash,
  onSelect,
  onRestore,
}: {
  note: NoteListItem;
  isSelected: boolean;
  showTrash: boolean;
  onSelect: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(note.id)}
      className={clsx(
        "w-full text-left px-3 py-2.5 border-b border-bear-border/50 transition-colors duration-150",
        isSelected ? "bg-bear-active" : "hover:bg-bear-hover",
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
        <span
          className={clsx(
            "w-2 h-2 rounded-full shrink-0",
            STATE_DOT_COLORS[note.state],
          )}
          title={note.state}
        />
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
            onRestore(note.id);
          }}
          className="mt-1 text-[11px] text-bear-accent hover:text-bear-accent-hover"
        >
          Restore
        </button>
      )}
    </button>
  );
});

export function NoteList() {
  const { notes, selectedNoteId, selectNote, showTrash, restoreNote } =
    useNotes();
  const [searchFilter, setSearchFilter] = useState("");
  const [debouncedFilter, setDebouncedFilter] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [isSemanticSearch, setIsSemanticSearch] = useState(false);
  const [semanticResults, setSemanticResults] = useState<
    Array<{ id: string; title: string; preview: string; similarity: number; tags: string[] }>
  >([]);

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
    <div className="h-full bg-bear-list flex flex-col">
      {/* Search input */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex gap-1.5">
          <input
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

      {/* Semantic search results */}
      {isSemanticSearch && semanticResults.length > 0 && debouncedFilter.trim() && (
        <div className="flex-1 overflow-y-auto">
          {semanticResults.map((result) => (
            <button
              key={result.id}
              onClick={() => selectNote(result.id)}
              className={clsx(
                "w-full text-left px-3 py-2.5 border-b border-bear-border/50 transition-colors duration-150",
                selectedNoteId === result.id ? "bg-bear-active" : "hover:bg-bear-hover",
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
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onScroll={useVirtualization ? handleScroll : undefined}
      >
        {sorted.length === 0 && (
          <p className="px-3 py-4 text-[12px] text-bear-text-muted text-center">
            {showTrash ? "Trash is empty" : "No notes"}
          </p>
        )}
        {useVirtualization ? (
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
                  isSelected={selectedNoteId === note.id}
                  showTrash={showTrash}
                  onSelect={selectNote}
                  onRestore={restoreNote}
                />
              ))}
            </div>
          </div>
        ) : (
          sorted.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              isSelected={selectedNoteId === note.id}
              showTrash={showTrash}
              onSelect={selectNote}
              onRestore={restoreNote}
            />
          ))
        )}
      </div>
      )}
    </div>
  );
}
