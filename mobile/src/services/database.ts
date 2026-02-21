import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";
import type {
  Note,
  NoteListItem,
  NoteState,
  Tag,
  CreateNoteParams,
  UpdateNoteParams,
  ListNotesParams,
  SearchNotesParams,
} from "@/types";
import { countWords, generatePreview } from "@/services/markdown";

type SQLiteDatabase = SQLite.SQLiteDatabase;

// ─── Schema ────────────────────────────────────────────────────────────────────

const CREATE_TABLES_SQL = `
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
    sync_hash TEXT,
    state TEXT NOT NULL DEFAULT 'draft',
    workspace_id TEXT
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
`;

const CREATE_INDEXES_SQL = `
  CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_notes_trashed ON notes(is_trashed);
  CREATE INDEX IF NOT EXISTS idx_notes_state ON notes(state);
  CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON note_tags(tag_id);
`;

// ─── Initialization ────────────────────────────────────────────────────────────

/**
 * Open and initialize the bruin.db database.
 * Creates tables, indexes, and enables WAL mode + foreign keys.
 */
export function initDatabase(): SQLiteDatabase {
  const db = SQLite.openDatabaseSync("bruin.db");

  db.execSync("PRAGMA journal_mode = WAL;");
  db.execSync("PRAGMA foreign_keys = ON;");
  db.execSync(CREATE_TABLES_SQL);
  db.execSync(CREATE_INDEXES_SQL);

  return db;
}

// ─── Tag helpers ───────────────────────────────────────────────────────────────

/**
 * Get the parent tag name for a hierarchical tag.
 * e.g. "work/projects" -> "work", "simple" -> null
 */
function getParentTag(tagName: string): string | null {
  const lastSlash = tagName.lastIndexOf("/");
  if (lastSlash === -1) {
    return null;
  }
  return tagName.slice(0, lastSlash);
}

/**
 * Fetch tag names for a given note.
 */
function fetchNoteTags(db: SQLiteDatabase, noteId: string): string[] {
  const rows = db.getAllSync<{ name: string }>(
    "SELECT t.name FROM tags t JOIN note_tags nt ON t.id = nt.tag_id WHERE nt.note_id = ? ORDER BY t.name",
    [noteId]
  );
  return rows.map((r) => r.name);
}

/**
 * Sync tags for a note: delete existing links, ensure tags exist (with hierarchy), re-link.
 * Matches the Rust sync_tags implementation.
 */
export function syncTags(
  db: SQLiteDatabase,
  noteId: string,
  tagNames: string[]
): void {
  db.runSync("DELETE FROM note_tags WHERE note_id = ?", [noteId]);

  for (const tagName of tagNames) {
    const parent = getParentTag(tagName);

    // Ensure parent tags exist in the hierarchy
    // e.g. for "work/projects/v2", ensure "work" and "work/projects" exist too
    if (parent !== null) {
      ensureTagHierarchy(db, parent);
    }

    db.runSync(
      "INSERT INTO tags (name, parent_name) VALUES (?, ?) ON CONFLICT(name) DO NOTHING",
      [tagName, parent]
    );

    const tagRow = db.getFirstSync<{ id: number }>(
      "SELECT id FROM tags WHERE name = ?",
      [tagName]
    );

    if (tagRow) {
      db.runSync(
        "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)",
        [noteId, tagRow.id]
      );
    }
  }

  // Update note_count for all tags
  db.execSync(
    "UPDATE tags SET note_count = (SELECT COUNT(*) FROM note_tags WHERE note_tags.tag_id = tags.id)"
  );
}

/**
 * Ensure all ancestor tags exist for a hierarchical tag path.
 * e.g. for "work/projects", ensure "work" exists with parent_name=null.
 */
function ensureTagHierarchy(db: SQLiteDatabase, tagPath: string): void {
  const parent = getParentTag(tagPath);

  // Recurse to ensure parent exists first
  if (parent !== null) {
    ensureTagHierarchy(db, parent);
  }

  db.runSync(
    "INSERT INTO tags (name, parent_name) VALUES (?, ?) ON CONFLICT(name) DO NOTHING",
    [tagPath, parent]
  );
}

// ─── Note helpers ──────────────────────────────────────────────────────────────

/**
 * Build a full Note object from a raw database row + tags.
 */
