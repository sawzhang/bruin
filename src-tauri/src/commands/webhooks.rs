use crate::db::models::Webhook;
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;
use chrono::Utc;

fn fetch_webhook(conn: &Connection, id: &str) -> Result<Webhook, String> {
    conn.query_row(
        "SELECT id, url, event_types, secret, is_active, created_at, last_triggered_at, failure_count FROM webhooks WHERE id = ?1",
        [id],
        |row| {
            let event_types_json: String = row.get(2)?;
            let event_types: Vec<String> = serde_json::from_str(&event_types_json).unwrap_or_default();
            Ok(Webhook {
                id: row.get(0)?,
                url: row.get(1)?,
                event_types,
                secret: row.get(3)?,
                is_active: row.get::<_, i32>(4)? != 0,
                created_at: row.get(5)?,
                last_triggered_at: row.get(6)?,
                failure_count: row.get(7)?,
            })
        },
    )
    .map_err(|e| format!("Webhook not found: {}", e))
}

#[tauri::command]
pub fn register_webhook(
    db: State<'_, Mutex<Connection>>,
    url: String,
    event_types: Vec<String>,
    secret: String,
) -> Result<Webhook, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let event_types_json = serde_json::to_string(&event_types).unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        "INSERT INTO webhooks (id, url, event_types, secret, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![id, url, event_types_json, secret, now],
    )
    .map_err(|e| e.to_string())?;

    fetch_webhook(&conn, &id)
}

#[tauri::command]
pub fn list_webhooks(
    db: State<'_, Mutex<Connection>>,
) -> Result<Vec<Webhook>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, url, event_types, secret, is_active, created_at, last_triggered_at, failure_count FROM webhooks ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let event_types_json: String = row.get(2)?;
            let event_types: Vec<String> = serde_json::from_str(&event_types_json).unwrap_or_default();
            Ok(Webhook {
                id: row.get(0)?,
                url: row.get(1)?,
                event_types,
                secret: row.get(3)?,
                is_active: row.get::<_, i32>(4)? != 0,
                created_at: row.get(5)?,
                last_triggered_at: row.get(6)?,
                failure_count: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_webhook(
    db: State<'_, Mutex<Connection>>,
    id: String,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM webhooks WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
