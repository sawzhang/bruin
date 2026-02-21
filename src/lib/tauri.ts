import { invoke } from "@tauri-apps/api/core";
import type {
  Note,
  NoteListItem,
  NoteState,
  CreateNoteParams,
  UpdateNoteParams,
  ListNotesParams,
  SearchNotesParams,
} from "../types/note";
import type { Tag } from "../types/tag";
import type { ActivityEvent } from "../types/activity";
import type { SyncState } from "../types/sync";
import type { Template } from "../types/template";
import type { Workspace } from "../types/workspace";
import type { KnowledgeGraph } from "../types/graph";

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

// State commands
export async function setNoteState(
  id: string,
  state: NoteState,
): Promise<Note> {
  return invoke("set_note_state", { id, state });
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

// Template commands
export async function listTemplates(): Promise<Template[]> {
  return invoke("list_templates");
}

export async function createNoteFromTemplate(
  templateId: string,
  title?: string,
): Promise<Note> {
  return invoke("create_note_from_template", {
    params: { template_id: templateId, title },
  });
}

// Activity commands
export async function getActivityFeed(
  limit?: number,
  noteId?: string,
): Promise<ActivityEvent[]> {
  return invoke("get_activity_feed", { limit: limit ?? 50, noteId });
}

// Workspace commands
export async function createWorkspace(
  name: string,
  description?: string,
  agentId?: string,
): Promise<Workspace> {
  return invoke("create_workspace", {
    name,
    description: description ?? "",
    agentId: agentId ?? null,
  });
}

export async function listWorkspaces(): Promise<Workspace[]> {
  return invoke("list_workspaces");
}

export async function deleteWorkspace(id: string): Promise<void> {
  return invoke("delete_workspace", { id });
}

// Knowledge Graph commands
export async function getKnowledgeGraph(
  centerNoteId?: string,
  depth?: number,
  maxNodes?: number,
): Promise<KnowledgeGraph> {
  return invoke("get_knowledge_graph", {
    centerNoteId: centerNoteId ?? null,
    depth: depth ?? 2,
    maxNodes: maxNodes ?? 200,
  });
}

// Semantic Search commands
export async function semanticSearch(
  queryEmbedding: number[],
  limit?: number,
): Promise<
  Array<{
    id: string;
    title: string;
    preview: string;
    similarity: number;
    tags: string[];
  }>
> {
  return invoke("semantic_search", {
    queryEmbedding,
    limit: limit ?? 10,
  });
}

// Import commands
export async function importMarkdownFiles(
  paths: string[],
): Promise<{ imported: number; skipped: number }> {
  return invoke("import_markdown_files", { paths });
}
