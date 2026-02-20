import { create } from "zustand";

interface UIState {
  sidebarWidth: number;
  noteListWidth: number;
  isCommandPaletteOpen: boolean;
  setSidebarWidth: (w: number) => void;
  setNoteListWidth: (w: number) => void;
  toggleCommandPalette: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarWidth: 220,
  noteListWidth: 280,
  isCommandPaletteOpen: false,

  setSidebarWidth: (w: number) => set({ sidebarWidth: Math.max(160, Math.min(400, w)) }),
  setNoteListWidth: (w: number) => set({ noteListWidth: Math.max(200, Math.min(500, w)) }),
  toggleCommandPalette: () =>
    set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
}));
