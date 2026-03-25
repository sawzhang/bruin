# Bruin — MCP Tools Reference

Bruin is a local-first macOS markdown note app. You have access to the `bruin-notes` MCP server.

## Core Workflows

### Daily log
```
1. get_daily_note() → {id, content}
2. append_to_note(id, "## Topic\n\nContent...")
```

### Research note
```
create_note(
  title: "Topic — YYYY-MM-DD",
  content: "## Summary\n...\n## Key Points\n...\n## References\n...",
  tags: ["research", "topic-tag"]
)
```

### Safe update (prevents overwrite)
```
1. note = read_note(note_id)     → has note.updated_at
2. update_note(note_id, content=..., expected_updated_at=note.updated_at)
```

### Find related notes
```
search_notes("keyword")           → full-text results
get_backlinks("Note Title")       → who links here
```

## Note State Machine
`draft → review → published`

Use `set_note_state` to advance a note. Agents write drafts; humans publish via the app.

## Tag Conventions
```
#daily                 Daily log notes
#weekly-review         Weekly summaries
#research/ai           Nested research tags
#project/bruin         Project notes
```

Tags auto-extracted from `#hashtag` patterns. Or pass explicit `tags: [...]`.

## Available Tools
- **Notes**: create_note, read_note, update_note, delete_note, list_notes, search_notes, get_note_by_title, append_to_note, get_daily_note, set_note_state, advanced_query, pin_note, restore_note, get_backlinks, get_forward_links
- **Tags**: list_tags
- **Agents**: register_agent, list_agents, get_agent, deactivate_agent, get_agent_audit_log
- **Workspaces**: create_workspace, list_workspaces
- **Tasks**: create_task, list_tasks, complete_task
- **Settings**: get_setting, set_setting, get_all_settings

## Resources
- `bruin://notes` — all notes list
- `bruin://notes/{id}` — note by ID
- `bruin://tags` — all tags
- `bruin://daily` — today's daily note

## Prompts
- `/mcp:bruin-notes:daily_log` — append to today's note
- `/mcp:bruin-notes:research_capture topic="..."` — create research note
- `/mcp:bruin-notes:weekly_review` — generate weekly review
- `/mcp:bruin-notes:link_knowledge note_id="..."` — add wiki-links
