use crate::db::models::{WorkflowTemplate, WorkflowStep};
use chrono::Utc;
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

fn fetch_workflow(conn: &Connection, id: &str) -> Result<WorkflowTemplate, String> {
    conn.query_row(
        "SELECT id, name, description, category, steps, created_at, updated_at FROM workflow_templates WHERE id = ?1",
        [id],
        |row| {
            let steps_json: String = row.get(4)?;
            let steps: Vec<WorkflowStep> = serde_json::from_str(&steps_json).unwrap_or_default();
            Ok(WorkflowTemplate {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                category: row.get(3)?,
                steps,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
    .map_err(|e| format!("Workflow template not found: {}", e))
}

#[tauri::command]
pub fn list_workflow_templates(
    db: State<'_, Mutex<Connection>>,
) -> Result<Vec<WorkflowTemplate>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, description, category, steps, created_at, updated_at FROM workflow_templates ORDER BY name")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let steps_json: String = row.get(4)?;
            let steps: Vec<WorkflowStep> = serde_json::from_str(&steps_json).unwrap_or_default();
            Ok(WorkflowTemplate {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                category: row.get(3)?,
                steps,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_workflow_template(
    db: State<'_, Mutex<Connection>>,
    id: String,
) -> Result<WorkflowTemplate, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    fetch_workflow(&conn, &id)
}

#[tauri::command]
pub fn create_workflow_template(
    db: State<'_, Mutex<Connection>>,
    name: String,
    description: Option<String>,
    category: Option<String>,
    steps: Vec<WorkflowStep>,
) -> Result<WorkflowTemplate, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let steps_json = serde_json::to_string(&steps).unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        "INSERT INTO workflow_templates (id, name, description, category, steps, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            id,
            name,
            description.unwrap_or_default(),
            category.unwrap_or_else(|| "general".to_string()),
            steps_json,
            now,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    fetch_workflow(&conn, &id)
}

#[tauri::command]
pub fn delete_workflow_template(
    db: State<'_, Mutex<Connection>>,
    id: String,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM workflow_templates WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
