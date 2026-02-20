import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { useNotes } from "../../hooks/useNotes";
import { useTags } from "../../hooks/useTags";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import { EmptyState } from "../common/EmptyState";
import type { NoteState } from "../../types/note";

const STATE_COLORS: Record<NoteState, string> = {
  draft: "bg-gray-400",
  review: "bg-yellow-500",
  published: "bg-green-500",
};

const STATE_LABELS: Record<NoteState, string> = {
  draft: "Draft",
  review: "In Review",
  published: "Published",
};

const STATE_TRANSITIONS: Record<NoteState, NoteState[]> = {
  draft: ["review"],
  review: ["published", "draft"],
  published: ["review"],
};

export function EditorPanel() {
  const { currentNote, updateNote, selectNote, createNote, notes, setNoteState } =
    useNotes();
  const { selectTag, loadTags } = useTags();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const noteIdRef = useRef<string | null>(null);

  // Sync local state when note changes
  useEffect(() => {
    if (currentNote) {
      if (noteIdRef.current !== currentNote.id) {
        setTitle(currentNote.title);
        setContent(currentNote.content);
        noteIdRef.current = currentNote.id;
      }
    } else {
      setTitle("");
      setContent("");
      noteIdRef.current = null;
    }
  }, [currentNote]);

  const debouncedSave = useCallback(
    (newTitle: string, newContent: string) => {
      if (!currentNote) return;
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateNote({
          id: currentNote.id,
          title: newTitle,
          content: newContent,
        });
      }, 1000);
    },
    [currentNote, updateNote],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearTimeout(saveTimerRef.current);
  }, []);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    debouncedSave(newTitle, content);
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    debouncedSave(title, newContent);
  };

  const handleTagClick = (tag: string) => {
    selectTag(tag);
    loadTags();
  };

  const handleWikiLinkClick = (noteTitle: string) => {
    const target = notes.find(
      (n) => n.title.toLowerCase() === noteTitle.toLowerCase(),
    );
    if (target) {
      selectNote(target.id);
    }
  };

  if (!currentNote) {
    return (
      <div className="h-full bg-bear-editor">
        <EmptyState
          message="Select a note to start editing"
          actionLabel="Create your first note"
          onAction={createNote}
        />
      </div>
    );
  }

  const wordCount = currentNote.word_count;

  return (
    <div className="h-full bg-bear-editor flex flex-col">
      {/* Title */}
      <div className="px-8 pt-6 pb-1">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Note title"
          className="w-full bg-transparent text-[24px] font-bold text-bear-text placeholder:text-bear-text-muted outline-none border-none"
        />
      </div>

      {/* State badge + transition buttons */}
      <div className="px-8 pb-2 flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full text-white ${STATE_COLORS[currentNote.state]}`}>
          {STATE_LABELS[currentNote.state]}
        </span>
        {STATE_TRANSITIONS[currentNote.state].map((target) => (
          <button
            key={target}
            onClick={() => setNoteState(currentNote.id, target)}
            className="text-[11px] px-2 py-0.5 rounded border border-bear-border text-bear-text-secondary hover:bg-bear-hover transition-colors"
          >
            → {STATE_LABELS[target]}
          </button>
        ))}
      </div>

      {/* Tags */}
      {currentNote.tags.length > 0 && (
        <div className="px-8 pb-2 flex gap-1.5 flex-wrap">
          {currentNote.tags.map((tag) => (
            <span
              key={tag}
              onClick={() => handleTagClick(tag)}
              className="text-[11px] px-2 py-0.5 rounded bg-bear-tag-bg text-bear-tag cursor-pointer hover:opacity-80 transition-opacity"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-y-auto px-8 py-2">
        <MarkdownEditor
          content={content}
          onUpdate={handleContentChange}
          onTagClick={handleTagClick}
          onWikiLinkClick={handleWikiLinkClick}
        />
      </div>

      {/* Status bar */}
      <div className="px-8 py-2 border-t border-bear-border/50 flex items-center justify-between text-[11px] text-bear-text-muted">
        <span>
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
        <span>
          {format(new Date(currentNote.updated_at), "MMM d, yyyy 'at' h:mm a")}
        </span>
      </div>
    </div>
  );
}
