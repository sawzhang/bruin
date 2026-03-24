---
name: bruin
description: Bruin — agent-native markdown knowledge base. Use when the user asks about Bruin, their notes, knowledge base, daily logs, research capture, or weekly reviews. Also use when user says "take note", "remember this", "save to Bruin", or "check my notes".
---

# Bruin — Agent-Native Knowledge Base

Bruin is a **local-first macOS markdown note app** built for AI agents. You (Claude) are the primary writer. The human is the reviewer.

**Architecture:**
```
Claude ──MCP (stdio)──► Bruin MCP Server ──► SQLite ◄── Tauri App ◄── Human reviews
```
All data lives at `~/Library/Application Support/com.bruin.app/bruin.db`. Nothing leaves the machine.

## Quick Setup (Claude Code)

Add to `~/.claude/claude_desktop_config.json` or Claude Desktop settings:
```json
{
  "mcpServers": {
    "bruin": {
      "command": "npx",
      "args": ["bruin-mcp-server"],
      "env": {
        "BRUIN_AGENT_NAME": "claude-code"
      }
    }
  }
}
```

`BRUIN_AGENT_NAME` auto-creates/restores your agent identity across sessions. All writes are attributed to this agent. Omit it for anonymous access.

## Core Workflow

Notes flow through: **draft → review → published**
- You write drafts via MCP
- Human reviews and publishes via the macOS app
- Wiki-links (`[[Note Title]]`) build a knowledge graph

## Most-Used Tools

| Tool | When to use |
|------|-------------|
| `get_daily_note` | Start any session — get/create today's log |
| `append_to_note` | Add to existing note without replacing it |
| `batch_create_notes` | Create multiple notes atomically |
| `search_notes` | Full-text search across all notes |
| `advanced_query` | Filter by date range + tags + content |
| `create_note` | Create a single note with title + content + tags |
| `get_backlinks` | Find notes that link to a given note |
| `semantic_search` | Find conceptually similar notes (requires embeddings) |

## MCP Prompts (invoke with /mcp:bruin-notes:)

- `/mcp:bruin-notes:daily_log` — append to today's daily log
- `/mcp:bruin-notes:research_capture` — save a research note from any source
- `/mcp:bruin-notes:weekly_review` — generate a weekly review from this week's notes
- `/mcp:bruin-notes:link_knowledge` — find and create wiki-links between related notes

## MCP Resources (read with @bruin:)

- `bruin://notes` — list all notes
- `bruin://notes/{id}` — read a single note
- `bruin://tags` — all tags with counts
- `bruin://daily` — today's daily note

## Tag Conventions

Use hierarchical tags with `/`:
- `#daily` — daily logs
- `#research/ai` — AI research notes
- `#project/bruin` — project notes
- `#weekly-review` — weekly summaries

## Common Patterns

**Daily log entry:**
```
1. get_daily_note() → get today's note id
2. append_to_note(id, "## Topic\n\ncontent...")
```

**Research capture:**
```
create_note(
  title: "Topic — YYYY-MM-DD",
  content: "## Summary\n...\n## Key Points\n...",
  tags: ["research", "topic-tag"]
)
```

**Find related notes:**
```
search_notes("keyword") → results
get_backlinks(note_id) → who links here
```

**Weekly review:**
```
advanced_query({ date_from: "YYYY-MM-DD", date_to: "YYYY-MM-DD", tags: ["daily"] })
→ synthesize into create_note("Weekly Review YYYY-MM-DD", ...)
```

## Note Schema

```typescript
{
  id: string,          // UUID
  title: string,
  content: string,     // Markdown
  state: "draft" | "review" | "published",
  tags: string[],      // hierarchical: "project/bruin/v2"
  is_pinned: boolean,
  created_at: string,
  updated_at: string,
  word_count: number
}
```

## Key Facts

- **60 MCP tools** across: notes, search, knowledge graph, agent registry, tasks, workflows, webhooks, workspaces
- **Semantic search** uses all-MiniLM-L6-v2 (384-dim embeddings, local)
- **Knowledge graph** via `[[wiki-links]]` — backlinks, forward links, BFS traversal
- **iCloud sync** — bidirectional, SHA-256 conflict resolution
- **Agent registry** — register your agent identity, all writes are attributed to you
- **Activity log** — every mutation is logged with actor, timestamp, and event type

## Agent Registration (optional)

If you want your writes attributed to a named agent:
```
register_agent(name: "claude-code", description: "Claude Code assistant", capabilities: ["note-writing", "research", "summarization"])
→ returns agent_id
```
All subsequent writes are logged under this identity.
