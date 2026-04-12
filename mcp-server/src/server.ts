import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateEmbedding } from "./embeddings.js";
import { createNote, getNote, getNoteByTitle, updateNote, deleteNote, setNoteState, listNotes, searchNotes, listTags, batchCreateNotes, appendToNote, getBacklinks, getDailyNote, advancedQuery, importMarkdownFiles, getActivityFeed, listTemplates, createNoteFromTemplate, registerWebhook, listWebhooks, deleteWebhook, createWorkspace, listWorkspaces, deleteWorkspace, setCurrentWorkspace, getCurrentWorkspace, getForwardLinks, getKnowledgeGraph, semanticSearch, upsertNoteEmbedding, getAllEmbeddings, registerAgent, listAgents, getAgent, getAgentAuditLog, setCurrentAgent, getCurrentAgent, createTask, listTasks, updateTask, completeTask, assignTask, listWorkflowTemplates, getWorkflowTemplate, createWorkflowTemplate, executeWorkflow, updateWebhook, testWebhook, getWebhookLogs, bindAgentWorkspace, getAgentWorkspaces, unbindAgentWorkspace, updateAgent, deactivateAgent, deleteWorkflowTemplate, pinNote, restoreNote, getSetting, setSetting, getAllSettings, exportNoteMarkdown, exportNoteHtml, createWikiSource, linkSourceToPages, getWikiSource, listWikiSources, getSourcesForPage, generateWikiIndex, wikiLint } from "./db/queries.js";

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function error(message: string) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true as const };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "bruin-notes",
    version: "0.1.0",
  });

  // --- Phase 4: MCP Resources ---

  // Helper: notify that a specific note changed
  function notifyNoteChanged(noteId: string) {
    try {
      server.server.sendResourceUpdated({ uri: `bruin://notes/${noteId}` });
    } catch { /* not connected yet */ }
  }

  // Helper: notify that the notes list changed (create/delete)
  function notifyNotesListChanged() {
    try {
      server.server.sendResourceUpdated({ uri: "bruin://notes" });
      server.server.sendResourceUpdated({ uri: "bruin://tags" });
    } catch { /* not connected yet */ }
  }

  // Resource: all notes list
  server.resource(
    "notes-list",
    "bruin://notes",
    { description: "List of all notes in Bruin" },
    async () => ({
      contents: [{
        uri: "bruin://notes",
        mimeType: "application/json",
        text: JSON.stringify(listNotes(undefined, 100, 0)),
      }],
    })
  );

  // Resource: individual note (template)
  server.resource(
    "note",
    "bruin://notes/{noteId}",
    { description: "Read a single note by ID" },
    async (uri) => {
      const noteId = uri.pathname.split("/").pop() ?? "";
      const note = getNote(noteId);
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: note ? JSON.stringify(note) : JSON.stringify({ error: "Not found" }),
        }],
      };
    }
  );

  // Resource: tags with counts
  server.resource(
    "tags",
    "bruin://tags",
    { description: "All tags with note counts" },
    async () => ({
      contents: [{
        uri: "bruin://tags",
        mimeType: "application/json",
        text: JSON.stringify(listTags()),
      }],
    })
  );

  // Resource: today's daily note
  server.resource(
    "daily",
    "bruin://daily",
    { description: "Today's daily note" },
    async () => {
      const note = getDailyNote();
      return {
        contents: [{
          uri: "bruin://daily",
          mimeType: "application/json",
          text: JSON.stringify(note),
        }],
      };
    }
  );

  // --- MCP Prompts: reusable agent workflow templates ---

  server.prompt(
    "daily_log",
    "Start or continue today's daily log — get today's note and append a structured entry",
    {
      topic: z.string().optional().describe("Topic or task to log (e.g. 'Twitter research', 'code review', 'meeting notes')"),
      content: z.string().optional().describe("Content to log. If omitted, the prompt asks you to generate it."),
      agent_id: z.string().optional().describe("Agent name for per-agent daily journal (e.g. 'claude-code'). Omit for shared daily note."),
    },
    async (args) => {
      const agentId = args.agent_id ?? getCurrentAgent() ?? undefined;
      const daily = getDailyNote(undefined, agentId);
      const topic = args.topic ?? "Daily Log";
      const contentHint = args.content
        ? `\nContent to append:\n${args.content}`
        : "\nGenerate a structured log entry for this topic.";
      const agentNote = agentId ? ` (agent: ${agentId})` : "";
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Today's daily note${agentNote} (id: ${daily.id}, title: "${daily.title}"):\n\n${daily.content || "(empty)"}\n\nTask: Append a new section titled "## ${topic}" to this daily note.${contentHint}\n\nUse the append_to_note tool with note_id="${daily.id}".`,
          },
        }],
      };
    }
  );

  server.prompt(
    "research_capture",
    "Create a structured research note from a source (URL, text, or topic)",
    {
      topic: z.string().describe("Research topic or title"),
      source: z.string().optional().describe("Source URL or reference"),
      raw_content: z.string().optional().describe("Raw content to structure and save"),
    },
    async (args) => {
      const today = new Date().toISOString().split("T")[0];
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Create a research note in Bruin.\n\nTopic: ${args.topic}\nDate: ${today}${args.source ? `\nSource: ${args.source}` : ""}${args.raw_content ? `\n\nRaw content:\n${args.raw_content}` : ""}\n\nStructure the note as:\n- ## Summary (3-5 bullet points)\n- ## Key Points\n- ## Raw Notes\n- ## References\n\nTags to use: #research, plus topic-specific tags.\n\nUse create_note with an appropriate title like "${args.topic} — ${today}".`,
          },
        }],
      };
    }
  );

  server.prompt(
    "weekly_review",
    "Generate a weekly review by querying this week's notes and summarizing activity",
    {
      week_start: z.string().optional().describe("Week start date (YYYY-MM-DD). Defaults to last Monday."),
    },
    async (args) => {
      const today = new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() - today.getDay() + 1);
      const weekStart = args.week_start ?? monday.toISOString().split("T")[0];
      const weekEnd = today.toISOString().split("T")[0];
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Generate a weekly review for the week of ${weekStart} to ${weekEnd}.\n\nSteps:\n1. Use advanced_query with date_from="${weekStart}" and date_to="${weekEnd}" to get all notes from this week\n2. Use advanced_query with tags=["daily"] to get daily logs\n3. Summarize: what was researched, what was completed, key insights, recurring themes\n4. Create a new note titled "Weekly Review ${weekStart}" with tags: #weekly-review, #review\n5. Include links to the most important notes using [[wiki-link]] syntax`,
          },
        }],
      };
    }
  );

  server.prompt(
    "link_knowledge",
    "Find and create wiki-links between related notes to build the knowledge graph",
    {
      note_id: z.string().optional().describe("Note ID to find connections for. If omitted, searches recent notes."),
    },
    async (args) => {
      let context = "";
      if (args.note_id) {
        const note = getNote(args.note_id);
        if (note) context = `Focus note: "${note.title}" (id: ${note.id})\nContent preview: ${note.content.slice(0, 300)}...`;
      }
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Build knowledge graph connections in Bruin.\n\n${context || "Start with recent notes using list_notes."}\n\nSteps:\n1. Read the target note(s)\n2. Use search_notes or semantic_search to find related notes by concept\n3. Use get_backlinks to see existing connections\n4. Update notes to add [[wiki-links]] where meaningful connections exist\n5. Report: how many links were added and what knowledge clusters emerged`,
          },
        }],
      };
    }
  );

  // --- Wiki Knowledge Base Prompts ---

  server.prompt(
    "wiki_ingest",
    "Ingest raw content into the wiki — decompose a source into structured wiki pages with cross-links",
    {
      title: z.string().describe("Title of the source material"),
      content: z.string().describe("Raw content to decompose into wiki pages"),
      url: z.string().optional().describe("Source URL if applicable"),
    },
    async (args) => {
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Ingest the following source into the Bruin wiki.\n\n## Source\nTitle: ${args.title}\n${args.url ? `URL: ${args.url}\n` : ""}Content:\n${args.content}\n\n## Instructions\n\nFollow these steps:\n\n1. **Register the source**: Call wiki_ingest_source with the title, content${args.url ? ", and URL" : ""}.\n\n2. **Analyze the content**: Identify 5-15 discrete concepts, entities, or topics that deserve their own wiki page. Think about:\n   - Key concepts and definitions\n   - People mentioned\n   - Technologies or tools\n   - Processes or workflows\n   - Relationships between entities\n\n3. **Check existing pages**: For each concept, use get_note_by_title (fuzzy=true) to check if a wiki page already exists. If it does, plan to UPDATE it rather than create a duplicate.\n\n4. **Create new pages**: Use batch_create_notes to create all new wiki pages in one transaction. Each page should:\n   - Have a clear, concise title (the concept name)\n   - Start with a one-line definition/summary\n   - Use [[wiki-links]] to reference other pages (both new and existing)\n   - Include tags: #wiki plus a subtype like #wiki/concept, #wiki/person, #wiki/tool, etc.\n   - Be self-contained but cross-referenced\n\n5. **Update existing pages**: For pages that already exist, use update_note to add new information from this source. Append, don't overwrite.\n\n6. **Link source to pages**: Call wiki_link_source_pages with the source_id and all created/updated note IDs.\n\n7. **Report**: Summarize what was created, updated, and linked.\n\n## Quality guidelines\n- Every page should have at least 2 outgoing [[wiki-links]]\n- Prefer short, focused pages over long ones\n- Use consistent naming: "React" not "React.js" or "ReactJS"\n- Add #wiki/stub tag if a page is minimal and needs expansion later`,
          },
        }],
      };
    }
  );

  server.prompt(
    "wiki_query",
    "Query the wiki knowledge base — search for relevant pages and synthesize an answer",
    {
      question: z.string().describe("The question to answer from the wiki"),
    },
    async (args) => {
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Answer this question using the Bruin wiki: "${args.question}"\n\n## Instructions\n\n1. **Get the wiki index**: Call wiki_get_index to see all available pages.\n\n2. **Semantic search**: Call semantic_search with the question to find the most relevant pages by meaning.\n\n3. **Full-text search**: Call search_notes with key terms from the question for exact matches.\n\n4. **Read relevant pages**: Use read_note to read the top 3-5 most relevant pages. Follow [[wiki-links]] to read connected pages if needed.\n\n5. **Check backlinks**: For key pages, call get_backlinks to find additional context.\n\n6. **Synthesize**: Provide a comprehensive answer that:\n   - Cites specific wiki pages by title using [[Page Title]] syntax\n   - Distinguishes between what the wiki says and what you infer\n   - Notes if the wiki lacks information on any aspect of the question\n   - Suggests which pages might need updating based on the question`,
          },
        }],
      };
    }
  );

  server.prompt(
    "wiki_lint_and_fix",
    "Run a health check on the wiki and fix problems — find orphans, missing pages, broken links, and stale content",
    {},
    async () => {
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Run a health check on the Bruin wiki and fix any problems found.\n\n## Instructions\n\n1. **Run lint**: Call wiki_lint to get the health report.\n\n2. **Fix orphan pages**: For each orphan page (no links in or out):\n   - Read the page content\n   - Use semantic_search to find related pages\n   - Update the orphan to add [[wiki-links]] to related pages\n   - Update related pages to link back if appropriate\n\n3. **Create missing pages**: For each missing page (referenced but doesn't exist):\n   - Read the pages that reference it to understand the expected content\n   - Create a stub page with tag #wiki/stub and [[wiki-links]] back to the referencing pages\n   - Include a note that this page needs expansion\n\n4. **Review stale pages**: For each stale page (not updated in 30+ days):\n   - Read the page\n   - Check if the information appears outdated\n   - Flag for review (add #wiki/needs-review tag) if content may be stale\n\n5. **Report**: Summarize all fixes made:\n   - Orphans connected: N\n   - Stubs created: N\n   - Stale pages flagged: N\n   - Links added: N`,
          },
        }],
      };
    }
  );

  server.tool(
    "create_note",
    "Create a new note in Bruin. Embeddings are auto-generated in the background so the note is immediately available via semantic_search.",
    {
      title: z.string().describe("Title of the note"),
      content: z.string().describe("Markdown content of the note"),
      tags: z.array(z.string()).optional().describe("Optional tags. If omitted, tags are extracted from #hashtags in the content."),
    },
    async (args) => {
      const note = createNote(args.title, args.content, args.tags);
      notifyNotesListChanged();
      // Auto-index embedding in the background (non-blocking)
      generateEmbedding(`${note.title}\n\n${note.content}`)
        .then((emb) => upsertNoteEmbedding(note.id, emb))
        .catch(() => { /* non-fatal: reindex_embeddings can catch up */ });
      return text({ id: note.id, title: note.title, created_at: note.created_at, tags: note.tags });
    }
  );

  server.tool(
    "read_note",
    "Read a note by ID",
    {
      note_id: z.string().describe("The UUID of the note"),
    },
    async (args) => {
      const note = getNote(args.note_id);
      if (!note) return error(`Note '${args.note_id}' not found`);
      return text(note);
    }
  );

  server.tool(
    "update_note",
    "Update an existing note. Pass expected_updated_at (from the note you read) to enable optimistic locking and prevent concurrent overwrites.",
    {
      note_id: z.string().describe("The UUID of the note to update"),
      title: z.string().optional().describe("New title"),
      content: z.string().optional().describe("New markdown content"),
      tags: z.array(z.string()).optional().describe("New tags. If omitted and content is updated, tags are re-extracted from content."),
      expected_updated_at: z.string().optional().describe("ISO timestamp from the note you last read. If set and the note was updated by another writer since then, the update is rejected with a conflict error. Recommended for safe concurrent access."),
    },
    async (args) => {
      try {
        const note = updateNote(args.note_id, args.title, args.content, args.tags, args.expected_updated_at);
        if (!note) return error(`Note '${args.note_id}' not found`);
        notifyNoteChanged(args.note_id);
        // Re-index embedding in background when content changes
        if (args.content !== undefined || args.title !== undefined) {
          generateEmbedding(`${note.title}\n\n${note.content}`)
            .then((emb) => upsertNoteEmbedding(note.id, emb))
            .catch(() => { /* non-fatal */ });
        }
        return text(note);
      } catch (e: unknown) {
        return error((e as Error).message);
      }
    }
  );

  server.tool(
    "delete_note",
    "Delete a note (soft delete to trash, or permanent)",
    {
      note_id: z.string().describe("The UUID of the note to delete"),
      permanent: z.boolean().optional().describe("If true, permanently delete. Default is soft delete to trash."),
    },
    async (args) => {
      const result = deleteNote(args.note_id, args.permanent ?? false);
      if (!result.success) return error(result.message);
      notifyNotesListChanged();
      return text(result);
    }
  );

  server.tool(
    "get_activity_feed",
    "Get the activity feed — a log of all mutations (creates, updates, deletes, state changes). Optionally filter by note.",
    {
      limit: z.number().optional().describe("Max events to return (default 50)"),
      note_id: z.string().optional().describe("Filter by a specific note ID"),
    },
    async (args) => {
      const events = getActivityFeed(args.limit ?? 50, args.note_id);
      return text(events);
    }
  );

  server.tool(
    "set_note_state",
    "Transition a note's workflow state. Valid transitions: draft→review, review→published, review→draft, published→review.",
    {
      note_id: z.string().describe("The UUID of the note"),
      state: z.enum(["draft", "review", "published"]).describe("Target state"),
    },
    async (args) => {
      try {
        const note = setNoteState(args.note_id, args.state);
        if (!note) return error(`Note '${args.note_id}' not found`);
        notifyNoteChanged(args.note_id);
        return text(note);
      } catch (e: unknown) {
        return error((e as Error).message);
      }
    }
  );

  server.tool(
    "list_notes",
    "List notes with optional tag filter and pagination",
    {
      tag: z.string().optional().describe("Filter by tag name"),
      limit: z.number().optional().describe("Max notes to return (default 20)"),
      offset: z.number().optional().describe("Pagination offset (default 0)"),
    },
    async (args) => {
      const notes = listNotes(args.tag, args.limit ?? 20, args.offset ?? 0);
      return text(notes);
    }
  );

  server.tool(
    "search_notes",
    "Full-text search across all notes",
    {
      query: z.string().describe("Search query (FTS5 syntax supported)"),
      limit: z.number().optional().describe("Max results to return (default 20)"),
    },
    async (args) => {
      const results = searchNotes(args.query, args.limit ?? 20);
      return text(results);
    }
  );

  server.tool(
    "list_tags",
    "List all tags with their note counts",
    {},
    async () => {
      const tags = listTags();
      return text(tags);
    }
  );

  server.tool(
    "get_note_by_title",
    "Find a note by title (exact or fuzzy match)",
    {
      title: z.string().describe("Title to search for"),
      fuzzy: z.boolean().optional().describe("If true, use fuzzy matching (LIKE %title%). Default is exact match."),
    },
    async (args) => {
      const notes = getNoteByTitle(args.title, args.fuzzy ?? false);
      if (notes.length === 0) {
        return error(`No notes found with title ${args.fuzzy ? "matching" : "equal to"} '${args.title}'`);
      }
      return text(notes);
    }
  );

  server.tool(
    "batch_create_notes",
    "Create multiple notes atomically in a single transaction",
    {
      notes: z.array(
        z.object({
          title: z.string().describe("Title of the note"),
          content: z.string().describe("Markdown content of the note"),
          tags: z.array(z.string()).optional().describe("Optional tags. If omitted, tags are extracted from #hashtags in the content."),
        })
      ).describe("Array of notes to create"),
    },
    async (args) => {
      const notes = batchCreateNotes(args.notes);
      notifyNotesListChanged();
      return text({ created: notes.length, notes: notes.map((n) => ({ id: n.id, title: n.title, tags: n.tags })) });
    }
  );

  server.tool(
    "append_to_note",
    "Append content to an existing note without replacing its current content",
    {
      note_id: z.string().describe("The UUID of the note to append to"),
      content: z.string().describe("Content to append to the note"),
      separator: z.string().optional().describe("Separator between existing and new content (default: two newlines)"),
    },
    async (args) => {
      const note = appendToNote(args.note_id, args.content, args.separator);
      if (!note) return error(`Note '${args.note_id}' not found`);
      notifyNoteChanged(args.note_id);
      return text(note);
    }
  );

  server.tool(
    "get_backlinks",
    "Find all notes that reference a given note via [[wiki-link]] syntax",
    {
      note_title: z.string().describe("The title of the note to find backlinks for"),
    },
    async (args) => {
      const backlinks = getBacklinks(args.note_title);
      return text({ note_title: args.note_title, backlink_count: backlinks.length, backlinks });
    }
  );

  server.tool(
    "get_daily_note",
    "Get or create today's daily note (or for a specific date). Supports per-agent isolation so each agent has its own daily journal.",
    {
      date: z.string().optional().describe("Date in YYYY-MM-DD format. Defaults to today if omitted."),
      agent_id: z.string().optional().describe("Agent name or ID for per-agent daily notes. If set, each agent gets its own journal (e.g. 'claude-code'). Omit for a shared daily note."),
    },
    async (args) => {
      const note = getDailyNote(args.date, args.agent_id);
      return text(note);
    }
  );

  server.tool(
    "advanced_query",
    "Query notes with structured filters: date range, tags (AND/OR), pinned status, word count range, and full-text search",
    {
      date_from: z.string().optional().describe("Filter notes updated on or after this ISO date (e.g. 2026-01-01)"),
      date_to: z.string().optional().describe("Filter notes updated on or before this ISO date"),
      tags: z.array(z.string()).optional().describe("Filter by tag names"),
      tag_mode: z.enum(["and", "or"]).optional().describe("How to combine tags: 'and' (must have all) or 'or' (must have any). Default: 'or'"),
      is_pinned: z.boolean().optional().describe("Filter by pinned status"),
      min_word_count: z.number().optional().describe("Minimum word count"),
      max_word_count: z.number().optional().describe("Maximum word count"),
      search_text: z.string().optional().describe("Full-text search query (FTS5 syntax)"),
      limit: z.number().optional().describe("Max results (default 50)"),
      offset: z.number().optional().describe("Pagination offset (default 0)"),
    },
    async (args) => {
      const results = advancedQuery(args);
      return text({ count: results.length, results });
    }
  );

  server.tool(
    "import_markdown",
    "Import markdown files (e.g. Bear exports) into Bruin. Accepts file paths and/or directory paths containing .md files.",
    {
      paths: z.array(z.string()).describe("Array of file or directory paths containing .md files to import"),
    },
    async (args) => {
      const result = importMarkdownFiles(args.paths);
      notifyNotesListChanged();
      return text(result);
    }
  );

  server.tool(
    "register_webhook",
    "Register a webhook to receive notifications when events occur. The webhook will receive a POST with JSON body and X-Webhook-Signature header (HMAC-SHA256).",
    {
      url: z.string().describe("The URL to send webhook POST requests to"),
      event_types: z.array(z.string()).optional().describe("Event types to subscribe to (e.g. 'note_created', 'note_updated', 'state_changed'). Empty = all events."),
      secret: z.string().describe("Secret key for HMAC-SHA256 signature verification"),
    },
    async (args) => {
      const webhook = registerWebhook(args.url, args.event_types ?? [], args.secret);
      return text(webhook);
    }
  );

  server.tool(
    "list_webhooks",
    "List all registered webhooks",
    {},
    async () => {
      const webhooks = listWebhooks();
      return text(webhooks);
    }
  );

  server.tool(
    "delete_webhook",
    "Delete a webhook by ID",
    {
      webhook_id: z.string().describe("The UUID of the webhook to delete"),
    },
    async (args) => {
      const result = deleteWebhook(args.webhook_id);
      if (!result.success) return error(result.message);
      return text(result);
    }
  );

  server.tool(
    "list_templates",
    "List all available note templates",
    {},
    async () => {
      const templates = listTemplates();
      return text(templates);
    }
  );

  server.tool(
    "create_from_template",
    "Create a new note from a template. Variables like {{date}} and {{title}} are expanded automatically.",
    {
      template_id: z.string().describe("The UUID of the template to use"),
      title: z.string().optional().describe("Title for the new note. Defaults to the template name."),
    },
    async (args) => {
      try {
        const note = createNoteFromTemplate(args.template_id, args.title);
        notifyNotesListChanged();
        return text(note);
      } catch (e: unknown) {
        return error((e as Error).message);
      }
    }
  );

  // --- Phase 1: Workspace Tools ---

  server.tool(
    "create_workspace",
    "Create a new workspace for organizing notes by agent or project",
    {
      name: z.string().describe("Unique workspace name"),
      description: z.string().optional().describe("Description of the workspace"),
      agent_id: z.string().optional().describe("Optional agent ID that owns this workspace"),
    },
    async (args) => {
      try {
        const workspace = createWorkspace(args.name, args.description, args.agent_id);
        return text(workspace);
      } catch (e: unknown) {
        return error((e as Error).message);
      }
    }
  );

  server.tool(
    "list_workspaces",
    "List all workspaces",
    {},
    async () => {
      const workspaces = listWorkspaces();
      return text(workspaces);
    }
  );

  server.tool(
    "switch_workspace",
    "Switch the current workspace context. All subsequent note operations will be scoped to this workspace. Pass null to clear workspace filter.",
    {
      workspace_id: z.string().nullable().describe("Workspace ID to switch to, or null to clear"),
    },
    async (args) => {
      setCurrentWorkspace(args.workspace_id);
      return text({ current_workspace_id: args.workspace_id, message: args.workspace_id ? `Switched to workspace '${args.workspace_id}'` : "Cleared workspace filter" });
    }
  );

  server.tool(
    "get_current_workspace",
    "Get the currently active workspace ID",
    {},
    async () => {
      return text({ current_workspace_id: getCurrentWorkspace() });
    }
  );

  // --- Phase 2: Knowledge Graph Tools ---

  server.tool(
    "get_knowledge_graph",
    "Get the knowledge graph of note connections via [[wiki-links]]. Returns nodes and edges for visualization.",
    {
      center_note_id: z.string().optional().describe("Note ID to center the graph on. If omitted, returns all linked notes."),
      depth: z.number().optional().describe("BFS traversal depth from center note (default 2)"),
      max_nodes: z.number().optional().describe("Maximum number of nodes to return (default 200)"),
    },
    async (args) => {
      const graph = getKnowledgeGraph(args.center_note_id, args.depth ?? 2, args.max_nodes ?? 200);
      return text(graph);
    }
  );

  server.tool(
    "get_forward_links",
    "Get all notes that a given note links to via [[wiki-links]]",
    {
      note_id: z.string().describe("The UUID of the source note"),
    },
    async (args) => {
      const links = getForwardLinks(args.note_id);
      return text({ note_id: args.note_id, forward_link_count: links.length, links });
    }
  );

  // --- Phase 3: Semantic Search Tools ---

  server.tool(
    "semantic_search",
    "Search notes by meaning using the all-MiniLM-L6-v2 model. Pass a plain text query — embeddings are generated automatically.",
    {
      query: z.string().describe("Plain text search query — the model converts it to a vector automatically"),
      limit: z.number().optional().describe("Max results (default 10)"),
      min_similarity: z.number().optional().describe("Minimum cosine similarity threshold 0–1 (default 0.3)"),
    },
    async (args) => {
      const embedding = await generateEmbedding(args.query);
      const results = semanticSearch(embedding, args.limit ?? 10, args.min_similarity ?? 0.3);
      return text({ count: results.length, results });
    }
  );

  server.tool(
    "reindex_embeddings",
    "Generate and store embeddings for all un-indexed notes (or a specific note) using the all-MiniLM-L6-v2 model. Run once after installing Bruin, then after bulk imports.",
    {
      note_id: z.string().optional().describe("Specific note ID to reindex. If omitted, indexes all notes that don't have embeddings yet."),
    },
    async (args) => {
      if (args.note_id) {
        const note = getNote(args.note_id);
        if (!note) return error(`Note '${args.note_id}' not found`);
        const embedding = await generateEmbedding(`${note.title}\n\n${note.content}`);
        upsertNoteEmbedding(args.note_id, embedding);
        return text({ indexed: 1, note_id: args.note_id, message: "Embedding generated and stored." });
      }

      // Batch index all notes missing embeddings
      const allNotes = listNotes(undefined, 1000, 0);
      const existing = getAllEmbeddings();
      const existingIds = new Set(existing.map((e) => e.note_id));
      const needsIndexing = allNotes.filter((n) => !existingIds.has(n.id));

      if (needsIndexing.length === 0) {
        return text({ total_notes: allNotes.length, indexed: existing.length, newly_indexed: 0, message: "All notes already indexed." });
      }

      let indexed = 0;
      for (const summary of needsIndexing) {
        const note = getNote(summary.id);
        if (!note) continue;
        const embedding = await generateEmbedding(`${note.title}\n\n${note.content}`);
        upsertNoteEmbedding(note.id, embedding);
        indexed++;
      }
      return text({ total_notes: allNotes.length, previously_indexed: existing.length, newly_indexed: indexed, message: `Indexed ${indexed} notes.` });
    }
  );

  // --- Agent Registry Tools ---

  server.tool(
    "register_agent",
    "Register a new AI agent identity. Agents get first-class tracking in the activity feed and can be assigned to tasks and workspaces.",
    {
      name: z.string().describe("Unique agent name (e.g. 'research-assistant', 'daily-reporter')"),
      description: z.string().optional().describe("Description of what the agent does"),
      capabilities: z.array(z.string()).optional().describe("List of capabilities (e.g. ['note_creation', 'search', 'task_management'])"),
    },
    async (args) => {
      try {
        const agent = registerAgent(args.name, args.description, args.capabilities);
        return text(agent);
      } catch (e: unknown) {
        return error((e as Error).message);
      }
    }
  );

  server.tool(
    "list_agents",
    "List all registered AI agents",
    {},
    async () => {
      const agents = listAgents();
      return text(agents);
    }
  );

  server.tool(
    "get_agent_audit_log",
    "Get the activity audit log for a specific agent — all actions performed by this agent",
    {
      agent_id: z.string().describe("The UUID of the agent"),
      limit: z.number().optional().describe("Max events to return (default 50)"),
    },
    async (args) => {
      const events = getAgentAuditLog(args.agent_id, args.limit ?? 50);
      return text(events);
    }
  );

  server.tool(
    "set_current_agent",
    "Set the current agent identity. All subsequent mutations will be attributed to this agent in the audit log.",
    {
      agent_id: z.string().nullable().describe("Agent ID to set as current, or null to clear"),
    },
    async (args) => {
      setCurrentAgent(args.agent_id);
      return text({ current_agent_id: args.agent_id, message: args.agent_id ? `Set current agent to '${args.agent_id}'` : "Cleared agent identity" });
    }
  );

  // --- Task Management Tools ---

  server.tool(
    "create_task",
    "Create a new task. Tasks can be assigned to agents and linked to notes.",
    {
      title: z.string().describe("Task title"),
      description: z.string().optional().describe("Detailed task description"),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("Task priority (default: medium)"),
      due_date: z.string().optional().describe("Due date in ISO format (e.g. 2026-03-01)"),
      assigned_agent_id: z.string().optional().describe("Agent ID to assign this task to"),
      linked_note_id: z.string().optional().describe("Note ID to link this task to"),
    },
    async (args) => {
      const task = createTask(args.title, args.description, args.priority, args.due_date, args.assigned_agent_id, args.linked_note_id);
      return text(task);
    }
  );

  server.tool(
    "list_tasks",
    "List tasks with optional filters for status and assigned agent",
    {
      status: z.enum(["todo", "in_progress", "done"]).optional().describe("Filter by status"),
      assigned_agent_id: z.string().optional().describe("Filter by assigned agent"),
      limit: z.number().optional().describe("Max tasks to return (default 100)"),
    },
    async (args) => {
      const tasks = listTasks(args.status, args.assigned_agent_id, args.limit);
      return text(tasks);
    }
  );

  server.tool(
    "update_task",
    "Update a task's properties (title, description, status, priority, due date, assignment, linked note)",
    {
      task_id: z.string().describe("Task ID to update"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      status: z.enum(["todo", "in_progress", "done"]).optional().describe("New status"),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("New priority"),
      due_date: z.string().optional().describe("New due date"),
      assigned_agent_id: z.string().optional().describe("New assigned agent"),
      linked_note_id: z.string().optional().describe("New linked note"),
    },
    async (args) => {
      const { task_id, ...updates } = args;
      const task = updateTask(task_id, updates);
      if (!task) return error(`Task '${task_id}' not found`);
      return text(task);
    }
  );

  server.tool(
    "complete_task",
    "Mark a task as done",
    {
      task_id: z.string().describe("Task ID to complete"),
    },
    async (args) => {
      const task = completeTask(args.task_id);
      if (!task) return error(`Task '${args.task_id}' not found`);
      return text(task);
    }
  );

  server.tool(
    "assign_task",
    "Assign a task to a specific agent",
    {
      task_id: z.string().describe("Task ID"),
      agent_id: z.string().describe("Agent ID to assign the task to"),
    },
    async (args) => {
      const task = assignTask(args.task_id, args.agent_id);
      if (!task) return error(`Task '${args.task_id}' not found`);
      return text(task);
    }
  );

  // --- Workflow Template Tools ---

  server.tool(
    "list_workflow_templates",
    "List all available workflow templates — multi-step agent workflows",
    {},
    async () => {
      const workflows = listWorkflowTemplates();
      return text(workflows);
    }
  );

  server.tool(
    "get_workflow_template",
    "Get a specific workflow template with its steps",
    {
      workflow_id: z.string().describe("Workflow template ID"),
    },
    async (args) => {
      const workflow = getWorkflowTemplate(args.workflow_id);
      if (!workflow) return error(`Workflow template '${args.workflow_id}' not found`);
      return text(workflow);
    }
  );

  server.tool(
    "execute_workflow",
    "Execute a workflow template server-side. Each step is run automatically with result chaining between steps.",
    {
      workflow_id: z.string().describe("Workflow template ID to execute"),
    },
    async (args) => {
      try {
        const results = executeWorkflow(args.workflow_id);
        return text({ steps: results });
      } catch (e: unknown) {
        return error((e as Error).message);
      }
    }
  );

  server.tool(
    "create_workflow_template",
    "Create a new workflow template with ordered steps",
    {
      name: z.string().describe("Unique workflow name"),
      description: z.string().optional().describe("Description of what the workflow does"),
      category: z.enum(["general", "daily", "research", "project"]).optional().describe("Workflow category"),
      steps: z.array(z.object({
        order: z.number().describe("Step order (1-based)"),
        tool_name: z.string().describe("MCP tool to call"),
        description: z.string().describe("What this step does"),
        params: z.record(z.string(), z.unknown()).describe("Parameters for the tool"),
        use_result_as: z.string().optional().describe("Variable name to store the result as"),
      })).describe("Ordered list of workflow steps"),
    },
    async (args) => {
      try {
        const workflow = createWorkflowTemplate(args.name, args.description, args.category, args.steps);
        return text(workflow);
      } catch (e: unknown) {
        return error((e as Error).message);
      }
    }
  );

  // --- Webhook Management Extensions ---

  server.tool(
    "update_webhook",
    "Update a webhook's URL, event types, or active status",
    {
      webhook_id: z.string().describe("Webhook ID to update"),
      url: z.string().optional().describe("New URL"),
      event_types: z.array(z.string()).optional().describe("New event types"),
      is_active: z.boolean().optional().describe("Enable/disable the webhook"),
    },
    async (args) => {
      const { webhook_id, ...updates } = args;
      const webhook = updateWebhook(webhook_id, updates);
      if (!webhook) return error(`Webhook '${webhook_id}' not found`);
      return text(webhook);
    }
  );

  server.tool(
    "test_webhook",
    "Send a test delivery to a webhook and return the result",
    {
      webhook_id: z.string().describe("Webhook ID to test"),
    },
    async (args) => {
      try {
        const log = await testWebhook(args.webhook_id);
        return text(log);
      } catch (e: unknown) {
        return error((e as Error).message);
      }
    }
  );

  server.tool(
    "get_webhook_logs",
    "Get delivery logs for a webhook — shows status codes, responses, and errors",
    {
      webhook_id: z.string().describe("Webhook ID to get logs for"),
      limit: z.number().optional().describe("Max logs to return (default 50)"),
    },
    async (args) => {
      const logs = getWebhookLogs(args.webhook_id, args.limit);
      return text(logs);
    }
  );

  // --- Agent-Workspace Binding ---

  server.tool(
    "bind_agent_workspace",
    "Bind an agent to a workspace, granting it access to notes in that workspace",
    {
      agent_id: z.string().describe("Agent ID"),
      workspace_id: z.string().describe("Workspace ID"),
      role: z.enum(["member", "admin"]).optional().describe("Agent's role in the workspace (default: member)"),
    },
    async (args) => {
      try {
        const binding = bindAgentWorkspace(args.agent_id, args.workspace_id, args.role);
        return text(binding);
      } catch (e: unknown) {
        return error((e as Error).message);
      }
    }
  );

  server.tool(
    "get_agent_workspaces",
    "Get all workspaces an agent is bound to",
    {
      agent_id: z.string().describe("Agent ID"),
    },
    async (args) => {
      const workspaces = getAgentWorkspaces(args.agent_id);
      return text(workspaces);
    }
  );

  // --- v0.4: Fill coverage gaps ---

  server.tool(
    "get_agent",
    "Get a single agent by ID with capabilities and status",
    {
      agent_id: z.string().describe("Agent ID"),
    },
    async (args) => {
      const agent = getAgent(args.agent_id);
      if (!agent) return error(`Agent '${args.agent_id}' not found`);
      return text(agent);
    }
  );

  server.tool(
    "update_agent",
    "Update an agent's name, description, or capabilities",
    {
      agent_id: z.string().describe("Agent ID to update"),
      name: z.string().optional().describe("New name"),
      description: z.string().optional().describe("New description"),
      capabilities: z.array(z.string()).optional().describe("New capabilities list"),
    },
    async (args) => {
      const { agent_id, ...updates } = args;
      const agent = updateAgent(agent_id, updates);
      if (!agent) return error(`Agent '${agent_id}' not found`);
      return text(agent);
    }
  );

  server.tool(
    "deactivate_agent",
    "Deactivate an agent, preventing it from performing further actions",
    {
      agent_id: z.string().describe("Agent ID to deactivate"),
    },
    async (args) => {
      const agent = deactivateAgent(args.agent_id);
      if (!agent) return error(`Agent '${args.agent_id}' not found`);
      return text(agent);
    }
  );

  server.tool(
    "delete_workspace",
    "Delete a workspace by ID",
    {
      workspace_id: z.string().describe("Workspace ID to delete"),
    },
    async (args) => {
      const result = deleteWorkspace(args.workspace_id);
      if (!result.success) return error(result.message);
      return text(result);
    }
  );

  server.tool(
    "unbind_agent_workspace",
    "Remove an agent's access to a workspace",
    {
      agent_id: z.string().describe("Agent ID"),
      workspace_id: z.string().describe("Workspace ID"),
    },
    async (args) => {
      const result = unbindAgentWorkspace(args.agent_id, args.workspace_id);
      if (!result.success) return error(result.message);
      return text(result);
    }
  );

  server.tool(
    "delete_workflow_template",
    "Delete a workflow template by ID",
    {
      workflow_id: z.string().describe("Workflow template ID to delete"),
    },
    async (args) => {
      const result = deleteWorkflowTemplate(args.workflow_id);
      if (!result.success) return error(result.message);
      return text(result);
    }
  );

  server.tool(
    "pin_note",
    "Pin or unpin a note. Pinned notes appear at the top of lists.",
    {
      note_id: z.string().describe("Note ID"),
      pinned: z.boolean().describe("True to pin, false to unpin"),
    },
    async (args) => {
      const note = pinNote(args.note_id, args.pinned);
      if (!note) return error(`Note '${args.note_id}' not found`);
      notifyNoteChanged(args.note_id);
      return text(note);
    }
  );

  server.tool(
    "restore_note",
    "Restore a note from trash",
    {
      note_id: z.string().describe("Note ID to restore"),
    },
    async (args) => {
      const note = restoreNote(args.note_id);
      if (!note) return error(`Trashed note '${args.note_id}' not found`);
      notifyNotesListChanged();
      return text(note);
    }
  );

  server.tool(
    "get_setting",
    "Get a setting value by key",
    {
      key: z.string().describe("Setting key"),
    },
    async (args) => {
      const value = getSetting(args.key);
      return text({ key: args.key, value });
    }
  );

  server.tool(
    "set_setting",
    "Set a setting value",
    {
      key: z.string().describe("Setting key"),
      value: z.string().describe("Setting value"),
    },
    async (args) => {
      setSetting(args.key, args.value);
      return text({ key: args.key, value: args.value, message: "Setting saved" });
    }
  );

  server.tool(
    "get_all_settings",
    "Get all settings as key-value pairs",
    {},
    async () => {
      const settings = getAllSettings();
      return text(settings);
    }
  );

  server.tool(
    "export_note_markdown",
    "Export a note as markdown with YAML frontmatter (title, dates, state, tags)",
    {
      note_id: z.string().describe("Note ID to export"),
    },
    async (args) => {
      const md = exportNoteMarkdown(args.note_id);
      if (!md) return error(`Note '${args.note_id}' not found`);
      return { content: [{ type: "text" as const, text: md }] };
    }
  );

  server.tool(
    "export_note_html",
    "Export a note as a standalone HTML document",
    {
      note_id: z.string().describe("Note ID to export"),
    },
    async (args) => {
      const html = exportNoteHtml(args.note_id);
      if (!html) return error(`Note '${args.note_id}' not found`);
      return { content: [{ type: "text" as const, text: html }] };
    }
  );

  // --- Wiki Knowledge Base Tools ---

  server.tool(
    "wiki_ingest_source",
    "Register a raw source for wiki ingestion. Stores the source content, deduplicates by content hash, and returns a source_id. After calling this, use batch_create_notes to create the wiki pages, then wiki_link_source_pages to link them.",
    {
      title: z.string().describe("Title/name of the source (e.g. article title, book chapter)"),
      content: z.string().describe("Raw text content of the source material"),
      url: z.string().optional().describe("Source URL if applicable"),
    },
    async (args) => {
      try {
        const source = createWikiSource(args.title, args.content, args.url);
        return text({ id: source.id, title: source.title, content_hash: source.content_hash, ingested_at: source.ingested_at });
      } catch (e: unknown) {
        return error((e as Error).message);
      }
    }
  );

  server.tool(
    "wiki_link_source_pages",
    "Link wiki pages (notes) to their source material. Call after batch_create_notes to record which source produced which pages.",
    {
      source_id: z.string().describe("Source ID from wiki_ingest_source"),
      note_ids: z.array(z.string()).describe("Array of note IDs that were created from this source"),
    },
    async (args) => {
      try {
        const result = linkSourceToPages(args.source_id, args.note_ids);
        return text(result);
      } catch (e: unknown) {
        return error((e as Error).message);
      }
    }
  );

  server.tool(
    "wiki_get_index",
    "Get a structured index of all wiki pages with link counts, tags, and previews. Use for navigating the wiki, generating an index page, or finding pages to read.",
    {
      tag: z.string().optional().describe("Tag prefix to filter by (default: 'wiki'). Use 'wiki/concept' to list only concept pages, 'wiki/person' for people, etc."),
    },
    async (args) => {
      const index = generateWikiIndex(args.tag ?? "wiki");
      return text({ page_count: index.length, pages: index });
    }
  );

  server.tool(
    "wiki_lint",
    "Health check the wiki. Finds orphan pages (no links in or out), missing pages (referenced via [[]] but don't exist), stale pages (not updated in 30+ days), and overall stats.",
    {},
    async () => {
      const report = wikiLint();
      return text(report);
    }
  );

  server.tool(
    "wiki_get_source",
    "Get a wiki source by ID, including its raw content and the pages it generated.",
    {
      source_id: z.string().describe("Source ID"),
    },
    async (args) => {
      const source = getWikiSource(args.source_id);
      if (!source) return error(`Source '${args.source_id}' not found`);
      return text(source);
    }
  );

  server.tool(
    "wiki_list_sources",
    "List all ingested wiki sources with page counts, ordered by ingestion date (newest first).",
    {
      limit: z.number().optional().describe("Max results (default 20)"),
      offset: z.number().optional().describe("Pagination offset (default 0)"),
    },
    async (args) => {
      const sources = listWikiSources(args.limit ?? 20, args.offset ?? 0);
      return text({ count: sources.length, sources });
    }
  );

  return server;
}
