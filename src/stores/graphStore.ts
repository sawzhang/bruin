import { create } from "zustand";
import type { KnowledgeGraph } from "../types/graph";
import * as tauri from "../lib/tauri";
import { useToastStore } from "./toastStore";

interface GraphState {
  graph: KnowledgeGraph | null;
  selectedNodeId: string | null;
  isLoading: boolean;
  loadGraph: (centerNoteId?: string, depth?: number, maxNodes?: number) => Promise<void>;
  setSelectedNodeId: (id: string | null) => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  graph: null,
  selectedNodeId: null,
  isLoading: false,

  loadGraph: async (centerNoteId?: string, depth?: number, maxNodes?: number) => {
    set({ isLoading: true });
    try {
      const graph = await tauri.getKnowledgeGraph(centerNoteId, depth, maxNodes);
      set({ graph, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      useToastStore.getState().addToast({ type: "error", message: `Failed to load graph: ${err}` });
    }
  },

  setSelectedNodeId: (id: string | null) => {
    set({ selectedNodeId: id });
  },
}));
