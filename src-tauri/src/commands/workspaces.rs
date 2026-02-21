use crate::db::models::Workspace;
use chrono::Utc;
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

use super::notes::log_activity;

#[tauri::command]
pub fn create_workspace(
    db: State<'_, Mutex<Connection>>,
    name: String,
    description: Option<String>,
    agent_id: Option<String>,
) -> Result<Workspace, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let desc = description.unwrap_or_default();

    conn.execute(
        "INSERT INTO workspaces (id, name, description, agent_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![id, name, desc, agent_id, now, now],
    )
    .map_err(|e| e.to_string())?;

    log_activity(&conn, "user", "workspace_created", None, &format!("Created workspace '{}'", name), "{}");

    Ok(Workspace {
        id,
        name,
        description: desc,
        agent_id,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn list_workspaces(
    db: State<'_, Mutex<Connection>>,
) -> Result<Vec<Workspace>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, description, agent_id, created_at, updated_at FROM workspaces ORDER BY name")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Workspace {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                agent_id: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut workspaces = Vec::new();
    for row in rows {
        workspaces.push(row.map_err(|e| e.to_string())?);
    }
    Ok(workspaces)
}

#[tauri::command]
pub fn delete_workspace(
    db: State<'_, Mutex<Connection>>,
    id: String,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    // workspace_id on notes will be SET NULL via FK constraint
    conn.execute("DELETE FROM workspaces WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;

    log_activity(&conn, "user", "workspace_deleted", None, &format!("Deleted workspace '{}'", id), "{}");

    Ok(())
}
