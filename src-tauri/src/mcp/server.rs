use chrono::Utc;
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, Write};
use std::path::PathBuf;
use uuid::Uuid;

// ── DB path discovery ────────────────────────────────────────────────────────

fn find_db() -> PathBuf {
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

fn setup_agent(conn: &Connection) -> Option<String> {
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

// ── Tool list definition ──────────────────────────────────────────────────────

fn tools_list() -> Value {
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

// ── Dispatch ──────────────────────────────────────────────────────────────────

fn dispatch(
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
                "args": ["--mcp"],
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
        "args": ["--mcp"],
        "env": { "BRUIN_AGENT_NAME": "claude-code" }
    });

    match std::fs::write(&config_path, serde_json::to_string_pretty(&existing).unwrap_or_default()) {
        Ok(_) => println!("\n✓ Auto-merged into {}", config_path.display()),
        Err(e) => eprintln!("\n✗ Could not auto-merge ({}). Please add manually.", e),
    }
}
