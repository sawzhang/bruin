import { create } from "zustand";
import type { Task, TaskStatus, TaskPriority } from "../types/task";
import * as tauri from "../lib/tauri";

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  filterStatus: TaskStatus | null;
  loadTasks: (status?: TaskStatus, agentId?: string) => Promise<void>;
  createTask: (title: string, description?: string, priority?: TaskPriority, dueDate?: string, agentId?: string, noteId?: string) => Promise<Task>;
  completeTask: (id: string) => Promise<void>;
  updateTask: (id: string, updates: { title?: string; status?: TaskStatus; priority?: TaskPriority }) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  setFilterStatus: (status: TaskStatus | null) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,
  filterStatus: null,

  loadTasks: async (status, agentId) => {
    set({ isLoading: true });
    try {
      const tasks = await tauri.listTasks(status ?? undefined, agentId);
      set({ tasks });
    } finally {
      set({ isLoading: false });
    }
  },

  createTask: async (title, description, priority, dueDate, agentId, noteId) => {
    const task = await tauri.createTask(title, description, priority, dueDate, agentId, noteId);
    set({ tasks: [task, ...get().tasks] });
    return task;
  },

  completeTask: async (id) => {
    const updated = await tauri.completeTask(id);
    set({ tasks: get().tasks.map((t) => (t.id === id ? updated : t)) });
  },

  updateTask: async (id, updates) => {
    const updated = await tauri.updateTask(id, updates.title, undefined, updates.status, updates.priority);
    set({ tasks: get().tasks.map((t) => (t.id === id ? updated : t)) });
  },

  deleteTask: async (id) => {
    await tauri.deleteTask(id);
    set({ tasks: get().tasks.filter((t) => t.id !== id) });
  },

  setFilterStatus: (status) => set({ filterStatus: status }),
}));
