use crate::sync::reconciler::SyncAction;
use crate::sync::{icloud, reconciler};
use notify::{Event, EventKind, RecursiveMode, Watcher};
use rusqlite::Connection;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::mpsc;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

pub fn start_watcher(app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let icloud_dir = icloud::get_icloud_dir()
        .map_err(|e| format!("Cannot start iCloud watcher: {}", e))?;
    fs::create_dir_all(&icloud_dir)?;

    let (tx, rx) = mpsc::channel::<PathBuf>();

    // File watcher sends events to channel
    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        match res {
            Ok(event) => match event.kind {
                EventKind::Create(_) | EventKind::Modify(_) => {
                    for path in event.paths {
                        if path.extension().and_then(|e| e.to_str()) == Some("md") {
                            let _ = tx.send(path);
                        }
                    }
                }
                _ => {}
            },
            Err(e) => {
                log::error!("Watch error: {:?}", e);
            }
        }
    })?;

    watcher.watch(&icloud_dir, RecursiveMode::NonRecursive)?;
    std::mem::forget(watcher);

    // Debounce thread: collect events and process after 500ms of quiet
    let app = app_handle.clone();
    std::thread::spawn(move || {
        let mut pending: HashMap<PathBuf, Instant> = HashMap::new();

        loop {
            match rx.recv_timeout(Duration::from_millis(200)) {
                Ok(path) => {
                    pending.insert(path, Instant::now());
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    let now = Instant::now();
                    let ready: Vec<PathBuf> = pending
                        .iter()
                        .filter(|(_, t)| now.duration_since(**t) >= Duration::from_millis(500))
                        .map(|(p, _)| p.clone())
                        .collect();

                    if ready.is_empty() {
                        continue;
                    }

                    for path in &ready {
                        pending.remove(path);
                    }

                    let db = app.state::<Mutex<Connection>>();
                    match db.lock() {
                        Ok(conn) => {
                            for path in &ready {
                                process_file_change(&conn, path);
                            }
                        }
                        Err(e) => {
                            log::error!("Failed to acquire DB lock for sync: {}. {} file events dropped.", e, ready.len());
                        }
                    }

                    let _ = app.emit("sync-status-changed", ());
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
    });

    Ok(())
}

fn process_file_change(conn: &Connection, path: &PathBuf) {
    if !path.exists() {
        log::debug!("Skipping deleted file: {:?}", path);
        return;
    }

    match icloud::import_file(path) {
        Ok(mut file_note) => {
            file_note.sync_hash =
                Some(icloud::compute_sync_hash(&file_note.title, &file_note.content));

            let db_note = reconciler::fetch_note_by_id(conn, &file_note.id);
            let action = reconciler::reconcile(db_note.as_ref(), &file_note);

            match action {
                SyncAction::Import => {
                    if let Err(e) = reconciler::import_note_to_db(conn, &file_note) {
                        log::warn!("Failed to import {:?}: {}", path, e);
                    }
                }
                SyncAction::Export => {
                    if let Some(ref db) = db_note {
                        if let Err(e) = icloud::export_note(db) {
                            log::warn!("Failed to export note {} back to iCloud: {}", db.id, e);
                        }
                    }
                }
                _ => {}
            }
        }
        Err(e) => {
            log::warn!("Failed to process file {:?}: {}", path, e);
        }
    }
}
