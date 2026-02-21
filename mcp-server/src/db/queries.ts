import { v4 as uuidv4 } from "uuid";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import db from "./connection.js";

const TAG_REGEX = /#([a-zA-Z0-9_]+(?:\/[a-zA-Z0-9_]+)*)/g;

/// Notify the Tauri app that the MCP server has written to the database.
/// Writes a timestamp to a trigger file that the Tauri file watcher monitors.
function notifyTauri(): void {
  try {
    const triggerDir = path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "com.bruin.app"
    );
    fs.mkdirSync(triggerDir, { recursive: true });
    const triggerFile = path.join(triggerDir, ".bruin-sync-trigger");
    fs.writeFileSync(triggerFile, new Date().toISOString());
  } catch {
    // Non-fatal: Tauri may not be running
  }
}

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
  state: string;
  workspace_id: string | null;
}

// --- Workspace types ---

export interface WorkspaceRow {
  id: string;
  name: string;
  description: string;
  agent_id: string | null;
  created_at: string;
  updated_at: string;
}

// Current workspace state for MCP server
let currentWorkspaceId: string | null = null;

export function setCurrentWorkspace(workspaceId: string | null): void {
  currentWorkspaceId = workspaceId;
}

export function getCurrentWorkspace(): string | null {
  return currentWorkspaceId;
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

export interface ActivityEventRow {
  id: number;
  actor: string;
  event_type: string;
  note_id: string | null;
  timestamp: string;
  summary: string;
  data: string;
}

function now(): string {
  return new Date().toISOString();
}

export function logActivity(
  actor: string,
  eventType: string,
  noteId: string | null,
  summary: string,
  data: string = "{}"
): void {
  db.prepare(
    "INSERT INTO activity_events (actor, event_type, note_id, timestamp, summary, data) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(actor, eventType, noteId, now(), summary, data);
  // Fire webhooks asynchronously
  fireWebhooks(eventType, noteId, summary).catch(() => {});
}

export function getActivityFeed(
  limit = 50,
  noteId?: string
): ActivityEventRow[] {
  if (noteId) {
    return db
      .prepare(
        "SELECT * FROM activity_events WHERE note_id = ? ORDER BY timestamp DESC LIMIT ?"
      )
      .all(noteId, limit) as ActivityEventRow[];
  }
  return db
    .prepare(
      "SELECT * FROM activity_events ORDER BY timestamp DESC LIMIT ?"
    )
    .all(limit) as ActivityEventRow[];
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

// --- Workspace CRUD ---

export function createWorkspace(
  name: string,
  description = "",
  agentId?: string
): WorkspaceRow {
  const id = uuidv4();
  const timestamp = now();
  db.prepare(
    "INSERT INTO workspaces (id, name, description, agent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, name, description, agentId ?? null, timestamp, timestamp);
  logActivity("agent", "workspace_created", null, `Created workspace '${name}'`);
  return { id, name, description, agent_id: agentId ?? null, created_at: timestamp, updated_at: timestamp };
}

export function listWorkspaces(): WorkspaceRow[] {
  return db.prepare("SELECT * FROM workspaces ORDER BY name").all() as WorkspaceRow[];
}

export function deleteWorkspace(id: string): { success: boolean; message: string } {
  const existing = db.prepare("SELECT id FROM workspaces WHERE id = ?").get(id);
  if (!existing) {
    return { success: false, message: `Workspace '${id}' not found` };
  }
  db.prepare("DELETE FROM workspaces WHERE id = ?").run(id);
  logActivity("agent", "workspace_deleted", null, `Deleted workspace '${id}'`);
  return { success: true, message: `Workspace '${id}' deleted` };
}

// --- Notes ---

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
    `INSERT INTO notes (id, title, content, created_at, updated_at, is_trashed, is_pinned, word_count, workspace_id)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`
  ).run(id, title, content, timestamp, timestamp, wc, currentWorkspaceId);

  syncNoteTags(id, allTags);
  syncNoteLinks(id, content);

  logActivity("agent", "note_created", id, `Created note '${title}'`);
  notifyTauri();

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
    state: "draft",
    workspace_id: currentWorkspaceId,
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

  if (content !== undefined) {
    syncNoteLinks(id, newContent);
  }

  logActivity("agent", "note_updated", id, `Updated note '${newTitle}'`);
  notifyTauri();

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
    logActivity("agent", "note_deleted", id, `Permanently deleted note '${id}'`);
    db.prepare("DELETE FROM notes WHERE id = ?").run(id);
    notifyTauri();
    return { success: true, message: `Note '${id}' permanently deleted` };
  } else {
    db.prepare(
      "UPDATE notes SET is_trashed = 1, updated_at = ? WHERE id = ?"
    ).run(now(), id);
    logActivity("agent", "note_trashed", id, `Moved note '${id}' to trash`);
    notifyTauri();
    return { success: true, message: `Note '${id}' moved to trash` };
  }
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["review"],
  review: ["published", "draft"],
  published: ["review"],
};

export function setNoteState(
  id: string,
  state: string
): NoteWithTags | null {
  const existing = db.prepare("SELECT * FROM notes WHERE id = ?").get(id) as
    | NoteRow
    | undefined;

  if (!existing) return null;

  const allowed = VALID_TRANSITIONS[existing.state] ?? [];
  if (!allowed.includes(state)) {
    throw new Error(
      `Invalid state transition: '${existing.state}' → '${state}'`
    );
  }

  db.prepare(
    "UPDATE notes SET state = ?, updated_at = ? WHERE id = ?"
  ).run(state, now(), id);

  logActivity("agent", "state_changed", id, `Changed state '${existing.state}' → '${state}'`);
  notifyTauri();

  return getNote(id);
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
  const wsFilter = currentWorkspaceId !== null;
  const wsClause = wsFilter ? "AND n.workspace_id = ?" : "";

  if (tag) {
    const sql = `SELECT n.* FROM notes n
         JOIN note_tags nt ON nt.note_id = n.id
         JOIN tags t ON t.id = nt.tag_id
         WHERE t.name = ? AND n.is_trashed = 0 ${wsClause}
         ORDER BY n.updated_at DESC
         LIMIT ? OFFSET ?`;
    const params = wsFilter
      ? [tag, currentWorkspaceId, limit, offset]
      : [tag, limit, offset];
    rows = db.prepare(sql).all(...params) as NoteRow[];
  } else {
    const sql = `SELECT n.* FROM notes n
         WHERE n.is_trashed = 0 ${wsClause}
         ORDER BY n.updated_at DESC
         LIMIT ? OFFSET ?`;
    const params = wsFilter
      ? [currentWorkspaceId, limit, offset]
      : [limit, offset];
    rows = db.prepare(sql).all(...params) as NoteRow[];
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
  const wsFilter = currentWorkspaceId !== null;
  const wsClause = wsFilter ? "AND n.workspace_id = ?" : "";

  const sql = `SELECT fts.rowid,
              highlight(notes_fts, 0, '<b>', '</b>') as title_hl,
              highlight(notes_fts, 1, '<b>', '</b>') as content_hl
       FROM notes_fts fts
       JOIN notes n ON n.rowid = fts.rowid
       WHERE notes_fts MATCH ? ${wsClause}
       LIMIT ? OFFSET ?`;

  const params = wsFilter
    ? [query, currentWorkspaceId, limit, offset]
    : [query, limit, offset];

  const ftsRows = db.prepare(sql).all(...params) as Array<{
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

export function batchCreateNotes(
  notes: Array<{ title: string; content: string; tags?: string[] }>
): NoteWithTags[] {
  const results: NoteWithTags[] = [];
  const transaction = db.transaction(() => {
    for (const note of notes) {
      results.push(createNote(note.title, note.content, note.tags));
    }
  });
  transaction();
  return results;
}

export function appendToNote(
  noteId: string,
  content: string,
  separator = "\n\n"
): NoteWithTags | null {
  const existing = db.prepare("SELECT * FROM notes WHERE id = ?").get(noteId) as
    | NoteRow
    | undefined;

  if (!existing) return null;

  const newContent = existing.content + separator + content;
  const wc = wordCount(newContent);
  const timestamp = now();

  db.prepare(
    `UPDATE notes SET content = ?, updated_at = ?, word_count = ? WHERE id = ?`
  ).run(newContent, timestamp, wc, noteId);

  syncNoteTags(noteId, extractTags(newContent));

  logActivity("agent", "note_updated", noteId, `Appended to note '${existing.title}'`);
  notifyTauri();

  return getNote(noteId);
}

export function getBacklinks(
  noteTitle: string
): Array<{ id: string; title: string; preview: string; updated_at: string; tags: string[] }> {
  const pattern = `%[[${noteTitle}]]%`;
  const rows = db
    .prepare(
      `SELECT * FROM notes WHERE content LIKE ? AND is_trashed = 0`
    )
    .all(pattern) as NoteRow[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    preview: row.content.slice(0, 200),
    updated_at: row.updated_at,
    tags: getTagsForNote(row.id),
  }));
}

export function getDailyNote(date?: string): NoteWithTags {
  const targetDate = date ?? new Date().toISOString().split("T")[0];
  const title = targetDate;

  const existing = db
    .prepare("SELECT * FROM notes WHERE title = ? AND is_trashed = 0")
    .all(title) as NoteRow[];

  if (existing.length > 0) {
    return { ...existing[0], tags: getTagsForNote(existing[0].id) };
  }

  const content = `# ${targetDate}\n\n`;
  return createNote(title, content, ["daily"]);
}

export function importMarkdownFiles(
  paths: string[]
): { imported: number; skipped: number } {
  let imported = 0;
  let skipped = 0;

  const transaction = db.transaction(() => {
    for (const filePath of paths) {
      try {
        const stat = fs.statSync(filePath);
        const mdFiles: string[] = [];

        if (stat.isDirectory()) {
          const entries = fs.readdirSync(filePath);
          for (const entry of entries) {
            if (entry.endsWith(".md")) {
              mdFiles.push(path.join(filePath, entry));
            }
          }
        } else if (filePath.endsWith(".md")) {
          mdFiles.push(filePath);
        }

        for (const mdFile of mdFiles) {
          try {
            const content = fs.readFileSync(mdFile, "utf-8");
            const title = path.basename(mdFile, ".md");
            const tags = extractTags(content);
            createNote(title, content, tags);
            imported++;
          } catch {
            skipped++;
          }
        }
      } catch {
        skipped++;
      }
    }
  });

  transaction();
  if (imported > 0) {
    notifyTauri();
  }
  return { imported, skipped };
}

// --- Templates ---

export interface TemplateRow {
  id: string;
  name: string;
  description: string;
  content: string;
  tags: string; // JSON array
  initial_state: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateWithTags {
  id: string;
  name: string;
  description: string;
  content: string;
  tags: string[];
  initial_state: string;
  created_at: string;
  updated_at: string;
}

function parseTemplate(row: TemplateRow): TemplateWithTags {
  return {
    ...row,
    tags: JSON.parse(row.tags || "[]"),
  };
}

export function listTemplates(): TemplateWithTags[] {
  const rows = db
    .prepare("SELECT * FROM templates ORDER BY name")
    .all() as TemplateRow[];
  return rows.map(parseTemplate);
}

export function createNoteFromTemplate(
  templateId: string,
  title?: string
): NoteWithTags {
  const row = db
    .prepare("SELECT * FROM templates WHERE id = ?")
    .get(templateId) as TemplateRow | undefined;

  if (!row) throw new Error(`Template '${templateId}' not found`);

  const template = parseTemplate(row);
  const noteTitle = title ?? template.name;
  const dateStr = new Date().toISOString().split("T")[0];

  const content = template.content
    .replace(/\{\{date\}\}/g, dateStr)
    .replace(/\{\{title\}\}/g, noteTitle);

  // Merge template tags with inline tags
  const inlineTags = extractTags(content);
  const allTags = [...new Set([...template.tags, ...inlineTags])];

  const id = uuidv4();
  const timestamp = now();
  const wc = wordCount(content);

  db.prepare(
    `INSERT INTO notes (id, title, content, created_at, updated_at, is_trashed, is_pinned, word_count, state)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`
  ).run(id, noteTitle, content, timestamp, timestamp, wc, template.initial_state);

  syncNoteTags(id, allTags);

  logActivity("agent", "note_created", id, `Created note '${noteTitle}' from template '${template.name}'`);
  notifyTauri();

  return getNote(id)!;
}

// --- Webhooks ---

export interface WebhookRow {
  id: string;
  url: string;
  event_types: string; // JSON array
  secret: string;
  is_active: number;
  created_at: string;
  last_triggered_at: string | null;
  failure_count: number;
}

export interface WebhookWithTypes {
  id: string;
  url: string;
  event_types: string[];
  secret: string;
  is_active: boolean;
  created_at: string;
  last_triggered_at: string | null;
  failure_count: number;
}

function parseWebhook(row: WebhookRow): WebhookWithTypes {
  return {
    ...row,
    event_types: JSON.parse(row.event_types || "[]"),
    is_active: row.is_active !== 0,
  };
}

export function registerWebhook(
  url: string,
  eventTypes: string[],
  secret: string
): WebhookWithTypes {
  const id = uuidv4();
  const timestamp = now();
  const eventTypesJson = JSON.stringify(eventTypes);

  db.prepare(
    "INSERT INTO webhooks (id, url, event_types, secret, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, url, eventTypesJson, secret, timestamp);

  return {
    id,
    url,
    event_types: eventTypes,
    secret,
    is_active: true,
    created_at: timestamp,
    last_triggered_at: null,
    failure_count: 0,
  };
}

export function listWebhooks(): WebhookWithTypes[] {
  const rows = db
    .prepare("SELECT * FROM webhooks ORDER BY created_at DESC")
    .all() as WebhookRow[];
  return rows.map(parseWebhook);
}

export function deleteWebhook(id: string): { success: boolean; message: string } {
  const existing = db.prepare("SELECT id FROM webhooks WHERE id = ?").get(id);
  if (!existing) {
    return { success: false, message: `Webhook '${id}' not found` };
  }
  db.prepare("DELETE FROM webhooks WHERE id = ?").run(id);
  return { success: true, message: `Webhook '${id}' deleted` };
}

export async function fireWebhooks(
  eventType: string,
  noteId: string | null,
  summary: string
): Promise<void> {
  const rows = db
    .prepare("SELECT * FROM webhooks WHERE is_active = 1")
    .all() as WebhookRow[];

  for (const row of rows) {
    const eventTypes: string[] = JSON.parse(row.event_types || "[]");
    if (eventTypes.length > 0 && !eventTypes.includes(eventType)) {
      continue;
    }

    const payload = JSON.stringify({
      event_type: eventType,
      note_id: noteId,
      summary,
      timestamp: now(),
    });

    // Compute HMAC-SHA256 signature
    const { createHmac } = await import("crypto");
    const signature = createHmac("sha256", row.secret)
      .update(payload)
      .digest("hex");

    // Fire-and-forget with retries
    (async () => {
      let attempts = 0;
      const maxRetries = 3;
      while (attempts < maxRetries) {
        try {
          const response = await fetch(row.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Webhook-Signature": signature,
            },
            body: payload,
          });
          if (response.ok) {
            db.prepare(
              "UPDATE webhooks SET last_triggered_at = ?, failure_count = 0 WHERE id = ?"
            ).run(now(), row.id);
            return;
          }
        } catch {
          // retry
        }
        attempts++;
        if (attempts < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempts)));
        }
      }
      // All retries failed
      db.prepare(
        "UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = ?"
      ).run(row.id);
    })();
  }
}

