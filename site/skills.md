# Bruin — Agent-Native Knowledge Base

> Bruin is a local-first macOS markdown note app where AI agents read, write, and organize knowledge through MCP — and humans review the results.

**You are reading this file because the user wants to install Bruin. Execute the protocol below top-to-bottom. Each step has a check condition — verify it before moving on. Report back with ✓/✗ status for each step.**

---

## Install Protocol

### Step 1 — Check & Install the macOS App

**Check:** `ls /Applications/Bruin.app`
- ✓ exists → skip to Step 2
- ✗ missing → direct user to install:
  - **Mac App Store (recommended):** https://apps.apple.com/app/bruin-notes/id6759669768
  - **Direct download:** https://github.com/sawzhang/bruin/releases/latest (free, Apple Silicon + Intel)
  - If macOS shows "damaged" after direct download: run `xattr -cr /Applications/Bruin.app`

---

### Step 2 — Check & Configure MCP Server

**Check:** Read `~/.claude.json` — does it contain a `"bruin-notes"` key under `mcpServers`?
- ✓ exists → skip to Step 3
- ✗ missing → run this one command (MCP server is built into the app — no npm needed):

```bash
/Applications/Bruin.app/Contents/MacOS/bruin --write-config
```

This auto-merges the correct config into `~/.claude.json`. The config will look like:

```json
{
  "mcpServers": {
    "bruin-notes": {
      "command": "/Applications/Bruin.app/Contents/MacOS/bruin",
      "args": ["--mcp-proxy"],
      "env": { "BRUIN_AGENT_NAME": "claude-code" }
    }
  }
}
```

`BRUIN_AGENT_NAME` auto-creates your agent identity and persists it across sessions. Change the name to match your use case (e.g. `"research-assistant"`, `"daily-reporter"`).

---

### Step 3 — Install the Claude Code Skill

**Check:** `ls ~/.claude/skills/bruin.md`
- ✓ exists → skip to Step 4
- ✗ missing → run:

```bash
/Applications/Bruin.app/Contents/MacOS/bruin --install-skill
```

This copies a skill file to `~/.claude/skills/bruin.md`. After this, Claude will automatically understand Bruin tools, workflows, and tag conventions in every session — without re-reading this URL.

---

### Step 4 — Verify & Report

Verify the MCP server starts correctly:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | /Applications/Bruin.app/Contents/MacOS/bruin --mcp-proxy
```

Expected: a JSON response with `"serverInfo": {"name": "bruin-notes"}`.

Then report back to the user:
```
Bruin install complete:
✓/✗ App installed at /Applications/Bruin.app
✓/✗ MCP config added to ~/.claude.json
✓/✗ Skill file at ~/.claude/skills/bruin.md
✓/✗ MCP server responded to initialize
Next: restart Claude Code to activate the bruin-notes MCP server.
```

---

## How Bruin Works

```
You / Agent ──MCP (stdio)──► Bruin MCP Server ──► SQLite ◄── Bruin App (macOS)
                                                      │
                                                 iCloud Sync
```

- **MCP server**: built into `Bruin.app` — no separate install, no npm, no Node.js
- **Database**: `~/Library/Application Support/com.bruin.notes/bruin.db` (shared, WAL mode)
- **Notes**: stored as markdown with YAML frontmatter, synced to iCloud
- **Agent writes draft → Human reviews in app → Human publishes**

Note state machine: `draft → review → published`

---

## MCP Prompts — Invoke These Directly

These are structured workflows. In Claude Code: `/mcp:bruin-notes:<name>`

| Prompt | How to invoke | What it does |
|--------|--------------|--------------|
| `daily_log` | `/mcp:bruin-notes:daily_log` | Get/create today's note and append a structured log entry |
| `research_capture` | `/mcp:bruin-notes:research_capture topic="Rust GUI frameworks"` | Create a structured research note from any source |
| `weekly_review` | `/mcp:bruin-notes:weekly_review` | Query this week's notes and generate a review |
| `link_knowledge` | `/mcp:bruin-notes:link_knowledge note_id="<id>"` | Find and create `[[wiki-links]]` between related notes |

---

## MCP Resources — Read These Directly

In Claude Code, use `@bruin` to reference:

| Resource URI | Contents |
|-------------|---------|
| `bruin://notes` | List of all notes (id, title, preview, tags, updated_at) |
| `bruin://notes/{noteId}` | Full note content by ID |
| `bruin://tags` | All tags with note counts |
| `bruin://daily` | Today's daily note (creates if missing) |

