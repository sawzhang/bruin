import { getBacklinks } from "../db/queries.js";

export const getBacklinksTool = {
  name: "get_backlinks" as const,
  description: "Find all notes that reference a given note via [[wiki-link]] syntax",
  inputSchema: {
    type: "object" as const,
    properties: {
      note_title: {
        type: "string" as const,
        description: "The title of the note to find backlinks for",
      },
    },
    required: ["note_title"],
  },
  handler(args: { note_title: string }) {
    const backlinks = getBacklinks(args.note_title);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { note_title: args.note_title, backlink_count: backlinks.length, backlinks },
            null,
            2
          ),
        },
      ],
    };
  },
};
