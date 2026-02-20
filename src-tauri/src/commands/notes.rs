use crate::db::models::*;
use crate::markdown::tags::extract_tags;
use crate::markdown::tags::get_parent_tag;
use crate::sync::icloud;
use chrono::Utc;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

fn compute_word_count(content: &str) -> i64 {
    content.split_whitespace().count() as i64
}

pub(crate) fn log_activity(
    conn: &Connection,
    actor: &str,
    event_type: &str,
    note_id: Option<&str>,
    summary: &str,
    data: &str,
) {
    let now = Utc::now().to_rfc3339();
    let _ = conn.execute(
        "INSERT INTO activity_events (actor, event_type, note_id, timestamp, summary, data) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![actor, event_type, note_id, now, summary, data],
    );
    fire_webhooks(conn, event_type, note_id, summary);
}

fn fire_webhooks(conn: &Connection, event_type: &str, note_id: Option<&str>, summary: &str) {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;

    let webhooks = conn
        .prepare("SELECT id, url, event_types, secret FROM webhooks WHERE is_active = 1")
        .and_then(|mut stmt| {
            stmt.query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                ))
            })
            .and_then(|rows| rows.collect::<Result<Vec<_>, _>>())
        });

    let webhooks = match webhooks {
        Ok(w) => w,
        Err(_) => return,
    };

    for (wh_id, url, event_types_json, secret) in webhooks {
        let event_types: Vec<String> =
            serde_json::from_str(&event_types_json).unwrap_or_default();

        // Skip if webhook doesn't subscribe to this event type (empty = all)
        if !event_types.is_empty() && !event_types.contains(&event_type.to_string()) {
            continue;
        }

        let payload = serde_json::json!({
            "event_type": event_type,
            "note_id": note_id,
            "summary": summary,
            "timestamp": Utc::now().to_rfc3339(),
        });
        let body = payload.to_string();

        // Compute HMAC-SHA256 signature
        let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes())
            .expect("HMAC key");
        mac.update(body.as_bytes());
        let signature = hex::encode(mac.finalize().into_bytes());

        // Fire-and-forget with simple retry
        let url_clone = url.clone();
        let body_clone = body.clone();
        let sig_clone = signature.clone();

        std::thread::spawn(move || {
            let mut attempts = 0;
            let max_retries = 3;
            loop {
                let result = ureq::post(&url_clone)
                    .set("Content-Type", "application/json")
                    .set("X-Webhook-Signature", &sig_clone)
                    .send_string(&body_clone);

                match result {
                    Ok(_) => break,
                    Err(_) => {
                        attempts += 1;
                        if attempts >= max_retries {
                            break;
                        }
                        // Exponential backoff: 1s, 2s, 4s
                        std::thread::sleep(std::time::Duration::from_secs(1 << attempts));
                    }
                }
            }
        });

        // Update last_triggered_at
        let _ = conn.execute(
            "UPDATE webhooks SET last_triggered_at = ?1 WHERE id = ?2",
            rusqlite::params![Utc::now().to_rfc3339(), wh_id],
        );
    }
}