function rowToNote(
  db: SQLiteDatabase,
  row: {
    id: string;
    title: string;
    content: string;
    created_at: string;
    updated_at: string;
    is_trashed: number;
    is_pinned: number;
    word_count: number;
    file_path: string | null;
    sync_hash: string | null;
    state: string;
    workspace_id: string | null;
  }
): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_trashed: row.is_trashed !== 0,
    is_pinned: row.is_pinned !== 0,
    word_count: row.word_count,
    file_path: row.file_path,
    sync_hash: row.sync_hash,
    state: row.state as NoteState,
    workspace_id: row.workspace_id,
    tags: fetchNoteTags(db, row.id),
  };
}

// ─── CRUD Operations ───────────────────────────────────────────────────────────

interface NoteRow {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_trashed: number;
  is_pinned: number;
  word_count: number;
  file_path: string | null;
  sync_hash: string | null;
  state: string;
  workspace_id: string | null;
}

/**
 * List notes with optional filtering, sorting, and pagination.
 */
export function listNotes(
  db: SQLiteDatabase,
  params: ListNotesParams = {}
): NoteListItem[] {
  const {
    tag,
    trashed = false,
    sort_by = "updated_at",
    sort_order = "desc",
    limit = 50,
    offset = 0,
  } = params;

  const conditions: string[] = [];
  const queryParams: (string | number)[] = [];

  conditions.push("n.is_trashed = ?");
  queryParams.push(trashed ? 1 : 0);

  let joinClause = "";

  if (tag) {
    joinClause =
      "JOIN note_tags nt ON nt.note_id = n.id JOIN tags t ON t.id = nt.tag_id";
    conditions.push("t.name = ?");
    queryParams.push(tag);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Validate sort column to prevent SQL injection
  const validSortColumns = ["updated_at", "created_at", "title"];
  const sortCol = validSortColumns.includes(sort_by) ? sort_by : "updated_at";
  const sortDir = sort_order === "asc" ? "ASC" : "DESC";

  // Pinned notes first, then sort by requested column
  const orderClause = `ORDER BY n.is_pinned DESC, n.${sortCol} ${sortDir}`;

  const sql = `
    SELECT n.id, n.title, n.content, n.updated_at, n.is_pinned, n.is_trashed,
           n.word_count, n.state, n.workspace_id
    FROM notes n
    ${joinClause}
    ${whereClause}
    ${orderClause}
    LIMIT ? OFFSET ?
  `;

  queryParams.push(limit, offset);

  const rows = db.getAllSync<{
    id: string;
    title: string;
    content: string;
    updated_at: string;
    is_pinned: number;
    is_trashed: number;
    word_count: number;
    state: string;
    workspace_id: string | null;
  }>(sql, queryParams);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    preview: generatePreview(row.content),
    updated_at: row.updated_at,
    is_pinned: row.is_pinned !== 0,
    is_trashed: row.is_trashed !== 0,
    word_count: row.word_count,
    tags: fetchNoteTags(db, row.id),
    state: row.state as NoteState,
    workspace_id: row.workspace_id,
  }));
}

/**
 * Get a single note by ID, including tags.
 */
export function getNote(db: SQLiteDatabase, id: string): Note | null {
  const row = db.getFirstSync<NoteRow>(
    `SELECT id, title, content, created_at, updated_at, is_trashed, is_pinned,
            word_count, file_path, sync_hash, state, workspace_id
     FROM notes WHERE id = ?`,
    [id]
  );

  if (!row) {
    return null;
  }

  return rowToNote(db, row);
}

/**
 * Create a new note. Generates UUID, computes word count, syncs tags.
 */
export function createNote(
  db: SQLiteDatabase,
  params: CreateNoteParams
): Note {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  const wordCount = countWords(params.content);

  db.runSync(
    `INSERT INTO notes (id, title, content, created_at, updated_at, is_trashed, is_pinned, word_count, state)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?, 'draft')`,
    [id, params.title, params.content, now, now, wordCount]
  );

  if (params.tags && params.tags.length > 0) {
    syncTags(db, id, params.tags);
  }

  return getNote(db, id)!;
}

/**
 * Update an existing note. Only updates provided fields. Recomputes word count if content changed.
 */
