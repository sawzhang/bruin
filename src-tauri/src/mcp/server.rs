use chrono::Utc;
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet, VecDeque};
use std::io::{BufRead, Write};
use std::path::PathBuf;
use uuid::Uuid;

// ── Thread-local state for workspace/agent context ──────────────────────────

thread_local! {
    static CURRENT_WORKSPACE_ID: RefCell<Option<String>> = const { RefCell::new(None) };
    static CURRENT_AGENT_ID: RefCell<Option<String>> = const { RefCell::new(None) };
}

// ── DB path discovery ────────────────────────────────────────────────────────

pub(crate) fn find_db() -> PathBuf {
    if let Ok(p) = std::env::var("BRUIN_DB") {
        let path = PathBuf::from(p);
        if path.exists() {
            return path;
        }
    }
    let home = std::env::var("HOME").unwrap_or_default();
    // Tauri v2: ~/Library/Application Support/com.bruin.notes/
    let new_path = PathBuf::from(&home)
        .join("Library")
        .join("Application Support")
        .join("com.bruin.notes")
        .join("bruin.db");
    if new_path.exists() {
        return new_path;
    }
    // Legacy path
    let old_path = PathBuf::from(&home)
        .join("Library")
        .join("Application Support")
        .join("com.bruin.app")
        .join("bruin.db");
    if old_path.exists() {
        return old_path;
    }
    new_path
}

// ── Agent auto-setup ─────────────────────────────────────────────────────────

pub(crate) fn setup_agent(conn: &Connection) -> Option<String> {
    // Prefer explicit UUID
    if let Ok(id) = std::env::var("BRUIN_AGENT_ID") {
        let exists: bool = conn
            .query_row("SELECT 1 FROM agents WHERE id = ?1", [&id], |_| Ok(true))
            .unwrap_or(false);
        if exists {
            return Some(id);
        }
    }

    let name = std::env::var("BRUIN_AGENT_NAME").unwrap_or_default();
    if name.is_empty() {
        return None;
    }

    // Look up by name
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM agents WHERE name = ?1 AND is_active = 1 LIMIT 1",
            [&name],
            |row| row.get(0),
        )
        .ok();

    if let Some(id) = existing {
        return Some(id);
    }

    // Auto-create
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let _ = conn.execute(
        "INSERT INTO agents (id, name, description, capabilities, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, name, "Auto-created by MCP server", "[]", now, now],
    );
    Some(id)
}

// ── Utility helpers ───────────────────────────────────────────────────────────

fn word_count(content: &str) -> i64 {
    content.split_whitespace().count() as i64
}

fn str_param<'a>(params: &'a Value, key: &str) -> Option<&'a str> {
    params.get(key).and_then(|v| v.as_str())
}

fn opt_str(params: &Value, key: &str) -> Option<String> {
    params.get(key).and_then(|v| v.as_str()).map(|s| s.to_string())
}

fn opt_i64(params: &Value, key: &str) -> Option<i64> {
    params.get(key).and_then(|v| v.as_i64())
}

fn opt_bool(params: &Value, key: &str) -> Option<bool> {
    params.get(key).and_then(|v| v.as_bool())
}

fn text_result(s: impl Into<String>) -> Value {
    json!({ "content": [{ "type": "text", "text": s.into() }] })
}

fn json_result(v: &Value) -> Value {
    let text = serde_json::to_string_pretty(v).unwrap_or_default();
    json!({ "content": [{ "type": "text", "text": text }] })
}

fn err_result(msg: impl Into<String>) -> Value {
    json!({
        "content": [{ "type": "text", "text": msg.into() }],
        "isError": true
    })
}

fn extract_tags_from_content(content: &str) -> Vec<String> {
    let re = regex::Regex::new(r"#([\w/\-]+)").unwrap();
    let mut tags: Vec<String> = re
        .captures_iter(content)
        .map(|c| c[1].to_string())
        .collect();
    tags.sort();
    tags.dedup();
    tags
}

fn sync_tags(conn: &Connection, note_id: &str, tags: &[String]) -> Result<(), String> {
    // Remove old associations and update counts
    let old_tag_ids: Vec<i64> = {
        let mut stmt = conn
            .prepare("SELECT tag_id FROM note_tags WHERE note_id = ?1")
            .map_err(|e| e.to_string())?;
        let ids: Vec<i64> = stmt
            .query_map([note_id], |row| row.get::<_, i64>(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        ids
    };
    conn.execute("DELETE FROM note_tags WHERE note_id = ?1", [note_id])
        .map_err(|e| e.to_string())?;

    let mut new_tag_ids: Vec<i64> = Vec::new();
    for tag_name in tags {
        let parent: Option<String> = tag_name.rfind('/').map(|i| tag_name[..i].to_string());
        conn.execute(
            "INSERT INTO tags (name, parent_name) VALUES (?1, ?2) ON CONFLICT(name) DO NOTHING",
            params![tag_name, parent],
        )
        .map_err(|e| e.to_string())?;

        let tag_id: i64 = conn
            .query_row("SELECT id FROM tags WHERE name = ?1", [tag_name], |row| {
                row.get(0)
            })
            .map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?1, ?2)",
            params![note_id, tag_id],
        )
        .map_err(|e| e.to_string())?;
        new_tag_ids.push(tag_id);
    }

    let mut all_ids: Vec<i64> = old_tag_ids;
    all_ids.extend(new_tag_ids);
    all_ids.sort();
    all_ids.dedup();
    for id in all_ids {
        let _ = conn.execute(
            "UPDATE tags SET note_count = (SELECT COUNT(*) FROM note_tags WHERE tag_id = ?1) WHERE id = ?1",
            [id],
        );
    }
    Ok(())
}

fn extract_wiki_links(content: &str) -> Vec<String> {
    let re = regex::Regex::new(r"\[\[([^\]]+)\]\]").unwrap();
    let mut links: Vec<String> = re
        .captures_iter(content)
        .map(|c| c[1].to_string())
        .collect();
    links.sort();
    links.dedup();
    links
}

fn sync_note_links(conn: &Connection, note_id: &str, content: &str) {
    let now = Utc::now().to_rfc3339();

    // Delete existing outbound links
    let _ = conn.execute(
        "DELETE FROM note_links WHERE source_note_id = ?1",
        [note_id],
    );

    let linked_titles = extract_wiki_links(content);
    for title in &linked_titles {
        // Find target note by title (must not be trashed)
        let target_id: Option<String> = conn
            .query_row(
                "SELECT id FROM notes WHERE title = ?1 AND is_trashed = 0",
                [title],
                |row| row.get(0),
            )
            .ok();

        if let Some(tid) = target_id {
            if tid != note_id {
                let _ = conn.execute(
                    "INSERT OR IGNORE INTO note_links (source_note_id, target_note_id, link_type, created_at) VALUES (?1, ?2, 'wiki_link', ?3)",
                    params![note_id, tid, now],
                );
            }
        }
    }
}

fn fetch_note_tags(conn: &Connection, note_id: &str) -> Vec<String> {
    let mut stmt = match conn.prepare(
        "SELECT t.name FROM tags t JOIN note_tags nt ON t.id = nt.tag_id WHERE nt.note_id = ?1 ORDER BY t.name",
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    stmt.query_map([note_id], |row| row.get::<_, String>(0))
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
}

fn fetch_note_json(conn: &Connection, id: &str) -> Result<Value, String> {
    let note = conn
        .query_row(
            "SELECT id, title, content, created_at, updated_at, is_trashed, is_pinned, word_count, state, workspace_id, version FROM notes WHERE id = ?1",
            [id],
            |row| {
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "title": row.get::<_, String>(1)?,
                    "content": row.get::<_, String>(2)?,
                    "created_at": row.get::<_, String>(3)?,
                    "updated_at": row.get::<_, String>(4)?,
                    "is_trashed": row.get::<_, i32>(5)? != 0,
                    "is_pinned": row.get::<_, i32>(6)? != 0,
                    "word_count": row.get::<_, i64>(7)?,
                    "state": row.get::<_, String>(8).unwrap_or_else(|_| "draft".to_string()),
                    "workspace_id": row.get::<_, Option<String>>(9)?,
                    "version": row.get::<_, i32>(10).unwrap_or(1),
                }))
            },
        )
        .map_err(|e| format!("Note not found: {}", e))?;

    let tags = fetch_note_tags(conn, note["id"].as_str().unwrap_or(""));
    let mut note = note;
    note["tags"] = json!(tags);
    Ok(note)
}

fn log_activity(
    conn: &Connection,
    event_type: &str,
    note_id: Option<&str>,
    summary: &str,
    agent_id: Option<&str>,
) {
    let now = Utc::now().to_rfc3339();
    let actor = agent_id.unwrap_or("mcp-agent");
    let _ = conn.execute(
        "INSERT INTO activity_events (actor, event_type, note_id, timestamp, summary, data, agent_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![actor, event_type, note_id, now, summary, "{}", agent_id],
    );
}

// ── Tool handlers ─────────────────────────────────────────────────────────────

fn tool_create_note(conn: &Connection, p: &Value, agent_id: Option<&str>) -> Value {
    let title = opt_str(p, "title").unwrap_or_default();
    let content = opt_str(p, "content").unwrap_or_default();
    let explicit_tags: Vec<String> = p
        .get("tags")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let wc = word_count(&content);

    let mut tags = extract_tags_from_content(&content);
    for t in &explicit_tags {
        if !tags.contains(t) {
            tags.push(t.clone());
        }
    }

    match conn.execute(
        "INSERT INTO notes (id, title, content, created_at, updated_at, word_count) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, title, content, now, now, wc],
    ) {
        Err(e) => return err_result(e.to_string()),
        Ok(_) => {}
    }

    let _ = sync_tags(conn, &id, &tags);
    sync_note_links(conn, &id, &content);
    log_activity(conn, "note_created", Some(&id), &format!("Created note '{}'", title), agent_id);

    match fetch_note_json(conn, &id) {
        Ok(note) => json_result(&note),
        Err(e) => err_result(e),
    }
}

fn tool_read_note(conn: &Connection, p: &Value) -> Value {
    let id = match str_param(p, "note_id") {
        Some(v) => v,
        None => return err_result("note_id is required"),
    };
    match fetch_note_json(conn, id) {
        Ok(note) => json_result(&note),
        Err(e) => err_result(e),
    }
}

fn tool_update_note(conn: &Connection, p: &Value, agent_id: Option<&str>) -> Value {
    let id = match str_param(p, "note_id") {
        Some(v) => v,
        None => return err_result("note_id is required"),
    };

    // Optimistic concurrency check
    if let Some(expected) = str_param(p, "expected_updated_at") {
        let current: Result<String, _> = conn.query_row(
            "SELECT updated_at FROM notes WHERE id = ?1",
            [id],
            |row| row.get(0),
        );
        if let Ok(current_ts) = current {
            if current_ts != expected {
                return err_result(format!(
                    "Conflict: note was modified (current: {current_ts}). Re-read the note and retry."
                ));
            }
        }
    }

    let existing = match fetch_note_json(conn, id) {
        Ok(n) => n,
        Err(e) => return err_result(e),
    };

    let title = opt_str(p, "title")
        .unwrap_or_else(|| existing["title"].as_str().unwrap_or("").to_string());
    let content = opt_str(p, "content")
        .unwrap_or_else(|| existing["content"].as_str().unwrap_or("").to_string());
    let now = Utc::now().to_rfc3339();
    let wc = word_count(&content);

    if let Err(e) = conn.execute(
        "UPDATE notes SET title = ?1, content = ?2, updated_at = ?3, word_count = ?4, version = version + 1 WHERE id = ?5",
        params![title, content, now, wc, id],
    ) {
        return err_result(e.to_string());
    }

    // Sync tags: prefer explicit param, else extract from content
    let tags: Vec<String> = if let Some(arr) = p.get("tags").and_then(|v| v.as_array()) {
        arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect()
    } else {
        extract_tags_from_content(&content)
    };
    let _ = sync_tags(conn, id, &tags);
    sync_note_links(conn, id, &content);

    log_activity(conn, "note_updated", Some(id), &format!("Updated note '{}'", title), agent_id);

    match fetch_note_json(conn, id) {
        Ok(note) => json_result(&note),
        Err(e) => err_result(e),
    }
}

fn tool_delete_note(conn: &Connection, p: &Value, agent_id: Option<&str>) -> Value {
    let id = match str_param(p, "note_id") {
        Some(v) => v,
        None => return err_result("note_id is required"),
    };
    let permanent = opt_bool(p, "permanent").unwrap_or(false);
    let now = Utc::now().to_rfc3339();

    if permanent {
        let _ = conn.execute("DELETE FROM notes WHERE id = ?1", [id]);
        log_activity(conn, "note_deleted", Some(id), "Permanently deleted note", agent_id);
        text_result("Note permanently deleted.")
    } else {
        let _ = conn.execute(
            "UPDATE notes SET is_trashed = 1, updated_at = ?1 WHERE id = ?2",
            params![now, id],
        );
        log_activity(conn, "note_trashed", Some(id), "Moved note to trash", agent_id);
        text_result("Note moved to trash.")
    }
}

