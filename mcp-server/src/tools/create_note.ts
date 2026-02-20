import { createNote } from "../db/queries.js";

export const createNoteTool = {
  name: "create_note" as const,
  description: "Create a new note in Bruin",
  inputSchema: {
    type: "object" as const,
    properties: {
      title: { type: "string" as const, description: "Title of the note" },
      content: { type: "string" as const, description: "Markdown content of the note" },
      tags: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "Optional tags for the note (e.g. ['project', 'ideas/draft']). If omitted, tags are extracted from #hashtags in the content.",
      },
    },
    required: ["title", "content"],
  },
  handler(args: { title: string; content: string; tags?: string[] }) {
    const note = createNote(args.title, args.content, args.tags);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { id: note.id, title: note.title, created_at: note.created_at, tags: note.tags },
            null,
            2
          ),
        },
      ],
    };
  },
};