export function updateNote(
  db: SQLiteDatabase,
  params: UpdateNoteParams
): Note {
  const existing = getNote(db, params.id);
  if (!existing) {
    throw new Error(`Note not found: ${params.id}`);
  }

  const setClauses: string[] = [];
  const queryParams: (string | number)[] = [];

  if (params.title !== undefined) {
    setClauses.push("title = ?");
    queryParams.push(params.title);
  }

  if (params.content !== undefined) {
    setClauses.push("content = ?");
    queryParams.push(params.content);
    setClauses.push("word_count = ?");
    queryParams.push(countWords(params.content));
  }

  const now = new Date().toISOString();
  setClauses.push("updated_at = ?");
  queryParams.push(now);

  if (setClauses.length > 0) {
    queryParams.push(params.id);
    db.runSync(
      `UPDATE notes SET ${setClauses.join(", ")} WHERE id = ?`,
      queryParams
    );
  }

  if (params.tags !== undefined) {
    syncTags(db, params.id, params.tags);
  }

  return getNote(db, params.id)!;
}

/**
 * Delete a note. If permanent, removes from DB entirely. Otherwise marks as trashed.
 */
export function deleteNote(
  db: SQLiteDatabase,
  id: string,
  permanent: boolean
): void {
  if (permanent) {
    db.runSync("DELETE FROM notes WHERE id = ?", [id]);
  } else {
    db.runSync(
      "UPDATE notes SET is_trashed = 1, updated_at = ? WHERE id = ?",
      [new Date().toISOString(), id]
    );
  }
}

/**
 * Pin or unpin a note.
 */
export function pinNote(
  db: SQLiteDatabase,
  id: string,
  pinned: boolean
): void {
  db.runSync(
    "UPDATE notes SET is_pinned = ?, updated_at = ? WHERE id = ?",
    [pinned ? 1 : 0, new Date().toISOString(), id]
  );
}

/**
 * Move a note to trash.
 */
export function trashNote(db: SQLiteDatabase, id: string): void {
  db.runSync(
    "UPDATE notes SET is_trashed = 1, updated_at = ? WHERE id = ?",
    [new Date().toISOString(), id]
  );
}

/**
 * Restore a note from trash.
 */
export function restoreNote(db: SQLiteDatabase, id: string): void {
  db.runSync(
    "UPDATE notes SET is_trashed = 0, updated_at = ? WHERE id = ?",
    [new Date().toISOString(), id]
  );
}

/**
 * Set the workflow state of a note (draft, review, published).
 */
export function setNoteState(
  db: SQLiteDatabase,
  id: string,
  state: NoteState
): Note {
  db.runSync(
    "UPDATE notes SET state = ?, updated_at = ? WHERE id = ?",
    [state, new Date().toISOString(), id]
  );

  return getNote(db, id)!;
}

/**
 * Full-text search against notes_fts. Returns matching notes as list items.
 */
export function searchNotes(
  db: SQLiteDatabase,
  params: SearchNotesParams
): NoteListItem[] {
  const { query, limit = 20, offset = 0 } = params;

  if (!query.trim()) {
    return [];
  }

  // Escape FTS5 special characters and append * for prefix matching
  const sanitized = query.replace(/['"]/g, "").trim();
  if (!sanitized) {
    return [];
  }

  const rows = db.getAllSync<{
    id: string;
    title: string;
    content: string;
    updated_at: string;
    is_pinned: number;
    is_trashed: number;
    word_count: number;
    state: string;
    workspace_id: string | null;
  }>(
    `SELECT n.id, n.title, n.content, n.updated_at, n.is_pinned, n.is_trashed,
            n.word_count, n.state, n.workspace_id
     FROM notes n
     JOIN notes_fts fts ON fts.rowid = n.rowid
     WHERE notes_fts MATCH ? AND n.is_trashed = 0
     ORDER BY rank
     LIMIT ? OFFSET ?`,
    [sanitized, limit, offset]
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    preview: generatePreview(row.content),
    updated_at: row.updated_at,
    is_pinned: row.is_pinned !== 0,
    is_trashed: row.is_trashed !== 0,
    word_count: row.word_count,
    tags: fetchNoteTags(db, row.id),
    state: row.state as NoteState,
    workspace_id: row.workspace_id,
  }));
}

// ─── Tags ──────────────────────────────────────────────────────────────────────

/**
 * List all tags with their note counts.
 */
export function listTags(db: SQLiteDatabase): Tag[] {
  const rows = db.getAllSync<{
    id: number;
    name: string;
    parent_name: string | null;
    note_count: number;
  }>(
    `SELECT t.id, t.name, t.parent_name,
            (SELECT COUNT(*) FROM note_tags nt WHERE nt.tag_id = t.id) AS note_count
     FROM tags t
     ORDER BY t.name`
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    parent_name: row.parent_name,
    note_count: row.note_count,
  }));
}
