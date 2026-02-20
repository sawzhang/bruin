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
pub fn search_notes(
    db: State<'_, Mutex<Connection>>,
    params: SearchNotesParams,
) -> Result<Vec<NoteListItem>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let limit = params.limit.unwrap_or(20);

    let mut stmt = conn
        .prepare(
            "SELECT n.id, n.title, snippet(notes_fts, 1, '<mark>', '</mark>', '...', 32) as preview, \
             n.updated_at, n.is_pinned, n.is_trashed, n.word_count \
             FROM notes_fts fts \
             JOIN notes n ON n.rowid = fts.rowid \
             WHERE notes_fts MATCH ?1 AND n.is_trashed = 0 \
             ORDER BY rank \
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![params.query, limit], |row| {
            Ok(NoteListItem {
                id: row.get(0)?,
                title: row.get(1)?,
                preview: row.get(2)?,
                updated_at: row.get(3)?,
                is_pinned: row.get::<_, i32>(4)? != 0,
                is_trashed: row.get::<_, i32>(5)? != 0,
                word_count: row.get(6)?,
                tags: vec![],
                state: "draft".to_string(),
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
