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
            "SELECT id, title, content, created_at, updated_at, is_trashed, is_pinned, word_count, file_path, sync_hash, state, workspace_id FROM notes WHERE id = ?1",
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
                    workspace_id: row.get(11)?,
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
        "INSERT INTO notes (id, title, content, created_at, updated_at, word_count, workspace_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![id, title, content, now, now, word_count, params.workspace_id],
    )
    .map_err(|e| e.to_string())?;

    sync_tags(&conn, &id, &tags)?;
    sync_note_links(&conn, &id, &content)?;
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
    sync_note_links(&conn, &params.id, &content)?;
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

    // Build workspace filter clause
    let ws_clause = if params.workspace_id.is_some() {
        "AND n.workspace_id = ?5"
    } else {
        "AND (?5 IS NULL OR 1=1)"
    };
    let ws_param = params.workspace_id.clone();

    if let Some(ref tag) = params.tag {
        let sql = format!(
            "SELECT n.id, n.title, n.content, n.updated_at, n.is_pinned, n.is_trashed, n.word_count, n.state, n.workspace_id \
             FROM notes n \
             JOIN note_tags nt ON n.id = nt.note_id \
             JOIN tags t ON nt.tag_id = t.id \
             WHERE t.name = ?1 AND n.is_trashed = ?2 {} \
             ORDER BY n.is_pinned DESC, n.updated_at DESC \
             LIMIT ?3 OFFSET ?4",
            ws_clause
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(rusqlite::params![tag, trashed, limit, offset, ws_param], |row| {
                let content: String = row.get(2)?;
                let preview = if content.len() > 200 {
                    let mut end = 200;
                    while !content.is_char_boundary(end) && end > 0 {
                        end -= 1;
                    }
                    content[..end].to_string()
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
                    workspace_id: row.get(8)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for row in rows {
            let mut item = row.map_err(|e| e.to_string())?;
            item.tags = fetch_note_tags(&conn, &item.id)?;
            items.push(item);
        }
    } else {
        // Use 'n' alias for consistency with workspace clause
        let sql = format!(
            "SELECT n.id, n.title, n.content, n.updated_at, n.is_pinned, n.is_trashed, n.word_count, n.state, n.workspace_id \
             FROM notes n \
             WHERE n.is_trashed = ?1 {} \
             ORDER BY n.is_pinned DESC, n.updated_at DESC \
             LIMIT ?2 OFFSET ?3",
            if params.workspace_id.is_some() { "AND n.workspace_id = ?4" } else { "AND (?4 IS NULL OR 1=1)" }
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(rusqlite::params![trashed, limit, offset, ws_param], |row| {
                let content: String = row.get(2)?;
                let preview = if content.len() > 200 {
                    let mut end = 200;
                    while !content.is_char_boundary(end) && end > 0 {
                        end -= 1;
                    }
                    content[..end].to_string()
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
                    workspace_id: row.get(8)?,
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

// --- Knowledge Graph: wiki-link sync ---

pub(crate) fn sync_note_links(conn: &Connection, note_id: &str, content: &str) -> Result<(), String> {
    let re = regex::Regex::new(r"\[\[([^\]]+)\]\]").unwrap();
    let now = Utc::now().to_rfc3339();

    // Remove existing links from this source
    conn.execute("DELETE FROM note_links WHERE source_note_id = ?1", [note_id])
        .map_err(|e| e.to_string())?;

    for cap in re.captures_iter(content) {
        let linked_title = &cap[1];
        // Resolve title to note id
        let target_id: Option<String> = conn
            .query_row(
                "SELECT id FROM notes WHERE title = ?1 AND is_trashed = 0",
                [linked_title],
                |row| row.get(0),
            )
            .ok();

        if let Some(target_id) = target_id {
            if target_id != note_id {
                let _ = conn.execute(
                    "INSERT OR IGNORE INTO note_links (source_note_id, target_note_id, link_type, created_at) VALUES (?1, ?2, 'wiki_link', ?3)",
                    rusqlite::params![note_id, target_id, now],
                );
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_knowledge_graph(
    db: State<'_, Mutex<Connection>>,
    center_note_id: Option<String>,
    depth: Option<i32>,
    max_nodes: Option<i32>,
) -> Result<KnowledgeGraph, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let max = max_nodes.unwrap_or(200) as usize;
    let depth_limit = depth.unwrap_or(2);

    use std::collections::{HashMap, HashSet, VecDeque};

    let mut visited: HashSet<String> = HashSet::new();
    let mut queue: VecDeque<(String, i32)> = VecDeque::new();
    let mut edges: Vec<GraphEdge> = Vec::new();

    if let Some(ref center_id) = center_note_id {
        queue.push_back((center_id.clone(), 0));
        visited.insert(center_id.clone());
    } else {
        // No center: grab all linked notes
        let mut stmt = conn
            .prepare("SELECT DISTINCT source_note_id FROM note_links UNION SELECT DISTINCT target_note_id FROM note_links")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        for row in rows {
            if let Ok(id) = row {
                if visited.len() < max {
                    visited.insert(id.clone());
                    queue.push_back((id, 0));
                }
            }
        }
    }

    // BFS
    while let Some((current_id, current_depth)) = queue.pop_front() {
        if current_depth >= depth_limit {
            continue;
        }

        // Forward links
        let mut stmt = conn
            .prepare("SELECT target_note_id, link_type FROM note_links WHERE source_note_id = ?1")
            .map_err(|e| e.to_string())?;
        let fwd: Vec<(String, String)> = stmt
            .query_map([&current_id], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        for (target_id, link_type) in &fwd {
            edges.push(GraphEdge {
                source: current_id.clone(),
                target: target_id.clone(),
                link_type: link_type.clone(),
            });
            if !visited.contains(target_id) && visited.len() < max {
                visited.insert(target_id.clone());
                queue.push_back((target_id.clone(), current_depth + 1));
            }
        }

        // Backward links
        let mut stmt = conn
            .prepare("SELECT source_note_id, link_type FROM note_links WHERE target_note_id = ?1")
            .map_err(|e| e.to_string())?;
        let bwd: Vec<(String, String)> = stmt
            .query_map([&current_id], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        for (source_id, link_type) in &bwd {
            edges.push(GraphEdge {
                source: source_id.clone(),
                target: current_id.clone(),
                link_type: link_type.clone(),
            });
            if !visited.contains(source_id) && visited.len() < max {
                visited.insert(source_id.clone());
                queue.push_back((source_id.clone(), current_depth + 1));
            }
        }
    }

    // Deduplicate edges
    let mut seen_edges: HashSet<(String, String, String)> = HashSet::new();
    edges.retain(|e| seen_edges.insert((e.source.clone(), e.target.clone(), e.link_type.clone())));

    // Build node info
    let mut link_counts: HashMap<String, i64> = HashMap::new();
    for e in &edges {
        *link_counts.entry(e.source.clone()).or_insert(0) += 1;
        *link_counts.entry(e.target.clone()).or_insert(0) += 1;
    }

    let mut nodes: Vec<GraphNode> = Vec::new();
    for node_id in &visited {
        let title: String = conn
            .query_row("SELECT title FROM notes WHERE id = ?1", [node_id], |row| row.get(0))
            .unwrap_or_else(|_| "Unknown".to_string());
        let tags = fetch_note_tags(&conn, node_id).unwrap_or_default();
        nodes.push(GraphNode {
            id: node_id.clone(),
            title,
            link_count: *link_counts.get(node_id).unwrap_or(&0),
            tags,
        });
    }

    Ok(KnowledgeGraph { nodes, edges })
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
