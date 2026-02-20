import { getDailyNote } from "../db/queries.js";

export const getDailyNoteTool = {
  name: "get_daily_note" as const,
  description: "Get or create today's daily note (or for a specific date). Used as an agent journal.",
  inputSchema: {
    type: "object" as const,
    properties: {
      date: {
        type: "string" as const,
        description: "Date in YYYY-MM-DD format. Defaults to today if omitted.",
      },
    },
    required: [],
  },
  handler(args: { date?: string }) {
    const note = getDailyNote(args.date);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(note, null, 2) }],
    };
  },
};
