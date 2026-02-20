use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncState {
    pub is_syncing: bool,
    pub last_sync: Option<String>,
    pub error: Option<String>,
    pub files_synced: u32,
}

impl Default for SyncState {
    fn default() -> Self {
        Self {
            is_syncing: false,
            last_sync: None,
            error: None,
            files_synced: 0,
        }
    }
}

#[tauri::command]
pub fn trigger_sync(
    db: State<'_, Mutex<Connection>>,
    sync_state: State<'_, Mutex<SyncState>>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    // Set syncing state
    {
        let mut state = sync_state.lock().map_err(|e| e.to_string())?;
        state.is_syncing = true;
        state.error = None;
    }
    let _ = app_handle.emit("sync-status-changed", ());

    // Run full reconciliation
    match crate::sync::reconciler::full_reconcile(&conn) {
        Ok(files_synced) => {
            let mut state = sync_state.lock().map_err(|e| e.to_string())?;
            state.is_syncing = false;
            state.last_sync = Some(chrono::Utc::now().to_rfc3339());
            state.files_synced = files_synced;
            state.error = None;
        }
        Err(e) => {
            let mut state = sync_state.lock().map_err(|e| e.to_string())?;
            state.is_syncing = false;
            state.error = Some(e.clone());
            let _ = app_handle.emit("sync-status-changed", ());
            return Err(e);
        }
    }

    let _ = app_handle.emit("sync-status-changed", ());
    Ok(())
}

#[tauri::command]
pub fn get_sync_status(
    sync_state: State<'_, Mutex<SyncState>>,
) -> Result<SyncState, String> {
    let state = sync_state.lock().map_err(|e| e.to_string())?;
    Ok(state.clone())
}