export interface AdvancedQueryFilters {
  date_from?: string;
  date_to?: string;
  tags?: string[];
  tag_mode?: "and" | "or";
  is_pinned?: boolean;
  min_word_count?: number;
  max_word_count?: number;
  search_text?: string;
  limit?: number;
  offset?: number;
}

export function advancedQuery(
  filters: AdvancedQueryFilters
): Array<{ id: string; title: string; preview: string; updated_at: string; word_count: number; is_pinned: number; tags: string[] }> {
  const conditions: string[] = ["n.is_trashed = 0"];
  const whereParams: unknown[] = [];
  const joinParams: unknown[] = [];
  const joins: string[] = [];
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  if (filters.date_from) {
    conditions.push("n.updated_at >= ?");
    whereParams.push(filters.date_from);
  }

  if (filters.date_to) {
    conditions.push("n.updated_at <= ?");
    whereParams.push(filters.date_to);
  }

  if (filters.is_pinned !== undefined) {
    conditions.push("n.is_pinned = ?");
    whereParams.push(filters.is_pinned ? 1 : 0);
  }

  if (filters.min_word_count !== undefined) {
    conditions.push("n.word_count >= ?");
    whereParams.push(filters.min_word_count);
  }

  if (filters.max_word_count !== undefined) {
    conditions.push("n.word_count <= ?");
    whereParams.push(filters.max_word_count);
  }

  if (filters.tags && filters.tags.length > 0) {
    const mode = filters.tag_mode ?? "or";
    const placeholders = filters.tags.map(() => "?").join(", ");

    if (mode === "and") {
      joins.push(
        `JOIN note_tags nt_filter ON nt_filter.note_id = n.id
         JOIN tags t_filter ON t_filter.id = nt_filter.tag_id AND t_filter.name IN (${placeholders})`
      );
      joinParams.push(...filters.tags);
      conditions.push("1=1");
    } else {
      joins.push(
        `JOIN note_tags nt_filter ON nt_filter.note_id = n.id
         JOIN tags t_filter ON t_filter.id = nt_filter.tag_id AND t_filter.name IN (${placeholders})`
      );
      joinParams.push(...filters.tags);
    }
  }

  let ftsJoin = "";
  if (filters.search_text) {
    ftsJoin = "JOIN notes_fts fts ON fts.rowid = n.rowid";
    conditions.push("notes_fts MATCH ?");
    whereParams.push(filters.search_text);
  }

  const whereClause = conditions.join(" AND ");
  const joinClause = joins.join("\n");

  let groupByClause = "GROUP BY n.id";
  let havingClause = "";
  const havingParams: unknown[] = [];

  if (filters.tags && filters.tags.length > 0 && (filters.tag_mode ?? "or") === "and") {
    havingClause = `HAVING COUNT(DISTINCT t_filter.name) = ?`;
    havingParams.push(filters.tags.length);
  }

  const sql = `
    SELECT n.*
    FROM notes n
    ${joinClause}
    ${ftsJoin}
    WHERE ${whereClause}
    ${groupByClause}
    ${havingClause}
    ORDER BY n.updated_at DESC
    LIMIT ? OFFSET ?
  `;

  // Params must match SQL positional order: JOIN → WHERE → HAVING → LIMIT/OFFSET
  const params = [...joinParams, ...whereParams, ...havingParams, limit, offset];

  const rows = db.prepare(sql).all(...params) as NoteRow[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    preview: row.content.slice(0, 200),
    updated_at: row.updated_at,
    word_count: row.word_count,
    is_pinned: row.is_pinned,
    tags: getTagsForNote(row.id),
  }));
}

