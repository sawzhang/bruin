import { getNoteByTitle } from "../db/queries.js";

export const getNoteByTitleTool = {
  name: "get_note_by_title" as const,
  description: "Find a note by title (exact or fuzzy match)",
  inputSchema: {
    type: "object" as const,
    properties: {
      title: { type: "string" as const, description: "Title to search for" },
      fuzzy: {
        type: "boolean" as const,
        description: "If true, use fuzzy matching (LIKE %%title%%). Default is exact match.",
      },
    },
    required: ["title"],
  },
  handler(args: { title: string; fuzzy?: boolean }) {
    const notes = getNoteByTitle(args.title, args.fuzzy ?? false);
    if (notes.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: `No notes found with title ${args.fuzzy ? "matching" : "equal to"} '${args.title}'`,
            }),
          },
        ],
        isError: true,
      };
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(notes, null, 2) }],
    };
  },
};
