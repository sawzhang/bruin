import { listTags } from "../db/queries.js";

export const listTagsTool = {
  name: "list_tags" as const,
  description: "List all tags with their note counts",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
  handler() {
    const tags = listTags();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(tags, null, 2) }],
    };
  },
};
