use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncState {
    pub is_syncing: bool,
    pub last_sync: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub fn trigger_sync() -> Result<(), String> {
    // iCloud sync is handled by the OS; triggering a manual reconciliation
    log::info!("Manual sync triggered");
    Ok(())
}

#[tauri::command]
pub fn get_sync_status() -> Result<SyncState, String> {
    Ok(SyncState {
        is_syncing: false,
        last_sync: None,
        error: None,
    })
}
