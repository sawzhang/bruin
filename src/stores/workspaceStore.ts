import { create } from "zustand";
import type { Workspace } from "../types/workspace";
import * as tauri from "../lib/tauri";

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  loadWorkspaces: () => Promise<void>;
  setCurrentWorkspace: (id: string | null) => void;
  createWorkspace: (name: string, description?: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  currentWorkspaceId: null,

  loadWorkspaces: async () => {
    try {
      const workspaces = await tauri.listWorkspaces();
      set({ workspaces });
    } catch {
      // ignore
    }
  },

  setCurrentWorkspace: (id: string | null) => {
    set({ currentWorkspaceId: id });
  },

  createWorkspace: async (name: string, description?: string) => {
    try {
      await tauri.createWorkspace(name, description);
      await get().loadWorkspaces();
    } catch {
      // ignore
    }
  },

  deleteWorkspace: async (id: string) => {
    try {
      await tauri.deleteWorkspace(id);
      if (get().currentWorkspaceId === id) {
        set({ currentWorkspaceId: null });
      }
      await get().loadWorkspaces();
    } catch {
      // ignore
    }
  },
}));
