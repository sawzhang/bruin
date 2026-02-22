# Changelog

All notable changes to Bruin will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-02-22

### Added
- Agent Registry: first-class agent identity with `agents` table, register/list/update/deactivate agents
- Agent audit logging: `agent_id` tracked on all activity events with agent badge in Activity panel
- Agent Dashboard: view active agents, task counts, and workspace bindings
- Agent-Workspace binding: scope agent access to specific workspaces with role-based assignments
- Task Management System: create, assign, complete, and filter tasks linked to notes and agents
- Task Panel: side panel with tasks grouped by status, priority indicators, and quick-complete
- Workflow Templates: multi-step agent workflow definitions with variable interpolation
- 3 seed workflows: Daily Standup, Research Summary, Meeting Follow-up
- Workflow Browser: browse and inspect workflow template steps
- "Run Workflow..." command in Command Palette
- Webhook Management UI: visual webhook registration, testing, enable/disable, and deletion
- Webhook delivery logs with payload/response inspection
- Webhook test endpoint for verifying connectivity
- Optimistic locking on notes via `version` column for safe concurrent agent edits
- 18 new MCP tools: agent registry (4), task management (5), workflow templates (4), webhook management (3), agent-workspace binding (2)
- 5 new database migration phases (10-14)

### Changed
- Activity panel now shows agent badge and supports filtering by agent
- Settings panel now includes Agents section and Manage Webhooks link
- Command Palette expanded with Tasks, Agents, and Run Workflow commands

## [0.2.0] - 2026-02-22

### Added
- Code block syntax highlighting via lowlight with theme-aware token colors
- Table support with resizable columns and BubbleMenu actions (add/remove rows/cols)
- Image drag-and-drop and paste support with local file storage
- Slash command palette (type `/` in editor for quick insert: headings, lists, code blocks, tables, etc.)
- Settings panel (Cmd+,) with font family, font size, auto-save interval, spell check, and line numbers
- Settings persistence via SQLite backend
- Export system: Markdown (with frontmatter), HTML (styled document), and PDF (via print dialog)
- Enhanced command palette (Cmd+K) with command mode (`>` prefix) for Settings, Theme, Graph, Activity, Export
- Toast notification system for user feedback on success/error actions
- React error boundaries wrapping Sidebar, NoteList, and EditorPanel

### Changed
- Replaced N+1 tag queries in list_notes, search_notes, and get_notes_by_tag with batch fetching
- Optimized tag count updates to only recalculate affected tags instead of all tags
- Replaced all silent catch blocks across stores with toast error notifications
- Dynamic auto-save debounce: 2s for notes over 10K words, configurable otherwise
- Typography extension disabled for large notes (>10K words) for performance

### Fixed
- Performance bottleneck from individual tag queries per note in list operations

## [0.1.0] - 2026-02-21

### Added
- Core note CRUD with markdown editing (TipTap)
- MCP server with 14 tools across 3 tiers (Core, Agent, Utility)
- Knowledge graph with `[[wiki-links]]` and D3 force-directed visualization
- Semantic search with local Hugging Face embeddings
- Full-text search via SQLite FTS5
- Review workflow: draft → review → published
- iCloud bidirectional sync with SHA-256 conflict resolution
- Hierarchical tags with tree navigation
- Workspaces for organizing notes
- Activity feed with state transition tracking
- Webhooks with HMAC-SHA256 signing
- Templates (Daily Journal, Meeting Notes, Research Summary)
- 6 color themes
- GitHub Actions CI/CD with automated Mac release builds (Apple Silicon + Intel)
- Promotional landing page (`site/`)

[0.3.0]: https://github.com/sawzhang/bruin/releases/tag/v0.3.0
[0.2.0]: https://github.com/sawzhang/bruin/releases/tag/v0.2.0
[0.1.0]: https://github.com/sawzhang/bruin/releases/tag/v0.1.0
