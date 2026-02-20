import { deleteNote } from "../db/queries.js";

export const deleteNoteTool = {
  name: "delete_note" as const,
  description: "Delete a note (soft delete to trash, or permanent)",
  inputSchema: {
    type: "object" as const,
    properties: {
      id: { type: "string" as const, description: "The UUID of the note to delete" },
      permanent: {
        type: "boolean" as const,
        description: "If true, permanently delete the note. If false (default), move to trash.",
      },
    },
    required: ["id"],
  },
  handler(args: { id: string; permanent?: boolean }) {
    const result = deleteNote(args.id, args.permanent ?? false);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      isError: !result.success,
    };
  },
};
