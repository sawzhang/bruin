use crate::sync::icloud;
use notify::{Event, RecursiveMode, Watcher};
use std::fs;
use tauri::AppHandle;

pub fn start_watcher(app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let icloud_dir = icloud::get_icloud_dir();
    fs::create_dir_all(&icloud_dir)?;

    let _app_handle = app_handle.clone();
    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        match res {
            Ok(event) => {
                log::info!("File change detected: {:?}", event);
                // Reconciliation will be triggered on next sync
            }
            Err(e) => {
                log::error!("Watch error: {:?}", e);
            }
        }
    })?;

    watcher.watch(&icloud_dir, RecursiveMode::Recursive)?;

    // Leak the watcher so it lives for the duration of the app
    std::mem::forget(watcher);

    Ok(())
}
