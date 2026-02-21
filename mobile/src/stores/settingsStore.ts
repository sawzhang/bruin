import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { ThemePreference } from "@/types";
import { StorageKeys } from "@/constants";

interface SettingsState {
  theme: ThemePreference;
  syncOnLaunch: boolean;
  isLoaded: boolean;
  loadSettings: () => void;
  setTheme: (theme: ThemePreference) => void;
  setSyncOnLaunch: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: "system",
  syncOnLaunch: true,
  isLoaded: false,

  loadSettings: () => {
    try {
      const theme =
        (SecureStore.getItem(StorageKeys.THEME) as ThemePreference) || "system";
      const syncOnLaunch =
        SecureStore.getItem(StorageKeys.SYNC_ON_LAUNCH) !== "false";
      set({ theme, syncOnLaunch, isLoaded: true });
    } catch {
      set({ isLoaded: true });
    }
  },

  setTheme: (theme: ThemePreference) => {
    SecureStore.setItem(StorageKeys.THEME, theme);
    set({ theme });
  },

  setSyncOnLaunch: (enabled: boolean) => {
    SecureStore.setItem(StorageKeys.SYNC_ON_LAUNCH, String(enabled));
    set({ syncOnLaunch: enabled });
  },
}));
