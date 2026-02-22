import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createNote, getNote, getNoteByTitle, updateNote, deleteNote, setNoteState, listNotes, searchNotes, listTags, batchCreateNotes, appendToNote, getBacklinks, getDailyNote, advancedQuery, importMarkdownFiles, getActivityFeed, listTemplates, createNoteFromTemplate, registerWebhook, listWebhooks, deleteWebhook, createWorkspace, listWorkspaces, deleteWorkspace, setCurrentWorkspace, getCurrentWorkspace, getForwardLinks, getKnowledgeGraph, semanticSearch, upsertNoteEmbedding, getAllEmbeddings, registerAgent, listAgents, getAgent, getAgentAuditLog, setCurrentAgent, getCurrentAgent, createTask, listTasks, updateTask, completeTask, assignTask, listWorkflowTemplates, getWorkflowTemplate, createWorkflowTemplate, executeWorkflow, updateWebhook, testWebhook, getWebhookLogs, bindAgentWorkspace, getAgentWorkspaces } from "./db/queries.js";

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

  server.tool(
    "create_note",
    "Create a new note in Bruin",
    {
      title: z.string().describe("Title of the note"),
      content: z.string().describe("Markdown content of the note"),
      tags: z.array(z.string()).optional().describe("Optional tags. If omitted, tags are extracted from #hashtags in the content."),
    },
    async (args) => {
      const note = createNote(args.title, args.content, args.tags);
      notifyNotesListChanged();
      return text({ id: note.id, title: note.title, created_at: note.created_at, tags: note.tags });
    }
  );

  server.tool(
    "read_note",
    "Read a note by ID",
    {
      id: z.string().describe("The UUID of the note"),
    },
    async (args) => {
      const note = getNote(args.id);
      if (!note) return error(`Note '${args.id}' not found`);
      return text(note);
    }
  );

  server.tool(
    "update_note",
    "Update an existing note",
    {
      id: z.string().describe("The UUID of the note to update"),
      title: z.string().optional().describe("New title"),
      content: z.string().optional().describe("New markdown content"),
      tags: z.array(z.string()).optional().describe("New tags. If omitted and content is updated, tags are re-extracted from content."),
    },
    async (args) => {
      const note = updateNote(args.id, args.title, args.content, args.tags);
      if (!note) return error(`Note '${args.id}' not found`);
      notifyNoteChanged(args.id);
      return text(note);
    }
  );

  server.tool(
    "delete_note",
    "Delete a note (soft delete to trash, or permanent)",
    {
      id: z.string().describe("The UUID of the note to delete"),
      permanent: z.boolean().optional().describe("If true, permanently delete. Default is soft delete to trash."),
    },
    async (args) => {
      const result = deleteNote(args.id, args.permanent ?? false);
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
      id: z.string().describe("The UUID of the note"),
      state: z.enum(["draft", "review", "published"]).describe("Target state"),
    },
    async (args) => {
      try {
        const note = setNoteState(args.id, args.state);
        if (!note) return error(`Note '${args.id}' not found`);
        notifyNoteChanged(args.id);
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
    "Get or create today's daily note (or for a specific date). Used as an agent journal.",
    {
      date: z.string().optional().describe("Date in YYYY-MM-DD format. Defaults to today if omitted."),
    },
    async (args) => {
      const note = getDailyNote(args.date);
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
      id: z.string().describe("The UUID of the webhook to delete"),
    },
    async (args) => {
      const result = deleteWebhook(args.id);
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
    "Search notes by meaning using vector embeddings. Requires embeddings to be generated first via reindex_embeddings.",
    {
      query_embedding: z.array(z.number()).describe("384-dimensional embedding vector of the search query"),
      limit: z.number().optional().describe("Max results (default 10)"),
      min_similarity: z.number().optional().describe("Minimum cosine similarity threshold (default 0.3)"),
    },
    async (args) => {
      const results = semanticSearch(args.query_embedding, args.limit ?? 10, args.min_similarity ?? 0.3);
      return text({ count: results.length, results });
    }
  );

  server.tool(
    "reindex_embeddings",
    "Generate and store embeddings for all notes (or a specific note). Uses the all-MiniLM-L6-v2 model. Note: This is a placeholder that stores the embedding you provide.",
    {
      note_id: z.string().optional().describe("Specific note ID to reindex. If omitted, returns all note IDs that need reindexing."),
      embedding: z.array(z.number()).optional().describe("The 384-dimensional embedding vector to store for the note"),
    },
    async (args) => {
      if (args.note_id && args.embedding) {
        upsertNoteEmbedding(args.note_id, args.embedding);
        return text({ message: `Embedding stored for note '${args.note_id}'` });
      }

      // Return notes that need embeddings
      const allNotes = listNotes(undefined, 1000, 0);
      const existing = getAllEmbeddings();
      const existingIds = new Set(existing.map((e) => e.note_id));
      const needsEmbedding = allNotes.filter((n) => !existingIds.has(n.id));
      return text({ total_notes: allNotes.length, indexed: existing.length, needs_indexing: needsEmbedding.length, note_ids: needsEmbedding.map((n) => n.id) });
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
      id: z.string().describe("Task ID to update"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      status: z.enum(["todo", "in_progress", "done"]).optional().describe("New status"),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("New priority"),
      due_date: z.string().optional().describe("New due date"),
      assigned_agent_id: z.string().optional().describe("New assigned agent"),
      linked_note_id: z.string().optional().describe("New linked note"),
    },
    async (args) => {
      const { id, ...updates } = args;
      const task = updateTask(id, updates);
      if (!task) return error(`Task '${id}' not found`);
      return text(task);
    }
  );

  server.tool(
    "complete_task",
    "Mark a task as done",
    {
      id: z.string().describe("Task ID to complete"),
    },
    async (args) => {
      const task = completeTask(args.id);
      if (!task) return error(`Task '${args.id}' not found`);
      return text(task);
    }
  );

  server.tool(
    "assign_task",
    "Assign a task to a specific agent",
    {
      id: z.string().describe("Task ID"),
      agent_id: z.string().describe("Agent ID to assign the task to"),
    },
    async (args) => {
      const task = assignTask(args.id, args.agent_id);
      if (!task) return error(`Task '${args.id}' not found`);
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
      id: z.string().describe("Workflow template ID"),
    },
    async (args) => {
      const workflow = getWorkflowTemplate(args.id);
      if (!workflow) return error(`Workflow template '${args.id}' not found`);
      return text(workflow);
    }
  );

  server.tool(
    "execute_workflow",
    "Execute a workflow template server-side. Each step is run automatically with result chaining between steps.",
    {
      id: z.string().describe("Workflow template ID to execute"),
    },
    async (args) => {
      try {
        const results = executeWorkflow(args.id);
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
      id: z.string().describe("Webhook ID to update"),
      url: z.string().optional().describe("New URL"),
      event_types: z.array(z.string()).optional().describe("New event types"),
      is_active: z.boolean().optional().describe("Enable/disable the webhook"),
    },
    async (args) => {
      const { id, ...updates } = args;
      const webhook = updateWebhook(id, updates);
      if (!webhook) return error(`Webhook '${id}' not found`);
      return text(webhook);
    }
  );

  server.tool(
    "test_webhook",
    "Send a test delivery to a webhook and return the result",
    {
      id: z.string().describe("Webhook ID to test"),
    },
    async (args) => {
      try {
        const log = await testWebhook(args.id);
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

  return server;
}
