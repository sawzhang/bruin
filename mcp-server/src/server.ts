import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createNote, getNote, getNoteByTitle, updateNote, deleteNote, listNotes, searchNotes, listTags } from "./db/queries.js";

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

  return server;
}
