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
import type { Agent } from "../types/agent";
import type { Task, TaskStatus, TaskPriority } from "../types/task";
import type { WorkflowTemplate, WorkflowStep } from "../types/workflow";
import type { Webhook, WebhookLog } from "../types/webhook";

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
  agentId?: string,
): Promise<ActivityEvent[]> {
  return invoke("get_activity_feed", { limit: limit ?? 50, noteId, agentId });
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

// Settings commands
export async function getSetting(key: string): Promise<string | null> {
  return invoke("get_setting", { key });
}

export async function setSetting(key: string, value: string): Promise<void> {
  return invoke("set_setting", { key, value });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  return invoke("get_all_settings");
}

// Export commands
export async function exportNoteMarkdown(
  id: string,
  stripFrontmatter?: boolean,
): Promise<string> {
  return invoke("export_note_markdown", { id, stripFrontmatter: stripFrontmatter ?? false });
}

export async function exportNoteHtml(id: string): Promise<string> {
  return invoke("export_note_html", { id });
}

// Agent commands
export async function registerAgent(
  name: string,
  description?: string,
  capabilities?: string[],
): Promise<Agent> {
  return invoke("register_agent", { name, description, capabilities });
}

export async function listAgents(): Promise<Agent[]> {
  return invoke("list_agents");
}

export async function getAgent(id: string): Promise<Agent> {
  return invoke("get_agent", { id });
}

export async function updateAgent(
  id: string,
  name?: string,
  description?: string,
  capabilities?: string[],
): Promise<Agent> {
  return invoke("update_agent", { id, name, description, capabilities });
}

export async function deactivateAgent(id: string): Promise<Agent> {
  return invoke("deactivate_agent", { id });
}

export async function getAgentAuditLog(
  agentId: string,
  limit?: number,
): Promise<import("../types/activity").ActivityEvent[]> {
  return invoke("get_agent_audit_log", { agentId, limit });
}

// Agent-Workspace commands
export async function bindAgentWorkspace(
  agentId: string,
  workspaceId: string,
  role?: string,
): Promise<{ agent_id: string; workspace_id: string; role: string; created_at: string }> {
  return invoke("bind_agent_workspace", { agentId, workspaceId, role });
}

export async function unbindAgentWorkspace(
  agentId: string,
  workspaceId: string,
): Promise<void> {
  return invoke("unbind_agent_workspace", { agentId, workspaceId });
}

export async function getAgentWorkspaces(
  agentId: string,
): Promise<Array<{ agent_id: string; workspace_id: string; role: string; created_at: string }>> {
  return invoke("get_agent_workspaces", { agentId });
}

export async function getWorkspaceAgents(
  workspaceId: string,
): Promise<Array<{ agent_id: string; workspace_id: string; role: string; created_at: string }>> {
  return invoke("get_workspace_agents", { workspaceId });
}

// Task commands
export async function createTask(
  title: string,
  description?: string,
  priority?: TaskPriority,
  dueDate?: string,
  assignedAgentId?: string,
  linkedNoteId?: string,
  workspaceId?: string,
): Promise<Task> {
  return invoke("create_task", {
    title,
    description,
    priority,
    dueDate: dueDate ?? null,
    assignedAgentId: assignedAgentId ?? null,
    linkedNoteId: linkedNoteId ?? null,
    workspaceId: workspaceId ?? null,
  });
}

export async function listTasks(
  status?: TaskStatus,
  assignedAgentId?: string,
  workspaceId?: string,
  limit?: number,
): Promise<Task[]> {
  return invoke("list_tasks", {
    status: status ?? null,
    assignedAgentId: assignedAgentId ?? null,
    workspaceId: workspaceId ?? null,
    limit: limit ?? 100,
  });
}

export async function getTask(id: string): Promise<Task> {
  return invoke("get_task", { id });
}

export async function updateTask(
  id: string,
  title?: string,
  description?: string,
  status?: TaskStatus,
  priority?: TaskPriority,
  dueDate?: string,
  assignedAgentId?: string,
  linkedNoteId?: string,
): Promise<Task> {
  return invoke("update_task", {
    id,
    title,
    description,
    status,
    priority,
    dueDate: dueDate ?? null,
    assignedAgentId: assignedAgentId ?? null,
    linkedNoteId: linkedNoteId ?? null,
  });
}

export async function completeTask(id: string): Promise<Task> {
  return invoke("complete_task", { id });
}

export async function deleteTask(id: string): Promise<void> {
  return invoke("delete_task", { id });
}

// Workflow commands
export async function listWorkflowTemplates(): Promise<WorkflowTemplate[]> {
  return invoke("list_workflow_templates");
}

export async function getWorkflowTemplate(id: string): Promise<WorkflowTemplate> {
  return invoke("get_workflow_template", { id });
}

export async function createWorkflowTemplate(
  name: string,
  description?: string,
  category?: string,
  steps?: WorkflowStep[],
): Promise<WorkflowTemplate> {
  return invoke("create_workflow_template", {
    name,
    description,
    category,
    steps: steps ?? [],
  });
}

export async function deleteWorkflowTemplate(id: string): Promise<void> {
  return invoke("delete_workflow_template", { id });
}

// Webhook management commands
export async function updateWebhook(
  id: string,
  url?: string,
  eventTypes?: string[],
  isActive?: boolean,
): Promise<Webhook> {
  return invoke("update_webhook", { id, url, eventTypes, isActive });
}

export async function testWebhook(id: string): Promise<WebhookLog> {
  return invoke("test_webhook", { id });
}

export async function getWebhookLogs(
  webhookId: string,
  limit?: number,
): Promise<WebhookLog[]> {
  return invoke("get_webhook_logs", { webhookId, limit });
}

// Webhook CRUD (re-export existing with proper types)
export async function listWebhooks(): Promise<Webhook[]> {
  return invoke("list_webhooks");
}

export async function registerWebhook(
  url: string,
  eventTypes: string[],
  secret: string,
): Promise<Webhook> {
  return invoke("register_webhook", { url, eventTypes, secret });
}

export async function deleteWebhook(id: string): Promise<void> {
  return invoke("delete_webhook", { id });
}

// Image commands
export async function saveImage(
  data: number[],
  filename: string,
): Promise<string> {
  return invoke("save_image", { data, filename });
}
