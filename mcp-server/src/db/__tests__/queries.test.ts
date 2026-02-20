import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";

// Create in-memory database for testing
let testDb: Database.Database;

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
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
      sync_hash TEXT,
      state TEXT NOT NULL DEFAULT 'draft'
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

    CREATE TABLE IF NOT EXISTS activity_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT NOT NULL DEFAULT 'user',
      event_type TEXT NOT NULL,
      note_id TEXT,
      timestamp TEXT NOT NULL,
      summary TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}'
    );

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

  return db;
}

// Mock the connection module to use in-memory db
vi.mock("../connection.js", () => {
  return { default: null };
});

// We need to set the mock db before importing queries
beforeEach(async () => {
  testDb = createTestDb();
  const connectionMock = await import("../connection.js");
  (connectionMock as { default: Database.Database }).default = testDb;
});

// Dynamic import to work with mocks
async function getQueries() {
  // Reset module cache to pick up new db
  vi.resetModules();
  vi.doMock("../connection.js", () => ({ default: testDb }));
  return import("../queries.js");
}

describe("extractTags", () => {
  it("extracts simple hashtags", async () => {
    const { extractTags } = await getQueries();
    expect(extractTags("Hello #world")).toEqual(["world"]);
  });

  it("extracts nested tags", async () => {
    const { extractTags } = await getQueries();
    expect(extractTags("Check #twitter/summary")).toEqual(["twitter/summary"]);
  });

  it("extracts multiple tags", async () => {
    const { extractTags } = await getQueries();
    const tags = extractTags("Hello #tag1 and #tag2 and #tag1");
    expect(tags).toEqual(["tag1", "tag2"]); // deduplicated
  });

  it("returns empty for no tags", async () => {
    const { extractTags } = await getQueries();
    expect(extractTags("Hello world")).toEqual([]);
  });
});

describe("createNote", () => {
  it("creates a note with auto-generated id", async () => {
    const { createNote } = await getQueries();
    const note = createNote("Test Title", "Test content");
    expect(note.id).toBeDefined();
    expect(note.title).toBe("Test Title");
    expect(note.content).toBe("Test content");
    expect(note.is_trashed).toBe(0);
    expect(note.is_pinned).toBe(0);
    expect(note.word_count).toBe(2);
  });

  it("extracts tags from content when not provided", async () => {
    const { createNote } = await getQueries();
    const note = createNote("Tagged Note", "Hello #world #test");
    expect(note.tags).toContain("world");
    expect(note.tags).toContain("test");
  });

  it("uses explicit tags when provided", async () => {
    const { createNote } = await getQueries();
    const note = createNote("Note", "Content with #inline", ["explicit"]);
    expect(note.tags).toEqual(["explicit"]);
  });
});

describe("getNote", () => {
  it("returns note by id", async () => {
    const { createNote, getNote } = await getQueries();
    const created = createNote("Test", "Content");
    const fetched = getNote(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.title).toBe("Test");
  });

  it("returns null for non-existent id", async () => {
    const { getNote } = await getQueries();
    expect(getNote("nonexistent")).toBeNull();
  });
});

describe("updateNote", () => {
  it("updates title and content", async () => {
    const { createNote, updateNote } = await getQueries();
    const note = createNote("Old Title", "Old content");
    const updated = updateNote(note.id, "New Title", "New content here");
    expect(updated!.title).toBe("New Title");
    expect(updated!.content).toBe("New content here");
    expect(updated!.word_count).toBe(3);
  });

  it("updates only title when content not provided", async () => {
    const { createNote, updateNote } = await getQueries();
    const note = createNote("Old", "Keep this content");
    const updated = updateNote(note.id, "New");
    expect(updated!.title).toBe("New");
    expect(updated!.content).toBe("Keep this content");
  });

  it("returns null for non-existent note", async () => {
    const { updateNote } = await getQueries();
    expect(updateNote("bad-id", "Title")).toBeNull();
  });

  it("re-syncs tags when content changes", async () => {
    const { createNote, updateNote } = await getQueries();
    const note = createNote("Note", "Hello #old");
    expect(note.tags).toContain("old");
    const updated = updateNote(note.id, undefined, "Hello #new");
    expect(updated!.tags).toContain("new");
    expect(updated!.tags).not.toContain("old");
  });
});

