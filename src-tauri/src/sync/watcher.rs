use crate::sync::reconciler::SyncAction;
use crate::sync::{icloud, reconciler};
use notify::{Event, EventKind, RecursiveMode, RecommendedWatcher, Watcher};
use rusqlite::Connection;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::mpsc;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

/// File system events sent through the debounce channel.
#[derive(Debug, Clone)]
enum FileEvent {
    Changed(PathBuf),
    Removed(PathBuf),
}

/// Holds watcher handles so they can be dropped for graceful shutdown.
pub struct WatcherState {
    icloud_watcher: Option<RecommendedWatcher>,
    trigger_watcher: Option<RecommendedWatcher>,
}

impl WatcherState {
    pub fn new() -> Self {
        Self {
            icloud_watcher: None,
            trigger_watcher: None,
        }
    }

    pub fn stop(&mut self) {
        self.icloud_watcher = None;
        self.trigger_watcher = None;
    }
}

/// Check if a path is an iCloud placeholder file (e.g., ".abc123.md.icloud").
fn is_icloud_placeholder(path: &PathBuf) -> bool {
    let file_name = match path.file_name().and_then(|n| n.to_str()) {
        Some(n) => n,
        None => return false,
    };
    file_name.starts_with('.') && file_name.ends_with(".icloud")
}

