use std::fs;
use std::sync::Mutex;
use rusqlite::Connection;
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

#[tauri::command]
pub fn save_image(
    app_handle: AppHandle,
    _db: State<'_, Mutex<Connection>>,
    data: Vec<u8>,
    filename: String,
) -> Result<String, String> {
    let images_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?
        .join("images");
    fs::create_dir_all(&images_dir)
        .map_err(|e| format!("Failed to create images dir: {}", e))?;
    let safe_filename = filename.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    let stored_name = format!("{}_{}", Uuid::new_v4(), safe_filename);
    let path = images_dir.join(&stored_name);
    fs::write(&path, &data).map_err(|e| format!("Failed to save image: {}", e))?;
    Ok(path.to_string_lossy().to_string())
}
