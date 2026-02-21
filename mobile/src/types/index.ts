// Note types — ported from desktop src/types/note.ts
export type NoteState = "draft" | "review" | "published";

export interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_trashed: boolean;
  is_pinned: boolean;
  word_count: number;
  file_path: string | null;
  sync_hash: string | null;
  tags: string[];
  state: NoteState;
  workspace_id: string | null;
}

export interface NoteListItem {
  id: string;
  title: string;
  preview: string;
  updated_at: string;
  is_pinned: boolean;
  is_trashed: boolean;
  word_count: number;
  tags: string[];
  state: NoteState;
  workspace_id: string | null;
}

export interface CreateNoteParams {
  title: string;
  content: string;
  tags?: string[];
}

export interface UpdateNoteParams {
  id: string;
  title?: string;
  content?: string;
  tags?: string[];
}

export interface ListNotesParams {
  tag?: string;
  trashed?: boolean;
  sort_by?: "updated_at" | "created_at" | "title";
  sort_order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface SearchNotesParams {
  query: string;
  limit?: number;
  offset?: number;
}

// Tag types — ported from desktop src/types/tag.ts
export interface Tag {
  id: number;
  name: string;
  parent_name: string | null;
  note_count: number;
}

export interface TagTreeNode {
  name: string;
  fullPath: string;
  noteCount: number;
  children: TagTreeNode[];
}

// Sync types — ported from desktop src/types/sync.ts
export interface SyncState {
  is_syncing: boolean;
  last_sync: string | null;
  error: string | null;
  files_synced: number;
}

export type SyncAction = "import" | "export" | "skip" | "conflict";

// Mobile-specific types
export interface FrontmatterData {
  id: string | null;
  title: string | null;
  tags: string[];
  created_at: string | null;
  updated_at: string | null;
  is_pinned: boolean;
}

export type ThemePreference = "light" | "dark" | "system";

export interface AppSettings {
  theme: ThemePreference;
  syncOnLaunch: boolean;
}
