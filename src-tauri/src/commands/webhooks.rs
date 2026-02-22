use crate::db::models::{Webhook, WebhookLog};
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

#[tauri::command]
pub fn update_webhook(
    db: State<'_, Mutex<Connection>>,
    id: String,
    url: Option<String>,
    event_types: Option<Vec<String>>,
    is_active: Option<bool>,
) -> Result<Webhook, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let existing = fetch_webhook(&conn, &id)?;
    let now = Utc::now().to_rfc3339();

    let new_url = url.unwrap_or(existing.url);
    let new_types = event_types.unwrap_or(existing.event_types);
    let new_active: i32 = if is_active.unwrap_or(existing.is_active) { 1 } else { 0 };
    let types_json = serde_json::to_string(&new_types).unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        "UPDATE webhooks SET url = ?1, event_types = ?2, is_active = ?3, last_triggered_at = COALESCE(last_triggered_at, ?4) WHERE id = ?5",
        rusqlite::params![new_url, types_json, new_active, now, id],
    )
    .map_err(|e| e.to_string())?;

    fetch_webhook(&conn, &id)
}

#[tauri::command]
pub fn test_webhook(
    db: State<'_, Mutex<Connection>>,
    id: String,
) -> Result<WebhookLog, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let webhook = fetch_webhook(&conn, &id)?;
    let now = Utc::now().to_rfc3339();

    let payload = serde_json::json!({
        "event_type": "test",
        "note_id": null,
        "summary": "Test webhook delivery",
        "timestamp": now,
    });
    let body = payload.to_string();

    // Compute HMAC-SHA256 signature
    use hmac::{Hmac, Mac};
    use sha2::Sha256;
    let mut mac = Hmac::<Sha256>::new_from_slice(webhook.secret.as_bytes())
        .expect("HMAC key");
    mac.update(body.as_bytes());
    let signature = hex::encode(mac.finalize().into_bytes());

    let url = webhook.url.clone();

    // Synchronous send for test
    let result = ureq::post(&url)
        .set("Content-Type", "application/json")
        .set("X-Webhook-Signature", &signature)
        .send_string(&body);

    let (status_code, response_body, success, error_message) = match result {
        Ok(resp) => {
            let status = resp.status() as i32;
            let body = resp.into_string().unwrap_or_default();
            (Some(status), Some(body), true, None)
        }
        Err(e) => (None, None, false, Some(e.to_string())),
    };

    // Log the test delivery
    conn.execute(
        "INSERT INTO webhook_logs (webhook_id, event_type, payload, status_code, response_body, attempt, success, error_message, timestamp) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![id, "test", body, status_code, response_body, 1, success as i32, error_message, now],
    )
    .map_err(|e| e.to_string())?;

    let log_id = conn.last_insert_rowid();
    Ok(WebhookLog {
        id: log_id,
        webhook_id: id,
        event_type: "test".to_string(),
        payload: body,
        status_code,
        response_body,
        attempt: 1,
        success,
        error_message,
        timestamp: now,
    })
}

#[tauri::command]
pub fn get_webhook_logs(
    db: State<'_, Mutex<Connection>>,
    webhook_id: String,
    limit: Option<i64>,
) -> Result<Vec<WebhookLog>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50);

    let mut stmt = conn
        .prepare(
            "SELECT id, webhook_id, event_type, payload, status_code, response_body, attempt, success, error_message, timestamp \
             FROM webhook_logs WHERE webhook_id = ?1 ORDER BY timestamp DESC LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![webhook_id, limit], |row| {
            Ok(WebhookLog {
                id: row.get(0)?,
                webhook_id: row.get(1)?,
                event_type: row.get(2)?,
                payload: row.get(3)?,
                status_code: row.get(4)?,
                response_body: row.get(5)?,
                attempt: row.get(6)?,
                success: row.get::<_, i32>(7)? != 0,
                error_message: row.get(8)?,
                timestamp: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}
