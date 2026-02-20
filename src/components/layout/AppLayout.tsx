import { useEffect } from "react";
import { useUIStore } from "../../stores/uiStore";
import { useNoteStore } from "../../stores/noteStore";
import { useTagStore } from "../../stores/tagStore";
import { useKeyboard } from "../../hooks/useKeyboard";
import { Sidebar } from "./Sidebar";
import { NoteList } from "./NoteList";
import { EditorPanel } from "./EditorPanel";
import { Resizer } from "../common/Resizer";
import { CommandPalette } from "../search/CommandPalette";
import { ThemePicker } from "../settings/ThemePicker";

export function AppLayout() {
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const noteListWidth = useUIStore((s) => s.noteListWidth);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const setNoteListWidth = useUIStore((s) => s.setNoteListWidth);
  const theme = useUIStore((s) => s.theme);
  const loadNotes = useNoteStore((s) => s.loadNotes);
  const loadTags = useTagStore((s) => s.loadTags);

  useKeyboard();

  // Load data on mount
  useEffect(() => {
    loadNotes();
    loadTags();
  }, [loadNotes, loadTags]);

  return (
    <div className={`theme-${theme} h-full flex overflow-hidden bg-bear-bg text-bear-text`}>
      {/* Sidebar */}
      <div style={{ width: sidebarWidth }} className="shrink-0 h-full">
        <Sidebar />
      </div>

      <Resizer onResize={(d) => setSidebarWidth(sidebarWidth + d)} />

      {/* Note List */}
      <div style={{ width: noteListWidth }} className="shrink-0 h-full">
        <NoteList />
      </div>

      <Resizer onResize={(d) => setNoteListWidth(noteListWidth + d)} />

      {/* Editor */}
      <div className="flex-1 h-full min-w-0">
        <EditorPanel />
      </div>

      {/* Overlays */}
      <CommandPalette />
      <ThemePicker />
    </div>
  );
}