fn tool_list_notes(conn: &Connection, p: &Value) -> Value {
    let limit = opt_i64(p, "limit").unwrap_or(50);
    let offset = opt_i64(p, "offset").unwrap_or(0);
    let tag = opt_str(p, "tag");

    let rows: Vec<Value> = if let Some(tag_name) = tag {
        let mut stmt = match conn.prepare(
            "SELECT n.id, n.title, SUBSTR(n.content, 1, 200) as preview, n.updated_at, n.is_pinned, n.word_count, n.state \
             FROM notes n \
             JOIN note_tags nt ON n.id = nt.note_id \
             JOIN tags t ON nt.tag_id = t.id \
             WHERE t.name = ?1 AND n.is_trashed = 0 \
             ORDER BY n.is_pinned DESC, n.updated_at DESC \
             LIMIT ?2 OFFSET ?3",
        ) {
            Ok(s) => s,
            Err(e) => return err_result(e.to_string()),
        };
        stmt.query_map(params![tag_name, limit, offset], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "title": row.get::<_, String>(1)?,
                "preview": row.get::<_, String>(2)?,
                "updated_at": row.get::<_, String>(3)?,
                "is_pinned": row.get::<_, i32>(4)? != 0,
                "word_count": row.get::<_, i64>(5)?,
                "state": row.get::<_, String>(6).unwrap_or_else(|_| "draft".to_string()),
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
    } else {
        let mut stmt = match conn.prepare(
            "SELECT id, title, SUBSTR(content, 1, 200) as preview, updated_at, is_pinned, word_count, state \
             FROM notes WHERE is_trashed = 0 \
             ORDER BY is_pinned DESC, updated_at DESC \
             LIMIT ?1 OFFSET ?2",
        ) {
            Ok(s) => s,
            Err(e) => return err_result(e.to_string()),
        };
        stmt.query_map(params![limit, offset], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "title": row.get::<_, String>(1)?,
                "preview": row.get::<_, String>(2)?,
                "updated_at": row.get::<_, String>(3)?,
                "is_pinned": row.get::<_, i32>(4)? != 0,
                "word_count": row.get::<_, i64>(5)?,
                "state": row.get::<_, String>(6).unwrap_or_else(|_| "draft".to_string()),
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
    };

    // Batch fetch tags
    let note_ids: Vec<String> = rows
        .iter()
        .filter_map(|r| r["id"].as_str().map(|s| s.to_string()))
        .collect();
    let mut tags_map: HashMap<String, Vec<String>> = HashMap::new();
    if !note_ids.is_empty() {
        for id in &note_ids {
            tags_map.insert(id.clone(), fetch_note_tags(conn, id));
        }
    }

    let rows: Vec<Value> = rows
        .into_iter()
        .map(|mut r| {
            let id = r["id"].as_str().unwrap_or("").to_string();
            r["tags"] = json!(tags_map.get(&id).cloned().unwrap_or_default());
            r
        })
        .collect();

    json_result(&json!(rows))
}

fn tool_search_notes(conn: &Connection, p: &Value) -> Value {
    let query = match str_param(p, "query") {
        Some(q) => q,
        None => return err_result("query is required"),
    };
    let limit = opt_i64(p, "limit").unwrap_or(20);

    let mut stmt = match conn.prepare(
        "SELECT n.id, n.title, snippet(notes_fts, 1, '', '', '...', 32) as preview, \
         n.updated_at, n.word_count, n.state \
         FROM notes_fts fts \
         JOIN notes n ON n.rowid = fts.rowid \
         WHERE notes_fts MATCH ?1 AND n.is_trashed = 0 \
         ORDER BY rank LIMIT ?2",
    ) {
        Ok(s) => s,
        Err(e) => return err_result(e.to_string()),
    };

    let rows: Vec<Value> = stmt
        .query_map(params![query, limit], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "title": row.get::<_, String>(1)?,
                "preview": row.get::<_, String>(2)?,
                "updated_at": row.get::<_, String>(3)?,
                "word_count": row.get::<_, i64>(4)?,
                "state": row.get::<_, String>(5).unwrap_or_else(|_| "draft".to_string()),
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();

    json_result(&json!(rows))
}

fn tool_get_note_by_title(conn: &Connection, p: &Value) -> Value {
    let title = match str_param(p, "title") {
        Some(t) => t,
        None => return err_result("title is required"),
    };
    let fuzzy = opt_bool(p, "fuzzy").unwrap_or(false);

    let id: Option<String> = if fuzzy {
        conn.query_row(
            "SELECT id FROM notes WHERE title LIKE ?1 AND is_trashed = 0 LIMIT 1",
            [format!("%{}%", title)],
            |row| row.get(0),
        )
        .ok()
    } else {
        conn.query_row(
            "SELECT id FROM notes WHERE title = ?1 AND is_trashed = 0 LIMIT 1",
            [title],
            |row| row.get(0),
        )
        .ok()
    };

    match id {
        Some(note_id) => match fetch_note_json(conn, &note_id) {
            Ok(note) => json_result(&note),
            Err(e) => err_result(e),
        },
        None => err_result(format!("No note found with title '{}'", title)),
    }
}

fn tool_append_to_note(conn: &Connection, p: &Value, agent_id: Option<&str>) -> Value {
    let id = match str_param(p, "note_id") {
        Some(v) => v,
        None => return err_result("note_id is required"),
    };
    let append = match str_param(p, "content") {
        Some(c) => c,
        None => return err_result("content is required"),
    };

    let existing_content: Result<String, _> =
        conn.query_row("SELECT content FROM notes WHERE id = ?1", [id], |row| {
            row.get(0)
        });

    let new_content = match existing_content {
        Ok(c) => format!("{}\n{}", c, append),
        Err(e) => return err_result(format!("Note not found: {}", e)),
    };

    let now = Utc::now().to_rfc3339();
    let wc = word_count(&new_content);
    let tags = extract_tags_from_content(&new_content);

    if let Err(e) = conn.execute(
        "UPDATE notes SET content = ?1, updated_at = ?2, word_count = ?3, version = version + 1 WHERE id = ?4",
        params![new_content, now, wc, id],
    ) {
        return err_result(e.to_string());
    }
    let _ = sync_tags(conn, id, &tags);
    sync_note_links(conn, id, &new_content);
    log_activity(conn, "note_updated", Some(id), "Appended to note", agent_id);

    match fetch_note_json(conn, id) {
        Ok(note) => json_result(&note),
        Err(e) => err_result(e),
    }
}

fn tool_get_daily_note(conn: &Connection, p: &Value, agent_id: Option<&str>) -> Value {
    let date_str = opt_str(p, "date").unwrap_or_else(|| Utc::now().format("%Y-%m-%d").to_string());
    let per_agent_id = opt_str(p, "agent_id").or_else(|| agent_id.map(|s| s.to_string()));
    let title = if let Some(aid) = &per_agent_id {
        format!("{} ({})", date_str, aid)
    } else {
        date_str.clone()
    };

    // Find existing daily note
    let existing_id: Option<String> = conn
        .query_row(
            "SELECT n.id FROM notes n \
             JOIN note_tags nt ON n.id = nt.note_id \
             JOIN tags t ON nt.tag_id = t.id \
             WHERE n.title = ?1 AND t.name = 'daily' AND n.is_trashed = 0 \
             LIMIT 1",
            [&title],
            |row| row.get(0),
        )
        .ok();

    if let Some(note_id) = existing_id {
        return match fetch_note_json(conn, &note_id) {
            Ok(note) => json_result(&note),
            Err(e) => err_result(e),
        };
    }

    // Create new daily note
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let content = format!("# {}\n\n", title);
    let wc = word_count(&content);

    if let Err(e) = conn.execute(
        "INSERT INTO notes (id, title, content, created_at, updated_at, word_count) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, title, content, now, now, wc],
    ) {
        return err_result(e.to_string());
    }
    let _ = sync_tags(conn, &id, &["daily".to_string()]);
    log_activity(conn, "note_created", Some(&id), &format!("Created daily note '{}'", title), agent_id);

    match fetch_note_json(conn, &id) {
        Ok(note) => json_result(&note),
        Err(e) => err_result(e),
    }
}

fn tool_set_note_state(conn: &Connection, p: &Value, agent_id: Option<&str>) -> Value {
    let id = match str_param(p, "note_id") {
        Some(v) => v,
        None => return err_result("note_id is required"),
    };
    let state = match str_param(p, "state") {
        Some(s) => s,
        None => return err_result("state is required"),
    };
    if !["draft", "review", "published"].contains(&state) {
        return err_result("state must be one of: draft, review, published");
    }

    let now = Utc::now().to_rfc3339();
    if let Err(e) = conn.execute(
        "UPDATE notes SET state = ?1, updated_at = ?2 WHERE id = ?3",
        params![state, now, id],
    ) {
        return err_result(e.to_string());
    }
    log_activity(
        conn,
        "note_state_changed",
        Some(id),
        &format!("State changed to '{}'", state),
        agent_id,
    );

    match fetch_note_json(conn, id) {
        Ok(note) => json_result(&note),
        Err(e) => err_result(e),
    }
}

fn tool_advanced_query(conn: &Connection, p: &Value) -> Value {
    let mut conditions = vec!["n.is_trashed = 0".to_string()];
    let mut bind_vals: Vec<String> = Vec::new();

    if let Some(from) = str_param(p, "date_from") {
        conditions.push(format!("n.created_at >= ?{}", bind_vals.len() + 1));
        bind_vals.push(from.to_string());
    }
    if let Some(to) = str_param(p, "date_to") {
        conditions.push(format!("n.created_at <= ?{}", bind_vals.len() + 1));
        bind_vals.push(to.to_string());
    }
    if let Some(state) = str_param(p, "state") {
        conditions.push(format!("n.state = ?{}", bind_vals.len() + 1));
        bind_vals.push(state.to_string());
    }
    if let Some(min_words) = opt_i64(p, "min_words") {
        conditions.push(format!("n.word_count >= {}", min_words));
    }
    if let Some(max_words) = opt_i64(p, "max_words") {
        conditions.push(format!("n.word_count <= {}", max_words));
    }

    let tags: Vec<String> = p
        .get("tags")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    let tag_mode = opt_str(p, "tag_mode").unwrap_or_else(|| "any".to_string());
    let mut sql = if !tags.is_empty() {
        let tag_list: Vec<String> = tags
            .iter()
            .map(|_| {
                bind_vals.push("dummy".to_string()); // placeholder
                format!("?{}", bind_vals.len())
            })
            .collect();
        // Replace dummy placeholders with actual tag values
        for (i, tag) in tags.iter().enumerate() {
            let idx = bind_vals.len() - tags.len() + i;
            bind_vals[idx] = tag.clone();
        }
        if tag_mode == "all" {
            format!(
                "SELECT DISTINCT n.id, n.title, SUBSTR(n.content, 1, 200) as preview, n.updated_at, n.word_count, n.state \
                 FROM notes n \
                 WHERE {} AND n.id IN (\
                   SELECT note_id FROM note_tags nt JOIN tags t ON nt.tag_id = t.id WHERE t.name IN ({}) \
                   GROUP BY note_id HAVING COUNT(DISTINCT t.name) = {}\
                 ) ORDER BY n.updated_at DESC LIMIT 100",
                conditions.join(" AND "),
                tag_list.join(", "),
                tags.len()
            )
        } else {
            format!(
                "SELECT DISTINCT n.id, n.title, SUBSTR(n.content, 1, 200) as preview, n.updated_at, n.word_count, n.state \
                 FROM notes n \
                 JOIN note_tags nt ON n.id = nt.note_id \
                 JOIN tags t ON nt.tag_id = t.id \
                 WHERE {} AND t.name IN ({}) \
                 ORDER BY n.updated_at DESC LIMIT 100",
                conditions.join(" AND "),
                tag_list.join(", ")
            )
        }
    } else {
        format!(
            "SELECT n.id, n.title, SUBSTR(n.content, 1, 200) as preview, n.updated_at, n.word_count, n.state \
             FROM notes n WHERE {} ORDER BY n.updated_at DESC LIMIT 100",
            conditions.join(" AND ")
        )
    };

    // Search filter
    if let Some(search) = str_param(p, "search") {
        let search_lower = search.to_lowercase();
        sql = format!(
            "SELECT * FROM ({}) WHERE LOWER(title) LIKE '%{}%' OR LOWER(preview) LIKE '%{}%'",
            sql, search_lower, search_lower
        );
    }

    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(e) => return err_result(format!("Query error: {}", e)),
    };

    let params: Vec<&dyn rusqlite::types::ToSql> =
        bind_vals.iter().map(|v| v as &dyn rusqlite::types::ToSql).collect();

    let rows: Vec<Value> = stmt
        .query_map(params.as_slice(), |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "title": row.get::<_, String>(1)?,
                "preview": row.get::<_, String>(2)?,
                "updated_at": row.get::<_, String>(3)?,
                "word_count": row.get::<_, i64>(4)?,
                "state": row.get::<_, String>(5).unwrap_or_else(|_| "draft".to_string()),
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();

    json_result(&json!(rows))
}

fn tool_pin_note(conn: &Connection, p: &Value) -> Value {
    let id = match str_param(p, "note_id") {
        Some(v) => v,
        None => return err_result("note_id is required"),
    };
    let pinned = opt_bool(p, "pinned").unwrap_or(true);
    let now = Utc::now().to_rfc3339();
    let _ = conn.execute(
        "UPDATE notes SET is_pinned = ?1, updated_at = ?2 WHERE id = ?3",
        params![pinned as i32, now, id],
    );
    text_result(if pinned { "Note pinned." } else { "Note unpinned." })
}

fn tool_restore_note(conn: &Connection, p: &Value) -> Value {
    let id = match str_param(p, "note_id") {
        Some(v) => v,
        None => return err_result("note_id is required"),
    };
    let now = Utc::now().to_rfc3339();
    let _ = conn.execute(
        "UPDATE notes SET is_trashed = 0, updated_at = ?1 WHERE id = ?2",
        params![now, id],
    );
    text_result("Note restored from trash.")
}

fn tool_list_tags(conn: &Connection) -> Value {
    let mut stmt = match conn.prepare(
        "SELECT name, parent_name, note_count, is_pinned FROM tags ORDER BY note_count DESC, name",
    ) {
        Ok(s) => s,
        Err(e) => return err_result(e.to_string()),
    };
    let rows: Vec<Value> = stmt
        .query_map([], |row| {
            Ok(json!({
                "name": row.get::<_, String>(0)?,
                "parent_name": row.get::<_, Option<String>>(1)?,
                "note_count": row.get::<_, i64>(2)?,
                "is_pinned": row.get::<_, i32>(3)? != 0,
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();
    json_result(&json!(rows))
}

fn tool_get_backlinks(conn: &Connection, p: &Value) -> Value {
    let title = match str_param(p, "note_title") {
        Some(t) => t,
        None => return err_result("note_title is required"),
    };
    let pattern = format!("%[[{}]]%", title);
    let mut stmt = match conn.prepare(
        "SELECT id, title, updated_at FROM notes WHERE content LIKE ?1 AND is_trashed = 0 ORDER BY updated_at DESC",
    ) {
        Ok(s) => s,
        Err(e) => return err_result(e.to_string()),
    };
    let rows: Vec<Value> = stmt
        .query_map([&pattern], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "title": row.get::<_, String>(1)?,
                "updated_at": row.get::<_, String>(2)?,
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();
    json_result(&json!(rows))
}

fn tool_get_forward_links(conn: &Connection, p: &Value) -> Value {
    let id = match str_param(p, "note_id") {
        Some(v) => v,
        None => return err_result("note_id is required"),
    };

    let content: String = match conn.query_row(
        "SELECT content FROM notes WHERE id = ?1",
        [id],
        |row| row.get(0),
    ) {
        Ok(c) => c,
        Err(_) => return err_result("Note not found"),
    };

    let re = regex::Regex::new(r"\[\[([^\]]+)\]\]").unwrap();
    let link_titles: Vec<String> = re
        .captures_iter(&content)
        .map(|c| c[1].to_string())
        .collect();

    let mut results = Vec::new();
    for title in &link_titles {
        let note: Option<Value> = conn
            .query_row(
                "SELECT id, title, updated_at FROM notes WHERE title = ?1 AND is_trashed = 0",
                [title],
                |row| {
                    Ok(json!({
                        "id": row.get::<_, String>(0)?,
                        "title": row.get::<_, String>(1)?,
                        "updated_at": row.get::<_, String>(2)?,
                    }))
                },
            )
            .ok();
        if let Some(n) = note {
            results.push(n);
        } else {
            results.push(json!({ "title": title, "exists": false }));
        }
    }
    json_result(&json!(results))
}

// ── Agent tools ───────────────────────────────────────────────────────────────

fn tool_register_agent(conn: &Connection, p: &Value) -> Value {
    let name = match str_param(p, "name") {
        Some(n) => n,
        None => return err_result("name is required"),
    };
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let caps: Vec<String> = p
        .get("capabilities")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();
    let caps_json = serde_json::to_string(&caps).unwrap_or_else(|_| "[]".to_string());

    if let Err(e) = conn.execute(
        "INSERT INTO agents (id, name, description, capabilities, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, name, opt_str(p, "description").unwrap_or_default(), caps_json, now, now],
    ) {
        return err_result(e.to_string());
    }

    match conn.query_row(
        "SELECT id, name, description, capabilities, is_active, created_at, updated_at FROM agents WHERE id = ?1",
        [&id],
        |row| {
            let caps_json: String = row.get(3)?;
            let caps: Vec<String> = serde_json::from_str(&caps_json).unwrap_or_default();
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "description": row.get::<_, String>(2)?,
                "capabilities": caps,
                "is_active": row.get::<_, i32>(4)? != 0,
                "created_at": row.get::<_, String>(5)?,
                "updated_at": row.get::<_, String>(6)?,
            }))
        },
    ) {
        Ok(agent) => json_result(&agent),
        Err(e) => err_result(e.to_string()),
    }
}

fn tool_list_agents(conn: &Connection) -> Value {
    let mut stmt = match conn.prepare(
        "SELECT id, name, description, capabilities, is_active, created_at, updated_at FROM agents ORDER BY name",
    ) {
        Ok(s) => s,
        Err(e) => return err_result(e.to_string()),
    };
    let rows: Vec<Value> = stmt
        .query_map([], |row| {
            let caps_json: String = row.get(3)?;
            let caps: Vec<String> = serde_json::from_str(&caps_json).unwrap_or_default();
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "description": row.get::<_, String>(2)?,
                "capabilities": caps,
                "is_active": row.get::<_, i32>(4)? != 0,
                "created_at": row.get::<_, String>(5)?,
                "updated_at": row.get::<_, String>(6)?,
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();
    json_result(&json!(rows))
}

fn tool_get_agent(conn: &Connection, p: &Value) -> Value {
    let id = match str_param(p, "agent_id") {
        Some(v) => v,
        None => return err_result("agent_id is required"),
    };
    match conn.query_row(
        "SELECT id, name, description, capabilities, is_active, created_at, updated_at FROM agents WHERE id = ?1",
        [id],
        |row| {
            let caps_json: String = row.get(3)?;
            let caps: Vec<String> = serde_json::from_str(&caps_json).unwrap_or_default();
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "description": row.get::<_, String>(2)?,
                "capabilities": caps,
                "is_active": row.get::<_, i32>(4)? != 0,
                "created_at": row.get::<_, String>(5)?,
                "updated_at": row.get::<_, String>(6)?,
            }))
        },
    ) {
        Ok(agent) => json_result(&agent),
        Err(e) => err_result(format!("Agent not found: {}", e)),
    }
}

fn tool_deactivate_agent(conn: &Connection, p: &Value) -> Value {
    let id = match str_param(p, "agent_id") {
        Some(v) => v,
        None => return err_result("agent_id is required"),
    };
    let now = Utc::now().to_rfc3339();
    let _ = conn.execute(
        "UPDATE agents SET is_active = 0, updated_at = ?1 WHERE id = ?2",
        params![now, id],
    );
    text_result("Agent deactivated.")
}

fn tool_get_agent_audit_log(conn: &Connection, p: &Value) -> Value {
    let id = match str_param(p, "agent_id") {
        Some(v) => v,
        None => return err_result("agent_id is required"),
    };
    let limit = opt_i64(p, "limit").unwrap_or(50);
    let mut stmt = match conn.prepare(
        "SELECT id, actor, event_type, note_id, timestamp, summary FROM activity_events \
         WHERE agent_id = ?1 ORDER BY timestamp DESC LIMIT ?2",
    ) {
        Ok(s) => s,
        Err(e) => return err_result(e.to_string()),
    };
    let rows: Vec<Value> = stmt
        .query_map(params![id, limit], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "actor": row.get::<_, String>(1)?,
                "event_type": row.get::<_, String>(2)?,
                "note_id": row.get::<_, Option<String>>(3)?,
                "timestamp": row.get::<_, String>(4)?,
                "summary": row.get::<_, String>(5)?,
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();
    json_result(&json!(rows))
}

// ── Workspace tools ───────────────────────────────────────────────────────────

fn tool_create_workspace(conn: &Connection, p: &Value, agent_id: Option<&str>) -> Value {
    let name = match str_param(p, "name") {
        Some(n) => n,
        None => return err_result("name is required"),
    };
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    if let Err(e) = conn.execute(
        "INSERT INTO workspaces (id, name, description, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, name, opt_str(p, "description").unwrap_or_default(), now, now],
    ) {
        return err_result(e.to_string());
    }
    log_activity(conn, "workspace_created", None, &format!("Created workspace '{}'", name), agent_id);
    text_result(format!("Workspace '{}' created with id: {}", name, id))
}

fn tool_list_workspaces(conn: &Connection) -> Value {
    let mut stmt = match conn
        .prepare("SELECT id, name, description, created_at, updated_at FROM workspaces ORDER BY name")
    {
        Ok(s) => s,
        Err(e) => return err_result(e.to_string()),
    };
    let rows: Vec<Value> = stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "description": row.get::<_, String>(2)?,
                "created_at": row.get::<_, String>(3)?,
                "updated_at": row.get::<_, String>(4)?,
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();
    json_result(&json!(rows))
}

// ── Task tools ────────────────────────────────────────────────────────────────

fn tool_create_task(conn: &Connection, p: &Value, agent_id: Option<&str>) -> Value {
    let title = match str_param(p, "title") {
        Some(t) => t,
        None => return err_result("title is required"),
    };
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    if let Err(e) = conn.execute(
        "INSERT INTO tasks (id, title, description, priority, due_date, assigned_agent_id, linked_note_id, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            id,
            title,
            opt_str(p, "description").unwrap_or_default(),
            opt_str(p, "priority").unwrap_or_else(|| "medium".to_string()),
            opt_str(p, "due_date"),
            opt_str(p, "assigned_agent_id"),
            opt_str(p, "linked_note_id"),
            now,
            now,
        ],
    ) {
        return err_result(e.to_string());
    }
    log_activity(conn, "task_created", None, &format!("Created task '{}'", title), agent_id);
    match conn.query_row(
        "SELECT id, title, description, status, priority, due_date, assigned_agent_id, linked_note_id, created_at, updated_at FROM tasks WHERE id = ?1",
        [&id],
        |row| Ok(json!({
            "id": row.get::<_, String>(0)?,
            "title": row.get::<_, String>(1)?,
            "description": row.get::<_, String>(2)?,
            "status": row.get::<_, String>(3)?,
            "priority": row.get::<_, String>(4)?,
            "due_date": row.get::<_, Option<String>>(5)?,
            "assigned_agent_id": row.get::<_, Option<String>>(6)?,
            "linked_note_id": row.get::<_, Option<String>>(7)?,
            "created_at": row.get::<_, String>(8)?,
            "updated_at": row.get::<_, String>(9)?,
        })),
    ) {
        Ok(task) => json_result(&task),
        Err(e) => err_result(e.to_string()),
    }
}

fn tool_list_tasks(conn: &Connection, p: &Value) -> Value {
    let mut conditions = Vec::<String>::new();
    let mut bind_vals: Vec<String> = Vec::new();

    if let Some(status) = str_param(p, "status") {
        conditions.push(format!("status = ?{}", bind_vals.len() + 1));
        bind_vals.push(status.to_string());
    }
    if let Some(aid) = str_param(p, "assigned_agent_id") {
        conditions.push(format!("assigned_agent_id = ?{}", bind_vals.len() + 1));
        bind_vals.push(aid.to_string());
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT id, title, description, status, priority, due_date, assigned_agent_id, linked_note_id, created_at, updated_at \
         FROM tasks {} ORDER BY created_at DESC LIMIT 100",
        where_clause
    );

    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(e) => return err_result(e.to_string()),
    };

    let params: Vec<&dyn rusqlite::types::ToSql> =
        bind_vals.iter().map(|v| v as &dyn rusqlite::types::ToSql).collect();

    let rows: Vec<Value> = stmt
        .query_map(params.as_slice(), |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "title": row.get::<_, String>(1)?,
                "description": row.get::<_, String>(2)?,
                "status": row.get::<_, String>(3)?,
                "priority": row.get::<_, String>(4)?,
                "due_date": row.get::<_, Option<String>>(5)?,
                "assigned_agent_id": row.get::<_, Option<String>>(6)?,
                "linked_note_id": row.get::<_, Option<String>>(7)?,
                "created_at": row.get::<_, String>(8)?,
                "updated_at": row.get::<_, String>(9)?,
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();
    json_result(&json!(rows))
}

fn tool_complete_task(conn: &Connection, p: &Value) -> Value {
    let id = match str_param(p, "task_id") {
        Some(v) => v,
        None => return err_result("task_id is required"),
    };
    let now = Utc::now().to_rfc3339();
    let _ = conn.execute(
        "UPDATE tasks SET status = 'completed', updated_at = ?1 WHERE id = ?2",
        params![now, id],
    );
    text_result("Task marked as completed.")
}

// ── Group A: Simple CRUD ─────────────────────────────────────────────────────

fn tool_batch_create_notes(conn: &Connection, p: &Value, agent_id: Option<&str>) -> Value {
    let notes_arr = match p.get("notes").and_then(|v| v.as_array()) {
        Some(arr) => arr,
        None => return err_result("notes array is required"),
    };

    if let Err(e) = conn.execute_batch("BEGIN") {
        return err_result(format!("Transaction begin failed: {}", e));
    }

    let mut created = Vec::new();
    for item in notes_arr {
        let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let content = item.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let explicit_tags: Vec<String> = item
            .get("tags")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();

        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let wc = word_count(&content);

        let mut tags = extract_tags_from_content(&content);
        for t in &explicit_tags {
            if !tags.contains(t) {
                tags.push(t.clone());
            }
        }

        if let Err(e) = conn.execute(
            "INSERT INTO notes (id, title, content, created_at, updated_at, word_count) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, title, content, now, now, wc],
        ) {
            let _ = conn.execute_batch("ROLLBACK");
            return err_result(format!("Failed to create note '{}': {}", title, e));
        }

        let _ = sync_tags(conn, &id, &tags);
        sync_note_links(conn, &id, &content);
        log_activity(conn, "note_created", Some(&id), &format!("Created note '{}'", title), agent_id);

        if let Ok(note) = fetch_note_json(conn, &id) {
            created.push(note);
        }
    }

    if let Err(e) = conn.execute_batch("COMMIT") {
        return err_result(format!("Transaction commit failed: {}", e));
    }

    json_result(&json!(created))
}

fn tool_get_activity_feed(conn: &Connection, p: &Value) -> Value {
    let limit = opt_i64(p, "limit").unwrap_or(50);
    let note_id = opt_str(p, "note_id");

    let (sql, bind_vals): (String, Vec<String>) = if let Some(nid) = note_id {
        (
            "SELECT id, actor, event_type, note_id, timestamp, summary, data, agent_id \
             FROM activity_events WHERE note_id = ?1 ORDER BY timestamp DESC LIMIT ?2"
                .to_string(),
            vec![nid],
        )
    } else {
        (
            "SELECT id, actor, event_type, note_id, timestamp, summary, data, agent_id \
             FROM activity_events ORDER BY timestamp DESC LIMIT ?1"
                .to_string(),
            vec![],
        )
    };

    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(e) => return err_result(e.to_string()),
    };

    let rows: Vec<Value> = if bind_vals.is_empty() {
        stmt.query_map(params![limit], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "actor": row.get::<_, String>(1)?,
                "event_type": row.get::<_, String>(2)?,
                "note_id": row.get::<_, Option<String>>(3)?,
                "timestamp": row.get::<_, String>(4)?,
                "summary": row.get::<_, String>(5)?,
                "data": row.get::<_, Option<String>>(6)?,
                "agent_id": row.get::<_, Option<String>>(7)?,
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
    } else {
        stmt.query_map(params![bind_vals[0], limit], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "actor": row.get::<_, String>(1)?,
                "event_type": row.get::<_, String>(2)?,
                "note_id": row.get::<_, Option<String>>(3)?,
                "timestamp": row.get::<_, String>(4)?,
                "summary": row.get::<_, String>(5)?,
                "data": row.get::<_, Option<String>>(6)?,
                "agent_id": row.get::<_, Option<String>>(7)?,
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
    };

    json_result(&json!(rows))
}

fn tool_list_templates(conn: &Connection) -> Value {
    let mut stmt = match conn.prepare(
        "SELECT id, name, description, content, tags, initial_state, created_at, updated_at FROM templates ORDER BY name",
    ) {
        Ok(s) => s,
        Err(e) => return err_result(e.to_string()),
    };
    let rows: Vec<Value> = stmt
        .query_map([], |row| {
            let tags_json: String = row.get::<_, String>(4).unwrap_or_else(|_| "[]".to_string());
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "description": row.get::<_, String>(2)?,
                "content": row.get::<_, String>(3)?,
                "tags": tags,
                "initial_state": row.get::<_, String>(5)?,
                "created_at": row.get::<_, String>(6)?,
                "updated_at": row.get::<_, String>(7)?,
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();
    json_result(&json!(rows))
}

fn tool_create_from_template(conn: &Connection, p: &Value, agent_id: Option<&str>) -> Value {
    // Look up template by ID or by name
    let template_row: Option<(String, String, String, String, String)> =
        if let Some(tid) = str_param(p, "template_id") {
            conn.query_row(
                "SELECT id, name, content, tags, initial_state FROM templates WHERE id = ?1",
                [tid],
                |row| Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                )),
            )
            .ok()
        } else if let Some(tname) = str_param(p, "template_name") {
            conn.query_row(
                "SELECT id, name, content, tags, initial_state FROM templates WHERE name LIKE ?1 LIMIT 1",
                [format!("%{}%", tname)],
                |row| Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                )),
            )
            .ok()
        } else {
            return err_result("template_id or template_name is required");
        };

    let (_, tpl_name, tpl_content, tpl_tags_json, initial_state) = match template_row {
        Some(t) => t,
        None => return err_result("Template not found"),
    };

    let title = opt_str(p, "title").unwrap_or_else(|| tpl_name.clone());
    let today = Utc::now().format("%Y-%m-%d").to_string();

    // Replace template variables
    let content = tpl_content
        .replace("{{date}}", &today)
        .replace("{{title}}", &title);

    // Merge template tags with extracted content tags
    let tpl_tags: Vec<String> = serde_json::from_str(&tpl_tags_json).unwrap_or_default();
    let mut tags = extract_tags_from_content(&content);
    for t in &tpl_tags {
        if !tags.contains(t) {
            tags.push(t.clone());
        }
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let wc = word_count(&content);

    if let Err(e) = conn.execute(
        "INSERT INTO notes (id, title, content, created_at, updated_at, word_count, state) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, title, content, now, now, wc, initial_state],
    ) {
        return err_result(e.to_string());
    }

    let _ = sync_tags(conn, &id, &tags);
    sync_note_links(conn, &id, &content);
    log_activity(conn, "note_created", Some(&id), &format!("Created note '{}' from template '{}'", title, tpl_name), agent_id);

    match fetch_note_json(conn, &id) {
        Ok(note) => json_result(&note),
        Err(e) => err_result(e),
    }
}

fn tool_delete_workspace(conn: &Connection, p: &Value, agent_id: Option<&str>) -> Value {
    let id = match str_param(p, "workspace_id") {
        Some(v) => v,
        None => return err_result("workspace_id is required"),
    };
    match conn.execute("DELETE FROM workspaces WHERE id = ?1", [id]) {
        Ok(0) => err_result("Workspace not found"),
        Ok(_) => {
            log_activity(conn, "workspace_deleted", None, &format!("Deleted workspace {}", id), agent_id);
            text_result("Workspace deleted.")
        }
        Err(e) => err_result(e.to_string()),
    }
}

fn tool_update_task(conn: &Connection, p: &Value, agent_id: Option<&str>) -> Value {
    let id = match str_param(p, "task_id") {
        Some(v) => v,
        None => return err_result("task_id is required"),
    };

    // Fetch existing task
    let existing = match conn.query_row(
        "SELECT title, description, status, priority, due_date, assigned_agent_id, linked_note_id FROM tasks WHERE id = ?1",
        [id],
        |row| Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, Option<String>>(4)?,
            row.get::<_, Option<String>>(5)?,
            row.get::<_, Option<String>>(6)?,
        )),
    ) {
        Ok(t) => t,
        Err(e) => return err_result(format!("Task not found: {}", e)),
    };

    let title = opt_str(p, "title").unwrap_or(existing.0);
    let description = opt_str(p, "description").unwrap_or(existing.1);
    let status = opt_str(p, "status").unwrap_or(existing.2);
    let priority = opt_str(p, "priority").unwrap_or(existing.3);
    let due_date = opt_str(p, "due_date").or(existing.4);
    let assigned_agent_id = opt_str(p, "assigned_agent_id").or(existing.5);
    let linked_note_id = opt_str(p, "linked_note_id").or(existing.6);
    let now = Utc::now().to_rfc3339();

    if let Err(e) = conn.execute(
        "UPDATE tasks SET title = ?1, description = ?2, status = ?3, priority = ?4, due_date = ?5, assigned_agent_id = ?6, linked_note_id = ?7, updated_at = ?8 WHERE id = ?9",
        params![title, description, status, priority, due_date, assigned_agent_id, linked_note_id, now, id],
    ) {
        return err_result(e.to_string());
    }

    log_activity(conn, "task_updated", None, &format!("Updated task '{}'", title), agent_id);

    match conn.query_row(
        "SELECT id, title, description, status, priority, due_date, assigned_agent_id, linked_note_id, created_at, updated_at FROM tasks WHERE id = ?1",
        [id],
        |row| Ok(json!({
            "id": row.get::<_, String>(0)?,
            "title": row.get::<_, String>(1)?,
            "description": row.get::<_, String>(2)?,
            "status": row.get::<_, String>(3)?,
            "priority": row.get::<_, String>(4)?,
            "due_date": row.get::<_, Option<String>>(5)?,
            "assigned_agent_id": row.get::<_, Option<String>>(6)?,
            "linked_note_id": row.get::<_, Option<String>>(7)?,
            "created_at": row.get::<_, String>(8)?,
            "updated_at": row.get::<_, String>(9)?,
        })),
    ) {
        Ok(task) => json_result(&task),
        Err(e) => err_result(e.to_string()),
    }
}

fn tool_assign_task(conn: &Connection, p: &Value) -> Value {
    let task_id = match str_param(p, "task_id") {
        Some(v) => v,
        None => return err_result("task_id is required"),
    };
    let agent_id_val = match str_param(p, "agent_id") {
        Some(v) => v,
        None => return err_result("agent_id is required"),
    };
    let now = Utc::now().to_rfc3339();
    match conn.execute(
        "UPDATE tasks SET assigned_agent_id = ?1, updated_at = ?2 WHERE id = ?3",
        params![agent_id_val, now, task_id],
    ) {
        Ok(0) => err_result("Task not found"),
        Ok(_) => text_result(format!("Task {} assigned to agent {}.", task_id, agent_id_val)),
        Err(e) => err_result(e.to_string()),
    }
}

fn tool_update_agent(conn: &Connection, p: &Value) -> Value {
    let id = match str_param(p, "agent_id") {
        Some(v) => v,
        None => return err_result("agent_id is required"),
    };

    let existing = match conn.query_row(
        "SELECT name, description, capabilities FROM agents WHERE id = ?1",
        [id],
        |row| Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        )),
    ) {
        Ok(a) => a,
        Err(e) => return err_result(format!("Agent not found: {}", e)),
    };

    let name = opt_str(p, "name").unwrap_or(existing.0);
    let description = opt_str(p, "description").unwrap_or(existing.1);
    let capabilities = if let Some(arr) = p.get("capabilities").and_then(|v| v.as_array()) {
        let caps: Vec<String> = arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect();
        serde_json::to_string(&caps).unwrap_or_else(|_| "[]".to_string())
    } else {
        existing.2
    };
    let now = Utc::now().to_rfc3339();

    if let Err(e) = conn.execute(
        "UPDATE agents SET name = ?1, description = ?2, capabilities = ?3, updated_at = ?4 WHERE id = ?5",
        params![name, description, capabilities, now, id],
    ) {
        return err_result(e.to_string());
    }

    match conn.query_row(
        "SELECT id, name, description, capabilities, is_active, created_at, updated_at FROM agents WHERE id = ?1",
        [id],
        |row| {
            let caps_json: String = row.get(3)?;
            let caps: Vec<String> = serde_json::from_str(&caps_json).unwrap_or_default();
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "description": row.get::<_, String>(2)?,
                "capabilities": caps,
                "is_active": row.get::<_, i32>(4)? != 0,
                "created_at": row.get::<_, String>(5)?,
                "updated_at": row.get::<_, String>(6)?,
            }))
        },
    ) {
        Ok(agent) => json_result(&agent),
        Err(e) => err_result(e.to_string()),
    }
}

