import { create } from "zustand";
import type { Agent } from "../types/agent";
import * as tauri from "../lib/tauri";

interface AgentState {
  agents: Agent[];
  isLoading: boolean;
  loadAgents: () => Promise<void>;
  registerAgent: (name: string, description?: string, capabilities?: string[]) => Promise<Agent>;
  deactivateAgent: (id: string) => Promise<void>;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  isLoading: false,

  loadAgents: async () => {
    set({ isLoading: true });
    try {
      const agents = await tauri.listAgents();
      set({ agents });
    } finally {
      set({ isLoading: false });
    }
  },

  registerAgent: async (name, description, capabilities) => {
    const agent = await tauri.registerAgent(name, description, capabilities);
    set({ agents: [...get().agents, agent] });
    return agent;
  },

  deactivateAgent: async (id) => {
    const updated = await tauri.deactivateAgent(id);
    set({ agents: get().agents.map((a) => (a.id === id ? updated : a)) });
  },
}));
