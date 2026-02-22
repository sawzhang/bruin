use crate::db::models::*;
use chrono::Utc;
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

fn fetch_agent(conn: &Connection, id: &str) -> Result<Agent, String> {
    conn.query_row(
        "SELECT id, name, description, capabilities, is_active, created_at, updated_at FROM agents WHERE id = ?1",
        [id],
        |row| {
            let caps_json: String = row.get(3)?;
            let capabilities: Vec<String> = serde_json::from_str(&caps_json).unwrap_or_default();
            Ok(Agent {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                capabilities,
                is_active: row.get::<_, i32>(4)? != 0,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
    .map_err(|e| format!("Agent not found: {}", e))
}

#[tauri::command]
pub fn register_agent(
    db: State<'_, Mutex<Connection>>,
    name: String,
    description: Option<String>,
    capabilities: Option<Vec<String>>,
) -> Result<Agent, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let caps = capabilities.unwrap_or_default();
    let caps_json = serde_json::to_string(&caps).unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        "INSERT INTO agents (id, name, description, capabilities, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![id, name, description.unwrap_or_default(), caps_json, now, now],
    )
    .map_err(|e| e.to_string())?;

    fetch_agent(&conn, &id)
}

#[tauri::command]
pub fn list_agents(db: State<'_, Mutex<Connection>>) -> Result<Vec<Agent>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, description, capabilities, is_active, created_at, updated_at FROM agents ORDER BY name")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let caps_json: String = row.get(3)?;
            let capabilities: Vec<String> = serde_json::from_str(&caps_json).unwrap_or_default();
            Ok(Agent {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                capabilities,
                is_active: row.get::<_, i32>(4)? != 0,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_agent(db: State<'_, Mutex<Connection>>, id: String) -> Result<Agent, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    fetch_agent(&conn, &id)
}

#[tauri::command]
pub fn update_agent(
    db: State<'_, Mutex<Connection>>,
    id: String,
    name: Option<String>,
    description: Option<String>,
    capabilities: Option<Vec<String>>,
) -> Result<Agent, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let existing = fetch_agent(&conn, &id)?;
    let now = Utc::now().to_rfc3339();

    let new_name = name.unwrap_or(existing.name);
    let new_desc = description.unwrap_or(existing.description);
    let new_caps = capabilities.unwrap_or(existing.capabilities);
    let caps_json = serde_json::to_string(&new_caps).unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        "UPDATE agents SET name = ?1, description = ?2, capabilities = ?3, updated_at = ?4 WHERE id = ?5",
        rusqlite::params![new_name, new_desc, caps_json, now, id],
    )
    .map_err(|e| e.to_string())?;

    fetch_agent(&conn, &id)
}

#[tauri::command]
pub fn deactivate_agent(db: State<'_, Mutex<Connection>>, id: String) -> Result<Agent, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE agents SET is_active = 0, updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now, id],
    )
    .map_err(|e| e.to_string())?;

    fetch_agent(&conn, &id)
}

#[tauri::command]
pub fn get_agent_audit_log(
    db: State<'_, Mutex<Connection>>,
    agent_id: String,
    limit: Option<i64>,
) -> Result<Vec<ActivityEvent>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50);

    let mut stmt = conn
        .prepare(
            "SELECT id, actor, event_type, note_id, timestamp, summary, data, agent_id \
             FROM activity_events WHERE agent_id = ?1 \
             ORDER BY timestamp DESC LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![agent_id, limit], |row| {
            Ok(ActivityEvent {
                id: row.get(0)?,
                actor: row.get(1)?,
                event_type: row.get(2)?,
                note_id: row.get(3)?,
                timestamp: row.get(4)?,
                summary: row.get(5)?,
                data: row.get(6)?,
                agent_id: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

// --- Agent-Workspace Binding ---

#[tauri::command]
pub fn bind_agent_workspace(
    db: State<'_, Mutex<Connection>>,
    agent_id: String,
    workspace_id: String,
    role: Option<String>,
) -> Result<AgentWorkspace, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    let role = role.unwrap_or_else(|| "member".to_string());

    conn.execute(
        "INSERT OR REPLACE INTO agent_workspaces (agent_id, workspace_id, role, created_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![agent_id, workspace_id, role, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(AgentWorkspace {
        agent_id,
        workspace_id,
        role,
        created_at: now,
    })
}

#[tauri::command]
pub fn unbind_agent_workspace(
    db: State<'_, Mutex<Connection>>,
    agent_id: String,
    workspace_id: String,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM agent_workspaces WHERE agent_id = ?1 AND workspace_id = ?2",
        rusqlite::params![agent_id, workspace_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_agent_workspaces(
    db: State<'_, Mutex<Connection>>,
    agent_id: String,
) -> Result<Vec<AgentWorkspace>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT agent_id, workspace_id, role, created_at FROM agent_workspaces WHERE agent_id = ?1")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([&agent_id], |row| {
            Ok(AgentWorkspace {
                agent_id: row.get(0)?,
                workspace_id: row.get(1)?,
                role: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_workspace_agents(
    db: State<'_, Mutex<Connection>>,
    workspace_id: String,
) -> Result<Vec<AgentWorkspace>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT agent_id, workspace_id, role, created_at FROM agent_workspaces WHERE workspace_id = ?1")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([&workspace_id], |row| {
            Ok(AgentWorkspace {
                agent_id: row.get(0)?,
                workspace_id: row.get(1)?,
                role: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}
