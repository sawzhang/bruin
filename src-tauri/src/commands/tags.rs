use crate::commands::notes::batch_fetch_tags;
use crate::db::models::*;
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn list_tags(db: State<'_, Mutex<Connection>>) -> Result<Vec<Tag>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, parent_name, note_count FROM tags ORDER BY name")
        .map_err(|e| e.to_string())?;

    let tags = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                parent_name: row.get(2)?,
                note_count: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(tags)
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
