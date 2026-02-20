import { advancedQuery, AdvancedQueryFilters } from "../db/queries.js";

export const advancedQueryTool = {
  name: "advanced_query" as const,
  description:
    "Query notes with structured filters: date range, tags (AND/OR), pinned status, word count range, and full-text search",
  inputSchema: {
    type: "object" as const,
    properties: {
      date_from: { type: "string" as const, description: "Filter notes updated on or after this ISO date (e.g. 2026-01-01)" },
      date_to: { type: "string" as const, description: "Filter notes updated on or before this ISO date" },
      tags: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "Filter by tag names",
      },
      tag_mode: {
        type: "string" as const,
        description: "How to combine tags: 'and' (must have all) or 'or' (must have any). Default: 'or'",
      },
      is_pinned: { type: "boolean" as const, description: "Filter by pinned status" },
      min_word_count: { type: "number" as const, description: "Minimum word count" },
      max_word_count: { type: "number" as const, description: "Maximum word count" },
      search_text: { type: "string" as const, description: "Full-text search query (FTS5 syntax)" },
      limit: { type: "number" as const, description: "Max results (default 50)" },
      offset: { type: "number" as const, description: "Pagination offset (default 0)" },
    },
    required: [],
  },
  handler(args: AdvancedQueryFilters) {
    const results = advancedQuery(args);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ count: results.length, results }, null, 2),
        },
      ],
    };
  },
};