pub(crate) fn sync_tags(conn: &Connection, note_id: &str, tags: &[String]) -> Result<(), String> {
    conn.execute("DELETE FROM note_tags WHERE note_id = ?1", [note_id])
        .map_err(|e| e.to_string())?;

    for tag_name in tags {
        let parent = get_parent_tag(tag_name);

        conn.execute(
            "INSERT INTO tags (name, parent_name) VALUES (?1, ?2) ON CONFLICT(name) DO NOTHING",
            rusqlite::params![tag_name, parent],
        )
        .map_err(|e| e.to_string())?;

        let tag_id: i64 = conn
            .query_row("SELECT id FROM tags WHERE name = ?1", [tag_name], |row| {
                row.get(0)
            })
            .map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?1, ?2)",
            rusqlite::params![note_id, tag_id],
        )
        .map_err(|e| e.to_string())?;
    }

    conn.execute_batch(
        "UPDATE tags SET note_count = (SELECT COUNT(*) FROM note_tags WHERE note_tags.tag_id = tags.id)",
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub(crate) fn fetch_note_tags(conn: &Connection, note_id: &str) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT t.name FROM tags t JOIN note_tags nt ON t.id = nt.tag_id WHERE nt.note_id = ?1 ORDER BY t.name")
        .map_err(|e| e.to_string())?;

    let tags = stmt
        .query_map([note_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(tags)
}

pub(crate) fn fetch_note(conn: &Connection, id: &str) -> Result<Note, String> {
    let note = conn
        .query_row(
            "SELECT id, title, content, created_at, updated_at, is_trashed, is_pinned, word_count, file_path, sync_hash, state FROM notes WHERE id = ?1",
            [id],
            |row| {
                Ok(Note {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    content: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                    is_trashed: row.get::<_, i32>(5)? != 0,
                    is_pinned: row.get::<_, i32>(6)? != 0,
                    word_count: row.get(7)?,
                    file_path: row.get(8)?,
                    sync_hash: row.get(9)?,
                    tags: vec![],
                    state: row.get::<_, String>(10).unwrap_or_else(|_| "draft".to_string()),
                })
            },
        )
        .map_err(|e| format!("Note not found: {}", e))?;

    let tags = fetch_note_tags(conn, &note.id)?;
    Ok(Note { tags, ..note })
}

/// Compute sync hash and update in DB, then export to iCloud.
fn sync_to_icloud(conn: &Connection, note: &Note) {
    let hash = icloud::compute_sync_hash(&note.title, &note.content);
    let _ = conn.execute(
        "UPDATE notes SET sync_hash = ?1 WHERE id = ?2",
        rusqlite::params![hash, note.id],
    );
    let _ = icloud::export_note(note);
}

#[tauri::command]
pub fn create_note(
    db: State<'_, Mutex<Connection>>,
    params: CreateNoteParams,
) -> Result<Note, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let title = params.title.unwrap_or_default();
    let content = params.content.unwrap_or_default();
    let word_count = compute_word_count(&content);
    let tags = extract_tags(&content);

    conn.execute(
        "INSERT INTO notes (id, title, content, created_at, updated_at, word_count) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![id, title, content, now, now, word_count],
    )
    .map_err(|e| e.to_string())?;

    sync_tags(&conn, &id, &tags)?;
    let note = fetch_note(&conn, &id)?;
    sync_to_icloud(&conn, &note);
    log_activity(&conn, "user", "note_created", Some(&id), &format!("Created note '{}'", note.title), "{}");
    Ok(note)
}

#[tauri::command]
pub fn get_note(db: State<'_, Mutex<Connection>>, id: String) -> Result<Note, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    fetch_note(&conn, &id)
}

#[tauri::command]
pub fn update_note(
    db: State<'_, Mutex<Connection>>,
    params: UpdateNoteParams,
) -> Result<Note, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    let existing = fetch_note(&conn, &params.id)?;
    let title = params.title.unwrap_or(existing.title);
    let content = params.content.unwrap_or(existing.content);
    let word_count = compute_word_count(&content);
    let tags = extract_tags(&content);

    conn.execute(
        "UPDATE notes SET title = ?1, content = ?2, updated_at = ?3, word_count = ?4 WHERE id = ?5",
        rusqlite::params![title, content, now, word_count, params.id],
    )
    .map_err(|e| e.to_string())?;

    sync_tags(&conn, &params.id, &tags)?;
    let note = fetch_note(&conn, &params.id)?;
    sync_to_icloud(&conn, &note);
    log_activity(&conn, "user", "note_updated", Some(&params.id), &format!("Updated note '{}'", note.title), "{}");
    Ok(note)
}