// --- Knowledge Graph ---

const WIKI_LINK_REGEX = /\[\[([^\]]+)\]\]/g;

export function extractWikiLinks(content: string): string[] {
  const links = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(WIKI_LINK_REGEX.source, "g");
  while ((match = re.exec(content)) !== null) {
    links.add(match[1]);
  }
  return Array.from(links);
}

export function syncNoteLinks(noteId: string, content: string): void {
  const timestamp = now();

  // Remove existing links from this source
  db.prepare("DELETE FROM note_links WHERE source_note_id = ?").run(noteId);

  const linkedTitles = extractWikiLinks(content);
  for (const title of linkedTitles) {
    const target = db.prepare(
      "SELECT id FROM notes WHERE title = ? AND is_trashed = 0"
    ).get(title) as { id: string } | undefined;

    if (target && target.id !== noteId) {
      db.prepare(
        "INSERT OR IGNORE INTO note_links (source_note_id, target_note_id, link_type, created_at) VALUES (?, ?, 'wiki_link', ?)"
      ).run(noteId, target.id, timestamp);
    }
  }
}

export function getForwardLinks(
  noteId: string
): Array<{ id: string; title: string; link_type: string }> {
  return db.prepare(
    `SELECT n.id, n.title, nl.link_type
     FROM note_links nl
     JOIN notes n ON n.id = nl.target_note_id
     WHERE nl.source_note_id = ?`
  ).all(noteId) as Array<{ id: string; title: string; link_type: string }>;
}

