use crate::db::models::Task;
use crate::commands::notes::log_activity;
use chrono::Utc;
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

fn fetch_task(conn: &Connection, id: &str) -> Result<Task, String> {
    conn.query_row(
        "SELECT id, title, description, status, priority, due_date, assigned_agent_id, linked_note_id, workspace_id, created_at, updated_at FROM tasks WHERE id = ?1",
        [id],
        |row| {
            Ok(Task {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                status: row.get(3)?,
                priority: row.get(4)?,
                due_date: row.get(5)?,
                assigned_agent_id: row.get(6)?,
                linked_note_id: row.get(7)?,
                workspace_id: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        },
    )
    .map_err(|e| format!("Task not found: {}", e))
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn create_task(
    db: State<'_, Mutex<Connection>>,
    title: String,
    description: Option<String>,
    priority: Option<String>,
    due_date: Option<String>,
    assigned_agent_id: Option<String>,
    linked_note_id: Option<String>,
    workspace_id: Option<String>,
) -> Result<Task, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO tasks (id, title, description, priority, due_date, assigned_agent_id, linked_note_id, workspace_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            id,
            title,
            description.unwrap_or_default(),
            priority.unwrap_or_else(|| "medium".to_string()),
            due_date,
            assigned_agent_id,
            linked_note_id,
            workspace_id,
            now,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    log_activity(&conn, "user", "task_created", None, &format!("Created task '{}'", title), "{}");
    fetch_task(&conn, &id)
}

#[tauri::command]
pub fn list_tasks(
    db: State<'_, Mutex<Connection>>,
    status: Option<String>,
    assigned_agent_id: Option<String>,
    workspace_id: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<Task>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(100);

    let mut conditions = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref s) = status {
        params.push(Box::new(s.clone()));
        conditions.push(format!("status = ?{}", params.len()));
    }
    if let Some(ref a) = assigned_agent_id {
        params.push(Box::new(a.clone()));
        conditions.push(format!("assigned_agent_id = ?{}", params.len()));
    }
    if let Some(ref w) = workspace_id {
        params.push(Box::new(w.clone()));
        conditions.push(format!("workspace_id = ?{}", params.len()));
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    params.push(Box::new(limit));
    let sql = format!(
        "SELECT id, title, description, status, priority, due_date, assigned_agent_id, linked_note_id, workspace_id, created_at, updated_at FROM tasks {} ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, updated_at DESC LIMIT ?{}",
        where_clause,
        params.len()
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let rows = stmt
        .query_map(param_refs.as_slice(), |row| {
            Ok(Task {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                status: row.get(3)?,
                priority: row.get(4)?,
                due_date: row.get(5)?,
                assigned_agent_id: row.get(6)?,
                linked_note_id: row.get(7)?,
                workspace_id: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_task(db: State<'_, Mutex<Connection>>, id: String) -> Result<Task, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    fetch_task(&conn, &id)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn update_task(
    db: State<'_, Mutex<Connection>>,
    id: String,
    title: Option<String>,
    description: Option<String>,
    status: Option<String>,
    priority: Option<String>,
    due_date: Option<String>,
    assigned_agent_id: Option<String>,
    linked_note_id: Option<String>,
) -> Result<Task, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let existing = fetch_task(&conn, &id)?;
    let now = Utc::now().to_rfc3339();

    let new_title = title.unwrap_or(existing.title);
    let new_desc = description.unwrap_or(existing.description);
    let new_status = status.unwrap_or(existing.status);
    let new_priority = priority.unwrap_or(existing.priority);
    let new_due = due_date.or(existing.due_date);
    let new_agent = assigned_agent_id.or(existing.assigned_agent_id);
    let new_note = linked_note_id.or(existing.linked_note_id);

    conn.execute(
        "UPDATE tasks SET title = ?1, description = ?2, status = ?3, priority = ?4, due_date = ?5, assigned_agent_id = ?6, linked_note_id = ?7, updated_at = ?8 WHERE id = ?9",
        rusqlite::params![new_title, new_desc, new_status, new_priority, new_due, new_agent, new_note, now, id],
    )
    .map_err(|e| e.to_string())?;

    log_activity(&conn, "user", "task_updated", None, &format!("Updated task '{}'", new_title), "{}");
    fetch_task(&conn, &id)
}

#[tauri::command]
pub fn complete_task(db: State<'_, Mutex<Connection>>, id: String) -> Result<Task, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE tasks SET status = 'done', updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now, id],
    )
    .map_err(|e| e.to_string())?;

    let task = fetch_task(&conn, &id)?;
    log_activity(&conn, "user", "task_completed", None, &format!("Completed task '{}'", task.title), "{}");
    Ok(task)
}

#[tauri::command]
pub fn delete_task(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let task = fetch_task(&conn, &id)?;

    conn.execute("DELETE FROM tasks WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;

    log_activity(&conn, "user", "task_deleted", None, &format!("Deleted task '{}'", task.title), "{}");
    Ok(())
}
