use crate::mcp::McpStatus;
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn get_mcp_status(state: State<'_, Mutex<McpStatus>>) -> McpStatus {
    state.lock().map(|s| s.clone()).unwrap_or_default()
}
