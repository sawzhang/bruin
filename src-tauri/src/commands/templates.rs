use crate::commands::notes::{fetch_note, log_activity, sync_tags};
use crate::db::models::Template;
use crate::markdown::tags::extract_tags;
use crate::sync::icloud;
use chrono::Utc;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

fn fetch_template(conn: &Connection, id: &str) -> Result<Template, String> {
    conn.query_row(
        "SELECT id, name, description, content, tags, initial_state, created_at, updated_at FROM templates WHERE id = ?1",
        [id],
        |row| {
            let tags_json: String = row.get(4)?;
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
            Ok(Template {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                content: row.get(3)?,
                tags,
                initial_state: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        },
    )
    .map_err(|e| format!("Template not found: {}", e))
}

#[tauri::command]
pub fn list_templates(
    db: State<'_, Mutex<Connection>>,
) -> Result<Vec<Template>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, description, content, tags, initial_state, created_at, updated_at FROM templates ORDER BY name")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let tags_json: String = row.get(4)?;
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
            Ok(Template {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                content: row.get(3)?,
                tags,
                initial_state: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFromTemplateParams {
    pub template_id: String,
    pub title: Option<String>,
}

#[tauri::command]
pub fn create_note_from_template(
    db: State<'_, Mutex<Connection>>,
    params: CreateFromTemplateParams,
) -> Result<crate::db::models::Note, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let template = fetch_template(&conn, &params.template_id)?;

    let now = Utc::now();
    let title = params.title.unwrap_or_else(|| template.name.clone());
    let date_str = now.format("%Y-%m-%d").to_string();

    // Expand template variables
    let content = template
        .content
        .replace("{{date}}", &date_str)
        .replace("{{title}}", &title);

    let id = Uuid::new_v4().to_string();
    let timestamp = now.to_rfc3339();
    let word_count = content.split_whitespace().count() as i64;

    // Merge template tags with any inline tags from expanded content
    let mut all_tags = template.tags.clone();
    for tag in extract_tags(&content) {
        if !all_tags.contains(&tag) {
            all_tags.push(tag);
        }
    }

    conn.execute(
        "INSERT INTO notes (id, title, content, created_at, updated_at, word_count, state) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![id, title, content, timestamp, timestamp, word_count, template.initial_state],
    )
    .map_err(|e| e.to_string())?;

    sync_tags(&conn, &id, &all_tags)?;

    let note = fetch_note(&conn, &id)?;
    let _ = icloud::export_note(&note);

    log_activity(
        &conn,
        "user",
        "note_created",
        Some(&id),
        &format!("Created note '{}' from template '{}'", title, template.name),
        "{}",
    );

    Ok(note)
}
