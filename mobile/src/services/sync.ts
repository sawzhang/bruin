import type { Note, NoteState, SyncAction } from "@/types";
import type { SQLiteDatabase } from "expo-sqlite";
import { parseFrontmatter, serializeFrontmatter } from "@/services/frontmatter";
import {
  getICloudNotesDir,
  listICloudFiles,
  readICloudFile,
  writeICloudFile,
} from "@/services/icloud";
import { getNote, syncTags } from "@/services/database";
import { countWords } from "@/services/markdown";
import { extractTags } from "@/services/markdown";
import { computeSyncHash } from "@/utils/hash";

// ─── Reconciler ────────────────────────────────────────────────────────────────

/**
 * Compare a database note and a file note to determine the sync action.
 * Exact port of the Rust reconciler logic.
 *
 * - No DB note -> "import"
 * - Hashes match -> "skip"
 * - DB has no hash -> "export"
 * - File has no hash -> "import"
 * - Both different -> last-write-wins via updated_at comparison
 */
export function reconcile(
  dbNote: Note | null,
  fileNote: Note
): SyncAction {
  if (dbNote === null) {
    return "import";
  }

  const dbHash = dbNote.sync_hash;
  const fileHash = fileNote.sync_hash;

  if (dbHash && fileHash && dbHash === fileHash) {
    return "skip";
  }

  if (!dbHash) {
    return "export";
  }

  if (!fileHash) {
    return "import";
  }

  // Both have different hashes - last-write-wins
  if (dbNote.updated_at >= fileNote.updated_at) {
    return "export";
  } else {
    return "import";
  }
}

// ─── Import / Export ───────────────────────────────────────────────────────────

/**
 * Import a note into the database via UPSERT.
 * On conflict, preserves DB-only fields (state, workspace_id, is_trashed, created_at).
 * Then syncs tags. Matches the Rust import_note_to_db implementation.
 */
export async function importNoteToDb(
  db: SQLiteDatabase,
  note: Note
): Promise<void> {
  const hash = await computeSyncHash(note.title, note.content);

  db.runSync(
    `INSERT INTO notes (id, title, content, created_at, updated_at, is_trashed, is_pinned, word_count, sync_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       content = excluded.content,
       updated_at = excluded.updated_at,
       is_pinned = excluded.is_pinned,
       word_count = excluded.word_count,
       sync_hash = excluded.sync_hash`,
    [
      note.id,
      note.title,
      note.content,
      note.created_at,
      note.updated_at,
      note.is_trashed ? 1 : 0,
      note.is_pinned ? 1 : 0,
      note.word_count,
      hash,
    ]
  );

  syncTags(db, note.id, note.tags);
}

/**
 * Export a note from the database to an iCloud .md file.
 * Serializes as frontmatter + content and writes to iCloud directory.
 */
async function exportNoteToFile(note: Note): Promise<void> {
  const content = serializeFrontmatter(note);
  const filename = `${note.id}.md`;
  await writeICloudFile(filename, content);
}

/**
 * Update the sync_hash for a note in the database.
 */
function updateSyncHash(db: SQLiteDatabase, id: string, hash: string): void {
  db.runSync("UPDATE notes SET sync_hash = ? WHERE id = ?", [hash, id]);
}

// ─── File parsing ──────────────────────────────────────────────────────────────

/**
 * Parse an iCloud .md file into a Note object.
 * Matches the Rust import_file behavior: parse frontmatter, extract tags if none, compute word count.
 */
function parseFileToNote(
  filename: string,
  raw: string
): Note {
  const { frontmatter: fm, body } = parseFrontmatter(raw);

  const now = new Date().toISOString();
  const wordCount = countWords(body);

  // If frontmatter has no tags, extract from body content
  const tags = fm.tags.length > 0 ? fm.tags : extractTags(body);

  // Generate ID from filename if not in frontmatter (filename is "uuid.md")
  const idFromFilename = filename.endsWith(".md")
    ? filename.slice(0, -3)
    : filename;

  return {
    id: fm.id ?? idFromFilename,
    title: fm.title ?? "",
    content: body,
    created_at: fm.created_at ?? now,
    updated_at: fm.updated_at ?? now,
    is_trashed: false,
    is_pinned: fm.is_pinned,
    word_count: wordCount,
    file_path: getICloudNotesDir() + filename,
    sync_hash: null, // Will be computed during reconciliation
    tags,
    state: "draft" as NoteState,
    workspace_id: null,
  };
}

// ─── Full Reconcile ────────────────────────────────────────────────────────────

export interface ReconcileResult {
  filesSynced: number;
  importedNoteIds: string[];
}

/**
 * Run full reconciliation between the local database and iCloud files.
 *
 * 1. Read all iCloud .md files, parse, compute hash, reconcile with DB
 * 2. Import or export as determined by reconcile()
 * 3. Export any DB notes not present in iCloud
 *
 * Returns count of files synced and IDs of imported notes.
 */
export async function fullReconcile(
  db: SQLiteDatabase
): Promise<ReconcileResult> {
  let filesSynced = 0;
  const importedNoteIds: string[] = [];
  const syncedIds = new Set<string>();

  // Phase 1: Process each iCloud file
  const filenames = await listICloudFiles();

  for (const filename of filenames) {
    try {
      const raw = await readICloudFile(filename);
      const fileNote = parseFileToNote(filename, raw);

      // Compute sync hash for the file note
      fileNote.sync_hash = await computeSyncHash(
        fileNote.title,
        fileNote.content
      );
      syncedIds.add(fileNote.id);

      // Fetch corresponding DB note
      const dbNote = getNote(db, fileNote.id);
      const action = reconcile(dbNote, fileNote);

      switch (action) {
        case "import": {
          await importNoteToDb(db, fileNote);
          importedNoteIds.push(fileNote.id);
          filesSynced++;
          break;
        }
        case "export": {
          if (dbNote) {
            await exportNoteToFile(dbNote);
            const hash = await computeSyncHash(dbNote.title, dbNote.content);
            updateSyncHash(db, dbNote.id, hash);
            filesSynced++;
          }
          break;
        }
        case "skip":
          break;
        case "conflict":
          // reconcile() resolves conflicts to export or import via last-write-wins,
          // so this branch should not be reached
          break;
      }
    } catch (e) {
      console.warn(`Failed to process iCloud file ${filename}:`, e);
    }
  }

  // Phase 2: Export DB notes that don't have corresponding iCloud files
  const allDbNotes = db.getAllSync<{
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
  }>(
    `SELECT id, title, content, created_at, updated_at, is_trashed, is_pinned,
            word_count, file_path, sync_hash, state, workspace_id
     FROM notes WHERE is_trashed = 0`
  );

  for (const row of allDbNotes) {
    if (!syncedIds.has(row.id)) {
      try {
        const note: Note = {
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
          tags: [],
        };

        // Fetch tags for the note
        const tagRows = db.getAllSync<{ name: string }>(
          "SELECT t.name FROM tags t JOIN note_tags nt ON t.id = nt.tag_id WHERE nt.note_id = ? ORDER BY t.name",
          [row.id]
        );
        note.tags = tagRows.map((t) => t.name);

        await exportNoteToFile(note);
        const hash = await computeSyncHash(note.title, note.content);
        updateSyncHash(db, note.id, hash);
        filesSynced++;
      } catch (e) {
        console.warn(`Failed to export note ${row.id} to iCloud:`, e);
      }
    }
  }

  return { filesSynced, importedNoteIds };
}
