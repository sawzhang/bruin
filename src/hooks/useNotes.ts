import { useNoteStore } from "../stores/noteStore";

export function useNotes() {
  const notes = useNoteStore((s) => s.notes);
  const selectedNoteId = useNoteStore((s) => s.selectedNoteId);
  const currentNote = useNoteStore((s) => s.currentNote);
  const isLoading = useNoteStore((s) => s.isLoading);
  const showTrash = useNoteStore((s) => s.showTrash);
  const loadNotes = useNoteStore((s) => s.loadNotes);
  const selectNote = useNoteStore((s) => s.selectNote);
  const createNote = useNoteStore((s) => s.createNote);
  const updateNote = useNoteStore((s) => s.updateNote);
  const deleteNote = useNoteStore((s) => s.deleteNote);
  const pinNote = useNoteStore((s) => s.pinNote);
  const trashNote = useNoteStore((s) => s.trashNote);
  const restoreNote = useNoteStore((s) => s.restoreNote);
  const setNoteState = useNoteStore((s) => s.setNoteState);
  const setShowTrash = useNoteStore((s) => s.setShowTrash);

  return {
    notes,
    selectedNoteId,
    currentNote,
    isLoading,
    showTrash,
    loadNotes,
    selectNote,
    createNote,
    updateNote,
    deleteNote,
    pinNote,
    trashNote,
    restoreNote,
    setNoteState,
    setShowTrash,
  };
}
