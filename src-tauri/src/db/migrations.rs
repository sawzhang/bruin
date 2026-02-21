use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Manager;

fn get_db_path() -> PathBuf {
    let home = dirs_next().expect("Could not determine home directory");
    let db_dir = home
        .join("Library")
        .join("Application Support")
        .join("com.bruin.app");
    fs::create_dir_all(&db_dir).expect("Failed to create database directory");
    db_dir.join("bruin.db")
}

fn dirs_next() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

pub fn run_migrations(app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = get_db_path();
    let conn = Connection::open(&db_path)?;

    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            is_trashed INTEGER NOT NULL DEFAULT 0,
            is_pinned INTEGER NOT NULL DEFAULT 0,
            word_count INTEGER NOT NULL DEFAULT 0,
            file_path TEXT,
            sync_hash TEXT
        );

        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            parent_name TEXT,
            note_count INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS note_tags (
            note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (note_id, tag_id)
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
            title,
            content,
            content=notes,
            content_rowid=rowid
        );

        -- Triggers to keep FTS in sync
        CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
            INSERT INTO notes_fts(rowid, title, content) VALUES (NEW.rowid, NEW.title, NEW.content);
        END;

        CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
            INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES('delete', OLD.rowid, OLD.title, OLD.content);
        END;

        CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
            INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES('delete', OLD.rowid, OLD.title, OLD.content);
            INSERT INTO notes_fts(rowid, title, content) VALUES (NEW.rowid, NEW.title, NEW.content);
        END;

        CREATE TABLE IF NOT EXISTS note_metadata (
            note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            PRIMARY KEY (note_id, key)
        );
        ",
    )?;

    // Performance: indices for common query patterns
    conn.execute_batch(
        "
        CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_notes_trashed ON notes(is_trashed);
        CREATE INDEX IF NOT EXISTS idx_notes_pinned_updated ON notes(is_pinned DESC, updated_at DESC);
        ",
    )?;

    // Phase 1: Add state column to notes
    let has_state_col: bool = conn
        .prepare("SELECT COUNT(*) FROM pragma_table_info('notes') WHERE name='state'")?
        .query_row([], |row| row.get::<_, i64>(0))
        .unwrap_or(0)
        > 0;
    if !has_state_col {
        conn.execute_batch("ALTER TABLE notes ADD COLUMN state TEXT NOT NULL DEFAULT 'draft';")?;
    }

    // Index on state (must be after column is added)
    conn.execute_batch("CREATE INDEX IF NOT EXISTS idx_notes_state ON notes(state);")?;

    // Phase 2: Activity Feed
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS activity_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor TEXT NOT NULL DEFAULT 'user',
            event_type TEXT NOT NULL,
            note_id TEXT,
            timestamp TEXT NOT NULL,
            summary TEXT NOT NULL,
            data TEXT NOT NULL DEFAULT '{}'
        );
        CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_events(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_activity_note_id ON activity_events(note_id);
        ",
    )?;

    // Phase 3: Templates
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            description TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            tags TEXT NOT NULL DEFAULT '[]',
            initial_state TEXT NOT NULL DEFAULT 'draft',
            created_at TEXT NOT NULL DEFAULT '2026-01-01T00:00:00Z',
            updated_at TEXT NOT NULL DEFAULT '2026-01-01T00:00:00Z'
        );
        ",
    )?;

    // Phase 5: Webhooks
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS webhooks (
            id TEXT PRIMARY KEY,
            url TEXT NOT NULL,
            event_types TEXT NOT NULL DEFAULT '[]',
            secret TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            last_triggered_at TEXT,
            failure_count INTEGER NOT NULL DEFAULT 0
        );
        ",
    )?;

    // Phase 6: Workspaces
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            description TEXT NOT NULL DEFAULT '',
            agent_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        ",
    )?;

    // Add workspace_id column to notes (conditional)
    let has_workspace_col: bool = conn
        .prepare("SELECT COUNT(*) FROM pragma_table_info('notes') WHERE name='workspace_id'")?
        .query_row([], |row| row.get::<_, i64>(0))
        .unwrap_or(0)
        > 0;
    if !has_workspace_col {
        conn.execute_batch("ALTER TABLE notes ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL;")?;
    }

    conn.execute_batch(
        "CREATE INDEX IF NOT EXISTS idx_notes_workspace ON notes(workspace_id);",
    )?;

    // Phase 7: Knowledge Graph (note_links)
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS note_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            target_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            link_type TEXT NOT NULL DEFAULT 'wiki_link',
            created_at TEXT NOT NULL,
            UNIQUE(source_note_id, target_note_id, link_type)
        );
        CREATE INDEX IF NOT EXISTS idx_note_links_source ON note_links(source_note_id);
        CREATE INDEX IF NOT EXISTS idx_note_links_target ON note_links(target_note_id);
        ",
    )?;

    // Phase 8: Semantic Search (note_embeddings)
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS note_embeddings (
            note_id TEXT PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
            embedding TEXT NOT NULL,
            model TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
            updated_at TEXT NOT NULL
        );
        ",
    )?;

    // Seed default templates if table is empty
    let template_count: i64 = conn
        .prepare("SELECT COUNT(*) FROM templates")?
        .query_row([], |row| row.get(0))
        .unwrap_or(0);

    if template_count == 0 {
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO templates (id, name, description, content, tags, initial_state, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                uuid::Uuid::new_v4().to_string(),
                "Daily Journal",
                "A daily journal entry with sections for gratitude, tasks, and reflections.",
                "# {{date}}\n\n## Gratitude\n\n- \n\n## Tasks\n\n- [ ] \n\n## Reflections\n\n",
                "[\"daily\",\"journal\"]",
                "draft",
                now,
                now,
            ],
        )?;
        conn.execute(
            "INSERT INTO templates (id, name, description, content, tags, initial_state, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                uuid::Uuid::new_v4().to_string(),
                "Meeting Notes",
                "Template for capturing meeting notes with attendees, agenda, and action items.",
                "# {{title}}\n\n**Date:** {{date}}\n**Attendees:**\n\n## Agenda\n\n1. \n\n## Notes\n\n\n\n## Action Items\n\n- [ ] \n",
                "[\"meeting\",\"notes\"]",
                "draft",
                now,
                now,
            ],
        )?;
        conn.execute(
            "INSERT INTO templates (id, name, description, content, tags, initial_state, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                uuid::Uuid::new_v4().to_string(),
                "Research Summary",
                "Template for summarizing research findings with sources and key takeaways.",
                "# {{title}}\n\n## Topic\n\n\n\n## Key Findings\n\n1. \n\n## Sources\n\n- \n\n## Takeaways\n\n",
                "[\"research\"]",
                "review",
                now,
                now,
            ],
        )?;
    }

    app_handle.manage(Mutex::new(conn));

    Ok(())
}
