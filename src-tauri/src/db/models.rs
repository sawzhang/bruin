use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
    pub is_trashed: bool,
    pub is_pinned: bool,
    pub word_count: i64,
    pub file_path: Option<String>,
    pub sync_hash: Option<String>,
    pub tags: Vec<String>,
    pub state: String,
    pub workspace_id: Option<String>,
    pub version: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteListItem {
    pub id: String,
    pub title: String,
    pub preview: String,
    pub updated_at: String,
    pub is_pinned: bool,
    pub is_trashed: bool,
    pub word_count: i64,
    pub tags: Vec<String>,
    pub state: String,
    pub workspace_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub parent_name: Option<String>,
    pub note_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Webhook {
    pub id: String,
    pub url: String,
    pub event_types: Vec<String>,
    pub secret: String,
    pub is_active: bool,
    pub created_at: String,
    pub last_triggered_at: Option<String>,
    pub failure_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Template {
    pub id: String,
    pub name: String,
    pub description: String,
    pub content: String,
    pub tags: Vec<String>,
    pub initial_state: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityEvent {
    pub id: i64,
    pub actor: String,
    pub event_type: String,
    pub note_id: Option<String>,
    pub timestamp: String,
    pub summary: String,
    pub data: String,
    pub agent_id: Option<String>,
}

// --- Agents ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub description: String,
    pub capabilities: Vec<String>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

// --- Tasks ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: String,
    pub priority: String,
    pub due_date: Option<String>,
    pub assigned_agent_id: Option<String>,
    pub linked_note_id: Option<String>,
    pub workspace_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

// --- Workflow Templates ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub steps: Vec<WorkflowStep>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    pub order: i32,
    pub tool_name: String,
    pub description: String,
    pub params: serde_json::Value,
    pub use_result_as: Option<String>,
}

// --- Webhook Logs ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookLog {
    pub id: i64,
    pub webhook_id: String,
    pub event_type: String,
    pub payload: String,
    pub status_code: Option<i32>,
    pub response_body: Option<String>,
    pub attempt: i32,
    pub success: bool,
    pub error_message: Option<String>,
    pub timestamp: String,
}

// --- Agent Workspaces ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentWorkspace {
    pub agent_id: String,
    pub workspace_id: String,
    pub role: String,
    pub created_at: String,
}

// --- Workspaces ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub description: String,
    pub agent_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

// --- Knowledge Graph ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: String,
    pub title: String,
    pub link_count: i64,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
    pub link_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeGraph {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateNoteParams {
    pub title: Option<String>,
    pub content: Option<String>,
    pub workspace_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateNoteParams {
    pub id: String,
    pub title: Option<String>,
    pub content: Option<String>,
    pub expected_version: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListNotesParams {
    pub tag: Option<String>,
    pub tags: Option<Vec<String>>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub trashed: Option<bool>,
    pub workspace_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchNotesParams {
    pub query: String,
    pub limit: Option<i64>,
}
