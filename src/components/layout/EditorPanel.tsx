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
import { ConfirmDialog } from "../ui/ConfirmDialog";
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
  const {
    currentNote, updateNote, selectNote, createNote, notes,
    setNoteState, trashNote, pinNote, showTrash, restoreNote, deleteNote,
  } = useNotes();
  const { selectTag, loadTags } = useTags();
  const autoSaveInterval = useSettingsStore((s) => s.autoSaveInterval);
  const addToast = useToastStore((s) => s.addToast);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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

  const handleExport = async (fmt: "markdown" | "html" | "pdf") => {
    if (!currentNote) return;
    setExportOpen(false);

    try {
      if (fmt === "markdown") {
        const md = await tauri.exportNoteMarkdown(currentNote.id);
        const path = await save({
          defaultPath: `${currentNote.title || "note"}.md`,
          filters: [{ name: "Markdown", extensions: ["md"] }],
        });
        if (path) {
          await writeTextFile(path, md);
          addToast({ type: "success", message: "Exported as Markdown" });
        }
      } else if (fmt === "html") {
        const html = await tauri.exportNoteHtml(currentNote.id);
        const path = await save({
          defaultPath: `${currentNote.title || "note"}.html`,
          filters: [{ name: "HTML", extensions: ["html"] }],
        });
        if (path) {
          await writeTextFile(path, html);
          addToast({ type: "success", message: "Exported as HTML" });
        }
      } else if (fmt === "pdf") {
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

  const handleTrash = () => {
    if (!currentNote) return;
    setConfirmTrash(true);
    setMoreOpen(false);
  };

  const handlePin = () => {
    if (!currentNote) return;
    pinNote(currentNote.id);
    setMoreOpen(false);
  };

  const handleRestore = () => {
    if (!currentNote) return;
    restoreNote(currentNote.id);
    addToast({ type: "success", message: "Note restored" });
  };

  const handlePermanentDelete = () => {
    setConfirmDelete(true);
  };

  if (!currentNote) {
    return (
      <div data-testid="editor-empty-state" className="h-full bg-bear-editor">
        <EmptyState
          message="Select a note to start editing"
          actionLabel="Create your first note"
          onAction={createNote}
        />
      </div>
    );
  }

  return (
    <div data-testid="editor-panel" className="h-full bg-bear-editor flex flex-col">
      {/* Top toolbar */}
      <div className="px-8 pt-4 pb-1 flex items-center justify-between">
        <div className="flex-1" />
        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {showTrash ? (
            // Trash view actions
            <>
              <button
                data-testid="btn-restore"
                onClick={handleRestore}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] text-green-400 hover:bg-green-500/10 border border-transparent hover:border-green-500/30 transition-colors"
                title="Restore this note"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                  <path d="M2 7.5C2 4.5 4.5 2 7.5 2c2 0 3.7 1.1 4.5 2.7" />
                  <path d="M10 2v3h-3" />
                </svg>
                Restore
              </button>
              <button
                data-testid="btn-delete-permanent"
                onClick={handlePermanentDelete}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-colors"
                title="Delete permanently"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                  <path d="M2.5 3.5h8l-.6 7.5H3.1L2.5 3.5z" />
                  <line x1="1.5" y1="3.5" x2="11.5" y2="3.5" />
                  <path d="M4.5 3.5V2.5a1 1 0 011-1h2a1 1 0 011 1v1" />
                  <line x1="5" y1="5.5" x2="5" y2="9.5" />
                  <line x1="8" y1="5.5" x2="8" y2="9.5" />
                </svg>
                Delete
              </button>
            </>
          ) : (
            // Normal view actions
            <>
              <button
                data-testid="btn-pin"
                onClick={handlePin}
                className={`p-1.5 rounded-md transition-colors ${
                  currentNote.is_pinned
                    ? "text-bear-accent"
                    : "text-bear-text-muted hover:text-bear-text hover:bg-bear-hover"
                }`}
                title={currentNote.is_pinned ? "Unpin" : "Pin to top"}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill={currentNote.is_pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3">
                  <path d="M8.5 1.5L12.5 5.5L8 7.5L6.5 9L5 10.5L3.5 9L5 7.5L6.5 6L8.5 1.5Z" />
                  <line x1="3.5" y1="9" x2="1.5" y2="11" />
                </svg>
              </button>
              {/* More actions */}
              <div className="relative">
                <button
                  data-testid="btn-more"
                  onClick={() => setMoreOpen(!moreOpen)}
                  className="p-1.5 rounded-md text-bear-text-muted hover:text-bear-text hover:bg-bear-hover transition-colors"
                  title="More actions"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                    <circle cx="3" cy="7" r="1.2" />
                    <circle cx="7" cy="7" r="1.2" />
                    <circle cx="11" cy="7" r="1.2" />
                  </svg>
                </button>
                {moreOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                    <div className="absolute top-8 right-0 z-50 bg-bear-sidebar border border-bear-border rounded-lg shadow-xl py-1 min-w-[160px] animate-scale-in origin-top-right">
                      <button
                        onClick={handlePin}
                        className="w-full text-left px-3 py-1.5 text-[12px] text-bear-text hover:bg-bear-hover transition-colors flex items-center gap-2"
                      >
                        <span className="w-4 text-center text-[13px]">{currentNote.is_pinned ? "\u25CB" : "\u25CF"}</span>
                        {currentNote.is_pinned ? "Unpin" : "Pin to Top"}
                      </button>
                      <div className="mx-2 my-1 border-t border-bear-border" />
                      <button
                        onClick={() => { setExportOpen(true); setMoreOpen(false); }}
                        className="w-full text-left px-3 py-1.5 text-[12px] text-bear-text hover:bg-bear-hover transition-colors flex items-center gap-2"
                      >
                        <span className="w-4 text-center text-[13px]">{"\u2B07"}</span>
                        Export...
                      </button>
                      <div className="mx-2 my-1 border-t border-bear-border" />
                      <button
                        onClick={handleTrash}
                        className="w-full text-left px-3 py-1.5 text-[12px] text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                      >
                        <span className="w-4 text-center text-[13px]">{"\u2717"}</span>
                        Move to Trash
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="px-8 pt-2 pb-1">
        <input
          data-testid="editor-title"
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Note title"
          readOnly={showTrash}
          className="w-full bg-transparent text-[24px] font-bold text-bear-text placeholder:text-bear-text-muted outline-none border-none"
        />
      </div>

      {/* State badge + transition buttons */}
      <div className="px-8 pb-2 flex items-center gap-2">
        <span data-testid="note-state-badge" className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full text-white ${STATE_COLORS[currentNote.state]}`}>
          {STATE_LABELS[currentNote.state]}
        </span>
        {!showTrash && STATE_TRANSITIONS[currentNote.state].map((target: NoteState) => (
          <button
            data-testid={`btn-state-${target}`}
            key={target}
            onClick={() => setNoteState(currentNote.id, target)}
            className="text-[11px] px-2 py-0.5 rounded border border-bear-border text-bear-text-secondary hover:bg-bear-hover transition-colors"
          >
            {"\u2192"} {STATE_LABELS[target]}
          </button>
        ))}
        {showTrash && (
          <span className="text-[11px] px-2 py-0.5 rounded bg-red-500/15 text-red-400">
            In Trash
          </span>
        )}
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
          onUpdate={showTrash ? () => {} : handleContentChange}
          onTagClick={handleTagClick}
          onWikiLinkClick={handleWikiLinkClick}
          wordCount={wordCount}
        />
      </div>

      {/* Status bar */}
      <div data-testid="editor-statusbar" className="px-8 py-2 border-t border-bear-border/50 flex items-center justify-between text-[11px] text-bear-text-muted">
        <span data-testid="editor-word-count">
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
        <div className="flex items-center gap-3">
          {/* Export dropdown */}
          {!showTrash && (
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
          )}
          <span>
            {format(new Date(currentNote.updated_at), "MMM d, yyyy 'at' h:mm a")}
          </span>
        </div>
      </div>

      {/* Confirm trash dialog */}
      <ConfirmDialog
        open={confirmTrash}
        title="Move to Trash?"
        message={`"${currentNote.title || "Untitled"}" will be moved to trash. You can restore it later.`}
        confirmLabel="Move to Trash"
        variant="danger"
        onConfirm={() => {
          trashNote(currentNote.id);
          setConfirmTrash(false);
          addToast({ type: "info", message: "Note moved to trash" });
        }}
        onCancel={() => setConfirmTrash(false)}
      />

      {/* Confirm permanent delete dialog */}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete Permanently?"
        message={`"${currentNote.title || "Untitled"}" will be permanently deleted. This action cannot be undone.`}
        confirmLabel="Delete Forever"
        variant="danger"
        onConfirm={() => {
          deleteNote(currentNote.id, true);
          setConfirmDelete(false);
          addToast({ type: "info", message: "Note permanently deleted" });
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