export function getKnowledgeGraph(
  centerNoteId?: string,
  depth = 2,
  maxNodes = 200
): { nodes: Array<{ id: string; title: string; link_count: number; tags: string[] }>; edges: Array<{ source: string; target: string; link_type: string }> } {
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [];
  const edges: Array<{ source: string; target: string; link_type: string }> = [];

  if (centerNoteId) {
    queue.push({ id: centerNoteId, depth: 0 });
    visited.add(centerNoteId);
  } else {
    // Get all linked note IDs
    const linked = db.prepare(
      "SELECT DISTINCT source_note_id as id FROM note_links UNION SELECT DISTINCT target_note_id as id FROM note_links"
    ).all() as Array<{ id: string }>;
    for (const { id } of linked) {
      if (visited.size < maxNodes) {
        visited.add(id);
        queue.push({ id, depth: 0 });
      }
    }
  }

  // BFS
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= depth) continue;

    // Forward links
    const fwd = db.prepare(
      "SELECT target_note_id, link_type FROM note_links WHERE source_note_id = ?"
    ).all(current.id) as Array<{ target_note_id: string; link_type: string }>;

    for (const { target_note_id, link_type } of fwd) {
      edges.push({ source: current.id, target: target_note_id, link_type });
      if (!visited.has(target_note_id) && visited.size < maxNodes) {
        visited.add(target_note_id);
        queue.push({ id: target_note_id, depth: current.depth + 1 });
      }
    }

    // Backward links
    const bwd = db.prepare(
      "SELECT source_note_id, link_type FROM note_links WHERE target_note_id = ?"
    ).all(current.id) as Array<{ source_note_id: string; link_type: string }>;

    for (const { source_note_id, link_type } of bwd) {
      edges.push({ source: source_note_id, target: current.id, link_type });
      if (!visited.has(source_note_id) && visited.size < maxNodes) {
        visited.add(source_note_id);
        queue.push({ id: source_note_id, depth: current.depth + 1 });
      }
    }
  }

  // Deduplicate edges
  const edgeSet = new Set<string>();
  const uniqueEdges = edges.filter((e) => {
    const key = `${e.source}:${e.target}:${e.link_type}`;
    if (edgeSet.has(key)) return false;
    edgeSet.add(key);
    return true;
  });

  // Count links per node
  const linkCounts = new Map<string, number>();
  for (const e of uniqueEdges) {
    linkCounts.set(e.source, (linkCounts.get(e.source) ?? 0) + 1);
    linkCounts.set(e.target, (linkCounts.get(e.target) ?? 0) + 1);
  }

  // Build nodes
  const nodes = Array.from(visited).map((id) => {
    const note = db.prepare("SELECT title FROM notes WHERE id = ?").get(id) as { title: string } | undefined;
    return {
      id,
      title: note?.title ?? "Unknown",
      link_count: linkCounts.get(id) ?? 0,
      tags: getTagsForNote(id),
    };
  });

  return { nodes, edges: uniqueEdges };
}

