import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useNotes } from "../../hooks/useNotes";
import { useTags } from "../../hooks/useTags";
import { useSettingsStore } from "../../stores/settingsStore";
import { useToastStore } from "../../stores/toastStore";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import { EmptyState } from "../common/EmptyState";
import * as tauri from "../../lib/tauri";
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
  const autoSaveInterval = useSettingsStore((s) => s.autoSaveInterval);
  const addToast = useToastStore((s) => s.addToast);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
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

  const wordCount = currentNote?.word_count ?? 0;
  const saveDelay = wordCount > 10000 ? 2000 : autoSaveInterval;

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
      }, saveDelay);
    },
    [currentNote, updateNote, saveDelay],
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

  const handleExport = async (format: "markdown" | "html" | "pdf") => {
    if (!currentNote) return;
    setExportOpen(false);

    try {
      if (format === "markdown") {
        const md = await tauri.exportNoteMarkdown(currentNote.id);
        const path = await save({
          defaultPath: `${currentNote.title || "note"}.md`,
          filters: [{ name: "Markdown", extensions: ["md"] }],
        });
        if (path) {
          await writeTextFile(path, md);
          addToast({ type: "success", message: "Exported as Markdown" });
        }
      } else if (format === "html") {
        const html = await tauri.exportNoteHtml(currentNote.id);
        const path = await save({
          defaultPath: `${currentNote.title || "note"}.html`,
          filters: [{ name: "HTML", extensions: ["html"] }],
        });
        if (path) {
          await writeTextFile(path, html);
          addToast({ type: "success", message: "Exported as HTML" });
        }
      } else if (format === "pdf") {
        const html = await tauri.exportNoteHtml(currentNote.id);
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        document.body.appendChild(iframe);
        iframe.contentDocument?.write(html);
        iframe.contentDocument?.close();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }
    } catch (err) {
      addToast({ type: "error", message: `Export failed: ${err}` });
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
        {STATE_TRANSITIONS[currentNote.state].map((target: NoteState) => (
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
          wordCount={wordCount}
        />
      </div>

      {/* Status bar */}
      <div className="px-8 py-2 border-t border-bear-border/50 flex items-center justify-between text-[11px] text-bear-text-muted">
        <span>
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
        <div className="flex items-center gap-3">
          {/* Export dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportOpen(!exportOpen)}
              className="hover:text-bear-text transition-colors"
            >
              Export
            </button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                <div className="absolute bottom-6 right-0 z-50 bg-bear-sidebar border border-bear-border rounded-lg shadow-xl py-1 min-w-[120px]">
                  <button
                    onClick={() => handleExport("markdown")}
                    className="w-full text-left px-3 py-1.5 text-[12px] text-bear-text hover:bg-bear-hover transition-colors"
                  >
                    Markdown
                  </button>
                  <button
                    onClick={() => handleExport("html")}
                    className="w-full text-left px-3 py-1.5 text-[12px] text-bear-text hover:bg-bear-hover transition-colors"
                  >
                    HTML
                  </button>
                  <button
                    onClick={() => handleExport("pdf")}
                    className="w-full text-left px-3 py-1.5 text-[12px] text-bear-text hover:bg-bear-hover transition-colors"
                  >
                    PDF
                  </button>
                </div>
              </>
            )}
          </div>
          <span>
            {format(new Date(currentNote.updated_at), "MMM d, yyyy 'at' h:mm a")}
          </span>
        </div>
      </div>
    </div>
  );
}