fn tool_bind_agent_workspace(conn: &Connection, p: &Value) -> Value {
    let agent_id_val = match str_param(p, "agent_id") {
        Some(v) => v,
        None => return err_result("agent_id is required"),
    };
    let workspace_id = match str_param(p, "workspace_id") {
        Some(v) => v,
        None => return err_result("workspace_id is required"),
    };
    let role = opt_str(p, "role").unwrap_or_else(|| "member".to_string());
    let now = Utc::now().to_rfc3339();

    if let Err(e) = conn.execute(
        "INSERT OR IGNORE INTO agent_workspaces (agent_id, workspace_id, role, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![agent_id_val, workspace_id, role, now],
    ) {
        return err_result(e.to_string());
    }
    text_result(format!("Agent {} bound to workspace {} as {}.", agent_id_val, workspace_id, role))
}

fn tool_get_agent_workspaces(conn: &Connection, p: &Value) -> Value {
    let agent_id_val = match str_param(p, "agent_id") {
        Some(v) => v,
        None => return err_result("agent_id is required"),
    };

    let mut stmt = match conn.prepare(
        "SELECT w.id, w.name, w.description, w.created_at, w.updated_at, aw.role \
         FROM workspaces w JOIN agent_workspaces aw ON w.id = aw.workspace_id \
         WHERE aw.agent_id = ?1 ORDER BY w.name",
    ) {
        Ok(s) => s,
        Err(e) => return err_result(e.to_string()),
    };
    let rows: Vec<Value> = stmt
        .query_map([agent_id_val], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "description": row.get::<_, String>(2)?,
                "created_at": row.get::<_, String>(3)?,
                "updated_at": row.get::<_, String>(4)?,
                "role": row.get::<_, String>(5)?,
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();
    json_result(&json!(rows))
}

fn tool_unbind_agent_workspace(conn: &Connection, p: &Value) -> Value {
    let agent_id_val = match str_param(p, "agent_id") {
        Some(v) => v,
        None => return err_result("agent_id is required"),
    };
    let workspace_id = match str_param(p, "workspace_id") {
        Some(v) => v,
        None => return err_result("workspace_id is required"),
    };
    match conn.execute(
        "DELETE FROM agent_workspaces WHERE agent_id = ?1 AND workspace_id = ?2",
        params![agent_id_val, workspace_id],
    ) {
        Ok(0) => err_result("Binding not found"),
        Ok(_) => text_result("Agent unbound from workspace."),
        Err(e) => err_result(e.to_string()),
    }
}

fn tool_import_markdown(conn: &Connection, p: &Value, agent_id: Option<&str>) -> Value {
    let paths = match p.get("paths").and_then(|v| v.as_array()) {
        Some(arr) => arr,
        None => return err_result("paths array is required"),
    };

    // Collect all .md file paths
    let mut md_files: Vec<PathBuf> = Vec::new();
    for path_val in paths {
        let path_str = match path_val.as_str() {
            Some(s) => s,
            None => continue,
        };
        let path = PathBuf::from(path_str);
        if path.is_dir() {
            // Recursively find .md files
            fn collect_md(dir: &std::path::Path, out: &mut Vec<PathBuf>) {
                if let Ok(entries) = std::fs::read_dir(dir) {
                    for entry in entries.filter_map(|e| e.ok()) {
                        let p = entry.path();
                        if p.is_dir() {
                            collect_md(&p, out);
                        } else if p.extension().and_then(|e| e.to_str()) == Some("md") {
                            out.push(p);
                        }
                    }
                }
            }
            collect_md(&path, &mut md_files);
        } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
            md_files.push(path);
        }
    }

    if let Err(e) = conn.execute_batch("BEGIN") {
        return err_result(format!("Transaction begin failed: {}", e));
    }

    let mut imported = 0i64;
    let mut skipped = 0i64;

    for md_path in &md_files {
        let content = match std::fs::read_to_string(md_path) {
            Ok(c) => c,
            Err(_) => {
                skipped += 1;
                continue;
            }
        };

        let title = md_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled")
            .to_string();

        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let wc = word_count(&content);
        let tags = extract_tags_from_content(&content);

        if conn.execute(
            "INSERT INTO notes (id, title, content, created_at, updated_at, word_count) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, title, content, now, now, wc],
        ).is_err() {
            skipped += 1;
            continue;
        }

        let _ = sync_tags(conn, &id, &tags);
        sync_note_links(conn, &id, &content);
        log_activity(conn, "note_created", Some(&id), &format!("Imported '{}'", title), agent_id);
        imported += 1;
    }

    let _ = conn.execute_batch("COMMIT");
    json_result(&json!({ "imported": imported, "skipped": skipped }))
}

