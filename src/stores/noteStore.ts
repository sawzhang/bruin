import { create } from "zustand";
import type {
  Note,
  NoteListItem,
  NoteState,
  ListNotesParams,
  UpdateNoteParams,
} from "../types/note";
import * as tauri from "../lib/tauri";
import { useTagStore } from "./tagStore";

interface NoteState {
  notes: NoteListItem[];
  selectedNoteId: string | null;
  currentNote: Note | null;
  isLoading: boolean;
  showTrash: boolean;
  loadNotes: (params?: ListNotesParams) => Promise<void>;
  selectNote: (id: string) => Promise<void>;
  createNote: () => Promise<void>;
  updateNote: (params: UpdateNoteParams) => Promise<void>;
  deleteNote: (id: string, permanent?: boolean) => Promise<void>;
  pinNote: (id: string) => Promise<void>;
  trashNote: (id: string) => Promise<void>;
  restoreNote: (id: string) => Promise<void>;
  setNoteState: (id: string, state: NoteState) => Promise<void>;
  setShowTrash: (show: boolean) => void;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  selectedNoteId: null,
  currentNote: null,
  isLoading: false,
  showTrash: false,

  loadNotes: async (params?: ListNotesParams) => {
    set({ isLoading: true });
    try {
      const notes = await tauri.listNotes(
        params ?? {
          trashed: get().showTrash,
          sort_by: "updated_at",
          sort_order: "desc",
        },
      );
      set({ notes, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  selectNote: async (id: string) => {
    set({ selectedNoteId: id });
    try {
      const note = await tauri.getNote(id);
      set({ currentNote: note });
    } catch {
      set({ currentNote: null });
    }
  },

  createNote: async () => {
    try {
      const note = await tauri.createNote({
        title: "Untitled",
        content: "",
        tags: [],
      });
      set({ selectedNoteId: note.id, currentNote: note });
      await get().loadNotes();
    } catch {
      // ignore
    }
  },

  updateNote: async (params: UpdateNoteParams) => {
    try {
      const note = await tauri.updateNote(params);
      set({ currentNote: note });
      // Refresh list to reflect changes
      const notes = get().notes.map((n) =>
        n.id === note.id
          ? {
              ...n,
              title: note.title,
              preview: note.content.slice(0, 100),
              updated_at: note.updated_at,
              is_pinned: note.is_pinned,
              word_count: note.word_count,
              tags: note.tags,
            }
          : n,
      );
      set({ notes });
      // Refresh tags in sidebar
      useTagStore.getState().loadTags();
    } catch {
      // ignore
    }
  },

  deleteNote: async (id: string, permanent = false) => {
    try {
      await tauri.deleteNote(id, permanent);
      const { selectedNoteId } = get();
      if (selectedNoteId === id) {
        set({ selectedNoteId: null, currentNote: null });
      }
      await get().loadNotes();
    } catch {
      // ignore
    }
  },

  pinNote: async (id: string) => {
    const note = get().currentNote;
    const isPinned = note?.id === id ? note.is_pinned : false;
    try {
      await tauri.pinNote(id, !isPinned);
      if (note?.id === id) {
        set({ currentNote: { ...note, is_pinned: !isPinned } });
      }
      await get().loadNotes();
    } catch {
      // ignore
    }
  },

  trashNote: async (id: string) => {
    try {
      await tauri.trashNote(id);
      const { selectedNoteId } = get();
      if (selectedNoteId === id) {
        set({ selectedNoteId: null, currentNote: null });
      }
      await get().loadNotes();
    } catch {
      // ignore
    }
  },

  restoreNote: async (id: string) => {
    try {
      await tauri.restoreNote(id);
      await get().loadNotes();
    } catch {
      // ignore
    }
  },

  setNoteState: async (id: string, state: NoteState) => {
    try {
      const note = await tauri.setNoteState(id, state);
      set({ currentNote: note });
      const notes = get().notes.map((n) =>
        n.id === note.id ? { ...n, state: note.state } : n,
      );
      set({ notes });
    } catch {
      // ignore
    }
  },

  setShowTrash: (show: boolean) => {
    set({ showTrash: show, selectedNoteId: null, currentNote: null });
  },
}));
