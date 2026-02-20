mod commands;
mod db;
mod markdown;
mod sync;

use db::migrations;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            migrations::run_migrations(&app_handle)?;
            sync::watcher::start_watcher(&app_handle)?;
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
            commands::tags::list_tags,
            commands::tags::get_notes_by_tag,
            commands::search::search_notes,
            commands::sync::trigger_sync,
            commands::sync::get_sync_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
