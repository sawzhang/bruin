use crate::commands::notes::{batch_fetch_tags, fetch_note_tags, log_activity};
use crate::db::models::*;
use crate::markdown::frontmatter::serialize_frontmatter;
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;

/// Re-write iCloud markdown files for notes affected by a tag change.
fn resync_notes_icloud(conn: &Connection, note_ids: &[String]) {
    for nid in note_ids {
        let note = match conn.query_row(
            "SELECT id, title, content, created_at, updated_at, is_trashed, is_pinned, word_count, file_path, sync_hash, state, workspace_id, version \
             FROM notes WHERE id = ?1",
            [nid],
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
                    version: row.get::<_, i32>(12).unwrap_or(1),
                })
            },
        ) {
            Ok(mut n) => {
                n.tags = fetch_note_tags(conn, nid).unwrap_or_default();
                n
            }
            Err(_) => continue,
        };

        if let Some(ref path) = note.file_path {
            let md = serialize_frontmatter(&note);
            let _ = std::fs::write(path, md);
        }
    }
}

#[tauri::command]
pub fn list_tags(db: State<'_, Mutex<Connection>>) -> Result<Vec<Tag>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, parent_name, note_count, is_pinned FROM tags ORDER BY is_pinned DESC, name")
        .map_err(|e| e.to_string())?;

    let tags = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                parent_name: row.get(2)?,
                note_count: row.get(3)?,
                is_pinned: row.get::<_, i32>(4)? != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(tags)
}

#[tauri::command]
pub fn pin_tag(
    db: State<'_, Mutex<Connection>>,
    name: String,
    pinned: bool,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE tags SET is_pinned = ?1 WHERE name = ?2",
        rusqlite::params![pinned as i32, name],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn rename_tag(
    db: State<'_, Mutex<Connection>>,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    // Check if new name already exists
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM tags WHERE name = ?1",
            [&new_name],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|e| e.to_string())?
        > 0;
    if exists {
        return Err(format!("Tag '{}' already exists", new_name));
    }

    // Compute new parent
    let new_parent = new_name.rfind('/').map(|pos| new_name[..pos].to_string());

    // Rename the tag
    conn.execute(
        "UPDATE tags SET name = ?1, parent_name = ?2 WHERE name = ?3",
        rusqlite::params![new_name, new_parent, old_name],
    )
    .map_err(|e| e.to_string())?;

    // Also rename child tags that had this as parent prefix
    let old_prefix = format!("{}/", old_name);
    let new_prefix = format!("{}/", new_name);
    let mut stmt = conn
        .prepare("SELECT id, name FROM tags WHERE name LIKE ?1")
        .map_err(|e| e.to_string())?;
    let children: Vec<(i64, String)> = stmt
        .query_map([format!("{}%", old_prefix)], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    for (child_id, child_name) in children {
        let updated_name = format!("{}{}", new_prefix, &child_name[old_prefix.len()..]);
        let updated_parent = updated_name.rfind('/').map(|pos| updated_name[..pos].to_string());
        conn.execute(
            "UPDATE tags SET name = ?1, parent_name = ?2 WHERE id = ?3",
            rusqlite::params![updated_name, updated_parent, child_id],
        )
        .map_err(|e| e.to_string())?;
    }

    // Collect affected note IDs and re-sync iCloud files
    let tag_id: i64 = conn
        .query_row("SELECT id FROM tags WHERE name = ?1", [&new_name], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    let mut note_stmt = conn
        .prepare("SELECT note_id FROM note_tags WHERE tag_id = ?1")
        .map_err(|e| e.to_string())?;
    let note_ids: Vec<String> = note_stmt
        .query_map([tag_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    resync_notes_icloud(&conn, &note_ids);
    log_activity(&conn, "user", "tag_renamed", None, &format!("Renamed tag '{}' to '{}'", old_name, new_name), "{}");
    Ok(())
}

#[tauri::command]
pub fn delete_tag(
    db: State<'_, Mutex<Connection>>,
    name: String,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    // Get tag id
    let tag_id: i64 = conn
        .query_row("SELECT id FROM tags WHERE name = ?1", [&name], |row| row.get(0))
        .map_err(|_| format!("Tag '{}' not found", name))?;

    // Get affected note IDs before removing associations
    let mut note_stmt = conn
        .prepare("SELECT note_id FROM note_tags WHERE tag_id = ?1")
        .map_err(|e| e.to_string())?;
    let note_ids: Vec<String> = note_stmt
        .query_map([tag_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // Remove all note_tags associations
    conn.execute("DELETE FROM note_tags WHERE tag_id = ?1", [tag_id])
        .map_err(|e| e.to_string())?;

    // Delete the tag itself
    conn.execute("DELETE FROM tags WHERE id = ?1", [tag_id])
        .map_err(|e| e.to_string())?;

    // Also delete child tags
    let prefix = format!("{}/%", name);
    conn.execute(
        "DELETE FROM note_tags WHERE tag_id IN (SELECT id FROM tags WHERE name LIKE ?1)",
        [&prefix],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tags WHERE name LIKE ?1", [&prefix])
        .map_err(|e| e.to_string())?;

    // Re-sync affected notes' iCloud files
    resync_notes_icloud(&conn, &note_ids);
    log_activity(&conn, "user", "tag_deleted", None, &format!("Deleted tag '{}'", name), "{}");
    Ok(())
}

#[tauri::command]
pub fn get_notes_by_tag(
    db: State<'_, Mutex<Connection>>,
    tag: String,
) -> Result<Vec<NoteListItem>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT n.id, n.title, n.content, n.updated_at, n.is_pinned, n.is_trashed, n.word_count, n.state, n.workspace_id \
             FROM notes n \
             JOIN note_tags nt ON n.id = nt.note_id \
             JOIN tags t ON nt.tag_id = t.id \
             WHERE t.name = ?1 AND n.is_trashed = 0 \
             ORDER BY n.is_pinned DESC, n.updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([&tag], |row| {
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

    let mut items: Vec<NoteListItem> = Vec::new();
    for row in rows {
        let item = row.map_err(|e| e.to_string())?;
        items.push(item);
    }

    // Batch-fetch tags (fixes N+1)
    let note_ids: Vec<String> = items.iter().map(|n| n.id.clone()).collect();
    let tags_map = batch_fetch_tags(&conn, &note_ids)?;
    for item in &mut items {
        if let Some(tags) = tags_map.get(&item.id) {
            item.tags = tags.clone();
        }
    }

    Ok(items)
}
