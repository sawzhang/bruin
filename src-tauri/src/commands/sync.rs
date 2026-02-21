use crate::sync::icloud::{self, ICloudStatus};
use crate::sync::reconciler::FailedSyncOp;
use crate::sync::watcher::WatcherState;
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
    pub total_files: u32,
    pub current_file: u32,
    pub current_phase: String,
    pub retry_queue: Vec<FailedSyncOp>,
}

impl Default for SyncState {
    fn default() -> Self {
        Self {
            is_syncing: false,
            last_sync: None,
            error: None,
            files_synced: 0,
            total_files: 0,
            current_file: 0,
            current_phase: "idle".to_string(),
            retry_queue: Vec::new(),
        }
    }
}

#[tauri::command]
pub fn trigger_sync(
    db: State<'_, Mutex<Connection>>,
    sync_state: State<'_, Mutex<SyncState>>,
    app_handle: AppHandle,
) -> Result<(), String> {
    // Guard: check iCloud availability
    if !icloud::is_icloud_available() {
        return Err("iCloud is not available".to_string());
    }

    let conn = db.lock().map_err(|e| e.to_string())?;

    // Extract retry queue from previous state
    let retry_queue = {
        let mut state = sync_state.lock().map_err(|e| e.to_string())?;
        state.is_syncing = true;
        state.error = None;
        state.current_phase = "importing".to_string();
        std::mem::take(&mut state.retry_queue)
    };
    let _ = app_handle.emit("sync-status-changed", ());

    let retry_input = if retry_queue.is_empty() {
        None
    } else {
        Some(retry_queue)
    };

    // Create progress callback that updates SyncState and emits events
    let sync_state_ref = sync_state.inner();
    let app_ref = app_handle.clone();
    let progress_cb = move |current: u32, total: u32, phase: &str| {
        if let Ok(mut state) = sync_state_ref.lock() {
            state.current_file = current;
            state.total_files = total;
            state.current_phase = phase.to_string();
        }
        let _ = app_ref.emit(
            "sync-progress",
            serde_json::json!({
                "current": current,
                "total": total,
                "phase": phase,
            }),
        );
    };

    // Run full reconciliation
    match crate::sync::reconciler::full_reconcile(&conn, Some(&progress_cb), retry_input) {
        Ok(result) => {
            let mut state = sync_state.lock().map_err(|e| e.to_string())?;
            state.is_syncing = false;
            state.last_sync = Some(chrono::Utc::now().to_rfc3339());
            state.files_synced = result.files_synced;
            state.current_phase = "idle".to_string();
            state.error = None;
            state.retry_queue = result.failures;

            // Emit notes-imported event if any notes were imported
            if !result.imported_note_ids.is_empty() {
                let _ = app_handle.emit("notes-imported", &result.imported_note_ids);
            }
        }
        Err(e) => {
            let mut state = sync_state.lock().map_err(|e| e.to_string())?;
            state.is_syncing = false;
            state.current_phase = "idle".to_string();
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

#[tauri::command]
pub fn get_icloud_status() -> Result<ICloudStatus, String> {
    Ok(icloud::get_icloud_status())
}

#[tauri::command]
pub fn stop_watcher(
    watcher_state: State<'_, Mutex<WatcherState>>,
) -> Result<(), String> {
    let mut ws = watcher_state.lock().map_err(|e| e.to_string())?;
    ws.stop();
    Ok(())
}
