import { searchNotes } from "../db/queries.js";

export const searchNotesTool = {
  name: "search_notes" as const,
  description: "Full-text search across all notes",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: { type: "string" as const, description: "Search query (FTS5 syntax supported)" },
      limit: { type: "number" as const, description: "Max results to return (default 20)" },
    },
    required: ["query"],
  },
  handler(args: { query: string; limit?: number }) {
    const results = searchNotes(args.query, args.limit ?? 20);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
    };
  },
};
