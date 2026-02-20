export interface SyncState {
  is_syncing: boolean;
  last_sync: string | null;
  error: string | null;
  files_synced: number;
}