fn tool_export_note_markdown(conn: &Connection, p: &Value) -> Value {
    let id = match str_param(p, "note_id") {
        Some(v) => v,
        None => return err_result("note_id is required"),
    };

    let note = match fetch_note_json(conn, id) {
        Ok(n) => n,
        Err(e) => return err_result(e),
    };

    let title = note["title"].as_str().unwrap_or("");
    let content = note["content"].as_str().unwrap_or("");
    let created_at = note["created_at"].as_str().unwrap_or("");
    let updated_at = note["updated_at"].as_str().unwrap_or("");
    let state = note["state"].as_str().unwrap_or("draft");
    let tags: Vec<&str> = note["tags"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect())
        .unwrap_or_default();

    let tags_yaml = if tags.is_empty() {
        "[]".to_string()
    } else {
        format!("[{}]", tags.iter().map(|t| format!("\"{}\"", t)).collect::<Vec<_>>().join(", "))
    };

    let markdown = format!(
        "---\ntitle: \"{}\"\ncreated_at: \"{}\"\nupdated_at: \"{}\"\ntags: {}\nstate: \"{}\"\n---\n\n{}",
        title, created_at, updated_at, tags_yaml, state, content
    );
    text_result(markdown)
}

fn tool_export_note_html(conn: &Connection, p: &Value) -> Value {
    let id = match str_param(p, "note_id") {
        Some(v) => v,
        None => return err_result("note_id is required"),
    };

    let note = match fetch_note_json(conn, id) {
        Ok(n) => n,
        Err(e) => return err_result(e),
    };

    let title = note["title"].as_str().unwrap_or("Untitled");
    let content = note["content"].as_str().unwrap_or("");

    let parser = pulldown_cmark::Parser::new(content);
    let mut html_body = String::new();
    pulldown_cmark::html::push_html(&mut html_body, parser);

    let html = format!(
        "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<title>{}</title>\n<style>\n\
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 720px; margin: 2em auto; padding: 0 1em; line-height: 1.6; color: #333; }}\n\
        h1 {{ border-bottom: 1px solid #eee; padding-bottom: 0.3em; }}\n\
        pre {{ background: #f6f8fa; padding: 1em; border-radius: 6px; overflow-x: auto; }}\n\
        code {{ background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; font-size: 85%; }}\n\
        pre code {{ background: none; padding: 0; }}\n\
        blockquote {{ border-left: 4px solid #dfe2e5; margin: 0; padding: 0 1em; color: #6a737d; }}\n\
        </style>\n</head>\n<body>\n<h1>{}</h1>\n{}\n</body>\n</html>",
        title, title, html_body
    );
    text_result(html)
}