---

## MCP Tools — Complete Reference

### Notes & Search (16 tools)

| Tool | Parameters | Use when |
|------|-----------|---------|
| `create_note` | title, content, tags? | Creating a new note. Embeddings auto-generated. |
| `read_note` | note_id | Reading full note content |
| `update_note` | note_id, title?, content?, tags?, expected_updated_at? | Updating. Pass `expected_updated_at` from read to prevent concurrent overwrites. |
| `delete_note` | note_id, permanent? | Trash (default) or permanent delete |
| `list_notes` | tag?, limit?, offset? | Browse notes, optionally filtered by tag |
| `search_notes` | query, limit? | Full-text search (FTS5) |
| `semantic_search` | query, limit?, min_similarity? | Meaning-based search. Pass plain text — vectors auto-generated. |
| `get_note_by_title` | title, fuzzy? | Find by exact or fuzzy title match |
| `batch_create_notes` | notes[] | Create multiple notes atomically in one call |
| `append_to_note` | note_id, content | Append without reading/replacing. Use for incremental writes. |
| `get_backlinks` | note_title | Find notes that link to this note via `[[wiki-links]]` |
| `get_daily_note` | date?, agent_id? | Get/create daily journal. Use `agent_id` for per-agent isolation. |
| `advanced_query` | date_from?, date_to?, tags?, tag_mode?, min_words?, max_words?, search?, state? | Structured multi-filter query |
| `set_note_state` | note_id, state | Move note through `draft → review → published` |
| `import_markdown` | paths[] | Bulk import from files or directories |
| `reindex_embeddings` | note_id? | Re-generate embeddings for all un-indexed notes or a specific note |

### Knowledge Graph (3 tools)

| Tool | Parameters | Use when |
|------|-----------|---------|
| `get_knowledge_graph` | center_note_id?, depth?, max_nodes? | BFS traversal of the wiki-link graph |
| `get_forward_links` | note_id | Notes this note links to via `[[...]]` |
| `get_backlinks` | note_title | Notes that link to this note |

### Agent Registry (6 tools)

| Tool | Parameters | Use when |
|------|-----------|---------|
| `register_agent` | name, description?, capabilities? | First-time agent registration |
| `list_agents` | — | See all registered agents |
| `get_agent` | agent_id | Get agent details |
| `update_agent` | agent_id, ...fields | Update agent metadata |
| `deactivate_agent` | agent_id | Disable agent (soft delete) |
| `get_agent_audit_log` | agent_id, limit? | All writes made by this agent |

### Workspaces (7 tools)

| Tool | Parameters | Use when |
|------|-----------|---------|
| `create_workspace` | name, description? | Create a scoped note collection |
| `list_workspaces` | — | List all workspaces |
| `switch_workspace` | workspace_id | Filter all operations to this workspace |
| `get_current_workspace` | — | Check active workspace |
| `bind_agent_workspace` | agent_id, workspace_id, role | Give agent access to workspace |
| `get_agent_workspaces` | agent_id | Which workspaces this agent can access |
| `unbind_agent_workspace` | agent_id, workspace_id | Remove agent workspace access |

### Tasks (5 tools)

| Tool | Parameters | Use when |
|------|-----------|---------|
| `create_task` | title, description?, priority?, due_date?, assigned_agent_id?, linked_note_id? | Create a trackable task |
| `list_tasks` | status?, assigned_agent_id? | List tasks, optionally filtered |
| `update_task` | task_id, ...fields | Update task metadata |
| `complete_task` | task_id | Mark task done |
| `assign_task` | task_id, agent_id | Assign to an agent |

### Workflow Templates (5 tools)

