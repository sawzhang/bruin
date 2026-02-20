import { invoke } from "@tauri-apps/api/core";
import type {
  Note,
  NoteListItem,
  CreateNoteParams,
  UpdateNoteParams,
  ListNotesParams,
  SearchNotesParams,
} from "../types/note";
import type { Tag } from "../types/tag";
import type { SyncState } from "../types/sync";

// Note commands
export async function createNote(params: CreateNoteParams): Promise<Note> {
  return invoke("create_note", { params });
}

export async function getNote(id: string): Promise<Note> {
  return invoke("get_note", { id });
}

export async function updateNote(params: UpdateNoteParams): Promise<Note> {
  return invoke("update_note", { params });
}

export async function deleteNote(
  id: string,
  permanent: boolean = false,
): Promise<void> {
  return invoke("delete_note", { id, permanent });
}

export async function listNotes(
  params: ListNotesParams,
): Promise<NoteListItem[]> {
  return invoke("list_notes", { params });
}

export async function pinNote(id: string, pinned: boolean): Promise<void> {
  return invoke("pin_note", { id, pinned });
}

export async function trashNote(id: string): Promise<void> {
  return invoke("trash_note", { id });
}

export async function restoreNote(id: string): Promise<void> {
  return invoke("restore_note", { id });
}

// Tag commands
export async function listTags(): Promise<Tag[]> {
  return invoke("list_tags");
}

export async function getNotesByTag(tag: string): Promise<NoteListItem[]> {
  return invoke("get_notes_by_tag", { tag });
}

// Search commands
export async function searchNotes(
  params: SearchNotesParams,
): Promise<NoteListItem[]> {
  return invoke("search_notes", { params });
}

// Sync commands
export async function triggerSync(): Promise<void> {
  return invoke("trigger_sync");
}

export async function getSyncStatus(): Promise<SyncState> {
  return invoke("get_sync_status");
}

// Import commands
export async function importMarkdownFiles(
  paths: string[],
): Promise<{ imported: number; skipped: number }> {
  return invoke("import_markdown_files", { paths });
}
