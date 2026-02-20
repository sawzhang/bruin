import { appendToNote } from "../db/queries.js";

export const appendToNoteTool = {
  name: "append_to_note" as const,
  description: "Append content to an existing note without replacing its current content",
  inputSchema: {
    type: "object" as const,
    properties: {
      note_id: { type: "string" as const, description: "The UUID of the note to append to" },
      content: { type: "string" as const, description: "Content to append to the note" },
      separator: {
        type: "string" as const,
        description: "Separator between existing and new content (default: two newlines)",
      },
    },
    required: ["note_id", "content"],
  },
  handler(args: { note_id: string; content: string; separator?: string }) {
    const note = appendToNote(args.note_id, args.content, args.separator);
    if (!note) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: `Note '${args.note_id}' not found` }),
          },
        ],
        isError: true,
      };
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(note, null, 2) }],
    };
  },
};
