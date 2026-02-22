use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use rusqlite::Connection;
use tauri::State;
use uuid::Uuid;

fn get_images_dir() -> Result<PathBuf, String> {
    let home = std::env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "Could not determine home directory".to_string())?;
    let dir = home
        .join("Library")
        .join("Application Support")
        .join("com.bruin.app")
        .join("images");
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create images dir: {}", e))?;
    Ok(dir)
}

#[tauri::command]
pub fn save_image(
    _db: State<'_, Mutex<Connection>>,
    data: Vec<u8>,
    filename: String,
) -> Result<String, String> {
    let images_dir = get_images_dir()?;
    let safe_filename = filename.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    let stored_name = format!("{}_{}", Uuid::new_v4(), safe_filename);
    let path = images_dir.join(&stored_name);
    fs::write(&path, &data).map_err(|e| format!("Failed to save image: {}", e))?;
    Ok(path.to_string_lossy().to_string())
}
