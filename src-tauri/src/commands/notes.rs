use crate::db::models::*;
use crate::markdown::tags::extract_tags;
use crate::markdown::tags::get_parent_tag;
use chrono::Utc;
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

fn compute_word_count(content: &str) -> i64 {
    content.split_whitespace().count() as i64
}

fn sync_tags(conn: &Connection, note_id: &str, tags: &[String]) -> Result<(), String> {
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

fn fetch_note_tags(conn: &Connection, note_id: &str) -> Result<Vec<String>, String> {
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

fn fetch_note(conn: &Connection, id: &str) -> Result<Note, String> {
    let note = conn
        .query_row(
            "SELECT id, title, content, created_at, updated_at, is_trashed, is_pinned, word_count, file_path, sync_hash FROM notes WHERE id = ?1",
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
                })
            },
        )
        .map_err(|e| format!("Note not found: {}", e))?;

    let tags = fetch_note_tags(conn, &note.id)?;
    Ok(Note { tags, ..note })
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
    fetch_note(&conn, &id)
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
    fetch_note(&conn, &params.id)
}

#[tauri::command]
pub fn delete_note(
    db: State<'_, Mutex<Connection>>,
    id: String,
    permanent: bool,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    if permanent {
        conn.execute("DELETE FROM note_tags WHERE note_id = ?1", [&id])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM notes WHERE id = ?1", [&id])
            .map_err(|e| e.to_string())?;
        conn.execute_batch(
            "UPDATE tags SET note_count = (SELECT COUNT(*) FROM note_tags WHERE note_tags.tag_id = tags.id)",
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "UPDATE notes SET is_trashed = 1, updated_at = ?1 WHERE id = ?2",
            rusqlite::params![Utc::now().to_rfc3339(), id],
        )
        .map_err(|e| e.to_string())?;
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
                "SELECT n.id, n.title, n.content, n.updated_at, n.is_pinned, n.is_trashed, n.word_count \
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
                "SELECT id, title, content, updated_at, is_pinned, is_trashed, word_count \
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
    Ok(())
}