fn tool_get_knowledge_graph(conn: &Connection, p: &Value) -> Value {
    let depth = opt_i64(p, "depth").unwrap_or(2) as usize;
    let max_nodes = opt_i64(p, "max_nodes").unwrap_or(200) as usize;
    let center_id = opt_str(p, "center_note_id");

    let mut nodes: Vec<Value> = Vec::new();
    let mut edges: Vec<Value> = Vec::new();
    let mut visited: HashSet<String> = HashSet::new();

    if let Some(cid) = center_id {
        // BFS from center
        let mut queue: VecDeque<(String, usize)> = VecDeque::new();
        queue.push_back((cid.clone(), 0));
        visited.insert(cid);

        while let Some((node_id, d)) = queue.pop_front() {
            if visited.len() > max_nodes {
                break;
            }

            // Fetch node info
            if let Ok(row) = conn.query_row(
                "SELECT id, title FROM notes WHERE id = ?1 AND is_trashed = 0",
                [&node_id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            ) {
                let link_count: i64 = conn
                    .query_row(
                        "SELECT COUNT(*) FROM note_links WHERE source_note_id = ?1 OR target_note_id = ?1",
                        [&node_id],
                        |row| row.get(0),
                    )
                    .unwrap_or(0);
                let tags = fetch_note_tags(conn, &node_id);
                nodes.push(json!({
                    "id": row.0,
                    "title": row.1,
                    "link_count": link_count,
                    "tags": tags,
                }));
            }

            if d >= depth {
                continue;
            }

            // Outbound links
            let mut stmt = match conn.prepare(
                "SELECT target_note_id, link_type FROM note_links WHERE source_note_id = ?1",
            ) {
                Ok(s) => s,
                Err(_) => continue,
            };
            let outbound: Vec<(String, String)> = stmt
                .query_map([&node_id], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                })
                .map(|rows| rows.filter_map(|r| r.ok()).collect())
                .unwrap_or_default();

            for (target, link_type) in outbound {
                edges.push(json!({
                    "source": node_id,
                    "target": target,
                    "type": link_type,
                }));
                if !visited.contains(&target) {
                    visited.insert(target.clone());
                    queue.push_back((target, d + 1));
                }
            }

            // Inbound links
            let mut stmt = match conn.prepare(
                "SELECT source_note_id, link_type FROM note_links WHERE target_note_id = ?1",
            ) {
                Ok(s) => s,
                Err(_) => continue,
            };
            let inbound: Vec<(String, String)> = stmt
                .query_map([&node_id], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                })
                .map(|rows| rows.filter_map(|r| r.ok()).collect())
                .unwrap_or_default();

            for (source, link_type) in inbound {
                edges.push(json!({
                    "source": source,
                    "target": node_id,
                    "type": link_type,
                }));
                if !visited.contains(&source) {
                    visited.insert(source.clone());
                    queue.push_back((source, d + 1));
                }
            }
        }
    } else {
        // No center: return all linked notes up to max_nodes
        let mut stmt = match conn.prepare(
            "SELECT DISTINCT source_note_id, target_note_id, link_type FROM note_links LIMIT ?1",
        ) {
            Ok(s) => s,
            Err(e) => return err_result(e.to_string()),
        };
        let all_edges: Vec<(String, String, String)> = stmt
            .query_map([max_nodes as i64 * 2], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .map(|rows| rows.filter_map(|r| r.ok()).collect())
            .unwrap_or_default();

        for (source, target, link_type) in &all_edges {
            visited.insert(source.clone());
            visited.insert(target.clone());
            edges.push(json!({
                "source": source,
                "target": target,
                "type": link_type,
            }));
        }

        // Fetch node info for all visited
        for node_id in visited.iter().take(max_nodes) {
            if let Ok(row) = conn.query_row(
                "SELECT id, title FROM notes WHERE id = ?1 AND is_trashed = 0",
                [node_id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            ) {
                let link_count: i64 = conn
                    .query_row(
                        "SELECT COUNT(*) FROM note_links WHERE source_note_id = ?1 OR target_note_id = ?1",
                        [node_id],
                        |row| row.get(0),
                    )
                    .unwrap_or(0);
                let tags = fetch_note_tags(conn, node_id);
                nodes.push(json!({
                    "id": row.0,
                    "title": row.1,
                    "link_count": link_count,
                    "tags": tags,
                }));
            }
        }
    }

    json_result(&json!({
        "nodes": nodes,
        "edges": edges,
        "node_count": nodes.len(),
        "edge_count": edges.len(),
    }))
}

// ── Group B: Context/State ───────────────────────────────────────────────────

fn tool_switch_workspace(conn: &Connection, p: &Value) -> Value {
    let workspace_id = opt_str(p, "workspace_id");

    if let Some(ref wid) = workspace_id {
        // Verify workspace exists
        let exists: bool = conn
            .query_row("SELECT 1 FROM workspaces WHERE id = ?1", [wid], |_| Ok(true))
            .unwrap_or(false);
        if !exists {
            return err_result(format!("Workspace '{}' not found", wid));
        }
    }

    CURRENT_WORKSPACE_ID.with(|cell| {
        *cell.borrow_mut() = workspace_id.clone();
    });

    match workspace_id {
        Some(wid) => text_result(format!("Switched to workspace {}.", wid)),
        None => text_result("Cleared workspace context."),
    }
}

fn tool_get_current_workspace(_conn: &Connection) -> Value {
    let wid = CURRENT_WORKSPACE_ID.with(|cell| cell.borrow().clone());
    json_result(&json!({ "workspace_id": wid }))
}

fn tool_set_current_agent(conn: &Connection, p: &Value) -> Value {
    let agent_id_val = match str_param(p, "agent_id") {
        Some(v) => v,
        None => return err_result("agent_id is required"),
    };

    // Verify agent exists
    let exists: bool = conn
        .query_row("SELECT 1 FROM agents WHERE id = ?1", [agent_id_val], |_| Ok(true))
        .unwrap_or(false);
    if !exists {
        return err_result(format!("Agent '{}' not found", agent_id_val));
    }

    CURRENT_AGENT_ID.with(|cell| {
        *cell.borrow_mut() = Some(agent_id_val.to_string());
    });

    text_result(format!("Current agent set to {}.", agent_id_val))
}

// ── Group C: Webhooks ────────────────────────────────────────────────────────

fn tool_register_webhook(conn: &Connection, p: &Value) -> Value {
    let url = match str_param(p, "url") {
        Some(v) => v,
        None => return err_result("url is required"),
    };
    let secret = match str_param(p, "secret") {
        Some(v) => v,
        None => return err_result("secret is required"),
    };
    let event_types: Vec<String> = p
        .get("event_types")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();
    let event_types_json = serde_json::to_string(&event_types).unwrap_or_else(|_| "[]".to_string());

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    if let Err(e) = conn.execute(
        "INSERT INTO webhooks (id, url, event_types, secret, is_active, created_at) VALUES (?1, ?2, ?3, ?4, 1, ?5)",
        params![id, url, event_types_json, secret, now],
    ) {
        return err_result(e.to_string());
    }

    json_result(&json!({
        "id": id,
        "url": url,
        "event_types": event_types,
        "secret": "***",
        "is_active": true,
        "created_at": now,
    }))
}

fn tool_list_webhooks(conn: &Connection) -> Value {
    let mut stmt = match conn.prepare(
        "SELECT id, url, event_types, is_active, created_at, last_triggered_at, failure_count FROM webhooks ORDER BY created_at DESC",
    ) {
        Ok(s) => s,
        Err(e) => return err_result(e.to_string()),
    };
    let rows: Vec<Value> = stmt
        .query_map([], |row| {
            let et_json: String = row.get::<_, String>(2).unwrap_or_else(|_| "[]".to_string());
            let et: Vec<String> = serde_json::from_str(&et_json).unwrap_or_default();
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "url": row.get::<_, String>(1)?,
                "event_types": et,
                "is_active": row.get::<_, i32>(3)? != 0,
                "created_at": row.get::<_, String>(4)?,
                "last_triggered_at": row.get::<_, Option<String>>(5)?,
                "failure_count": row.get::<_, i64>(6)?,
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();
    json_result(&json!(rows))
}

fn tool_delete_webhook(conn: &Connection, p: &Value) -> Value {
    let id = match str_param(p, "webhook_id") {
        Some(v) => v,
        None => return err_result("webhook_id is required"),
    };
    match conn.execute("DELETE FROM webhooks WHERE id = ?1", [id]) {
        Ok(0) => err_result("Webhook not found"),
        Ok(_) => text_result("Webhook deleted."),
        Err(e) => err_result(e.to_string()),
    }
}

fn tool_update_webhook(conn: &Connection, p: &Value) -> Value {
    let id = match str_param(p, "webhook_id") {
        Some(v) => v,
        None => return err_result("webhook_id is required"),
    };

    let existing = match conn.query_row(
        "SELECT url, event_types, is_active FROM webhooks WHERE id = ?1",
        [id],
        |row| Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i32>(2)?,
        )),
    ) {
        Ok(w) => w,
        Err(e) => return err_result(format!("Webhook not found: {}", e)),
    };

    let url = opt_str(p, "url").unwrap_or(existing.0);
    let event_types_json = if let Some(arr) = p.get("event_types").and_then(|v| v.as_array()) {
        let et: Vec<String> = arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect();
        serde_json::to_string(&et).unwrap_or_else(|_| "[]".to_string())
    } else {
        existing.1
    };
    let is_active = opt_bool(p, "is_active").map(|b| b as i32).unwrap_or(existing.2);

    if let Err(e) = conn.execute(
        "UPDATE webhooks SET url = ?1, event_types = ?2, is_active = ?3 WHERE id = ?4",
        params![url, event_types_json, is_active, id],
    ) {
        return err_result(e.to_string());
    }

    let et: Vec<String> = serde_json::from_str(&event_types_json).unwrap_or_default();
    json_result(&json!({
        "id": id,
        "url": url,
        "event_types": et,
        "is_active": is_active != 0,
    }))
}

fn tool_test_webhook(conn: &Connection, p: &Value) -> Value {
    let id = match str_param(p, "webhook_id") {
        Some(v) => v,
        None => return err_result("webhook_id is required"),
    };

    let (url, secret) = match conn.query_row(
        "SELECT url, secret FROM webhooks WHERE id = ?1",
        [id],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
    ) {
        Ok(w) => w,
        Err(e) => return err_result(format!("Webhook not found: {}", e)),
    };

    let now = Utc::now().to_rfc3339();
    let payload = json!({
        "event": "test",
        "webhook_id": id,
        "timestamp": now,
        "data": { "message": "This is a test webhook delivery from Bruin." }
    });
    let payload_str = serde_json::to_string(&payload).unwrap_or_default();

    // Compute HMAC-SHA256
    use hmac::{Hmac, Mac};
    type HmacSha256 = Hmac<sha2::Sha256>;
    let mut mac = match HmacSha256::new_from_slice(secret.as_bytes()) {
        Ok(m) => m,
        Err(e) => return err_result(format!("HMAC error: {}", e)),
    };
    mac.update(payload_str.as_bytes());
    let signature = hex::encode(mac.finalize().into_bytes());

    // POST
    let result = ureq::post(&url)
        .set("Content-Type", "application/json")
        .set("X-Bruin-Signature", &format!("sha256={}", signature))
        .set("X-Bruin-Event", "test")
        .send_string(&payload_str);

    let (status_code, response_body, success, error_msg) = match result {
        Ok(resp) => {
            let status = resp.status() as i64;
            let body = resp.into_string().unwrap_or_default();
            (status, body, true, None::<String>)
        }
        Err(ureq::Error::Status(code, resp)) => {
            let body = resp.into_string().unwrap_or_default();
            (code as i64, body, false, Some(format!("HTTP {}", code)))
        }
        Err(e) => {
            (0i64, String::new(), false, Some(e.to_string()))
        }
    };

    // Log to webhook_logs
    let _ = conn.execute(
        "INSERT INTO webhook_logs (webhook_id, event_type, payload, status_code, response_body, success, error_message, timestamp) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![id, "test", payload_str, status_code, response_body, success as i32, error_msg, now],
    );

    json_result(&json!({
        "success": success,
        "status_code": status_code,
        "response_preview": &response_body[..response_body.len().min(500)],
        "error": error_msg,
    }))
}

fn tool_get_webhook_logs(conn: &Connection, p: &Value) -> Value {
    let webhook_id = match str_param(p, "webhook_id") {
        Some(v) => v,
        None => return err_result("webhook_id is required"),
    };
    let limit = opt_i64(p, "limit").unwrap_or(50);

    let mut stmt = match conn.prepare(
        "SELECT id, event_type, payload, status_code, response_body, attempt, success, error_message, timestamp \
         FROM webhook_logs WHERE webhook_id = ?1 ORDER BY timestamp DESC LIMIT ?2",
    ) {
        Ok(s) => s,
        Err(e) => return err_result(e.to_string()),
    };
    let rows: Vec<Value> = stmt
        .query_map(params![webhook_id, limit], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "event_type": row.get::<_, String>(1)?,
                "payload": row.get::<_, String>(2)?,
                "status_code": row.get::<_, Option<i64>>(3)?,
                "response_body": row.get::<_, Option<String>>(4)?,
                "attempt": row.get::<_, i64>(5)?,
                "success": row.get::<_, i32>(6)? != 0,
                "error_message": row.get::<_, Option<String>>(7)?,
                "timestamp": row.get::<_, String>(8)?,
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();
    json_result(&json!(rows))
}

// ── Group D: Workflows ───────────────────────────────────────────────────────

fn tool_list_workflow_templates(conn: &Connection) -> Value {
    let mut stmt = match conn.prepare(
        "SELECT id, name, description, category, steps, created_at, updated_at FROM workflow_templates ORDER BY name",
    ) {
        Ok(s) => s,
        Err(e) => return err_result(e.to_string()),
    };
    let rows: Vec<Value> = stmt
        .query_map([], |row| {
            let steps_json: String = row.get::<_, String>(4).unwrap_or_else(|_| "[]".to_string());
            let steps: Value = serde_json::from_str(&steps_json).unwrap_or(json!([]));
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "description": row.get::<_, String>(2)?,
                "category": row.get::<_, String>(3)?,
                "steps": steps,
                "created_at": row.get::<_, String>(5)?,
                "updated_at": row.get::<_, String>(6)?,
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();
    json_result(&json!(rows))
}

fn tool_get_workflow_template(conn: &Connection, p: &Value) -> Value {
    let id = match str_param(p, "workflow_id") {
        Some(v) => v,
        None => return err_result("workflow_id is required"),
    };
    match conn.query_row(
        "SELECT id, name, description, category, steps, created_at, updated_at FROM workflow_templates WHERE id = ?1",
        [id],
        |row| {
            let steps_json: String = row.get::<_, String>(4).unwrap_or_else(|_| "[]".to_string());
            let steps: Value = serde_json::from_str(&steps_json).unwrap_or(json!([]));
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "description": row.get::<_, String>(2)?,
                "category": row.get::<_, String>(3)?,
                "steps": steps,
                "created_at": row.get::<_, String>(5)?,
                "updated_at": row.get::<_, String>(6)?,
            }))
        },
    ) {
        Ok(wf) => json_result(&wf),
        Err(e) => err_result(format!("Workflow template not found: {}", e)),
    }
}

fn tool_create_workflow_template(conn: &Connection, p: &Value) -> Value {
    let name = match str_param(p, "name") {
        Some(v) => v,
        None => return err_result("name is required"),
    };
    let description = opt_str(p, "description").unwrap_or_default();
    let category = opt_str(p, "category").unwrap_or_else(|| "general".to_string());
    let steps = p.get("steps").cloned().unwrap_or(json!([]));
    let steps_json = serde_json::to_string(&steps).unwrap_or_else(|_| "[]".to_string());

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    if let Err(e) = conn.execute(
        "INSERT INTO workflow_templates (id, name, description, category, steps, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, name, description, category, steps_json, now, now],
    ) {
        return err_result(e.to_string());
    }

    json_result(&json!({
        "id": id,
        "name": name,
        "description": description,
        "category": category,
        "steps": steps,
        "created_at": now,
        "updated_at": now,
    }))
}

fn tool_delete_workflow_template(conn: &Connection, p: &Value) -> Value {
    let id = match str_param(p, "workflow_id") {
        Some(v) => v,
        None => return err_result("workflow_id is required"),
    };
    match conn.execute("DELETE FROM workflow_templates WHERE id = ?1", [id]) {
        Ok(0) => err_result("Workflow template not found"),
        Ok(_) => text_result("Workflow template deleted."),
        Err(e) => err_result(e.to_string()),
    }
}

fn tool_execute_workflow(conn: &Connection, p: &Value, agent_id: Option<&str>) -> Value {
    let workflow_id = match str_param(p, "workflow_id") {
        Some(v) => v,
        None => return err_result("workflow_id is required"),
    };

    let (name, steps_json) = match conn.query_row(
        "SELECT name, steps FROM workflow_templates WHERE id = ?1",
        [workflow_id],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
    ) {
        Ok(w) => w,
        Err(e) => return err_result(format!("Workflow template not found: {}", e)),
    };

    let steps: Vec<Value> = serde_json::from_str(&steps_json).unwrap_or_default();
    let today = Utc::now().format("%Y-%m-%d").to_string();

    let mut step_results: Vec<Value> = Vec::new();
    let mut step_outputs: HashMap<String, Value> = HashMap::new();
    let step_ref_re = regex::Regex::new(r"\{\{(\w+)\.(\w+)\}\}").unwrap();

    for (i, step) in steps.iter().enumerate() {
        let tool_name = step.get("tool").and_then(|v| v.as_str()).unwrap_or("");
        let step_name = step
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or(&format!("step_{}", i))
            .to_string();
        let mut args = step.get("params").cloned().unwrap_or(json!({}));

        // Interpolate variables in string params
        if let Some(obj) = args.as_object_mut() {
            let keys: Vec<String> = obj.keys().cloned().collect();
            for key in keys {
                if let Some(s) = obj.get(&key).and_then(|v| v.as_str()).map(|s| s.to_string()) {
                    let mut val = s.replace("{{date}}", &today);
                    // Replace {{stepname.field}} with previous step output
                    let val_clone = val.clone();
                    for cap in step_ref_re.captures_iter(&val_clone) {
                        let ref_step = &cap[1];
                        let ref_field = &cap[2];
                        if let Some(prev) = step_outputs.get(ref_step) {
                            if let Some(replacement) = prev.get(ref_field).and_then(|v| v.as_str()) {
                                val = val.replace(&cap[0], replacement);
                            }
                        }
                    }
                    obj.insert(key, json!(val));
                }
            }
        }

        // Execute the step tool — delegate to the main dispatch
        let step_params = json!({ "name": tool_name, "arguments": args });
        let result = match dispatch(conn, "tools/call", &step_params, agent_id) {
            Ok(v) => v,
            Err(e) => err_result(e),
        };

        // Try to parse the result content as JSON for step_outputs
        if let Some(content_text) = result
            .get("content")
            .and_then(|c| c.as_array())
            .and_then(|arr| arr.first())
            .and_then(|item| item.get("text"))
            .and_then(|v| v.as_str())
        {
            if let Ok(parsed) = serde_json::from_str::<Value>(content_text) {
                step_outputs.insert(step_name.clone(), parsed);
            }
        }

        step_results.push(json!({
            "step": i,
            "name": step_name,
            "tool": tool_name,
            "result": result,
        }));
    }

    log_activity(conn, "workflow_executed", None, &format!("Executed workflow '{}'", name), agent_id);

    json_result(&json!({
        "workflow": name,
        "steps_executed": step_results.len(),
        "results": step_results,
    }))
}

// ── Group E: Wiki ────────────────────────────────────────────────────────────

fn tool_wiki_ingest_source(conn: &Connection, p: &Value) -> Value {
    let title = match str_param(p, "title") {
        Some(v) => v,
        None => return err_result("title is required"),
    };
    let content = match str_param(p, "content") {
        Some(v) => v,
        None => return err_result("content is required"),
    };
    let url = opt_str(p, "url");

    // Compute SHA-256
    use sha2::Digest;
    let hash = hex::encode(sha2::Sha256::digest(content.as_bytes()));

    // Check for duplicate
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM wiki_sources WHERE content_hash = ?1",
            [&hash],
            |row| row.get(0),
        )
        .ok();

    if let Some(eid) = existing {
        return err_result(format!("Duplicate content detected. Existing source id: {}", eid));
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    if let Err(e) = conn.execute(
        "INSERT INTO wiki_sources (id, title, url, content_hash, raw_content, ingested_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, title, url, hash, content, now],
    ) {
        return err_result(e.to_string());
    }

    json_result(&json!({
        "id": id,
        "title": title,
        "url": url,
        "content_hash": hash,
        "ingested_at": now,
    }))
}

fn tool_wiki_link_source_pages(conn: &Connection, p: &Value) -> Value {
    let source_id = match str_param(p, "source_id") {
        Some(v) => v,
        None => return err_result("source_id is required"),
    };
    let note_ids = match p.get("note_ids").and_then(|v| v.as_array()) {
        Some(arr) => arr,
        None => return err_result("note_ids array is required"),
    };

    let mut linked = 0i64;
    for nid_val in note_ids {
        if let Some(nid) = nid_val.as_str() {
            if conn
                .execute(
                    "INSERT OR IGNORE INTO wiki_source_pages (source_id, note_id) VALUES (?1, ?2)",
                    params![source_id, nid],
                )
                .is_ok()
            {
                linked += 1;
            }
        }
    }

    json_result(&json!({ "source_id": source_id, "linked": linked }))
}

fn tool_wiki_get_index(conn: &Connection, p: &Value) -> Value {
    let tag = opt_str(p, "tag").unwrap_or_else(|| "wiki".to_string());
    let tag_pattern = format!("{}%", tag);

    let mut stmt = match conn.prepare(
        "SELECT n.id, n.title, n.updated_at, n.word_count, n.state, \
         (SELECT COUNT(*) FROM note_links WHERE target_note_id = n.id) AS backlink_count, \
         (SELECT COUNT(*) FROM note_links WHERE source_note_id = n.id) AS forward_link_count \
         FROM notes n \
         JOIN note_tags nt ON n.id = nt.note_id \
         JOIN tags t ON nt.tag_id = t.id \
         WHERE t.name LIKE ?1 AND n.is_trashed = 0 \
         ORDER BY n.title",
    ) {
        Ok(s) => s,
        Err(e) => return err_result(e.to_string()),
    };
    let rows: Vec<Value> = stmt
        .query_map([&tag_pattern], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "title": row.get::<_, String>(1)?,
                "updated_at": row.get::<_, String>(2)?,
                "word_count": row.get::<_, i64>(3)?,
                "state": row.get::<_, String>(4).unwrap_or_else(|_| "draft".to_string()),
                "backlink_count": row.get::<_, i64>(5)?,
                "forward_link_count": row.get::<_, i64>(6)?,
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();
    json_result(&json!(rows))
}

fn tool_wiki_lint(conn: &Connection) -> Value {
    // Orphan pages: wiki-tagged notes with no links (neither inbound nor outbound)
    let orphans: Vec<Value> = {
        let mut stmt = match conn.prepare(
            "SELECT n.id, n.title FROM notes n \
             JOIN note_tags nt ON n.id = nt.note_id \
             JOIN tags t ON nt.tag_id = t.id \
             WHERE t.name LIKE 'wiki%' AND n.is_trashed = 0 \
             AND n.id NOT IN (SELECT source_note_id FROM note_links) \
             AND n.id NOT IN (SELECT target_note_id FROM note_links) \
             ORDER BY n.title",
        ) {
            Ok(s) => s,
            Err(e) => return err_result(e.to_string()),
        };
        stmt.query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "title": row.get::<_, String>(1)?,
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
    };

    // Missing pages: extract all [[links]] from wiki notes and find titles that don't exist
    let missing: Vec<String> = {
        let mut stmt = match conn.prepare(
            "SELECT n.content FROM notes n \
             JOIN note_tags nt ON n.id = nt.note_id \
             JOIN tags t ON nt.tag_id = t.id \
             WHERE t.name LIKE 'wiki%' AND n.is_trashed = 0",
        ) {
            Ok(s) => s,
            Err(e) => return err_result(e.to_string()),
        };
        let contents: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map(|rows| rows.filter_map(|r| r.ok()).collect())
            .unwrap_or_default();

        let mut all_links: HashSet<String> = HashSet::new();
        for content in &contents {
            for link in extract_wiki_links(content) {
                all_links.insert(link);
            }
        }

        let mut missing_titles = Vec::new();
        for link_title in &all_links {
            let exists: bool = conn
                .query_row(
                    "SELECT 1 FROM notes WHERE title = ?1 AND is_trashed = 0",
                    [link_title],
                    |_| Ok(true),
                )
                .unwrap_or(false);
            if !exists {
                missing_titles.push(link_title.clone());
            }
        }
        missing_titles.sort();
        missing_titles
    };

    // Stale pages: wiki notes not updated in 30+ days
    let stale: Vec<Value> = {
        let cutoff = (Utc::now() - chrono::Duration::days(30)).to_rfc3339();
        let mut stmt = match conn.prepare(
            "SELECT n.id, n.title, n.updated_at FROM notes n \
             JOIN note_tags nt ON n.id = nt.note_id \
             JOIN tags t ON nt.tag_id = t.id \
             WHERE t.name LIKE 'wiki%' AND n.is_trashed = 0 AND n.updated_at < ?1 \
             ORDER BY n.updated_at",
        ) {
            Ok(s) => s,
            Err(e) => return err_result(e.to_string()),
        };
        stmt.query_map([&cutoff], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "title": row.get::<_, String>(1)?,
                "updated_at": row.get::<_, String>(2)?,
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
    };

    // Stats
    let total_wiki_notes: i64 = conn
        .query_row(
            "SELECT COUNT(DISTINCT n.id) FROM notes n \
             JOIN note_tags nt ON n.id = nt.note_id \
             JOIN tags t ON nt.tag_id = t.id \
             WHERE t.name LIKE 'wiki%' AND n.is_trashed = 0",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let total_links: i64 = conn
        .query_row("SELECT COUNT(*) FROM note_links", [], |row| row.get(0))
        .unwrap_or(0);

    json_result(&json!({
        "orphan_pages": orphans,
        "missing_pages": missing,
        "stale_pages": stale,
        "stats": {
            "total_wiki_notes": total_wiki_notes,
            "total_links": total_links,
            "orphan_count": orphans.len(),
            "missing_count": missing.len(),
            "stale_count": stale.len(),
        }
    }))
}

fn tool_wiki_get_source(conn: &Connection, p: &Value) -> Value {
    let id = match str_param(p, "source_id") {
        Some(v) => v,
        None => return err_result("source_id is required"),
    };

    let source = match conn.query_row(
        "SELECT id, title, url, content_hash, raw_content, ingested_at, workspace_id FROM wiki_sources WHERE id = ?1",
        [id],
        |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "title": row.get::<_, String>(1)?,
                "url": row.get::<_, Option<String>>(2)?,
                "content_hash": row.get::<_, String>(3)?,
                "raw_content": row.get::<_, String>(4)?,
                "ingested_at": row.get::<_, String>(5)?,
                "workspace_id": row.get::<_, Option<String>>(6)?,
            }))
        },
    ) {
        Ok(s) => s,
        Err(e) => return err_result(format!("Wiki source not found: {}", e)),
    };

    // Get linked pages
    let mut stmt = match conn.prepare(
        "SELECT n.id, n.title FROM notes n \
         JOIN wiki_source_pages wsp ON n.id = wsp.note_id \
         WHERE wsp.source_id = ?1",
    ) {
        Ok(s) => s,
        Err(e) => return err_result(e.to_string()),
    };
    let linked_pages: Vec<Value> = stmt
        .query_map([id], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "title": row.get::<_, String>(1)?,
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();

    let mut result = source;
    result["linked_pages"] = json!(linked_pages);
    json_result(&result)
}

fn tool_wiki_list_sources(conn: &Connection, p: &Value) -> Value {
    let limit = opt_i64(p, "limit").unwrap_or(50);
    let offset = opt_i64(p, "offset").unwrap_or(0);

    let mut stmt = match conn.prepare(
        "SELECT ws.id, ws.title, ws.url, ws.content_hash, ws.ingested_at, \
         (SELECT COUNT(*) FROM wiki_source_pages wsp WHERE wsp.source_id = ws.id) AS page_count \
         FROM wiki_sources ws \
         ORDER BY ws.ingested_at DESC LIMIT ?1 OFFSET ?2",
    ) {
        Ok(s) => s,
        Err(e) => return err_result(e.to_string()),
    };
    let rows: Vec<Value> = stmt
        .query_map(params![limit, offset], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "title": row.get::<_, String>(1)?,
                "url": row.get::<_, Option<String>>(2)?,
                "content_hash": row.get::<_, String>(3)?,
                "ingested_at": row.get::<_, String>(4)?,
                "page_count": row.get::<_, i64>(5)?,
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();
    json_result(&json!(rows))
}

// ── Semantic search (keyword-based, no embeddings) ───────────────────────────

/// Tokenize text into searchable terms: CJK bigrams + English words.
fn tokenize_for_search(text: &str) -> HashSet<String> {
    let mut tokens = HashSet::new();
    let text_lower = text.to_lowercase();

    // English words (2+ chars)
    let word_re = regex::Regex::new(r"[a-z]{2,}").unwrap();
    for m in word_re.find_iter(&text_lower) {
        tokens.insert(m.as_str().to_string());
    }

    // CJK bigrams (Chinese/Japanese/Korean)
    let cjk_re = regex::Regex::new(r"[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]+").unwrap();
    for m in cjk_re.find_iter(text) {
        let chars: Vec<char> = m.as_str().chars().collect();
        for n in [3, 2] {
            for i in 0..chars.len().saturating_sub(n - 1) {
                let gram: String = chars[i..i + n].iter().collect();
                tokens.insert(gram);
            }
        }
    }

    tokens
}

fn tool_semantic_search(conn: &Connection, p: &Value) -> Value {
    let query = match str_param(p, "query") {
        Some(q) => q,
        None => return err_result("query is required"),
    };
    let limit = opt_i64(p, "limit").unwrap_or(10);
    let min_score = opt_i64(p, "min_score").unwrap_or(0) as f64;

    // Step 1: FTS5 candidate retrieval — get broad set
    let fts_query = query
        .split_whitespace()
        .map(|w| w.replace('"', ""))
        .filter(|w| !w.is_empty())
        .collect::<Vec<_>>()
        .join(" OR ");

    if fts_query.is_empty() {
        return json_result(&json!({ "results": [], "confidence": "NONE" }));
    }

    // Also fetch by LIKE for CJK where FTS tokenization may miss
    let like_pattern = format!("%{}%", query.replace('%', "").replace('_', ""));

    let mut candidates: HashMap<String, (String, String, String, Vec<String>)> = HashMap::new(); // id -> (title, content, updated_at, tags)

    // FTS5 candidates
    if let Ok(mut stmt) = conn.prepare(
        "SELECT n.id, n.title, n.content, n.updated_at \
         FROM notes_fts fts \
         JOIN notes n ON n.rowid = fts.rowid \
         WHERE notes_fts MATCH ?1 AND n.is_trashed = 0 \
         LIMIT 100",
    ) {
        if let Ok(rows) = stmt.query_map([&fts_query], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        }) {
            for r in rows.flatten() {
                candidates.entry(r.0.clone()).or_insert_with(|| {
                    let tags = fetch_note_tags(conn, &r.0);
                    (r.1, r.2, r.3, tags)
                });
            }
        }
    }

    // LIKE fallback for CJK
    if let Ok(mut stmt) = conn.prepare(
        "SELECT id, title, content, updated_at FROM notes \
         WHERE (title LIKE ?1 OR content LIKE ?1) AND is_trashed = 0 \
         LIMIT 50",
    ) {
        if let Ok(rows) = stmt.query_map([&like_pattern], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        }) {
            for r in rows.flatten() {
                candidates.entry(r.0.clone()).or_insert_with(|| {
                    let tags = fetch_note_tags(conn, &r.0);
                    (r.1, r.2, r.3, tags)
                });
            }
        }
    }

    if candidates.is_empty() {
        return json_result(&json!({ "results": [], "confidence": "NONE" }));
    }

    // Step 2: Tokenize query
    let q_tokens = tokenize_for_search(query);
    if q_tokens.is_empty() {
        return json_result(&json!({ "results": [], "confidence": "NONE" }));
    }

    // Step 3: Multi-level scoring
    let mut scored: Vec<(String, f64, f64, String, String, Vec<String>)> = Vec::new(); // (id, score, coverage, title, updated_at, tags)

    for (id, (title, content, updated_at, tags)) in &candidates {
        let title_lower = title.to_lowercase();
        let title_tokens = tokenize_for_search(title);
        let tag_text = tags.join(" ").to_lowercase();
        let tag_tokens = tokenize_for_search(&tag_text);

        // Content tokens: first 2000 chars for efficiency
        let content_preview = if content.len() > 2000 {
            let mut end = 2000;
            while end < content.len() && !content.is_char_boundary(end) {
                end += 1;
            }
            &content[..end]
        } else {
            content.as_str()
        };
        let content_tokens = tokenize_for_search(content_preview);

        // All page tokens combined
        let all_page_tokens: HashSet<String> = title_tokens
            .iter()
            .chain(tag_tokens.iter())
            .chain(content_tokens.iter())
            .cloned()
            .collect();

        let overlap: HashSet<&String> = q_tokens.intersection(&all_page_tokens).collect();
        if overlap.is_empty() {
            continue;
        }

        let mut score: f64 = 0.0;

        for token in &overlap {
            let len_boost = if token.len() >= 3 { token.len() as f64 } else { 1.0 };

            // Title match: highest weight
            if title_tokens.contains(*token) || title_lower.contains(token.as_str()) {
                score += 10.0 * len_boost;
            }

            // Tag match
            if tag_tokens.contains(*token) || tag_text.contains(token.as_str()) {
                score += 6.0 * len_boost;
            }

            // Content match
            if content_tokens.contains(*token) {
                // First 500 chars: higher weight
                let first_500 = if content.len() > 500 {
                    let mut e = 500;
                    while e < content.len() && !content.is_char_boundary(e) { e += 1; }
                    &content[..e]
                } else {
                    content.as_str()
                };
                if first_500.to_lowercase().contains(token.as_str()) {
                    score += 2.0;
                } else {
                    score += 0.5;
                }
            }
        }

        // Coverage: what fraction of query tokens are covered by the page
        let covered = q_tokens.iter().filter(|t| all_page_tokens.contains(*t)).count();
        let coverage = covered as f64 / q_tokens.len() as f64;

        // Coverage penalty
        let core_count = q_tokens.len();
        if core_count <= 4 {
            if coverage == 0.0 {
                score *= 0.1;
            }
        } else if coverage < 0.2 {
            score *= coverage * 2.0;
        } else if coverage < 0.4 {
            score *= 0.7;
        }

        if score > min_score {
            let preview_end = content.len().min(200);
            let mut pe = preview_end;
            while pe < content.len() && !content.is_char_boundary(pe) { pe += 1; }
            scored.push((id.clone(), score, coverage, title.clone(), updated_at.clone(), tags.clone()));
        }
    }

    // Sort by score descending
    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(limit as usize);

    // Confidence classification
    let confidence = if let Some(top) = scored.first() {
        let (top_score, top_coverage) = (top.1, top.2);
        if top_score >= 15.0 && top_coverage >= 0.4 {
            "HIGH"
        } else if top_score >= 5.0 && top_coverage >= 0.2 {
            "MEDIUM"
        } else if top_score >= 1.5 {
            "LOW"
        } else {
            "NONE"
        }
    } else {
        "NONE"
    };

    let results: Vec<Value> = scored
        .iter()
        .map(|(id, score, coverage, title, updated_at, tags)| {
            json!({
                "id": id,
                "title": title,
                "score": (score * 100.0).round() / 100.0,
                "coverage": (coverage * 100.0).round() / 100.0,
                "updated_at": updated_at,
                "tags": tags,
            })
        })
        .collect();

    json_result(&json!({
        "confidence": confidence,
        "count": results.len(),
        "results": results,
    }))
}