// --- Semantic Search ---

export function upsertNoteEmbedding(
  noteId: string,
  embedding: number[],
  model = "all-MiniLM-L6-v2"
): void {
  const timestamp = now();
  db.prepare(
    `INSERT INTO note_embeddings (note_id, embedding, model, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(note_id) DO UPDATE SET embedding = ?, model = ?, updated_at = ?`
  ).run(noteId, JSON.stringify(embedding), model, timestamp, JSON.stringify(embedding), model, timestamp);
}

export function getAllEmbeddings(): Array<{ note_id: string; embedding: number[] }> {
  const rows = db.prepare(
    "SELECT note_id, embedding FROM note_embeddings"
  ).all() as Array<{ note_id: string; embedding: string }>;

  return rows.map((r) => ({
    note_id: r.note_id,
    embedding: JSON.parse(r.embedding),
  }));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

export function semanticSearch(
  queryEmbedding: number[],
  limit = 10,
  minSimilarity = 0.3
): Array<{ id: string; title: string; preview: string; similarity: number; tags: string[] }> {
  const allEmbeddings = getAllEmbeddings();

  const results: Array<{ note_id: string; similarity: number }> = [];
  for (const { note_id, embedding } of allEmbeddings) {
    // Apply workspace filter if set
    if (currentWorkspaceId !== null) {
      const note = db.prepare("SELECT workspace_id FROM notes WHERE id = ?").get(note_id) as { workspace_id: string | null } | undefined;
      if (note && note.workspace_id !== currentWorkspaceId) continue;
    }

    const sim = cosineSimilarity(queryEmbedding, embedding);
    if (sim >= minSimilarity) {
      results.push({ note_id, similarity: sim });
    }
  }

  // Sort by similarity descending
  results.sort((a, b) => b.similarity - a.similarity);

  return results.slice(0, limit).map(({ note_id, similarity }) => {
    const note = db.prepare("SELECT * FROM notes WHERE id = ?").get(note_id) as NoteRow;
    return {
      id: note.id,
      title: note.title,
      preview: note.content.slice(0, 200),
      similarity: Math.round(similarity * 1000) / 1000,
      tags: getTagsForNote(note.id),
    };
  });
}
