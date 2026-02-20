import { getNote } from "../db/queries.js";

export const readNoteTool = {
  name: "read_note" as const,
  description: "Read a note by ID",
  inputSchema: {
    type: "object" as const,
    properties: {
      id: { type: "string" as const, description: "The UUID of the note" },
    },
    required: ["id"],
  },
  handler(args: { id: string }) {
    const note = getNote(args.id);
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