fn tool_reindex_embeddings(_conn: &Connection, _p: &Value) -> Value {
    // No-op: this implementation uses keyword-based search, not embeddings.
    // Kept for API compatibility.
    text_result("Reindexing not needed: search uses FTS5 keyword matching (no embeddings).")
}

// ── Settings tools ────────────────────────────────────────────────────────────

fn tool_get_setting(conn: &Connection, p: &Value) -> Value {
    let key = match str_param(p, "key") {
        Some(k) => k,
        None => return err_result("key is required"),
    };
    match conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| {
        row.get::<_, String>(0)
    }) {
        Ok(val) => text_result(val),
        Err(rusqlite::Error::QueryReturnedNoRows) => json_result(&Value::Null),
        Err(e) => err_result(e.to_string()),
    }
}

fn tool_set_setting(conn: &Connection, p: &Value) -> Value {
    let key = match str_param(p, "key") {
        Some(k) => k,
        None => return err_result("key is required"),
    };
    let value = match str_param(p, "value") {
        Some(v) => v,
        None => return err_result("value is required"),
    };
    let now = Utc::now().to_rfc3339();
    let _ = conn.execute(
        "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3",
        params![key, value, now],
    );
    text_result(format!("Setting '{}' updated.", key))
}

fn tool_get_all_settings(conn: &Connection) -> Value {
    let mut stmt = match conn.prepare("SELECT key, value FROM settings") {
        Ok(s) => s,
        Err(e) => return err_result(e.to_string()),
    };
    let map: serde_json::Map<String, Value> = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map(|rows| {
            rows.filter_map(|r| r.ok())
                .map(|(k, v)| (k, Value::String(v)))
                .collect()
        })
        .unwrap_or_default();
    json_result(&Value::Object(map))
}

// ── Resources ─────────────────────────────────────────────────────────────────

fn resource_notes_list(conn: &Connection) -> Value {
    let rows: Vec<Value> = {
        let mut stmt = conn.prepare(
            "SELECT id, title, SUBSTR(content, 1, 200), updated_at, state FROM notes WHERE is_trashed = 0 ORDER BY updated_at DESC LIMIT 200",
        ).unwrap_or_else(|_| conn.prepare("SELECT 1").unwrap());
        stmt.query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "title": row.get::<_, String>(1)?,
                "preview": row.get::<_, String>(2)?,
                "updated_at": row.get::<_, String>(3)?,
                "state": row.get::<_, String>(4).unwrap_or_else(|_| "draft".to_string()),
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
    };
    let text = serde_json::to_string_pretty(&rows).unwrap_or_default();
    json!({
        "contents": [{ "uri": "bruin://notes", "mimeType": "application/json", "text": text }]
    })
}

fn resource_note_by_id(conn: &Connection, note_id: &str) -> Value {
    match fetch_note_json(conn, note_id) {
        Ok(note) => {
            let text = serde_json::to_string_pretty(&note).unwrap_or_default();
            json!({
                "contents": [{ "uri": format!("bruin://notes/{}", note_id), "mimeType": "application/json", "text": text }]
            })
        }
        Err(e) => json!({ "contents": [{ "uri": format!("bruin://notes/{}", note_id), "mimeType": "text/plain", "text": e }] }),
    }
}

