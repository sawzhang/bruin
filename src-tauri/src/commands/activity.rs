use crate::db::models::ActivityEvent;
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn get_activity_feed(
    db: State<'_, Mutex<Connection>>,
    limit: Option<i64>,
    note_id: Option<String>,
) -> Result<Vec<ActivityEvent>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50);

    if let Some(ref nid) = note_id {
        let mut stmt = conn
            .prepare(
                "SELECT id, actor, event_type, note_id, timestamp, summary, data \
                 FROM activity_events WHERE note_id = ?1 \
                 ORDER BY timestamp DESC LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(rusqlite::params![nid, limit], |row| {
                Ok(ActivityEvent {
                    id: row.get(0)?,
                    actor: row.get(1)?,
                    event_type: row.get(2)?,
                    note_id: row.get(3)?,
                    timestamp: row.get(4)?,
                    summary: row.get(5)?,
                    data: row.get(6)?,
                })
            })
            .map_err(|e| e.to_string())?;

        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    } else {
        let mut stmt = conn
            .prepare(
                "SELECT id, actor, event_type, note_id, timestamp, summary, data \
                 FROM activity_events \
                 ORDER BY timestamp DESC LIMIT ?1",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(rusqlite::params![limit], |row| {
                Ok(ActivityEvent {
                    id: row.get(0)?,
                    actor: row.get(1)?,
                    event_type: row.get(2)?,
                    note_id: row.get(3)?,
                    timestamp: row.get(4)?,
                    summary: row.get(5)?,
                    data: row.get(6)?,
                })
            })
            .map_err(|e| e.to_string())?;

        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }
}