#[tauri::command]
pub fn delete_note(
    db: State<'_, Mutex<Connection>>,
    id: String,
    permanent: bool,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    if permanent {
        log_activity(&conn, "user", "note_deleted", Some(&id), &format!("Permanently deleted note '{}'", id), "{}");
        conn.execute("DELETE FROM note_tags WHERE note_id = ?1", [&id])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM notes WHERE id = ?1", [&id])
            .map_err(|e| e.to_string())?;
        conn.execute_batch(
            "UPDATE tags SET note_count = (SELECT COUNT(*) FROM note_tags WHERE note_tags.tag_id = tags.id)",
        )
        .map_err(|e| e.to_string())?;
        let _ = icloud::delete_note_file(&id);
    } else {
        conn.execute(
            "UPDATE notes SET is_trashed = 1, updated_at = ?1 WHERE id = ?2",
            rusqlite::params![Utc::now().to_rfc3339(), id],
        )
        .map_err(|e| e.to_string())?;
        log_activity(&conn, "user", "note_trashed", Some(&id), &format!("Moved note '{}' to trash", id), "{}");
    }

    Ok(())
}

#[tauri::command]
pub fn list_notes(
    db: State<'_, Mutex<Connection>>,
    params: ListNotesParams,
) -> Result<Vec<NoteListItem>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let trashed: i32 = if params.trashed.unwrap_or(false) { 1 } else { 0 };
    let limit = params.limit.unwrap_or(50);
    let offset = params.offset.unwrap_or(0);

    let mut items: Vec<NoteListItem> = Vec::new();

    if let Some(ref tag) = params.tag {
        let mut stmt = conn
            .prepare(
                "SELECT n.id, n.title, n.content, n.updated_at, n.is_pinned, n.is_trashed, n.word_count, n.state \
                 FROM notes n \
                 JOIN note_tags nt ON n.id = nt.note_id \
                 JOIN tags t ON nt.tag_id = t.id \
                 WHERE t.name = ?1 AND n.is_trashed = ?2 \
                 ORDER BY n.is_pinned DESC, n.updated_at DESC \
                 LIMIT ?3 OFFSET ?4",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(rusqlite::params![tag, trashed, limit, offset], |row| {
                let content: String = row.get(2)?;
                let preview = if content.len() > 200 {
                    content[..200].to_string()
                } else {
                    content
                };
                Ok(NoteListItem {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    preview,
                    updated_at: row.get(3)?,
                    is_pinned: row.get::<_, i32>(4)? != 0,
                    is_trashed: row.get::<_, i32>(5)? != 0,
                    word_count: row.get(6)?,
                    tags: vec![],
                    state: row.get::<_, String>(7).unwrap_or_else(|_| "draft".to_string()),
                })
            })
            .map_err(|e| e.to_string())?;

        for row in rows {
            let mut item = row.map_err(|e| e.to_string())?;
            item.tags = fetch_note_tags(&conn, &item.id)?;
            items.push(item);
        }
    } else {
        let mut stmt = conn
            .prepare(
                "SELECT id, title, content, updated_at, is_pinned, is_trashed, word_count, state \
                 FROM notes \
                 WHERE is_trashed = ?1 \
                 ORDER BY is_pinned DESC, updated_at DESC \
                 LIMIT ?2 OFFSET ?3",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(rusqlite::params![trashed, limit, offset], |row| {
                let content: String = row.get(2)?;
                let preview = if content.len() > 200 {
                    content[..200].to_string()
                } else {
                    content
                };
                Ok(NoteListItem {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    preview,
                    updated_at: row.get(3)?,
                    is_pinned: row.get::<_, i32>(4)? != 0,
                    is_trashed: row.get::<_, i32>(5)? != 0,
                    word_count: row.get(6)?,
                    tags: vec![],
                    state: row.get::<_, String>(7).unwrap_or_else(|_| "draft".to_string()),
                })
            })
            .map_err(|e| e.to_string())?;

        for row in rows {
            let mut item = row.map_err(|e| e.to_string())?;
            item.tags = fetch_note_tags(&conn, &item.id)?;
            items.push(item);
        }
    }

    Ok(items)
}

#[tauri::command]
pub fn pin_note(
    db: State<'_, Mutex<Connection>>,
    id: String,
    pinned: bool,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let pinned_int: i32 = if pinned { 1 } else { 0 };
    conn.execute(
        "UPDATE notes SET is_pinned = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![pinned_int, Utc::now().to_rfc3339(), id],
    )
    .map_err(|e| e.to_string())?;

    if let Ok(note) = fetch_note(&conn, &id) {
        let _ = icloud::export_note(&note);
    }
    let action = if pinned { "pinned" } else { "unpinned" };
    log_activity(&conn, "user", "note_pinned", Some(&id), &format!("Note {} '{}'", action, id), "{}");
    Ok(())
}

#[tauri::command]
pub fn trash_note(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE notes SET is_trashed = 1, updated_at = ?1 WHERE id = ?2",
        rusqlite::params![Utc::now().to_rfc3339(), id],
    )
    .map_err(|e| e.to_string())?;

    let _ = icloud::delete_note_file(&id);
    log_activity(&conn, "user", "note_trashed", Some(&id), &format!("Moved note '{}' to trash", id), "{}");
    Ok(())
}