describe("deleteNote", () => {
  it("soft deletes by default", async () => {
    const { createNote, deleteNote, getNote } = await getQueries();
    const note = createNote("To Delete", "Content");
    const result = deleteNote(note.id);
    expect(result.success).toBe(true);
    const fetched = getNote(note.id);
    expect(fetched!.is_trashed).toBe(1);
  });

  it("permanently deletes when requested", async () => {
    const { createNote, deleteNote, getNote } = await getQueries();
    const note = createNote("To Delete", "Content");
    const result = deleteNote(note.id, true);
    expect(result.success).toBe(true);
    expect(getNote(note.id)).toBeNull();
  });

  it("returns failure for non-existent note", async () => {
    const { deleteNote } = await getQueries();
    const result = deleteNote("bad-id");
    expect(result.success).toBe(false);
  });
});

describe("listNotes", () => {
  it("lists notes ordered by updated_at descending", async () => {
    const { createNote, updateNote, listNotes } = await getQueries();
    const first = createNote("First", "Content 1");
    const second = createNote("Second", "Content 2");
    // Force different timestamps so ordering is deterministic
    testDb.prepare("UPDATE notes SET updated_at = '2026-01-01T00:00:00Z' WHERE id = ?").run(first.id);
    testDb.prepare("UPDATE notes SET updated_at = '2026-01-02T00:00:00Z' WHERE id = ?").run(second.id);
    const notes = listNotes();
    expect(notes.length).toBe(2);
    expect(notes[0].title).toBe("Second");
  });

  it("filters by tag", async () => {
    const { createNote, listNotes } = await getQueries();
    createNote("Tagged", "Content #important");
    createNote("Untagged", "Content plain");
    const notes = listNotes("important");
    expect(notes.length).toBe(1);
    expect(notes[0].title).toBe("Tagged");
  });

  it("excludes trashed notes", async () => {
    const { createNote, deleteNote, listNotes } = await getQueries();
    createNote("Active", "Content");
    const trashed = createNote("Trashed", "Content");
    deleteNote(trashed.id);
    const notes = listNotes();
    expect(notes.length).toBe(1);
    expect(notes[0].title).toBe("Active");
  });

  it("respects limit and offset", async () => {
    const { createNote, listNotes } = await getQueries();
    for (let i = 0; i < 5; i++) {
      createNote(`Note ${i}`, `Content ${i}`);
    }
    const page = listNotes(undefined, 2, 2);
    expect(page.length).toBe(2);
  });
});

describe("searchNotes", () => {
  it("finds notes by content", async () => {
    const { createNote, searchNotes } = await getQueries();
    createNote("Apple", "This is about JavaScript");
    createNote("Banana", "This is about Python");
    const results = searchNotes("JavaScript");
    expect(results.length).toBe(1);
    expect(results[0].title).toBe("Apple");
  });

  it("finds notes by title", async () => {
    const { createNote, searchNotes } = await getQueries();
    createNote("React Tutorial", "Some content");
    createNote("Vue Guide", "Other content");
    const results = searchNotes("React");
    expect(results.length).toBe(1);
  });
});

describe("getNoteByTitle", () => {
  it("finds exact match", async () => {
    const { createNote, getNoteByTitle } = await getQueries();
    createNote("Exact Title", "Content");
    const results = getNoteByTitle("Exact Title");
    expect(results.length).toBe(1);
  });

  it("finds fuzzy match", async () => {
    const { createNote, getNoteByTitle } = await getQueries();
    createNote("My Long Title", "Content");
    const results = getNoteByTitle("Long", true);
    expect(results.length).toBe(1);
  });
});

describe("listTags", () => {
  it("lists tags with counts", async () => {
    const { createNote, listTags } = await getQueries();
    createNote("A", "Hello #js #react");
    createNote("B", "Hello #js");
    const tags = listTags();
    const jsTag = tags.find((t) => t.name === "js");
    expect(jsTag).toBeDefined();
    expect(jsTag!.note_count).toBe(2);
  });
});

describe("batchCreateNotes", () => {
  it("creates multiple notes atomically", async () => {
    const { batchCreateNotes, listNotes } = await getQueries();
    const notes = batchCreateNotes([
      { title: "Note A", content: "Content A" },
      { title: "Note B", content: "Content B #tag" },
      { title: "Note C", content: "Content C", tags: ["explicit"] },
    ]);
    expect(notes.length).toBe(3);
    expect(listNotes().length).toBe(3);
  });
});

