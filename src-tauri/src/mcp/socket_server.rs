use crate::mcp::server::{dispatch, find_db, get_default_socket_path, setup_agent};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::UnixListener;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct McpStatus {
    pub is_running: bool,
    pub socket_path: Option<String>,
    pub client_count: usize,
}

pub fn get_socket_path(app_handle: &AppHandle) -> PathBuf {
    if let Ok(dir) = app_handle.path().app_data_dir() {
        return dir.join("mcp.sock");
    }
    get_default_socket_path()
}

pub fn start_socket_server(app_handle: AppHandle) {
    let socket_path = get_socket_path(&app_handle);

    // Remove stale socket file from a previous run
    let _ = std::fs::remove_file(&socket_path);

    let listener = match UnixListener::bind(&socket_path) {
        Ok(l) => l,
        Err(e) => {
            log::error!(
                "Failed to start MCP socket server at {:?}: {}",
                socket_path,
                e
            );
            return;
        }
    };

    let socket_path_str = socket_path.to_string_lossy().into_owned();
    let client_count = Arc::new(AtomicUsize::new(0));

    std::thread::spawn(move || {
        // Update managed state from inside the thread — avoids borrow-before-move
        {
            let state = app_handle.state::<Mutex<McpStatus>>();
            if let Ok(mut s) = state.lock() {
                s.is_running = true;
                s.socket_path = Some(socket_path_str);
            };
        }
        let _ = app_handle.emit("mcp-status-changed", ());

        for stream in listener.incoming() {
            match stream {
                Ok(stream) => {
                    let new_count = client_count.fetch_add(1, Ordering::SeqCst) + 1;
                    update_client_count(&app_handle, new_count);

                    let handle = app_handle.clone();
                    let cc = client_count.clone();

                    std::thread::spawn(move || {
                        serve_connection(stream, &handle);
                        let remaining = cc.fetch_sub(1, Ordering::SeqCst) - 1;
                        update_client_count(&handle, remaining);
                    });
                }
                Err(e) => {
                    log::error!("MCP socket accept error: {}", e);
                    break;
                }
            }
        }
    });
}

fn update_client_count(app_handle: &AppHandle, count: usize) {
    let state = app_handle.state::<Mutex<McpStatus>>();
    if let Ok(mut s) = state.lock() {
        s.client_count = count;
    };
    let _ = app_handle.emit("mcp-status-changed", ());
}

fn serve_connection(stream: std::os::unix::net::UnixStream, app_handle: &AppHandle) {
    let db_path = find_db();
    let conn = match Connection::open(&db_path) {
        Ok(c) => c,
        Err(e) => {
            log::error!("MCP socket: failed to open DB: {}", e);
            return;
        }
    };
    let _ = conn.execute_batch(
        "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
    );
    let agent_id = setup_agent(&conn);

    let reader = BufReader::new(&stream);
    let mut writer = &stream;

    for line in reader.lines() {
        let line = match line {
            Ok(l) if !l.trim().is_empty() => l,
            Ok(_) => continue,
            Err(_) => break,
        };

        let request: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => {
                let err_msg = json!({
                    "jsonrpc": "2.0", "id": Value::Null,
                    "error": { "code": -32700, "message": format!("Parse error: {}", e) }
                });
                let _ = writeln!(writer, "{}", err_msg);
                let _ = writer.flush();
                continue;
            }
        };

        // Notifications (no id) — no response needed
        let has_id = request.get("id").map(|v| !v.is_null()).unwrap_or(false);
        if !has_id {
            continue;
        }

        let id = request["id"].clone();
        let method = request["method"].as_str().unwrap_or("");
        let params = request.get("params").cloned().unwrap_or(json!({}));

        let response = match dispatch(&conn, method, &params, agent_id.as_deref()) {
            Ok(result) => json!({ "jsonrpc": "2.0", "id": id, "result": result }),
            Err(err) => json!({
                "jsonrpc": "2.0", "id": id,
                "error": { "code": -32603, "message": err }
            }),
        };

        let out_line = serde_json::to_string(&response).unwrap_or_default();
        if writeln!(writer, "{}", out_line).is_err() {
            break;
        }
        let _ = writer.flush();

        // After writes, tell the UI to refresh
        let _ = app_handle.emit("notes-changed", ());
    }
}
