import { useEffect } from "react";
import { useNoteStore } from "../stores/noteStore";
import { useUIStore } from "../stores/uiStore";

export function useKeyboard() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;

      // Cmd+N: create new note
      if (meta && e.key === "n") {
        e.preventDefault();
        useNoteStore.getState().createNote();
        return;
      }

      // Cmd+P: toggle command palette
      if (meta && !e.shiftKey && e.key === "p") {
        e.preventDefault();
        useUIStore.getState().toggleCommandPalette();
        return;
      }

      // Cmd+Shift+P: pin/unpin note
      if (meta && e.shiftKey && e.key === "p") {
        e.preventDefault();
        const { selectedNoteId, pinNote } = useNoteStore.getState();
        if (selectedNoteId) pinNote(selectedNoteId);
        return;
      }

      // Cmd+K: toggle command palette (alternative)
      if (meta && e.key === "k") {
        e.preventDefault();
        useUIStore.getState().toggleCommandPalette();
        return;
      }

      // Cmd+,: toggle settings
      if (meta && e.key === ",") {
        e.preventDefault();
        useUIStore.getState().toggleSettings();
        return;
      }

      // Cmd+T: toggle theme picker
      if (meta && e.key === "t") {
        e.preventDefault();
        useUIStore.getState().toggleThemePicker();
        return;
      }

      // Cmd+Backspace: trash selected note
      if (meta && e.key === "Backspace") {
        e.preventDefault();
        const { selectedNoteId, trashNote } = useNoteStore.getState();
        if (selectedNoteId) trashNote(selectedNoteId);
        return;
      }

      // Escape: close overlays
      if (e.key === "Escape") {
        const ui = useUIStore.getState();
        if (ui.isSettingsOpen) {
          e.preventDefault();
          ui.toggleSettings();
          return;
        }
        if (ui.isThemePickerOpen) {
          e.preventDefault();
          ui.toggleThemePicker();
          return;
        }
        if (ui.isCommandPaletteOpen) {
          e.preventDefault();
          ui.toggleCommandPalette();
        }
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
