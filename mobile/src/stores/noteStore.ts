import { create } from "zustand";
import type {
  Note,
  NoteListItem,
  NoteState,
  ListNotesParams,
  UpdateNoteParams,
} from "@/types";
import * as database from "@/services/database";
import { useTagStore } from "./tagStore";
import type { SQLiteDatabase } from "expo-sqlite";

interface NoteStoreState {
  notes: NoteListItem[];
  selectedNoteId: string | null;
  currentNote: Note | null;
  isLoading: boolean;
  showTrash: boolean;
  db: SQLiteDatabase | null;
  setDb: (db: SQLiteDatabase) => void;
  loadNotes: (params?: ListNotesParams) => void;
  selectNote: (id: string) => void;
  createNote: () => Note | null;
  updateNote: (params: UpdateNoteParams) => void;
  deleteNote: (id: string, permanent?: boolean) => void;
  pinNote: (id: string) => void;
  trashNote: (id: string) => void;
  restoreNote: (id: string) => void;
  setNoteState: (id: string, state: NoteState) => void;
  setShowTrash: (show: boolean) => void;
}

export const useNoteStore = create<NoteStoreState>((set, get) => ({
  notes: [],
  selectedNoteId: null,
  currentNote: null,
  isLoading: false,
  showTrash: false,
  db: null,

  setDb: (db: SQLiteDatabase) => {
    set({ db });
  },

  loadNotes: (params?: ListNotesParams) => {
    const { db } = get();
    if (!db) return;
    set({ isLoading: true });
    try {
      const notes = database.listNotes(
        db,
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

  selectNote: (id: string) => {
    const { db } = get();
    if (!db) return;
    set({ selectedNoteId: id });
    try {
      const note = database.getNote(db, id);
      set({ currentNote: note });
    } catch {
      set({ currentNote: null });
    }
  },

  createNote: () => {
    const { db } = get();
    if (!db) return null;
    try {
      const note = database.createNote(db, {
        title: "Untitled",
        content: "",
        tags: [],
      });
      set({ selectedNoteId: note.id, currentNote: note });
      get().loadNotes();
      return note;
    } catch {
      return null;
    }
  },

  updateNote: (params: UpdateNoteParams) => {
    const { db } = get();
    if (!db) return;
    try {
      const note = database.updateNote(db, params);
      set({ currentNote: note });
      const notes = get().notes.map((n) =>
        n.id === note.id
          ? {
              ...n,
              title: note.title,
              preview: note.content.slice(0, 120),
              updated_at: note.updated_at,
              is_pinned: note.is_pinned,
              word_count: note.word_count,
              tags: note.tags,
            }
          : n,
      );
      set({ notes });
      useTagStore.getState().loadTags();
    } catch {
      // ignore
    }
  },

  deleteNote: (id: string, permanent = false) => {
    const { db } = get();
    if (!db) return;
    try {
      database.deleteNote(db, id, permanent);
      const { selectedNoteId } = get();
      if (selectedNoteId === id) {
        set({ selectedNoteId: null, currentNote: null });
      }
      get().loadNotes();
    } catch {
      // ignore
    }
  },

  pinNote: (id: string) => {
    const { db } = get();
    if (!db) return;
    const note = get().currentNote;
    const isPinned = note?.id === id ? note.is_pinned : false;
    try {
      database.pinNote(db, id, !isPinned);
      if (note?.id === id) {
        set({ currentNote: { ...note, is_pinned: !isPinned } });
      }
      get().loadNotes();
    } catch {
      // ignore
    }
  },

  trashNote: (id: string) => {
    const { db } = get();
    if (!db) return;
    try {
      database.trashNote(db, id);
      const { selectedNoteId } = get();
      if (selectedNoteId === id) {
        set({ selectedNoteId: null, currentNote: null });
      }
      get().loadNotes();
    } catch {
      // ignore
    }
  },

  restoreNote: (id: string) => {
    const { db } = get();
    if (!db) return;
    try {
      database.restoreNote(db, id);
      get().loadNotes();
    } catch {
      // ignore
    }
  },

  setNoteState: (id: string, state: NoteState) => {
    const { db } = get();
    if (!db) return;
    try {
      const note = database.setNoteState(db, id, state);
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