| Tool | Parameters | Use when |
|------|-----------|---------|
| `create_workflow_template` | name, description, category, steps[] | Define a multi-step automation |
| `list_workflow_templates` | — | Browse available templates |
| `get_workflow_template` | template_id | Read template steps |
| `execute_workflow` | template_id, params? | Run a template |
| `delete_workflow_template` | template_id | Remove template |

### Webhooks (5 tools)

| Tool | Parameters | Use when |
|------|-----------|---------|
| `register_webhook` | url, event_types[], secret? | Subscribe to note change events |
| `list_webhooks` | — | List registered webhooks |
| `update_webhook` | webhook_id, ...fields | Update webhook config |
| `delete_webhook` | webhook_id | Remove webhook |
| `test_webhook` | webhook_id | Send a test delivery |
| `get_webhook_logs` | webhook_id | Delivery history |

### Settings & Export (5 tools)

| Tool | Parameters | Use when |
|------|-----------|---------|
| `get_setting` | key | Read a setting value |
| `set_setting` | key, value | Write a setting |
| `get_all_settings` | — | Dump all settings |
| `export_note_markdown` | note_id | Export with YAML frontmatter |
| `export_note_html` | note_id | Export as HTML |

### Utility (3 tools)

| Tool | Parameters | Use when |
|------|-----------|---------|
| `pin_note` | note_id, pinned | Pin/unpin a note |
| `restore_note` | note_id | Restore from trash |
| `list_tags` | — | All tags with counts and hierarchy |

---

## Common Patterns

### Daily log entry
```
1. get_daily_note(agent_id="claude-code") → {id, content}
2. append_to_note(id, "## Topic\n\nContent...")
```

Or use the prompt: `/mcp:bruin-notes:daily_log topic="Research session"`

### Research note
```
create_note(
  title: "Topic — 2026-03-25",
  content: "## Summary\n...\n## Key Points\n...\n## References\n...",
  tags: ["research", "topic-tag"]
)
```

Or use: `/mcp:bruin-notes:research_capture topic="Topic" source="URL"`

### Safe update (prevents concurrent overwrite)
```
1. note = read_note(note_id)        → has note.updated_at
2. update_note(note_id, content=..., expected_updated_at=note.updated_at)
   # If another writer changed it first → error with instructions to re-read
```

### Find related notes
```
search_notes("keyword")             → full-text results
semantic_search("similar concept")  → meaning-based results
get_backlinks("Note Title")         → who links here
```

### Weekly review
```
/mcp:bruin-notes:weekly_review
```
Queries this week's notes, synthesizes them into a review note.

### Build knowledge graph
```
/mcp:bruin-notes:link_knowledge note_id="<id>"
```
Finds conceptually related notes and adds `[[wiki-links]]`.

---

## Tag Conventions

Tags use `/` for hierarchy:
```
#daily                     Daily log notes
#weekly-review             Weekly summaries
#research/ai               AI research
#research/rust             Rust research
#project/bruin             Bruin project notes
#agent/claude-code         Notes from claude-code agent
```

Tags are auto-extracted from `#hashtag` patterns in note content. Or pass explicit `tags: [...]` to `create_note`.

---

## Note Schema

```json
{
  "id": "uuid",
  "title": "string",
  "content": "markdown string",
  "state": "draft | review | published",
  "tags": ["string"],
  "is_pinned": false,
  "word_count": 150,
  "created_at": "ISO 8601",
  "updated_at": "ISO 8601"
}
```

---

## Environment Variables

| Variable | Effect |
|----------|--------|
| `BRUIN_AGENT_NAME` | Look up (or auto-create) agent by name on startup. Persists across restarts. |
| `BRUIN_AGENT_ID` | Use exact agent UUID. Must already exist in DB. |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `app is damaged` | `xattr -cr /Applications/Bruin.app` |
| MCP server not found | Make sure Bruin.app is running first (`--mcp-proxy` connects to the running app) |
| Semantic search returns nothing | Run `reindex_embeddings()` to index existing notes |
| Notes not showing in app | App and MCP server share the same SQLite file — check that Bruin app is running |
| Agent ID resets on restart | Set `BRUIN_AGENT_NAME` env var in MCP config |

---

*Source: https://github.com/sawzhang/bruin — MIT License — Available on the Mac App Store*
