use crate::db::models::Note;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SyncAction {
    Import,
    Export,
    Skip,
    Conflict,
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
                    // Both have different hashes - conflict
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