describe("appendToNote", () => {
  it("appends content with default separator", async () => {
    const { createNote, appendToNote } = await getQueries();
    const note = createNote("Note", "First part");
    const updated = appendToNote(note.id, "Second part");
    expect(updated!.content).toBe("First part\n\nSecond part");
  });

  it("appends with custom separator", async () => {
    const { createNote, appendToNote } = await getQueries();
    const note = createNote("Note", "Item 1");
    const updated = appendToNote(note.id, "Item 2", "\n- ");
    expect(updated!.content).toBe("Item 1\n- Item 2");
  });

  it("returns null for non-existent note", async () => {
    const { appendToNote } = await getQueries();
    expect(appendToNote("bad-id", "Content")).toBeNull();
  });

  it("updates tags from appended content", async () => {
    const { createNote, appendToNote } = await getQueries();
    const note = createNote("Note", "Hello");
    const updated = appendToNote(note.id, "New #topic");
    expect(updated!.tags).toContain("topic");
  });
});

describe("getBacklinks", () => {
  it("finds notes linking to a target", async () => {
    const { createNote, getBacklinks } = await getQueries();
    createNote("Target", "I am the target");
    createNote("Linker", "See also [[Target]] for more info");
    createNote("NoLink", "Nothing here");
    const backlinks = getBacklinks("Target");
    expect(backlinks.length).toBe(1);
    expect(backlinks[0].title).toBe("Linker");
  });

  it("returns empty for no backlinks", async () => {
    const { createNote, getBacklinks } = await getQueries();
    createNote("Lonely", "No one links to me");
    expect(getBacklinks("Lonely")).toEqual([]);
  });
});

describe("getDailyNote", () => {
  it("creates a new daily note for given date", async () => {
    const { getDailyNote } = await getQueries();
    const note = getDailyNote("2026-01-15");
    expect(note.title).toBe("2026-01-15");
    expect(note.tags).toContain("daily");
  });

  it("returns existing daily note (idempotent)", async () => {
    const { getDailyNote } = await getQueries();
    const first = getDailyNote("2026-01-15");
    const second = getDailyNote("2026-01-15");
    expect(first.id).toBe(second.id);
  });
});

// --- Phase 1: State Machine Tests ---

describe("setNoteState", () => {
  it("transitions draft to review", async () => {
    const { createNote, setNoteState } = await getQueries();
    const note = createNote("Note", "Content");
    expect(note.state).toBe("draft");
    const updated = setNoteState(note.id, "review");
    expect(updated!.state).toBe("review");
  });

  it("transitions review to published", async () => {
    const { createNote, setNoteState } = await getQueries();
    const note = createNote("Note", "Content");
    setNoteState(note.id, "review");
    const published = setNoteState(note.id, "published");
    expect(published!.state).toBe("published");
  });

  it("rejects invalid transitions", async () => {
    const { createNote, setNoteState } = await getQueries();
    const note = createNote("Note", "Content");
    // draft → published is not valid
    expect(() => setNoteState(note.id, "published")).toThrow();
  });

  it("returns null for non-existent note", async () => {
    const { setNoteState } = await getQueries();
    expect(setNoteState("bad-id", "review")).toBeNull();
  });

  it("defaults to draft state on create", async () => {
    const { createNote } = await getQueries();
    const note = createNote("Note", "Content");
    expect(note.state).toBe("draft");
  });
});

// --- Phase 2: Activity Feed Tests ---

describe("activityFeed", () => {
  it("logs activity from mutations", async () => {
    const { createNote, getActivityFeed } = await getQueries();
    createNote("Test", "Content");
    const events = getActivityFeed();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].event_type).toBe("note_created");
    expect(events[0].actor).toBe("agent");
  });

  it("filters by note_id", async () => {
    const { createNote, getActivityFeed } = await getQueries();
    const note1 = createNote("A", "Content A");
    createNote("B", "Content B");
    const events = getActivityFeed(50, note1.id);
    expect(events.every((e: { note_id: string }) => e.note_id === note1.id)).toBe(true);
  });
});

// --- Phase 3: Templates Tests ---

