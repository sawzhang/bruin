import { updateNote } from "../db/queries.js";

export const updateNoteTool = {
  name: "update_note" as const,
  description: "Update an existing note",
  inputSchema: {
    type: "object" as const,
    properties: {
      id: { type: "string" as const, description: "The UUID of the note to update" },
      title: { type: "string" as const, description: "New title (optional)" },
      content: { type: "string" as const, description: "New markdown content (optional)" },
      tags: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "New tags (optional). If omitted and content is updated, tags are re-extracted from content.",
      },
    },
    required: ["id"],
  },
  handler(args: { id: string; title?: string; content?: string; tags?: string[] }) {
    const note = updateNote(args.id, args.title, args.content, args.tags);
    if (!note) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: `Note '${args.id}' not found` }) }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(note, null, 2) }],
    };
  },
};
