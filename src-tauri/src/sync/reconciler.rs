use crate::db::models::Note;
use crate::sync::icloud;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SyncAction {
    Import,
    Export,
    Skip,
    Conflict,
}

/// Result of a full reconciliation run.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReconcileResult {
    pub files_synced: u32,
    pub imported_note_ids: Vec<String>,
    pub failures: Vec<FailedSyncOp>,
}

/// A sync operation that failed and can be retried.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailedSyncOp {
    pub note_id: String,
    pub operation: String,
    pub error: String,
    pub retry_count: u32,
}

/// Compare notes by sync_hash. Return the appropriate SyncAction.
pub fn reconcile(db_note: Option<&Note>, file_note: &Note) -> SyncAction {
    match db_note {
        None => SyncAction::Import,
        Some(db) => {
            match (&db.sync_hash, &file_note.sync_hash) {
                (Some(db_hash), Some(file_hash)) if db_hash == file_hash => SyncAction::Skip,
                (None, _) => SyncAction::Export,
                (_, None) => SyncAction::Import,
                _ => {
                    // Both have different hashes - conflict, last-write-wins
                    if db.updated_at >= file_note.updated_at {
                        SyncAction::Export
                    } else {
                        SyncAction::Import
                    }
                }
            }
        }
    }
}

/// Insert or update a note from file into the database using merge strategy.
/// On conflict, preserves DB-only fields: state, workspace_id, is_trashed, created_at.
pub(crate) fn import_note_to_db(conn: &Connection, note: &Note) -> Result<(), String> {
    let hash = icloud::compute_sync_hash(&note.title, &note.content);

    conn.execute(
        "INSERT INTO notes (id, title, content, created_at, updated_at, is_trashed, is_pinned, word_count, sync_hash)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           content = excluded.content,
           updated_at = excluded.updated_at,
           is_pinned = excluded.is_pinned,
           word_count = excluded.word_count,
           sync_hash = excluded.sync_hash",
        rusqlite::params![
            note.id,
            note.title,
            note.content,
            note.created_at,
            note.updated_at,
            note.is_trashed as i32,
            note.is_pinned as i32,
            note.word_count,
            hash
        ],
    )
    .map_err(|e| e.to_string())?;

    crate::commands::notes::sync_tags(conn, &note.id, &note.tags)?;
    crate::commands::notes::sync_note_links(conn, &note.id, &note.content)?;

    Ok(())
}

/// Fetch a note from DB by id, returning None if not found.
pub(crate) fn fetch_note_by_id(conn: &Connection, id: &str) -> Option<Note> {
    crate::commands::notes::fetch_note(conn, id).ok()
}

/// Fetch all non-trashed notes from the database.
fn fetch_all_notes(conn: &Connection) -> Result<Vec<Note>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, content, created_at, updated_at, is_trashed, is_pinned, word_count, file_path, sync_hash, state, workspace_id FROM notes WHERE is_trashed = 0",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
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
        })
        .map_err(|e| e.to_string())?;

    let mut notes = Vec::new();
    for row in rows {
        let mut note = row.map_err(|e| e.to_string())?;
        note.tags = crate::commands::notes::fetch_note_tags(conn, &note.id)?;
        notes.push(note);
    }

    Ok(notes)
}