describe("templates", () => {
  it("lists templates (initially empty in test)", async () => {
    const { listTemplates } = await getQueries();
    const templates = listTemplates();
    expect(Array.isArray(templates)).toBe(true);
  });

  it("creates note from template with variable expansion", async () => {
    const { createNoteFromTemplate, getNote } = await getQueries();
    // Insert a template manually
    testDb.prepare(
      "INSERT INTO templates (id, name, description, content, tags, initial_state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run("tpl-1", "Test Template", "desc", "# {{title}}\n\nDate: {{date}}", '["test"]', "review", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z");

    const note = createNoteFromTemplate("tpl-1", "My Note");
    expect(note.title).toBe("My Note");
    expect(note.content).toContain("# My Note");
    expect(note.content).toContain("Date: ");
    expect(note.state).toBe("review");
    expect(note.tags).toContain("test");
  });

  it("throws for non-existent template", async () => {
    const { createNoteFromTemplate } = await getQueries();
    expect(() => createNoteFromTemplate("bad-id")).toThrow();
  });
});

// --- Phase 5: Webhook Tests ---

describe("webhooks", () => {
  it("registers and lists webhooks", async () => {
    const { registerWebhook, listWebhooks } = await getQueries();
    const wh = registerWebhook("https://example.com/hook", ["note_created"], "secret123");
    expect(wh.url).toBe("https://example.com/hook");
    expect(wh.event_types).toEqual(["note_created"]);
    expect(wh.is_active).toBe(true);

    const all = listWebhooks();
    expect(all.length).toBe(1);
    expect(all[0].id).toBe(wh.id);
  });

  it("deletes webhooks", async () => {
    const { registerWebhook, deleteWebhook, listWebhooks } = await getQueries();
    const wh = registerWebhook("https://example.com/hook", [], "secret");
    const result = deleteWebhook(wh.id);
    expect(result.success).toBe(true);
    expect(listWebhooks().length).toBe(0);
  });

  it("returns failure for non-existent webhook", async () => {
    const { deleteWebhook } = await getQueries();
    const result = deleteWebhook("bad-id");
    expect(result.success).toBe(false);
  });
});

describe("advancedQuery", () => {
  it("filters by pinned status", async () => {
    const { createNote, advancedQuery } = await getQueries();
    const note = createNote("Pinned", "Content");
    // Pin the note directly
    testDb.prepare("UPDATE notes SET is_pinned = 1 WHERE id = ?").run(note.id);
    createNote("Not Pinned", "Content");

    const results = advancedQuery({ is_pinned: true });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe("Pinned");
  });

  it("filters by min word count", async () => {
    const { createNote, advancedQuery } = await getQueries();
    createNote("Short", "Hi");
    createNote("Long", "This is a longer note with many words in it");

    const results = advancedQuery({ min_word_count: 5 });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe("Long");
  });

  it("filters by tags with OR mode", async () => {
    const { createNote, advancedQuery } = await getQueries();
    createNote("A", "Content #js");
    createNote("B", "Content #python");
    createNote("C", "Content #rust");

    const results = advancedQuery({ tags: ["js", "python"], tag_mode: "or" });
    expect(results.length).toBe(2);
  });

  it("filters by tags with AND mode", async () => {
    const { createNote, advancedQuery } = await getQueries();
    createNote("Both", "Content #js #react");
    createNote("OnlyJS", "Content #js");

    const results = advancedQuery({ tags: ["js", "react"], tag_mode: "and" });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe("Both");
  });

  it("combines multiple filters", async () => {
    const { createNote, advancedQuery } = await getQueries();
    const match = createNote("Match", "A longer note about development work #js");
    createNote("NoTag", "A longer note about plain development work");
    createNote("Short", "Hi #js");

    // Verify data is correct
    expect(match.word_count).toBe(7);
    expect(match.tags).toContain("js");

    // Test tag filter alone
    const tagOnly = advancedQuery({ tags: ["js"] });
    expect(tagOnly.length).toBe(2); // Match + Short

    // Test word count filter alone
    const wcOnly = advancedQuery({ min_word_count: 3 });
    expect(wcOnly.length).toBe(2); // Match + NoTag

    // Test combined — should only return Match
    const combined = advancedQuery({ tags: ["js"], min_word_count: 3 });
    expect(combined.length).toBe(1);
    expect(combined[0].title).toBe("Match");
  });
});