fn resource_tags(conn: &Connection) -> Value {
    let mut stmt = match conn.prepare("SELECT name, note_count FROM tags ORDER BY note_count DESC, name") {
        Ok(s) => s,
        Err(_) => return json!({ "contents": [] }),
    };
    let rows: Vec<Value> = stmt
        .query_map([], |row| {
            Ok(json!({ "name": row.get::<_, String>(0)?, "note_count": row.get::<_, i64>(1)? }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();
    let text = serde_json::to_string_pretty(&rows).unwrap_or_default();
    json!({
        "contents": [{ "uri": "bruin://tags", "mimeType": "application/json", "text": text }]
    })
}

fn resource_daily(conn: &Connection) -> Value {
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let existing_id: Option<String> = conn
        .query_row(
            "SELECT n.id FROM notes n \
             JOIN note_tags nt ON n.id = nt.note_id \
             JOIN tags t ON nt.tag_id = t.id \
             WHERE n.title = ?1 AND t.name = 'daily' AND n.is_trashed = 0 LIMIT 1",
            [&today],
            |row| row.get(0),
        )
        .ok();

    let note = if let Some(id) = existing_id {
        fetch_note_json(conn, &id).ok()
    } else {
        // Create it
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let content = format!("# {}\n\n", today);
        let _ = conn.execute(
            "INSERT INTO notes (id, title, content, created_at, updated_at, word_count) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, today, content, now, now, word_count(&content)],
        );
        let _ = sync_tags(conn, &id, &["daily".to_string()]);
        fetch_note_json(conn, &id).ok()
    };

    let text = note
        .map(|n| serde_json::to_string_pretty(&n).unwrap_or_default())
        .unwrap_or_else(|| "Error loading daily note".to_string());
    json!({
        "contents": [{ "uri": "bruin://daily", "mimeType": "application/json", "text": text }]
    })
}

// ── Prompts ───────────────────────────────────────────────────────────────────

fn prompt_daily_log(p: &Value) -> Value {
    let topic = opt_str(p, "topic").unwrap_or_else(|| "Daily log".to_string());
    json!({
        "description": "Get or create today's daily note and append a log entry",
        "messages": [{
            "role": "user",
            "content": {
                "type": "text",
                "text": format!(
                    "Use get_daily_note to get today's note, then append_to_note to add a structured entry about: {}\n\nFormat:\n## {}\n\n[Log content here]",
                    topic, topic
                )
            }
        }]
    })
}

fn prompt_research_capture(p: &Value) -> Value {
    let topic = opt_str(p, "topic").unwrap_or_else(|| "Research topic".to_string());
    let source = opt_str(p, "source").unwrap_or_default();
    json!({
        "description": "Create a structured research note",
        "messages": [{
            "role": "user",
            "content": {
                "type": "text",
                "text": format!(
                    "Create a research note about: {}\n{}\n\nUse create_note with:\n- title: \"{} — {}\"\n- content with sections: ## Summary, ## Key Points, ## References\n- tags: [\"research\"]",
                    topic,
                    if source.is_empty() { String::new() } else { format!("\nSource: {}", source) },
                    topic,
                    Utc::now().format("%Y-%m-%d")
                )
            }
        }]
    })
}

fn prompt_weekly_review() -> Value {
    let now = Utc::now();
    let week_start = now.format("%Y-%m-%d").to_string();
    json!({
        "description": "Query this week's notes and generate a weekly review",
        "messages": [{
            "role": "user",
            "content": {
                "type": "text",
                "text": format!(
                    "Use advanced_query with date_from=\"{}\" to get this week's notes. Then synthesize them into a weekly review note with create_note (title: \"Weekly Review — {}\", tags: [\"weekly-review\"]).",
                    week_start, week_start
                )
            }
        }]
    })
}

fn prompt_link_knowledge(p: &Value) -> Value {
    let note_id = opt_str(p, "note_id").unwrap_or_default();
    json!({
        "description": "Find related notes and create wiki-links",
        "messages": [{
            "role": "user",
            "content": {
                "type": "text",
                "text": format!(
                    "1. read_note(\"{}\") to get the note content\n2. semantic_search or search_notes to find related notes\n3. update_note to add [[wiki-links]] to the most relevant ones",
                    note_id
                )
            }
        }]
    })
}

fn prompt_wiki_ingest(p: &Value) -> Value {
    let title = opt_str(p, "title").unwrap_or_else(|| "Untitled source".to_string());
    let content = opt_str(p, "content").unwrap_or_default();
    let url = opt_str(p, "url").unwrap_or_default();
    json!({
        "description": "Ingest raw content into the wiki — decompose a source into structured wiki pages with cross-links",
        "messages": [{
            "role": "user",
            "content": {
                "type": "text",
                "text": format!(
                    "Ingest the following source into the Bruin wiki.\n\n## Source\nTitle: {title}\n{url_line}\nContent:\n{content}\n\n## Instructions\n\n1. Call wiki_ingest_source with the title, content{url_arg}.\n2. Identify 5-15 discrete concepts/entities. For each, use get_note_by_title (fuzzy=true) to check if a page exists.\n3. Use batch_create_notes for new pages. Each page: clear title, one-line summary, [[wiki-links]], tags (#wiki, #wiki/concept etc.).\n4. For existing pages, use update_note to append new info.\n5. Call wiki_link_source_pages with source_id and all note IDs.\n6. Report: what was created, updated, linked.\n\nQuality: 2+ outgoing [[links]] per page. Short focused pages. Consistent naming. #wiki/stub for minimal pages.",
                    title = title,
                    url_line = if url.is_empty() { String::new() } else { format!("URL: {}\n", url) },
                    content = content,
                    url_arg = if url.is_empty() { "" } else { ", and URL" },
                )
            }
        }]
    })
}

fn prompt_wiki_query(p: &Value) -> Value {
    let question = opt_str(p, "question").unwrap_or_else(|| "What do you want to know?".to_string());
    json!({
        "description": "Query the wiki knowledge base — search for relevant pages and synthesize an answer",
        "messages": [{
            "role": "user",
            "content": {
                "type": "text",
                "text": format!(
                    "Answer this question using the Bruin wiki: \"{question}\"\n\n1. Call wiki_get_index to see all pages.\n2. Call search_notes with key terms.\n3. Use read_note on the top 3-5 relevant pages. Follow [[wiki-links]].\n4. Synthesize: cite pages with [[Title]], note gaps, suggest updates.",
                    question = question,
                )
            }
        }]
    })
}

fn prompt_wiki_lint_and_fix() -> Value {
    json!({
        "description": "Run a health check on the wiki and fix problems",
        "messages": [{
            "role": "user",
            "content": {
                "type": "text",
                "text": "Run wiki_lint. Then:\n1. Fix orphans: read page, semantic_search for related, add [[links]].\n2. Create stubs for missing pages with #wiki/stub tag.\n3. Flag stale pages (30+ days) with #wiki/needs-review.\n4. Report: orphans fixed, stubs created, stale flagged."
            }
        }]
    })
}

// ── Tool list definition ──────────────────────────────────────────────────────

fn tools_list_base() -> Value {
    json!([
        {
            "name": "create_note",
            "description": "Create a new note with optional title, content, and tags. Tags are also auto-extracted from #hashtag patterns in content.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "Note title" },
                    "content": { "type": "string", "description": "Note content (markdown)" },
                    "tags": { "type": "array", "items": { "type": "string" }, "description": "Explicit tags" }
                }
            }
        },
        {
            "name": "read_note",
            "description": "Read full note content by ID.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "note_id": { "type": "string" }
                },
                "required": ["note_id"]
            }
        },
        {
            "name": "update_note",
            "description": "Update a note's title, content, or tags. Pass expected_updated_at from read_note to prevent concurrent overwrites.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "note_id": { "type": "string" },
                    "title": { "type": "string" },
                    "content": { "type": "string" },
                    "tags": { "type": "array", "items": { "type": "string" } },
                    "expected_updated_at": { "type": "string", "description": "ISO 8601 timestamp from read_note for optimistic locking" }
                },
                "required": ["note_id"]
            }
        },
        {
            "name": "delete_note",
            "description": "Move note to trash (default) or permanently delete.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "note_id": { "type": "string" },
                    "permanent": { "type": "boolean", "description": "If true, permanently delete instead of trash" }
                },
                "required": ["note_id"]
            }
        },
        {
            "name": "list_notes",
            "description": "List notes, optionally filtered by tag.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "tag": { "type": "string" },
                    "limit": { "type": "integer", "default": 50 },
                    "offset": { "type": "integer", "default": 0 }
                }
            }
        },
        {
            "name": "search_notes",
            "description": "Full-text search across notes (FTS5).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": { "type": "string" },
                    "limit": { "type": "integer", "default": 20 }
                },
                "required": ["query"]
            }
        },
        {
            "name": "get_note_by_title",
            "description": "Find a note by exact or fuzzy title match.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "title": { "type": "string" },
                    "fuzzy": { "type": "boolean", "default": false }
                },
                "required": ["title"]
            }
        },
        {
            "name": "append_to_note",
            "description": "Append content to a note without reading/replacing. Use for incremental writes.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "note_id": { "type": "string" },
                    "content": { "type": "string" }
                },
                "required": ["note_id", "content"]
            }
        },
        {
            "name": "get_daily_note",
            "description": "Get or create today's daily journal note. Supports per-agent isolation via agent_id.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "date": { "type": "string", "description": "ISO date (YYYY-MM-DD), defaults to today" },
                    "agent_id": { "type": "string", "description": "Agent ID for per-agent daily notes" }
                }
            }
        },
        {
            "name": "set_note_state",
            "description": "Move note through state machine: draft → review → published.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "note_id": { "type": "string" },
                    "state": { "type": "string", "enum": ["draft", "review", "published"] }
                },
                "required": ["note_id", "state"]
            }
        },
        {
            "name": "advanced_query",
            "description": "Multi-filter query with date range, tags, state, word count, and text search.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "date_from": { "type": "string" },
                    "date_to": { "type": "string" },
                    "tags": { "type": "array", "items": { "type": "string" } },
                    "tag_mode": { "type": "string", "enum": ["any", "all"], "default": "any" },
                    "min_words": { "type": "integer" },
                    "max_words": { "type": "integer" },
                    "search": { "type": "string" },
                    "state": { "type": "string", "enum": ["draft", "review", "published"] }
                }
            }
        },
        {
            "name": "pin_note",
            "description": "Pin or unpin a note.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "note_id": { "type": "string" },
                    "pinned": { "type": "boolean", "default": true }
                },
                "required": ["note_id"]
            }
        },
        {
            "name": "restore_note",
            "description": "Restore a note from trash.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "note_id": { "type": "string" }
                },
                "required": ["note_id"]
            }
        },
        {
            "name": "get_backlinks",
            "description": "Find notes that link to this note via [[wiki-links]].",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "note_title": { "type": "string" }
                },
                "required": ["note_title"]
            }
        },
        {
            "name": "get_forward_links",
            "description": "Get all [[wiki-links]] in a note and resolve them.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "note_id": { "type": "string" }
                },
                "required": ["note_id"]
            }
        },
        {
            "name": "list_tags",
            "description": "List all tags with note counts and hierarchy.",
            "inputSchema": { "type": "object", "properties": {} }
        },
        {
            "name": "register_agent",
            "description": "Register a new agent in the registry.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "name": { "type": "string" },
                    "description": { "type": "string" },
                    "capabilities": { "type": "array", "items": { "type": "string" } }
                },
                "required": ["name"]
            }
        },
        {
            "name": "list_agents",
            "description": "List all registered agents.",
            "inputSchema": { "type": "object", "properties": {} }
        },
        {
            "name": "get_agent",
            "description": "Get agent details by ID.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "agent_id": { "type": "string" }
                },
                "required": ["agent_id"]
            }
        },
        {
            "name": "deactivate_agent",
            "description": "Deactivate an agent (soft delete).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "agent_id": { "type": "string" }
                },
                "required": ["agent_id"]
            }
        },
        {
            "name": "get_agent_audit_log",
            "description": "Get all writes made by an agent.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "agent_id": { "type": "string" },
                    "limit": { "type": "integer", "default": 50 }
                },
                "required": ["agent_id"]
            }
        },
        {
            "name": "create_workspace",
            "description": "Create a scoped note collection.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "name": { "type": "string" },
                    "description": { "type": "string" }
                },
                "required": ["name"]
            }
        },
        {
            "name": "list_workspaces",
            "description": "List all workspaces.",
            "inputSchema": { "type": "object", "properties": {} }
        },
        {
            "name": "create_task",
            "description": "Create a trackable task.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "title": { "type": "string" },
                    "description": { "type": "string" },
                    "priority": { "type": "string", "enum": ["low", "medium", "high"], "default": "medium" },
                    "due_date": { "type": "string" },
                    "assigned_agent_id": { "type": "string" },
                    "linked_note_id": { "type": "string" }
                },
                "required": ["title"]
            }
        },
        {
            "name": "list_tasks",
            "description": "List tasks, optionally filtered by status or agent.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "status": { "type": "string" },
                    "assigned_agent_id": { "type": "string" }
                }
            }
        },
        {
            "name": "complete_task",
            "description": "Mark a task as completed.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "task_id": { "type": "string" }
                },
                "required": ["task_id"]
            }
        },
        {
            "name": "get_setting",
            "description": "Read a setting value.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "key": { "type": "string" }
                },
                "required": ["key"]
            }
        },
        {
            "name": "set_setting",
            "description": "Write a setting value.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "key": { "type": "string" },
                    "value": { "type": "string" }
                },
                "required": ["key", "value"]
            }
        },
        {
            "name": "get_all_settings",
            "description": "Dump all settings.",
            "inputSchema": { "type": "object", "properties": {} }
        }
    ])
}

fn tools_list_group_a() -> Value {
    json!([
        {
            "name": "batch_create_notes",
            "description": "Create multiple notes in a single transaction.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "notes": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": { "type": "string" },
                                "content": { "type": "string" },
                                "tags": { "type": "array", "items": { "type": "string" } }
                            }
                        }
                    }
                },
                "required": ["notes"]
            }
        },
        {
            "name": "get_activity_feed",
            "description": "Get recent activity events, optionally filtered by note.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "limit": { "type": "integer", "default": 50 },
                    "note_id": { "type": "string", "description": "Filter to a specific note" }
                }
            }
        },
        {
            "name": "list_templates",
            "description": "List all note templates.",
            "inputSchema": { "type": "object", "properties": {} }
        },
        {
            "name": "create_from_template",
            "description": "Create a note from a template. Supports variable interpolation ({{date}}, {{title}}).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "template_id": { "type": "string" },
                    "template_name": { "type": "string", "description": "Fuzzy match by name (alternative to template_id)" },
                    "title": { "type": "string", "description": "Override the note title" }
                }
            }
        },
        {
            "name": "delete_workspace",
            "description": "Delete a workspace.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "workspace_id": { "type": "string" }
                },
                "required": ["workspace_id"]
            }
        },
        {
            "name": "update_task",
            "description": "Update task fields (title, description, status, priority, due_date, assigned_agent_id, linked_note_id).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "task_id": { "type": "string" },
                    "title": { "type": "string" },
                    "description": { "type": "string" },
                    "status": { "type": "string" },
                    "priority": { "type": "string", "enum": ["low", "medium", "high"] },
                    "due_date": { "type": "string" },
                    "assigned_agent_id": { "type": "string" },
                    "linked_note_id": { "type": "string" }
                },
                "required": ["task_id"]
            }
        },
        {
            "name": "assign_task",
            "description": "Assign a task to an agent.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "task_id": { "type": "string" },
                    "agent_id": { "type": "string" }
                },
                "required": ["task_id", "agent_id"]
            }
        },
        {
            "name": "update_agent",
            "description": "Update agent details (name, description, capabilities).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "agent_id": { "type": "string" },
                    "name": { "type": "string" },
                    "description": { "type": "string" },
                    "capabilities": { "type": "array", "items": { "type": "string" } }
                },
                "required": ["agent_id"]
            }
        },
        {
            "name": "bind_agent_workspace",
            "description": "Bind an agent to a workspace with a role.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "agent_id": { "type": "string" },
                    "workspace_id": { "type": "string" },
                    "role": { "type": "string", "default": "member" }
                },
                "required": ["agent_id", "workspace_id"]
            }
        },
        {
            "name": "get_agent_workspaces",
            "description": "List workspaces an agent belongs to.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "agent_id": { "type": "string" }
                },
                "required": ["agent_id"]
            }
        },
        {
            "name": "unbind_agent_workspace",
            "description": "Remove an agent from a workspace.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "agent_id": { "type": "string" },
                    "workspace_id": { "type": "string" }
                },
                "required": ["agent_id", "workspace_id"]
            }
        },
        {
            "name": "import_markdown",
            "description": "Import .md files from filesystem paths (files or directories) as notes.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "paths": { "type": "array", "items": { "type": "string" }, "description": "File or directory paths to import" }
                },
                "required": ["paths"]
            }
        },
        {
            "name": "export_note_markdown",
            "description": "Export a note as markdown with YAML frontmatter.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "note_id": { "type": "string" }
                },
                "required": ["note_id"]
            }
        },
        {
            "name": "export_note_html",
            "description": "Export a note as a standalone HTML document.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "note_id": { "type": "string" }
                },
                "required": ["note_id"]
            }
        },
        {
            "name": "get_knowledge_graph",
            "description": "Get the knowledge graph (nodes + edges) via BFS from a center note, or all linked notes.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "center_note_id": { "type": "string", "description": "Start BFS from this note. If omitted, returns all linked notes." },
                    "depth": { "type": "integer", "default": 2, "description": "Max BFS depth" },
                    "max_nodes": { "type": "integer", "default": 200 }
                }
            }
        }
    ])
}

fn tools_list_group_bcde() -> Value {
    json!([
        {
            "name": "switch_workspace",
            "description": "Set the active workspace context. Pass null to clear.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "workspace_id": { "type": ["string", "null"] }
                }
            }
        },
        {
            "name": "get_current_workspace",
            "description": "Get the currently active workspace context.",
            "inputSchema": { "type": "object", "properties": {} }
        },
        {
            "name": "set_current_agent",
            "description": "Set the current agent for audit attribution.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "agent_id": { "type": "string" }
                },
                "required": ["agent_id"]
            }
        },
        {
            "name": "register_webhook",
            "description": "Register a new webhook endpoint.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "url": { "type": "string" },
                    "event_types": { "type": "array", "items": { "type": "string" } },
                    "secret": { "type": "string", "description": "HMAC-SHA256 signing secret" }
                },
                "required": ["url", "secret"]
            }
        },
        {
            "name": "list_webhooks",
            "description": "List all registered webhooks.",
            "inputSchema": { "type": "object", "properties": {} }
        },
        {
            "name": "delete_webhook",
            "description": "Delete a webhook.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "webhook_id": { "type": "string" }
                },
                "required": ["webhook_id"]
            }
        },
        {
            "name": "update_webhook",
            "description": "Update webhook URL, event types, or active status.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "webhook_id": { "type": "string" },
                    "url": { "type": "string" },
                    "event_types": { "type": "array", "items": { "type": "string" } },
                    "is_active": { "type": "boolean" }
                },
                "required": ["webhook_id"]
            }
        },
        {
            "name": "test_webhook",
            "description": "Send a test payload to a webhook and log the result.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "webhook_id": { "type": "string" }
                },
                "required": ["webhook_id"]
            }
        },
        {
            "name": "get_webhook_logs",
            "description": "Get delivery logs for a webhook.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "webhook_id": { "type": "string" },
                    "limit": { "type": "integer", "default": 50 }
                },
                "required": ["webhook_id"]
            }
        },
        {
            "name": "list_workflow_templates",
            "description": "List all workflow templates.",
            "inputSchema": { "type": "object", "properties": {} }
        },
        {
            "name": "get_workflow_template",
            "description": "Get a workflow template by ID.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "workflow_id": { "type": "string" }
                },
                "required": ["workflow_id"]
            }
        },
        {
            "name": "create_workflow_template",
            "description": "Create a new workflow template with named steps.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "name": { "type": "string" },
                    "description": { "type": "string" },
                    "category": { "type": "string", "default": "general" },
                    "steps": { "type": "array", "items": { "type": "object" }, "description": "Array of step objects with tool, name, params" }
                },
                "required": ["name", "steps"]
            }
        },
        {
            "name": "delete_workflow_template",
            "description": "Delete a workflow template.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "workflow_id": { "type": "string" }
                },
                "required": ["workflow_id"]
            }
        },
        {
            "name": "execute_workflow",
            "description": "Execute a workflow template. Runs each step sequentially, interpolating {{date}} and {{stepname.field}} variables.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "workflow_id": { "type": "string" }
                },
                "required": ["workflow_id"]
            }
        },
        {
            "name": "wiki_ingest_source",
            "description": "Ingest a source document into the wiki system. Deduplicates by content hash.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "title": { "type": "string" },
                    "content": { "type": "string" },
                    "url": { "type": "string", "description": "Optional source URL" }
                },
                "required": ["title", "content"]
            }
        },
        {
            "name": "wiki_link_source_pages",
            "description": "Link a wiki source to one or more notes.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "source_id": { "type": "string" },
                    "note_ids": { "type": "array", "items": { "type": "string" } }
                },
                "required": ["source_id", "note_ids"]
            }
        },
        {
            "name": "wiki_get_index",
            "description": "Get an index of wiki-tagged notes with link counts.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "tag": { "type": "string", "default": "wiki", "description": "Tag prefix to filter (default: wiki)" }
                }
            }
        },
        {
            "name": "wiki_lint",
            "description": "Lint the wiki: find orphan pages, missing pages, stale pages, and stats.",
            "inputSchema": { "type": "object", "properties": {} }
        },
        {
            "name": "wiki_get_source",
            "description": "Get a wiki source by ID with its linked pages.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "source_id": { "type": "string" }
                },
                "required": ["source_id"]
            }
        },
        {
            "name": "wiki_list_sources",
            "description": "List wiki sources with page counts.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "limit": { "type": "integer", "default": 50 },
                    "offset": { "type": "integer", "default": 0 }
                }
            }
        },
        {
            "name": "semantic_search",
            "description": "Smart search: FTS5 candidate retrieval + multi-level scoring (title > tags > content). Returns results with confidence level (HIGH/MEDIUM/LOW/NONE) and coverage score. Better than search_notes for finding relevant pages by meaning.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Search query (natural language or keywords)" },
                    "limit": { "type": "integer", "default": 10, "description": "Max results" },
                    "min_score": { "type": "number", "default": 0, "description": "Min score threshold" }
                },
                "required": ["query"]
            }
        },
        {
            "name": "reindex_embeddings",
            "description": "No-op (search uses keyword matching, not embeddings). Kept for API compatibility.",
            "inputSchema": { "type": "object", "properties": {} }
        }
    ])
}