/// Update sync_hash for a note in the database.
fn update_sync_hash(conn: &Connection, id: &str, hash: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE notes SET sync_hash = ?1 WHERE id = ?2",
        rusqlite::params![hash, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Run full reconciliation between DB and iCloud files.
/// Accepts optional progress callback and retry queue from previous failures.
pub fn full_reconcile(
    conn: &Connection,
    progress: Option<&dyn Fn(u32, u32, &str)>,
    retry_queue: Option<Vec<FailedSyncOp>>,
) -> Result<ReconcileResult, String> {
    let mut files_synced: u32 = 0;
    let mut imported_note_ids: Vec<String> = Vec::new();
    let mut failures: Vec<FailedSyncOp> = Vec::new();

    // Retry previously failed operations first
    if let Some(retries) = retry_queue {
        for mut op in retries {
            if op.retry_count >= 3 {
                failures.push(op);
                continue;
            }
            op.retry_count += 1;
            match op.operation.as_str() {
                "import" => {
                    let icloud_dir = icloud::get_icloud_dir()?;
                    let file_path = icloud_dir.join(format!("{}.md", op.note_id));
                    if file_path.exists() {
                        match icloud::import_file(&file_path) {
                            Ok(mut file_note) => {
                                file_note.sync_hash = Some(icloud::compute_sync_hash(&file_note.title, &file_note.content));
                                if let Err(e) = import_note_to_db(conn, &file_note) {
                                    op.error = e;
                                    failures.push(op);
                                } else {
                                    imported_note_ids.push(file_note.id);
                                    files_synced += 1;
                                }
                            }
                            Err(e) => {
                                op.error = e;
                                failures.push(op);
                            }
                        }
                    }
                }
                "export" => {
                    if let Some(db_note) = fetch_note_by_id(conn, &op.note_id) {
                        match icloud::export_note(&db_note) {
                            Ok(()) => {
                                let hash = icloud::compute_sync_hash(&db_note.title, &db_note.content);
                                let _ = update_sync_hash(conn, &db_note.id, &hash);
                                files_synced += 1;
                            }
                            Err(e) => {
                                op.error = e;
                                failures.push(op);
                            }
                        }
                    }
                }
                _ => {}
            }
        }
    }

    let icloud_files = icloud::list_icloud_files()?;
    let total_files = icloud_files.len() as u32;
    let mut synced_ids: HashSet<String> = HashSet::new();

    // Process each iCloud file
    for (i, file_path) in icloud_files.iter().enumerate() {
        if let Some(ref cb) = progress {
            cb(i as u32, total_files, "importing");
        }

        match icloud::import_file(file_path) {
            Ok(mut file_note) => {
                file_note.sync_hash =
                    Some(icloud::compute_sync_hash(&file_note.title, &file_note.content));
                synced_ids.insert(file_note.id.clone());

                let db_note = fetch_note_by_id(conn, &file_note.id);
                let action = reconcile(db_note.as_ref(), &file_note);

                match action {
                    SyncAction::Import => {
                        match import_note_to_db(conn, &file_note) {
                            Ok(()) => {
                                imported_note_ids.push(file_note.id.clone());
                                files_synced += 1;
                            }
                            Err(e) => {
                                log::warn!("Failed to import note {} from iCloud: {}", file_note.id, e);
                                failures.push(FailedSyncOp {
                                    note_id: file_note.id.clone(),
                                    operation: "import".to_string(),
                                    error: e,
                                    retry_count: 0,
                                });
                            }
                        }
                    }
                    SyncAction::Export => {
                        if let Some(db) = &db_note {
                            match icloud::export_note(db) {
                                Ok(()) => {
                                    let hash = icloud::compute_sync_hash(&db.title, &db.content);
                                    if let Err(e) = update_sync_hash(conn, &db.id, &hash) {
                                        log::warn!("Failed to update sync hash for note {}: {}", db.id, e);
                                    }
                                    files_synced += 1;
                                }
                                Err(e) => {
                                    log::warn!("Failed to export note {} to iCloud: {}", db.id, e);
                                    failures.push(FailedSyncOp {
                                        note_id: db.id.clone(),
                                        operation: "export".to_string(),
                                        error: e,
                                        retry_count: 0,
                                    });
                                }
                            }
                        }
                    }
                    SyncAction::Skip => {}
                    SyncAction::Conflict => {
                        // reconcile() resolves conflicts to Export or Import via last-write-wins,
                        // so this branch shouldn't be reached
                    }
                }
            }
            Err(e) => {
                log::warn!("Failed to parse iCloud file {:?}: {}", file_path, e);
            }
        }
    }

    // Export DB notes that don't have corresponding iCloud files
    let all_db_notes = fetch_all_notes(conn)?;
    let total_export = all_db_notes.len() as u32;
    let mut export_i: u32 = 0;

    for note in &all_db_notes {
        if !synced_ids.contains(&note.id) {
            if let Some(ref cb) = progress {
                cb(export_i, total_export, "exporting");
            }
            match icloud::export_note(note) {
                Ok(()) => {
                    let hash = icloud::compute_sync_hash(&note.title, &note.content);
                    if let Err(e) = update_sync_hash(conn, &note.id, &hash) {
                        log::warn!("Failed to update sync hash for note {}: {}", note.id, e);
                    }
                    files_synced += 1;
                }
                Err(e) => {
                    log::warn!("Failed to export note {} to iCloud: {}", note.id, e);
                    failures.push(FailedSyncOp {
                        note_id: note.id.clone(),
                        operation: "export".to_string(),
                        error: e,
                        retry_count: 0,
                    });
                }
            }
            export_i += 1;
        }
    }

    if let Some(ref cb) = progress {
        cb(0, 0, "idle");
    }

    Ok(ReconcileResult {
        files_synced,
        imported_note_ids,
        failures,
    })
}
