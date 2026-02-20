import { v4 as uuidv4 } from "uuid";
import db from "./connection.js";

const TAG_REGEX = /#([a-zA-Z0-9_]+(?:\/[a-zA-Z0-9_]+)*)/g;

export interface NoteRow {
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
}

export interface TagRow {
  id: number;
  name: string;
  parent_name: string | null;
  note_count: number;
}

export interface NoteWithTags extends NoteRow {
  tags: string[];
}

function now(): string {
  return new Date().toISOString();
}

function wordCount(content: string): number {
  return content.split(/\s+/).filter((s) => s.length > 0).length;
}

export function extractTags(content: string): string[] {
  const tags = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(TAG_REGEX.source, "g");
  while ((match = re.exec(content)) !== null) {
    tags.add(match[1]);
  }
  return Array.from(tags);
}

function getTagsForNote(noteId: string): string[] {
  const rows = db
    .prepare(
      `SELECT t.name FROM tags t
       JOIN note_tags nt ON nt.tag_id = t.id
       WHERE nt.note_id = ?`
    )
    .all(noteId) as { name: string }[];
  return rows.map((r) => r.name);
}

function getOrCreateTag(name: string): number {
  const parentName = name.includes("/") ? name.split("/")[0] : null;

  const existing = db
    .prepare("SELECT id FROM tags WHERE name = ?")
    .get(name) as { id: number } | undefined;

  if (existing) return existing.id;

  const result = db
    .prepare("INSERT INTO tags (name, parent_name, note_count) VALUES (?, ?, 0)")
    .run(name, parentName);

  return Number(result.lastInsertRowid);
}

export function syncNoteTags(noteId: string, tags: string[]): void {
  const oldTags = getTagsForNote(noteId);

  db.prepare("DELETE FROM note_tags WHERE note_id = ?").run(noteId);

  for (const oldTag of oldTags) {
    db.prepare(
      "UPDATE tags SET note_count = MAX(note_count - 1, 0) WHERE name = ?"
    ).run(oldTag);
  }

  for (const tag of tags) {
    const tagId = getOrCreateTag(tag);
    db.prepare("INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)").run(
      noteId,
      tagId
    );
    db.prepare("UPDATE tags SET note_count = note_count + 1 WHERE id = ?").run(
      tagId
    );
  }
}

export function createNote(
  title: string,
  content: string,
  tags?: string[]
): NoteWithTags {
  const id = uuidv4();
  const timestamp = now();
  const wc = wordCount(content);

  const allTags = tags ?? extractTags(content);

  db.prepare(
    `INSERT INTO notes (id, title, content, created_at, updated_at, is_trashed, is_pinned, word_count)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?)`
  ).run(id, title, content, timestamp, timestamp, wc);

  syncNoteTags(id, allTags);

  return {
    id,
    title,
    content,
    created_at: timestamp,
    updated_at: timestamp,
    is_trashed: 0,
    is_pinned: 0,
    word_count: wc,
    file_path: null,
    sync_hash: null,
    tags: allTags,
  };
}

export function getNote(id: string): NoteWithTags | null {
  const row = db.prepare("SELECT * FROM notes WHERE id = ?").get(id) as
    | NoteRow
    | undefined;

  if (!row) return null;

  return { ...row, tags: getTagsForNote(id) };
}

export function getNoteByTitle(
  title: string,
  fuzzy = false
): NoteWithTags[] {
  let rows: NoteRow[];
  if (fuzzy) {
    rows = db
      .prepare("SELECT * FROM notes WHERE title LIKE ? AND is_trashed = 0")
      .all(`%${title}%`) as NoteRow[];
  } else {
    rows = db
      .prepare("SELECT * FROM notes WHERE title = ? AND is_trashed = 0")
      .all(title) as NoteRow[];
  }

  return rows.map((row) => ({ ...row, tags: getTagsForNote(row.id) }));
}

export function updateNote(
  id: string,
  title?: string,
  content?: string,
  tags?: string[]
): NoteWithTags | null {
  const existing = db.prepare("SELECT * FROM notes WHERE id = ?").get(id) as
    | NoteRow
    | undefined;

  if (!existing) return null;

  const newTitle = title ?? existing.title;
  const newContent = content ?? existing.content;
  const wc = content !== undefined ? wordCount(newContent) : existing.word_count;
  const timestamp = now();

  db.prepare(
    `UPDATE notes SET title = ?, content = ?, updated_at = ?, word_count = ? WHERE id = ?`
  ).run(newTitle, newContent, timestamp, wc, id);

  if (tags !== undefined) {
    syncNoteTags(id, tags);
  } else if (content !== undefined) {
    syncNoteTags(id, extractTags(newContent));
  }

  return getNote(id);
}

export function deleteNote(
  id: string,
  permanent = false
): { success: boolean; message: string } {
  const existing = db.prepare("SELECT id FROM notes WHERE id = ?").get(id) as
    | { id: string }
    | undefined;

  if (!existing) {
    return { success: false, message: `Note with id '${id}' not found` };
  }

  if (permanent) {
    db.prepare("DELETE FROM notes WHERE id = ?").run(id);
    return { success: true, message: `Note '${id}' permanently deleted` };
  } else {
    db.prepare(
      "UPDATE notes SET is_trashed = 1, updated_at = ? WHERE id = ?"
    ).run(now(), id);
    return { success: true, message: `Note '${id}' moved to trash` };
  }
}

export function listNotes(
  tag?: string,
  limit = 20,
  offset = 0
): Array<{
  id: string;
  title: string;
  preview: string;
  updated_at: string;
  tags: string[];
}> {
  let rows: NoteRow[];

  if (tag) {
    rows = db
      .prepare(
        `SELECT n.* FROM notes n
         JOIN note_tags nt ON nt.note_id = n.id
         JOIN tags t ON t.id = nt.tag_id
         WHERE t.name = ? AND n.is_trashed = 0
         ORDER BY n.updated_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(tag, limit, offset) as NoteRow[];
  } else {
    rows = db
      .prepare(
        `SELECT * FROM notes
         WHERE is_trashed = 0
         ORDER BY updated_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset) as NoteRow[];
  }

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    preview: row.content.slice(0, 200),
    updated_at: row.updated_at,
    tags: getTagsForNote(row.id),
  }));
}

export function searchNotes(
  query: string,
  limit = 20,
  offset = 0
): Array<{
  id: string;
  title: string;
  preview: string;
  updated_at: string;
  tags: string[];
}> {
  const ftsRows = db
    .prepare(
      `SELECT rowid,
              highlight(notes_fts, 0, '<b>', '</b>') as title_hl,
              highlight(notes_fts, 1, '<b>', '</b>') as content_hl
       FROM notes_fts
       WHERE notes_fts MATCH ?
       LIMIT ? OFFSET ?`
    )
    .all(query, limit, offset) as Array<{
    rowid: number;
    title_hl: string;
    content_hl: string;
  }>;

  return ftsRows.map((fts) => {
    const note = db
      .prepare("SELECT * FROM notes WHERE rowid = ?")
      .get(fts.rowid) as NoteRow;

    return {
      id: note.id,
      title: note.title,
      preview: fts.content_hl.slice(0, 200),
      updated_at: note.updated_at,
      tags: getTagsForNote(note.id),
    };
  });
}

export function listTags(): Array<{ name: string; note_count: number }> {
  const rows = db
    .prepare("SELECT name, note_count FROM tags WHERE note_count > 0 ORDER BY name")
    .all() as Array<{ name: string; note_count: number }>;
  return rows;
}
