import Database from "better-sqlite3";
import os from "os";
import path from "path";
import fs from "fs";

const DB_DIR = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "com.bruin.app"
);
const DB_PATH = path.join(DB_DIR, "bruin.db");

function ensureDatabase(): Database.Database {
  fs.mkdirSync(DB_DIR, { recursive: true });

  const db = new Database(DB_PATH);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
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
  `);

  // Phase 2: Activity Feed
  db.exec(`
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
  `);

  // Performance: indices for common query patterns
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notes_trashed ON notes(is_trashed);
    CREATE INDEX IF NOT EXISTS idx_notes_pinned_updated ON notes(is_pinned DESC, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notes_state ON notes(state);
  `);

  // Phase 5: Webhooks
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      event_types TEXT NOT NULL DEFAULT '[]',
      secret TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT '2026-01-01T00:00:00Z',
      last_triggered_at TEXT,
      failure_count INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Phase 3: Templates
  db.exec(`
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
  `);

  // Seed default templates if empty
  const templateCount = db.prepare("SELECT COUNT(*) as cnt FROM templates").get() as { cnt: number };
  if (templateCount.cnt === 0) {
    const ts = new Date().toISOString();
    db.prepare(
      "INSERT INTO templates (id, name, description, content, tags, initial_state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      crypto.randomUUID(), "Daily Journal",
      "A daily journal entry with sections for gratitude, tasks, and reflections.",
      "# {{date}}\n\n## Gratitude\n\n- \n\n## Tasks\n\n- [ ] \n\n## Reflections\n\n",
      '["daily","journal"]', "draft", ts, ts
    );
    db.prepare(
      "INSERT INTO templates (id, name, description, content, tags, initial_state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      crypto.randomUUID(), "Meeting Notes",
      "Template for capturing meeting notes with attendees, agenda, and action items.",
      "# {{title}}\n\n**Date:** {{date}}\n**Attendees:**\n\n## Agenda\n\n1. \n\n## Notes\n\n\n\n## Action Items\n\n- [ ] \n",
      '["meeting","notes"]', "draft", ts, ts
    );
    db.prepare(
      "INSERT INTO templates (id, name, description, content, tags, initial_state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      crypto.randomUUID(), "Research Summary",
      "Template for summarizing research findings with sources and key takeaways.",
      "# {{title}}\n\n## Topic\n\n\n\n## Key Findings\n\n1. \n\n## Sources\n\n- \n\n## Takeaways\n\n",
      '["research"]', "review", ts, ts
    );
  }

  // Phase 6: Workspaces
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      agent_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Add workspace_id column to notes (conditional)
  const hasWorkspaceCol = db.prepare(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('notes') WHERE name='workspace_id'"
  ).get() as { cnt: number };
  if (hasWorkspaceCol.cnt === 0) {
    db.exec("ALTER TABLE notes ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL;");
  }

  db.exec("CREATE INDEX IF NOT EXISTS idx_notes_workspace ON notes(workspace_id);");

  // Phase 7: Knowledge Graph (note_links)
  db.exec(`
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
  `);

  // Phase 8: Semantic Search (note_embeddings)
  db.exec(`
    CREATE TABLE IF NOT EXISTS note_embeddings (
      note_id TEXT PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
      embedding TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
      updated_at TEXT NOT NULL
    );
  `);

  // Phase 1: Add state column to notes
  const hasStateCol = db.prepare(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('notes') WHERE name='state'"
  ).get() as { cnt: number };
  if (hasStateCol.cnt === 0) {
    db.exec("ALTER TABLE notes ADD COLUMN state TEXT NOT NULL DEFAULT 'draft';");
  }

  // Phase 10: Agents + Agent audit tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      capabilities TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const hasAgentIdCol = db.prepare(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('activity_events') WHERE name='agent_id'"
  ).get() as { cnt: number };
  if (hasAgentIdCol.cnt === 0) {
    db.exec("ALTER TABLE activity_events ADD COLUMN agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL;");
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_activity_agent ON activity_events(agent_id);");

  // Phase 11: Tasks
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date TEXT,
      assigned_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      linked_note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
      workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(assigned_agent_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);
  `);

  // Phase 12: Workflow Templates
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'general',
      steps TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Phase 13: Webhook Logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      webhook_id TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status_code INTEGER,
      response_body TEXT,
      attempt INTEGER NOT NULL DEFAULT 1,
      success INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      timestamp TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON webhook_logs(webhook_id, timestamp DESC);
  `);

  // Phase 14: Agent Workspaces + Note versioning
  const hasVersionCol = db.prepare(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('notes') WHERE name='version'"
  ).get() as { cnt: number };
  if (hasVersionCol.cnt === 0) {
    db.exec("ALTER TABLE notes ADD COLUMN version INTEGER NOT NULL DEFAULT 1;");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_workspaces (
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL,
      PRIMARY KEY (agent_id, workspace_id)
    );
  `);

  // Seed default workflows if empty
  const workflowCount = db.prepare("SELECT COUNT(*) as cnt FROM workflow_templates").get() as { cnt: number };
  if (workflowCount.cnt === 0) {
    const ts = new Date().toISOString();
    db.prepare(
      "INSERT INTO workflow_templates (id, name, description, category, steps, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(
      crypto.randomUUID(), "Daily Standup",
      "Get daily note, list in-progress tasks, and append a summary",
      "daily",
      JSON.stringify([
        { order: 1, tool_name: "get_daily_note", description: "Get or create today's daily note", params: {}, use_result_as: "standup_note" },
        { order: 2, tool_name: "list_tasks", description: "List all in-progress tasks", params: { status: "in_progress" }, use_result_as: "active_tasks" },
        { order: 3, tool_name: "append_to_note", description: "Append task summary to daily note", params: { note_id: "{{standup_note.id}}", content: "Active Tasks: {{active_tasks}}" }, use_result_as: "updated_note" },
      ]),
      ts, ts
    );
    db.prepare(
      "INSERT INTO workflow_templates (id, name, description, category, steps, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(
      crypto.randomUUID(), "Research Summary",
      "Search notes by tag and create a summary note with links",
      "research",
      JSON.stringify([
        { order: 1, tool_name: "list_notes", description: "Find notes with research tag", params: { tag: "research" }, use_result_as: "research_notes" },
        { order: 2, tool_name: "create_note", description: "Create summary note with links", params: { title: "Research Summary {{date}}", content: "Research Notes: {{research_notes}}" }, use_result_as: "summary_note" },
      ]),
      ts, ts
    );
    db.prepare(
      "INSERT INTO workflow_templates (id, name, description, category, steps, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(
      crypto.randomUUID(), "Meeting Follow-up",
      "Create a note from meeting template and generate tasks from action items",
      "project",
      JSON.stringify([
        { order: 1, tool_name: "create_from_template", description: "Create meeting note from template", params: { template_name: "Meeting Notes" }, use_result_as: "meeting_note" },
        { order: 2, tool_name: "create_task", description: "Create follow-up task", params: { title: "Review meeting action items", linked_note_id: "{{meeting_note.id}}" }, use_result_as: "followup_task" },
      ]),
      ts, ts
    );
  }

  return db;
}

const db: import("better-sqlite3").Database = ensureDatabase();

export default db;
