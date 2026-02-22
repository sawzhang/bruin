import { create } from "zustand";
import { DEFAULT_THEME_ID } from "../lib/themes";

const THEME_STORAGE_KEY = "bruin-theme";

function loadSavedTheme(): string {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) ?? DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

interface UIState {
  sidebarWidth: number;
  noteListWidth: number;
  isCommandPaletteOpen: boolean;
  isThemePickerOpen: boolean;
  isActivityPanelOpen: boolean;
  isTemplatePickerOpen: boolean;
  isGraphViewOpen: boolean;
  isSettingsOpen: boolean;
  isTaskPanelOpen: boolean;
  isWebhookManagerOpen: boolean;
  isWorkflowBrowserOpen: boolean;
  isAgentDashboardOpen: boolean;
  theme: string;
  setSidebarWidth: (w: number) => void;
  setNoteListWidth: (w: number) => void;
  toggleCommandPalette: () => void;
  toggleThemePicker: () => void;
  toggleActivityPanel: () => void;
  toggleTemplatePicker: () => void;
  toggleGraphView: () => void;
  toggleSettings: () => void;
  toggleTaskPanel: () => void;
  toggleWebhookManager: () => void;
  toggleWorkflowBrowser: () => void;
  toggleAgentDashboard: () => void;
  setTheme: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarWidth: 220,
  noteListWidth: 280,
  isCommandPaletteOpen: false,
  isThemePickerOpen: false,
  isActivityPanelOpen: false,
  isTemplatePickerOpen: false,
  isGraphViewOpen: false,
  isSettingsOpen: false,
  isTaskPanelOpen: false,
  isWebhookManagerOpen: false,
  isWorkflowBrowserOpen: false,
  isAgentDashboardOpen: false,
  theme: loadSavedTheme(),

  setSidebarWidth: (w: number) => set({ sidebarWidth: Math.max(160, Math.min(400, w)) }),
  setNoteListWidth: (w: number) => set({ noteListWidth: Math.max(200, Math.min(500, w)) }),
  toggleCommandPalette: () =>
    set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
  toggleThemePicker: () =>
    set((state) => ({ isThemePickerOpen: !state.isThemePickerOpen })),
  toggleActivityPanel: () =>
    set((state) => ({ isActivityPanelOpen: !state.isActivityPanelOpen })),
  toggleTemplatePicker: () =>
    set((state) => ({ isTemplatePickerOpen: !state.isTemplatePickerOpen })),
  toggleGraphView: () =>
    set((state) => ({ isGraphViewOpen: !state.isGraphViewOpen })),
  toggleSettings: () =>
    set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
  toggleTaskPanel: () =>
    set((state) => ({ isTaskPanelOpen: !state.isTaskPanelOpen })),
  toggleWebhookManager: () =>
    set((state) => ({ isWebhookManagerOpen: !state.isWebhookManagerOpen })),
  toggleWorkflowBrowser: () =>
    set((state) => ({ isWorkflowBrowserOpen: !state.isWorkflowBrowserOpen })),
  toggleAgentDashboard: () =>
    set((state) => ({ isAgentDashboardOpen: !state.isAgentDashboardOpen })),
  setTheme: (id: string) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      // ignore storage errors
    }
    set({ theme: id });
  },
}));
