import { create } from "zustand";
import type { SQLiteDatabase } from "expo-sqlite";
import { fullReconcile } from "@/services/sync";
import { isICloudAvailable } from "@/services/icloud";

interface SyncStoreState {
  isSyncing: boolean;
  lastSync: string | null;
  error: string | null;
  filesSynced: number;
  iCloudAvailable: boolean;
  db: SQLiteDatabase | null;
  setDb: (db: SQLiteDatabase) => void;
  triggerSync: () => Promise<void>;
  checkICloudStatus: () => Promise<void>;
  setLastSync: (date: string | null) => void;
}

export const useSyncStore = create<SyncStoreState>((set, get) => ({
  isSyncing: false,
  lastSync: null,
  error: null,
  filesSynced: 0,
  iCloudAvailable: false,
  db: null,

  setDb: (db: SQLiteDatabase) => {
    set({ db });
  },

  triggerSync: async () => {
    const { db, isSyncing } = get();
    if (!db || isSyncing) return;

    set({ isSyncing: true, error: null });
    try {
      const result = await fullReconcile(db);
      const now = new Date().toISOString();
      set({
        isSyncing: false,
        lastSync: now,
        filesSynced: result.filesSynced,
      });
    } catch (e) {
      set({
        isSyncing: false,
        error: e instanceof Error ? e.message : "Sync failed",
      });
    }
  },

  checkICloudStatus: async () => {
    try {
      const available = await isICloudAvailable();
      set({ iCloudAvailable: available });
    } catch {
      set({ iCloudAvailable: false });
    }
  },

  setLastSync: (date: string | null) => {
    set({ lastSync: date });
  },
}));
