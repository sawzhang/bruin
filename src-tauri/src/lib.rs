mod commands;
mod db;
mod markdown;
mod sync;

use commands::sync::SyncState;
use sync::watcher::WatcherState;
use db::migrations;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(Mutex::new(SyncState::default()))
        .manage(Mutex::new(WatcherState::new()))
        .setup(|app| {
            let app_handle = app.handle().clone();
            migrations::run_migrations(&app_handle)?;

            // Run initial full reconciliation only if iCloud is available
            if sync::icloud::is_icloud_available() {
                {
                    let db = app_handle.state::<Mutex<rusqlite::Connection>>();
                    let conn = db.lock().map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
                    match sync::reconciler::full_reconcile(&conn, None, None) {
                        Ok(_) => {
                            // Update SyncState so the UI shows "Synced"
                            let sync_state = app_handle.state::<Mutex<SyncState>>();
                            if let Ok(mut state) = sync_state.lock() {
                                state.last_sync = Some(chrono::Utc::now().to_rfc3339());
                            };
                        }
                        Err(e) => {
                            log::warn!("Initial sync failed: {}", e);
                        }
                    }
                }

                // Start watcher, but don't fail if it errors
                match sync::watcher::start_watcher(&app_handle) {
                    Ok(ws) => {
                        let watcher_state = app_handle.state::<Mutex<WatcherState>>();
                        let mut state = watcher_state.lock().expect("watcher state lock");
                        *state = ws;
                    }
                    Err(e) => {
                        log::warn!("Failed to start file watcher: {}", e);
                    }
                }
            } else {
                log::info!("iCloud not available, skipping initial sync and file watcher");
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::notes::create_note,
            commands::notes::get_note,
            commands::notes::update_note,
            commands::notes::delete_note,
            commands::notes::list_notes,
            commands::notes::pin_note,
            commands::notes::trash_note,
            commands::notes::restore_note,
            commands::notes::import_markdown_files,
            commands::notes::set_note_state,
            commands::activity::get_activity_feed,
            commands::templates::list_templates,
            commands::templates::create_note_from_template,
            commands::webhooks::register_webhook,
            commands::webhooks::list_webhooks,
            commands::webhooks::delete_webhook,
            commands::tags::list_tags,
            commands::tags::get_notes_by_tag,
            commands::search::search_notes,
            commands::sync::trigger_sync,
            commands::sync::get_sync_status,
            commands::sync::get_icloud_status,
            commands::sync::stop_watcher,
            commands::workspaces::create_workspace,
            commands::workspaces::list_workspaces,
            commands::workspaces::delete_workspace,
            commands::notes::get_knowledge_graph,
            commands::search::semantic_search,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