pub fn start_watcher(app_handle: &AppHandle) -> Result<WatcherState, Box<dyn std::error::Error>> {
    let icloud_dir = icloud::get_icloud_dir()
        .map_err(|e| format!("Cannot start iCloud watcher: {}", e))?;
    fs::create_dir_all(&icloud_dir)?;

    let (tx, rx) = mpsc::channel::<FileEvent>();

    // File watcher sends events to channel
    let tx_clone = tx.clone();
    let icloud_watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        match res {
            Ok(event) => match event.kind {
                EventKind::Create(_) | EventKind::Modify(_) => {
                    for path in event.paths {
                        if is_icloud_placeholder(&path) {
                            continue;
                        }
                        if path.extension().and_then(|e| e.to_str()) == Some("md") {
                            let _ = tx_clone.send(FileEvent::Changed(path));
                        }
                    }
                }
                EventKind::Remove(_) => {
                    for path in event.paths {
                        if is_icloud_placeholder(&path) {
                            continue;
                        }
                        if path.extension().and_then(|e| e.to_str()) == Some("md") {
                            let _ = tx_clone.send(FileEvent::Removed(path));
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

    // Start watching iCloud directory
    let mut icloud_w = icloud_watcher;
    icloud_w.watch(&icloud_dir, RecursiveMode::NonRecursive)?;

    // --- MCP trigger file watcher ---
    let home = std::env::var("HOME").unwrap_or_default();
    let app_support_dir = PathBuf::from(&home)
        .join("Library")
        .join("Application Support")
        .join("com.bruin.app");
    fs::create_dir_all(&app_support_dir)?;

    let tx_trigger = tx;
    let trigger_watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        match res {
            Ok(event) => match event.kind {
                EventKind::Create(_) | EventKind::Modify(_) => {
                    for path in &event.paths {
                        if path.file_name().and_then(|n| n.to_str()) == Some(".bruin-sync-trigger") {
                            // Send a special Changed event with the trigger file path
                            let _ = tx_trigger.send(FileEvent::Changed(path.clone()));
                        }
                    }
                }
                _ => {}
            },
            Err(e) => {
                log::error!("Trigger watch error: {:?}", e);
            }
        }
    })?;

    let mut trigger_w = trigger_watcher;
    trigger_w.watch(&app_support_dir, RecursiveMode::NonRecursive)?;

    // Debounce thread: collect events and process after 500ms of quiet
    let app = app_handle.clone();
    std::thread::spawn(move || {
        let mut pending_changes: HashMap<PathBuf, Instant> = HashMap::new();
        let mut pending_removes: HashMap<PathBuf, Instant> = HashMap::new();
        let mut pending_full_reconcile = false;
        let mut last_full_reconcile_trigger: Option<Instant> = None;

        loop {
            match rx.recv_timeout(Duration::from_millis(200)) {
                Ok(event) => match event {
                    FileEvent::Changed(path) => {
                        if path.file_name().and_then(|n| n.to_str()) == Some(".bruin-sync-trigger") {
                            pending_full_reconcile = true;
                            last_full_reconcile_trigger = Some(Instant::now());
                        } else {
                            pending_changes.insert(path, Instant::now());
                        }
                    }
                    FileEvent::Removed(path) => {
                        pending_removes.insert(path, Instant::now());
                    }
                },
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    let now = Instant::now();

                    // Handle full reconcile from MCP trigger
                    if pending_full_reconcile {
                        if let Some(t) = last_full_reconcile_trigger {
                            if now.duration_since(t) >= Duration::from_millis(500) {
                                pending_full_reconcile = false;
                                last_full_reconcile_trigger = None;

                                let db = app.state::<Mutex<Connection>>();
                                match db.lock() {
                                    Ok(conn) => {
                                        match reconciler::full_reconcile(&conn, None, None) {
                                            Ok(result) => {
                                                log::info!("MCP trigger: synced {} files", result.files_synced);
                                                if !result.imported_note_ids.is_empty() {
                                                    let _ = app.emit("notes-imported", &result.imported_note_ids);
                                                }
                                            }
                                            Err(e) => log::error!("MCP trigger reconcile failed: {}", e),
                                        }
                                    }
                                    Err(e) => log::error!("Failed to acquire DB lock for MCP sync: {}", e),
                                }
                                let _ = app.emit("sync-status-changed", ());
                            }
                        }
                    }

                    // Process file changes
                    let ready_changes: Vec<PathBuf> = pending_changes
                        .iter()
                        .filter(|(_, t)| now.duration_since(**t) >= Duration::from_millis(500))
                        .map(|(p, _)| p.clone())
                        .collect();

                    let ready_removes: Vec<PathBuf> = pending_removes
                        .iter()
                        .filter(|(_, t)| now.duration_since(**t) >= Duration::from_millis(500))
                        .map(|(p, _)| p.clone())
                        .collect();

                    if ready_changes.is_empty() && ready_removes.is_empty() {
                        continue;
                    }

                    for path in &ready_changes {
                        pending_changes.remove(path);
                    }
                    for path in &ready_removes {
                        pending_removes.remove(path);
                    }

                    let db = app.state::<Mutex<Connection>>();
                    match db.lock() {
                        Ok(conn) => {
                            for path in &ready_changes {
                                process_file_change(&conn, path);
                            }
                            for path in &ready_removes {
                                process_file_removal(&conn, path);
                            }
                        }
                        Err(e) => {
                            log::error!(
                                "Failed to acquire DB lock for sync: {}. {} events dropped.",
                                e,
                                ready_changes.len() + ready_removes.len()
                            );
                        }
                    }

                    let _ = app.emit("sync-status-changed", ());
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
    });

    Ok(WatcherState {
        icloud_watcher: Some(icloud_w),
        trigger_watcher: Some(trigger_w),
    })
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

/// Process a file removal event: extract note ID from filename and trash the note in DB.
fn process_file_removal(conn: &Connection, path: &PathBuf) {
    let note_id = match path.file_stem().and_then(|s| s.to_str()) {
        Some(id) => id.to_string(),
        None => {
            log::warn!("Could not extract note ID from removed file: {:?}", path);
            return;
        }
    };

    // Only trash the note if it exists and isn't already trashed
    match conn.execute(
        "UPDATE notes SET is_trashed = 1, updated_at = ?1 WHERE id = ?2 AND is_trashed = 0",
        rusqlite::params![chrono::Utc::now().to_rfc3339(), note_id],
    ) {
        Ok(rows) if rows > 0 => {
            log::info!("Trashed note {} after iCloud file removal", note_id);
        }
        Ok(_) => {
            log::debug!("No active note found for removed file: {}", note_id);
        }
        Err(e) => {
            log::warn!("Failed to trash note {} after file removal: {}", note_id, e);
        }
    }
}
