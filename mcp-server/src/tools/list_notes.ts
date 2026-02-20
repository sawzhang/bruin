import { listNotes } from "../db/queries.js";

export const listNotesTool = {
  name: "list_notes" as const,
  description: "List notes with optional tag filter and pagination",
  inputSchema: {
    type: "object" as const,
    properties: {
      tag: { type: "string" as const, description: "Filter by tag name (optional)" },
      limit: { type: "number" as const, description: "Max notes to return (default 20)" },
      offset: { type: "number" as const, description: "Pagination offset (default 0)" },
    },
  },
  handler(args: { tag?: string; limit?: number; offset?: number }) {
    const notes = listNotes(args.tag, args.limit ?? 20, args.offset ?? 0);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(notes, null, 2) }],
    };
  },
};