#[tauri::command]
pub fn restore_note(db: State<'_, Mutex<Connection>>, id: String) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE notes SET is_trashed = 0, updated_at = ?1 WHERE id = ?2",
        rusqlite::params![Utc::now().to_rfc3339(), id],
    )
    .map_err(|e| e.to_string())?;

    if let Ok(note) = fetch_note(&conn, &id) {
        sync_to_icloud(&conn, &note);
    }
    log_activity(&conn, "user", "note_restored", Some(&id), &format!("Restored note '{}' from trash", id), "{}");
    Ok(())
}

// --- Note State Machine ---

const VALID_TRANSITIONS: &[(&str, &str)] = &[
    ("draft", "review"),
    ("review", "published"),
    ("review", "draft"),
    ("published", "review"),
];

#[tauri::command]
pub fn set_note_state(
    db: State<'_, Mutex<Connection>>,
    id: String,
    state: String,
) -> Result<Note, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let existing = fetch_note(&conn, &id)?;

    let valid = VALID_TRANSITIONS
        .iter()
        .any(|(from, to)| *from == existing.state && *to == state);

    if !valid {
        return Err(format!(
            "Invalid state transition: '{}' → '{}'",
            existing.state, state
        ));
    }

    conn.execute(
        "UPDATE notes SET state = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![state, Utc::now().to_rfc3339(), id],
    )
    .map_err(|e| e.to_string())?;

    log_activity(&conn, "user", "state_changed", Some(&id), &format!("Changed state '{}' → '{}'", existing.state, state), "{}");
    fetch_note(&conn, &id)
}

// --- Bear Markdown Import ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub imported: u32,
    pub skipped: u32,
}

#[tauri::command]
pub fn import_markdown_files(
    db: State<'_, Mutex<Connection>>,
    paths: Vec<String>,
) -> Result<ImportResult, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut imported = 0u32;
    let mut skipped = 0u32;

    // Collect all .md file paths (support both files and directories)
    let mut md_files: Vec<PathBuf> = Vec::new();
    for path_str in &paths {
        let path = PathBuf::from(path_str);
        if path.is_dir() {
            if let Ok(entries) = fs::read_dir(&path) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.extension().and_then(|e| e.to_str()) == Some("md") {
                        md_files.push(p);
                    }
                }
            }
        } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
            md_files.push(path);
        }
    }

    for md_path in &md_files {
        match import_single_markdown(&conn, md_path) {
            Ok(_) => imported += 1,
            Err(e) => {
                log::warn!("Skipped {}: {}", md_path.display(), e);
                skipped += 1;
            }
        }
    }

    Ok(ImportResult { imported, skipped })
}

fn import_single_markdown(conn: &Connection, path: &Path) -> Result<Note, String> {
    let raw = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;

    // Determine if file has Bruin frontmatter or is a plain Bear export
    let (title, body, file_tags) = if raw.starts_with("---") {
        let file_note = icloud::import_file(path)?;
        (file_note.title, file_note.content, file_note.tags)
    } else {
        let title = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled")
            .to_string();
        let tags = extract_tags(&raw);
        (title, raw, tags)
    };

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let word_count = compute_word_count(&body);

    conn.execute(
        "INSERT INTO notes (id, title, content, created_at, updated_at, word_count) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![id, title, body, now, now, word_count],
    )
    .map_err(|e| e.to_string())?;

    sync_tags(conn, &id, &file_tags)?;
    let note = fetch_note(conn, &id)?;
    sync_to_icloud(conn, &note);
    Ok(note)
}
