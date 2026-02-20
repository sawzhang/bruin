export type SyncStatus = "idle" | "syncing" | "error";

export interface SyncState {
  status: SyncStatus;
  lastSyncAt: string | null;
  error: string | null;
  pendingChanges: number;
}