fn tools_list() -> Value {
    let mut base = tools_list_base();
    if let Some(base_arr) = base.as_array_mut() {
        if let Some(a_arr) = tools_list_group_a().as_array().cloned() {
            base_arr.extend(a_arr);
        }
        if let Some(bcde_arr) = tools_list_group_bcde().as_array().cloned() {
            base_arr.extend(bcde_arr);
        }
    }
    base
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

pub(crate) fn dispatch(
    conn: &Connection,
    method: &str,
    params: &Value,
    agent_id: Option<&str>,
) -> Result<Value, String> {
    match method {
        "initialize" => Ok(json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {},
                "resources": { "subscribe": false },
                "prompts": {}
            },
            "serverInfo": {
                "name": "bruin-notes",
                "version": env!("CARGO_PKG_VERSION")
            }
        })),

        "tools/list" => Ok(json!({ "tools": tools_list() })),

        "tools/call" => {
            let tool_name = params
                .get("name")
                .and_then(|v| v.as_str())
                .ok_or("Missing tool name")?;
            let args = params.get("arguments").cloned().unwrap_or(json!({}));

            let result = match tool_name {
                "create_note" => tool_create_note(conn, &args, agent_id),
                "read_note" => tool_read_note(conn, &args),
                "update_note" => tool_update_note(conn, &args, agent_id),
                "delete_note" => tool_delete_note(conn, &args, agent_id),
                "list_notes" => tool_list_notes(conn, &args),
                "search_notes" => tool_search_notes(conn, &args),
                "get_note_by_title" => tool_get_note_by_title(conn, &args),
                "append_to_note" => tool_append_to_note(conn, &args, agent_id),
                "get_daily_note" => tool_get_daily_note(conn, &args, agent_id),
                "set_note_state" => tool_set_note_state(conn, &args, agent_id),
                "advanced_query" => tool_advanced_query(conn, &args),
                "pin_note" => tool_pin_note(conn, &args),
                "restore_note" => tool_restore_note(conn, &args),
                "get_backlinks" => tool_get_backlinks(conn, &args),
                "get_forward_links" => tool_get_forward_links(conn, &args),
                "list_tags" => tool_list_tags(conn),
                "register_agent" => tool_register_agent(conn, &args),
                "list_agents" => tool_list_agents(conn),
                "get_agent" => tool_get_agent(conn, &args),
                "deactivate_agent" => tool_deactivate_agent(conn, &args),
                "get_agent_audit_log" => tool_get_agent_audit_log(conn, &args),
                "create_workspace" => tool_create_workspace(conn, &args, agent_id),
                "list_workspaces" => tool_list_workspaces(conn),
                "create_task" => tool_create_task(conn, &args, agent_id),
                "list_tasks" => tool_list_tasks(conn, &args),
                "complete_task" => tool_complete_task(conn, &args),
                "get_setting" => tool_get_setting(conn, &args),
                "set_setting" => tool_set_setting(conn, &args),
                "get_all_settings" => tool_get_all_settings(conn),
                // Group A: Simple CRUD
                "batch_create_notes" => tool_batch_create_notes(conn, &args, agent_id),
                "get_activity_feed" => tool_get_activity_feed(conn, &args),
                "list_templates" => tool_list_templates(conn),
                "create_from_template" => tool_create_from_template(conn, &args, agent_id),
                "delete_workspace" => tool_delete_workspace(conn, &args, agent_id),
                "update_task" => tool_update_task(conn, &args, agent_id),
                "assign_task" => tool_assign_task(conn, &args),
                "update_agent" => tool_update_agent(conn, &args),
                "bind_agent_workspace" => tool_bind_agent_workspace(conn, &args),
                "get_agent_workspaces" => tool_get_agent_workspaces(conn, &args),
                "unbind_agent_workspace" => tool_unbind_agent_workspace(conn, &args),
                "import_markdown" => tool_import_markdown(conn, &args, agent_id),
                "export_note_markdown" => tool_export_note_markdown(conn, &args),
                "export_note_html" => tool_export_note_html(conn, &args),
                "get_knowledge_graph" => tool_get_knowledge_graph(conn, &args),
                // Group B: Context/State
                "switch_workspace" => tool_switch_workspace(conn, &args),
                "get_current_workspace" => tool_get_current_workspace(conn),
                "set_current_agent" => tool_set_current_agent(conn, &args),
                // Group C: Webhooks
                "register_webhook" => tool_register_webhook(conn, &args),
                "list_webhooks" => tool_list_webhooks(conn),
                "delete_webhook" => tool_delete_webhook(conn, &args),
                "update_webhook" => tool_update_webhook(conn, &args),
                "test_webhook" => tool_test_webhook(conn, &args),
                "get_webhook_logs" => tool_get_webhook_logs(conn, &args),
                // Group D: Workflows
                "list_workflow_templates" => tool_list_workflow_templates(conn),
                "get_workflow_template" => tool_get_workflow_template(conn, &args),
                "create_workflow_template" => tool_create_workflow_template(conn, &args),
                "delete_workflow_template" => tool_delete_workflow_template(conn, &args),
                "execute_workflow" => tool_execute_workflow(conn, &args, agent_id),
                // Group E: Wiki
                "wiki_ingest_source" => tool_wiki_ingest_source(conn, &args),
                "wiki_link_source_pages" => tool_wiki_link_source_pages(conn, &args),
                "wiki_get_index" => tool_wiki_get_index(conn, &args),
                "wiki_lint" => tool_wiki_lint(conn),
                "wiki_get_source" => tool_wiki_get_source(conn, &args),
                "wiki_list_sources" => tool_wiki_list_sources(conn, &args),
                "semantic_search" => tool_semantic_search(conn, &args),
                "reindex_embeddings" => tool_reindex_embeddings(conn, &args),
                other => err_result(format!("Unknown tool: {}", other)),
            };
            Ok(result)
        }

        "resources/list" => Ok(json!({
            "resources": [
                { "uri": "bruin://notes", "name": "All notes", "mimeType": "application/json" },
                { "uri": "bruin://tags", "name": "All tags", "mimeType": "application/json" },
                { "uri": "bruin://daily", "name": "Today's daily note", "mimeType": "application/json" }
            ]
        })),

        "resources/read" => {
            let uri = params
                .get("uri")
                .and_then(|v| v.as_str())
                .ok_or("Missing uri")?;
            if uri == "bruin://notes" {
                Ok(resource_notes_list(conn))
            } else if uri == "bruin://tags" {
                Ok(resource_tags(conn))
            } else if uri == "bruin://daily" {
                Ok(resource_daily(conn))
            } else if let Some(id) = uri.strip_prefix("bruin://notes/") {
                Ok(resource_note_by_id(conn, id))
            } else {
                Err(format!("Unknown resource: {}", uri))
            }
        }

        "prompts/list" => Ok(json!({
            "prompts": [
                {
                    "name": "daily_log",
                    "description": "Get/create today's note and append a structured log entry",
                    "arguments": [{ "name": "topic", "description": "Topic for the log entry", "required": false }]
                },
                {
                    "name": "research_capture",
                    "description": "Create a structured research note from any source",
                    "arguments": [
                        { "name": "topic", "description": "Research topic", "required": true },
                        { "name": "source", "description": "Source URL or reference", "required": false }
                    ]
                },
                {
                    "name": "weekly_review",
                    "description": "Query this week's notes and generate a review",
                    "arguments": []
                },
                {
                    "name": "link_knowledge",
                    "description": "Find and create [[wiki-links]] between related notes",
                    "arguments": [{ "name": "note_id", "description": "Note to link from", "required": true }]
                },
                {
                    "name": "wiki_ingest",
                    "description": "Ingest raw content into the wiki — decompose into structured pages with cross-links",
                    "arguments": [
                        { "name": "title", "description": "Title of the source material", "required": true },
                        { "name": "content", "description": "Raw content to decompose", "required": true },
                        { "name": "url", "description": "Source URL if applicable", "required": false }
                    ]
                },
                {
                    "name": "wiki_query",
                    "description": "Query the wiki knowledge base — search and synthesize an answer",
                    "arguments": [{ "name": "question", "description": "Question to answer from the wiki", "required": true }]
                },
                {
                    "name": "wiki_lint_and_fix",
                    "description": "Run a health check on the wiki and fix problems",
                    "arguments": []
                }
            ]
        })),

        "prompts/get" => {
            let name = params
                .get("name")
                .and_then(|v| v.as_str())
                .ok_or("Missing prompt name")?;
            let args = params.get("arguments").cloned().unwrap_or(json!({}));
            let result = match name {
                "daily_log" => prompt_daily_log(&args),
                "research_capture" => prompt_research_capture(&args),
                "weekly_review" => prompt_weekly_review(),
                "link_knowledge" => prompt_link_knowledge(&args),
                "wiki_ingest" => prompt_wiki_ingest(&args),
                "wiki_query" => prompt_wiki_query(&args),
                "wiki_lint_and_fix" => prompt_wiki_lint_and_fix(),
                other => return Err(format!("Unknown prompt: {}", other)),
            };
            Ok(result)
        }

        "ping" => Ok(json!({})),

        // Notifications have no id, handled before dispatch, but be safe
        _ if method.starts_with("notifications/") => Ok(json!({})),

        other => Err(format!("Method not found: {}", other)),
    }
}

// ── Public entrypoints ────────────────────────────────────────────────────────

pub fn run() {
    // Log to stderr so it doesn't corrupt JSON-RPC stdout
    let _ = env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("warn"))
        .target(env_logger::Target::Stderr)
        .try_init();

    let db_path = find_db();
    let conn = match Connection::open(&db_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[bruin-mcp] Failed to open database at {:?}: {}", db_path, e);
            std::process::exit(1);
        }
    };
    let _ = conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");

    let agent_id = setup_agent(&conn);

    let stdin = std::io::stdin();
    let stdout = std::io::stdout();
    let mut out = stdout.lock();

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) if !l.trim().is_empty() => l,
            Ok(_) => continue,
            Err(_) => break,
        };

        let request: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => {
                let err_msg = json!({
                    "jsonrpc": "2.0",
                    "id": null,
                    "error": { "code": -32700, "message": format!("Parse error: {}", e) }
                });
                let _ = writeln!(out, "{}", err_msg);
                let _ = out.flush();
                continue;
            }
        };

        // Notifications (no id) — no response needed
        let has_id = request.get("id").map(|v| !v.is_null()).unwrap_or(false);
        if !has_id {
            continue;
        }

        let id = request["id"].clone();
        let method = request["method"].as_str().unwrap_or("");
        let params = request.get("params").cloned().unwrap_or(json!({}));

        let response = match dispatch(&conn, method, &params, agent_id.as_deref()) {
            Ok(result) => json!({ "jsonrpc": "2.0", "id": id, "result": result }),
            Err(err) => json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": { "code": -32603, "message": err }
            }),
        };

        let line = serde_json::to_string(&response).unwrap_or_default();
        let _ = writeln!(out, "{}", line);
        let _ = out.flush();
    }
}

pub fn install_skill() {
    let home = std::env::var("HOME").unwrap_or_default();
    let skills_dir = PathBuf::from(&home).join(".claude").join("skills");

    if let Err(e) = std::fs::create_dir_all(&skills_dir) {
        eprintln!("Failed to create skills directory: {}", e);
        std::process::exit(1);
    }

    let skill_path = skills_dir.join("bruin.md");
    let skill_content = include_str!("../../skills/bruin.md");

    match std::fs::write(&skill_path, skill_content) {
        Ok(_) => println!("✓ Skill installed: {}", skill_path.display()),
        Err(e) => {
            eprintln!("Failed to write skill file: {}", e);
            std::process::exit(1);
        }
    }
}

pub fn write_mcp_config() {
    let exe_path = std::env::current_exe()
        .unwrap_or_else(|_| PathBuf::from("/Applications/Bruin.app/Contents/MacOS/bruin"));
    let exe_str = exe_path.to_string_lossy();

    let config_snippet = serde_json::to_string_pretty(&json!({
        "mcpServers": {
            "bruin-notes": {
                "command": exe_str,
                "args": ["--mcp-proxy"],
                "env": {
                    "BRUIN_AGENT_NAME": "claude-code"
                }
            }
        }
    }))
    .unwrap_or_default();

    println!("Add this to ~/.claude.json:\n\n{}", config_snippet);

    // Try to auto-merge into ~/.claude.json
    let home = std::env::var("HOME").unwrap_or_default();
    let config_path = PathBuf::from(&home).join(".claude.json");

    let mut existing: Value = if config_path.exists() {
        std::fs::read_to_string(&config_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or(json!({}))
    } else {
        json!({})
    };

    if existing.get("mcpServers").is_none() {
        existing["mcpServers"] = json!({});
    }
    existing["mcpServers"]["bruin-notes"] = json!({
        "command": exe_str,
        "args": ["--mcp-proxy"],
        "env": { "BRUIN_AGENT_NAME": "claude-code" }
    });

    match std::fs::write(&config_path, serde_json::to_string_pretty(&existing).unwrap_or_default()) {
        Ok(_) => println!("\n✓ Auto-merged into {}", config_path.display()),
        Err(e) => eprintln!("\n✗ Could not auto-merge ({}). Please add manually.", e),
    }
}

// ── Socket path helper ────────────────────────────────────────────────────────

pub(crate) fn get_default_socket_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_default();
    PathBuf::from(home)
        .join("Library")
        .join("Application Support")
        .join("com.bruin.notes")
        .join("mcp.sock")
}

// ── MCP proxy: bridges Claude Code stdio ↔ the running app's Unix socket ─────

pub fn run_mcp_proxy() {
    use std::io::BufRead;
    use std::os::unix::net::UnixStream;

    let socket_path = get_default_socket_path();
    let stream = match UnixStream::connect(&socket_path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!(
                "[bruin-mcp-proxy] Bruin.app is not running or MCP socket not found.\n\
                 Start Bruin.app first, then retry.\n\
                 Socket: {}\n\
                 Error: {}",
                socket_path.display(),
                e
            );
            std::process::exit(1);
        }
    };

    // stdin → socket
    let stream_write = stream.try_clone().expect("clone unix stream");
    let t_write = std::thread::spawn(move || {
        let stdin = std::io::stdin();
        let mut writer = stream_write;
        for line in stdin.lock().lines() {
            match line {
                Ok(l) => {
                    use std::io::Write;
                    if writeln!(writer, "{}", l).is_err() {
                        break;
                    }
                    let _ = writer.flush();
                }
                Err(_) => break,
            }
        }
    });

    // socket → stdout
    let t_read = std::thread::spawn(move || {
        use std::io::{BufReader, Write};
        let stdout = std::io::stdout();
        let mut out = stdout.lock();
        for line in BufReader::new(stream).lines() {
            match line {
                Ok(l) => {
                    if writeln!(out, "{}", l).is_err() {
                        break;
                    }
                    let _ = out.flush();
                }
                Err(_) => break,
            }
        }
    });

    let _ = t_write.join();
    let _ = t_read.join();
}
