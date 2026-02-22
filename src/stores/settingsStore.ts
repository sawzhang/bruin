import { create } from "zustand";
import * as tauri from "../lib/tauri";

interface SettingsState {
  fontFamily: string;
  fontSize: number;
  autoSaveInterval: number;
  spellCheck: boolean;
  showLineNumbers: boolean;
  defaultWorkspaceId: string | null;
  loaded: boolean;
  loadSettings: () => Promise<void>;
  setSetting: (key: string, value: string) => Promise<void>;
}

const DEFAULTS: Record<string, string> = {
  fontFamily: "system-ui",
  fontSize: "16",
  autoSaveInterval: "1000",
  spellCheck: "true",
  showLineNumbers: "false",
  defaultWorkspaceId: "",
};

export const useSettingsStore = create<SettingsState>((set) => ({
  fontFamily: "system-ui",
  fontSize: 16,
  autoSaveInterval: 1000,
  spellCheck: true,
  showLineNumbers: false,
  defaultWorkspaceId: null,
  loaded: false,

  loadSettings: async () => {
    try {
      const all = await tauri.getAllSettings();
      set({
        fontFamily: all.fontFamily ?? DEFAULTS.fontFamily,
        fontSize: parseInt(all.fontSize ?? DEFAULTS.fontSize, 10),
        autoSaveInterval: parseInt(all.autoSaveInterval ?? DEFAULTS.autoSaveInterval, 10),
        spellCheck: (all.spellCheck ?? DEFAULTS.spellCheck) === "true",
        showLineNumbers: (all.showLineNumbers ?? DEFAULTS.showLineNumbers) === "true",
        defaultWorkspaceId: all.defaultWorkspaceId || null,
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },

  setSetting: async (key: string, value: string) => {
    try {
      await tauri.setSetting(key, value);
      // Update local state
      set((state) => {
        const updates: Partial<SettingsState> = {};
        switch (key) {
          case "fontFamily":
            updates.fontFamily = value;
            break;
          case "fontSize":
            updates.fontSize = parseInt(value, 10);
            break;
          case "autoSaveInterval":
            updates.autoSaveInterval = parseInt(value, 10);
            break;
          case "spellCheck":
            updates.spellCheck = value === "true";
            break;
          case "showLineNumbers":
            updates.showLineNumbers = value === "true";
            break;
          case "defaultWorkspaceId":
            updates.defaultWorkspaceId = value || null;
            break;
        }
        return { ...state, ...updates };
      });
    } catch {
      // ignore
    }
  },
}));
