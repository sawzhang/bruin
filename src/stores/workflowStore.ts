import { create } from "zustand";
import type { WorkflowTemplate } from "../types/workflow";
import * as tauri from "../lib/tauri";

interface WorkflowState {
  workflows: WorkflowTemplate[];
  isLoading: boolean;
  loadWorkflows: () => Promise<void>;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  workflows: [],
  isLoading: false,

  loadWorkflows: async () => {
    set({ isLoading: true });
    try {
      const workflows = await tauri.listWorkflowTemplates();
      set({ workflows });
    } finally {
      set({ isLoading: false });
    }
  },
}));
