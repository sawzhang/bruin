import { batchCreateNotes } from "../db/queries.js";

export const batchCreateNotesTool = {
  name: "batch_create_notes" as const,
  description: "Create multiple notes atomically in a single transaction",
  inputSchema: {
    type: "object" as const,
    properties: {
      notes: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            title: { type: "string" as const, description: "Title of the note" },
            content: { type: "string" as const, description: "Markdown content of the note" },
            tags: {
              type: "array" as const,
              items: { type: "string" as const },
              description: "Optional tags. If omitted, tags are extracted from #hashtags in the content.",
            },
          },
          required: ["title", "content"],
        },
        description: "Array of notes to create",
      },
    },
    required: ["notes"],
  },
  handler(args: { notes: Array<{ title: string; content: string; tags?: string[] }> }) {
    const notes = batchCreateNotes(args.notes);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { created: notes.length, notes: notes.map((n) => ({ id: n.id, title: n.title, tags: n.tags })) },
            null,
            2
          ),
        },
      ],
    };
  },
};
