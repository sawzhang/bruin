import { create } from "zustand";
import type { ActivityEvent } from "../types/activity";
import * as tauri from "../lib/tauri";
import { useToastStore } from "./toastStore";

interface ActivityState {
  events: ActivityEvent[];
  isLoading: boolean;
  loadEvents: (noteId?: string, agentId?: string) => Promise<void>;
}

export const useActivityStore = create<ActivityState>((set) => ({
  events: [],
  isLoading: false,

  loadEvents: async (noteId?: string, agentId?: string) => {
    set({ isLoading: true });
    try {
      const events = await tauri.getActivityFeed(50, noteId, agentId);
      set({ events, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      useToastStore.getState().addToast({ type: "error", message: `Failed to load activity: ${err}` });
    }
  },
}));
