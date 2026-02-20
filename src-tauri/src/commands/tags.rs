use crate::db::models::*;
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;

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
            "SELECT n.id, n.title, n.content, n.updated_at, n.is_pinned, n.is_trashed, n.word_count \
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

    let mut items: Vec<NoteListItem> = Vec::new();
    for row in rows {
        let mut item = row.map_err(|e| e.to_string())?;
        item.tags = fetch_note_tags(&conn, &item.id)?;
        items.push(item);
    }

    Ok(items)
}
