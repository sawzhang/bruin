import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createNote, getNote, getNoteByTitle, updateNote, deleteNote, listNotes, searchNotes, listTags, batchCreateNotes, appendToNote, getBacklinks, getDailyNote, advancedQuery, importMarkdownFiles } from "./db/queries.js";

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function error(message: string) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true as const };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "bruin-notes",
    version: "0.1.0",
  });

  server.tool(
    "create_note",
    "Create a new note in Bruin",
    {
      title: z.string().describe("Title of the note"),
      content: z.string().describe("Markdown content of the note"),
      tags: z.array(z.string()).optional().describe("Optional tags. If omitted, tags are extracted from #hashtags in the content."),
    },
    async (args) => {
      const note = createNote(args.title, args.content, args.tags);
      return text({ id: note.id, title: note.title, created_at: note.created_at, tags: note.tags });
    }
  );

  server.tool(
    "read_note",
    "Read a note by ID",
    {
      id: z.string().describe("The UUID of the note"),
    },
    async (args) => {
      const note = getNote(args.id);
      if (!note) return error(`Note '${args.id}' not found`);
      return text(note);
    }
  );

  server.tool(
    "update_note",
    "Update an existing note",
    {
      id: z.string().describe("The UUID of the note to update"),
      title: z.string().optional().describe("New title"),
      content: z.string().optional().describe("New markdown content"),
      tags: z.array(z.string()).optional().describe("New tags. If omitted and content is updated, tags are re-extracted from content."),
    },
    async (args) => {
      const note = updateNote(args.id, args.title, args.content, args.tags);
      if (!note) return error(`Note '${args.id}' not found`);
      return text(note);
    }
  );

  server.tool(
    "delete_note",
    "Delete a note (soft delete to trash, or permanent)",
    {
      id: z.string().describe("The UUID of the note to delete"),
      permanent: z.boolean().optional().describe("If true, permanently delete. Default is soft delete to trash."),
    },
    async (args) => {
      const result = deleteNote(args.id, args.permanent ?? false);
      if (!result.success) return error(result.message);
      return text(result);
    }
  );

  server.tool(
    "list_notes",
    "List notes with optional tag filter and pagination",
    {
      tag: z.string().optional().describe("Filter by tag name"),
      limit: z.number().optional().describe("Max notes to return (default 20)"),
      offset: z.number().optional().describe("Pagination offset (default 0)"),
    },
    async (args) => {
      const notes = listNotes(args.tag, args.limit ?? 20, args.offset ?? 0);
      return text(notes);
    }
  );

  server.tool(
    "search_notes",
    "Full-text search across all notes",
    {
      query: z.string().describe("Search query (FTS5 syntax supported)"),
      limit: z.number().optional().describe("Max results to return (default 20)"),
    },
    async (args) => {
      const results = searchNotes(args.query, args.limit ?? 20);
      return text(results);
    }
  );

  server.tool(
    "list_tags",
    "List all tags with their note counts",
    {},
    async () => {
      const tags = listTags();
      return text(tags);
    }
  );

  server.tool(
    "get_note_by_title",
    "Find a note by title (exact or fuzzy match)",
    {
      title: z.string().describe("Title to search for"),
      fuzzy: z.boolean().optional().describe("If true, use fuzzy matching (LIKE %title%). Default is exact match."),
    },
    async (args) => {
      const notes = getNoteByTitle(args.title, args.fuzzy ?? false);
      if (notes.length === 0) {
        return error(`No notes found with title ${args.fuzzy ? "matching" : "equal to"} '${args.title}'`);
      }
      return text(notes);
    }
  );

  server.tool(
    "batch_create_notes",
    "Create multiple notes atomically in a single transaction",
    {
      notes: z.array(
        z.object({
          title: z.string().describe("Title of the note"),
          content: z.string().describe("Markdown content of the note"),
          tags: z.array(z.string()).optional().describe("Optional tags. If omitted, tags are extracted from #hashtags in the content."),
        })
      ).describe("Array of notes to create"),
    },
    async (args) => {
      const notes = batchCreateNotes(args.notes);
      return text({ created: notes.length, notes: notes.map((n) => ({ id: n.id, title: n.title, tags: n.tags })) });
    }
  );

  server.tool(
    "append_to_note",
    "Append content to an existing note without replacing its current content",
    {
      note_id: z.string().describe("The UUID of the note to append to"),
      content: z.string().describe("Content to append to the note"),
      separator: z.string().optional().describe("Separator between existing and new content (default: two newlines)"),
    },
    async (args) => {
      const note = appendToNote(args.note_id, args.content, args.separator);
      if (!note) return error(`Note '${args.note_id}' not found`);
      return text(note);
    }
  );

  server.tool(
    "get_backlinks",
    "Find all notes that reference a given note via [[wiki-link]] syntax",
    {
      note_title: z.string().describe("The title of the note to find backlinks for"),
    },
    async (args) => {
      const backlinks = getBacklinks(args.note_title);
      return text({ note_title: args.note_title, backlink_count: backlinks.length, backlinks });
    }
  );

  server.tool(
    "get_daily_note",
    "Get or create today's daily note (or for a specific date). Used as an agent journal.",
    {
      date: z.string().optional().describe("Date in YYYY-MM-DD format. Defaults to today if omitted."),
    },
    async (args) => {
      const note = getDailyNote(args.date);
      return text(note);
    }
  );

  server.tool(
    "advanced_query",
    "Query notes with structured filters: date range, tags (AND/OR), pinned status, word count range, and full-text search",
    {
      date_from: z.string().optional().describe("Filter notes updated on or after this ISO date (e.g. 2026-01-01)"),
      date_to: z.string().optional().describe("Filter notes updated on or before this ISO date"),
      tags: z.array(z.string()).optional().describe("Filter by tag names"),
      tag_mode: z.enum(["and", "or"]).optional().describe("How to combine tags: 'and' (must have all) or 'or' (must have any). Default: 'or'"),
      is_pinned: z.boolean().optional().describe("Filter by pinned status"),
      min_word_count: z.number().optional().describe("Minimum word count"),
      max_word_count: z.number().optional().describe("Maximum word count"),
      search_text: z.string().optional().describe("Full-text search query (FTS5 syntax)"),
      limit: z.number().optional().describe("Max results (default 50)"),
      offset: z.number().optional().describe("Pagination offset (default 0)"),
    },
    async (args) => {
      const results = advancedQuery(args);
      return text({ count: results.length, results });
    }
  );

  server.tool(
    "import_markdown",
    "Import markdown files (e.g. Bear exports) into Bruin. Accepts file paths and/or directory paths containing .md files.",
    {
      paths: z.array(z.string()).describe("Array of file or directory paths containing .md files to import"),
    },
    async (args) => {
      const result = importMarkdownFiles(args.paths);
      return text(result);
    }
  );

  return server;
}
