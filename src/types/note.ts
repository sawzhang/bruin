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
