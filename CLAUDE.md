# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run tauri dev              # Start app (Vite + Tauri hot reload)
npm run tauri build            # Production build → .dmg in src-tauri/target/release/bundle/

# Frontend tests
npm test                       # Run Vitest once
npm run test:watch             # Watch mode

# Rust checks
cd src-tauri && cargo check    # Type check Rust
cd src-tauri && cargo clippy   # Lint Rust

# MCP server (built into the app binary)
/Applications/Bruin.app/Contents/MacOS/bruin --mcp            # Start MCP server (stdio)
/Applications/Bruin.app/Contents/MacOS/bruin --install-skill   # Install Claude Code skill
/Applications/Bruin.app/Contents/MacOS/bruin --write-config    # Write Claude Code MCP config
```

## Architecture

Bruin is a Tauri 2 desktop app: Rust backend + React 19 frontend with a native MCP server built into the app binary.

### Data flow

```
AI Agent ──MCP (stdio)──► Bruin Binary (Rust) ──► SQLite ◄──IPC──► React Frontend
                                                      │
                                                 iCloud Sync
                                              (bidirectional .md files)
```

The MCP server runs as the same binary with `--mcp` flag: `bruin --mcp`. It accesses SQLite directly — no Node.js required. The GUI app and MCP server share the same database at `~/Library/Application Support/com.bruin.notes/bruin.db`.

### Frontend (src/)

- **IPC bridge**: `src/lib/tauri.ts` — every Tauri `invoke()` call is wrapped here. Stores never call `invoke()` directly.
- **State**: Zustand stores in `src/stores/` — `noteStore`, `workspaceStore`, `graphStore`, `tagStore`, `activityStore`, `uiStore`. Each store calls functions from `tauri.ts` and manages its own slice.
- **Editor**: TipTap-based rich markdown editor in `src/components/editor/`.
- **Graph**: D3 force-directed visualization in `src/components/graph/`.
- **Themes**: 6 themes defined in `src/lib/themes.ts`, applied via CSS variables with Tailwind's `bear.*` namespace.

### Backend (src-tauri/src/)

- **Commands**: `commands/*.rs` — each file is a group of `#[tauri::command]` handlers. Registered in `lib.rs` via `generate_handler![]`.
- **Database**: `db/migrations.rs` — 8-phase migration system. Schema includes: `notes`, `tags`, `note_tags`, `notes_fts` (FTS5), `activity_events`, `templates`, `webhooks`, `workspaces`, `note_links` (knowledge graph), `note_embeddings`, `agents`, `tasks`, `workflow_templates`.
- **Sync**: `sync/` — three layers: `icloud.rs` (file I/O, hash computation), `reconciler.rs` (merge strategy using SHA-256 + last-write-wins), `watcher.rs` (notify crate with debounced events).
- **DB access pattern**: All commands receive `State<'_, Mutex<Connection>>` via Tauri managed state. Lock the mutex, do work, return `Result<T, String>`.

### MCP Server (src-tauri/src/mcp/)

The MCP server is built natively into the Tauri binary — no Node.js required. It runs via `bruin --mcp` (stdio) or as a Unix socket server when the GUI app is running.

- `server.rs` — all tool/prompt/resource handlers + JSON-RPC dispatch (~4100 LOC)
- `socket_server.rs` — Unix socket listener for `--mcp-proxy` mode
- `mod.rs` — module exports

**MCP Primitives:**
- **64 Tools** across: notes/search, knowledge graph, wiki KB, agent registry, workspaces, tasks, workflows, webhooks, templates, settings/export
- **4 Resources**: `bruin://notes`, `bruin://notes/{id}`, `bruin://tags`, `bruin://daily`
- **7 Prompts**: `daily_log`, `research_capture`, `weekly_review`, `link_knowledge`, `wiki_ingest`, `wiki_query`, `wiki_lint_and_fix`

### Key patterns

- **Note states**: `draft → review → published`. Valid transitions: `draft→review`, `review→published`, `review→draft`, `published→review`.
- **Activity logging**: Every note mutation calls `logActivity()` which inserts into `activity_events` and fires webhooks (HMAC-SHA256 signed, async with retry). The `currentAgentId` in-memory state attributes writes to the active agent.
- **Tag hierarchy**: Tags like `#project/bruin/v2` are stored flat in `tags.name` with `parent_name` tracking the hierarchy.
- **Wiki-links**: `[[Note Title]]` syntax creates entries in `note_links` table. Parsed during `sync_note_links()`.
- **UTF-8 safe slicing**: When truncating content for previews, always use `is_char_boundary()` loop before slicing (multi-byte characters like Chinese/emoji will panic otherwise).
- **Sync state**: `SyncState` (managed Tauri state) must be updated after any sync path — startup reconcile, watcher events, and manual trigger — or the UI shows "Not synced".
- **Optimistic locking**: `updateNote()` accepts `expectedUpdatedAt`. If the note was updated by another writer since the caller last read it, the write throws a conflict error. MCP tool exposes this as `expected_updated_at`.
- **Per-agent daily notes**: `getDailyNote(date?, agentId?)` scopes the daily note to the agent when `agentId` is provided (title: `YYYY-MM-DD [agentId]`, tagged `#agent/<agentId>`).
- **Persistent agent identity**: MCP server reads `BRUIN_AGENT_NAME` (or `BRUIN_AGENT_ID`) env var on startup and calls `setCurrentAgent()`. Agent is auto-created if name is new. All subsequent writes are attributed to this agent without needing `register_agent` or `set_current_agent` in every session.
- **Wiki knowledge base**: Karpathy-style LLM wiki pattern. Sources tracked in `wiki_sources` table, pages linked via `wiki_source_pages`. Tools: `wiki_ingest_source`, `wiki_get_index`, `wiki_lint`. Prompts guide AI through ingest/query/lint workflows.

## Database

SQLite with WAL mode. FTS5 virtual table `notes_fts` auto-syncs via triggers. Migrations run sequentially on app startup in `db/migrations.rs`. Add new migrations as the next phase number.

The MCP server (`bruin --mcp`) accesses the same database file. Both use WAL mode for concurrent reads. Concurrent writes to the same note should use `expected_updated_at` optimistic locking.

## iCloud Sync

Notes sync as individual `.md` files with YAML frontmatter to `~/Library/Mobile Documents/iCloud~com~bruin~app/Documents/notes/`. The reconciler compares SHA-256 hashes of `title+content` to detect changes, with `updated_at` as tiebreaker for conflicts.

## External Documentation

Full MCP tool reference and user-facing install guide: **https://bruin.me/skills.md**

This URL is designed to be read by AI agents (Claude, etc.) to understand Bruin and help users install it.

## Releasing

Version is tracked in three files (keep in sync):
- `package.json` → `"version"`
- `src-tauri/Cargo.toml` → `version`
- `src-tauri/tauri.conf.json` → `"version"`

Update `CHANGELOG.md` with new entries under `## [x.y.z] - YYYY-MM-DD`, following Keep a Changelog format (Added/Changed/Fixed/Removed sections). Add a link reference at the bottom.

Release is fully automated — push a `v*` tag and GitHub Actions builds + publishes:

```bash
git tag v1.0.0
git push origin master --tags
```

## CI/CD

- **CI** (`.github/workflows/ci.yml`): Runs on push/PR to `master`. Frontend type check + tests, Rust check + clippy.
- **Release** (`.github/workflows/release.yml`): Triggered by `v*` tags. Builds Mac `.dmg` for both `aarch64-apple-darwin` and `x86_64-apple-darwin` via `tauri-apps/tauri-action`. Auto-publishes (not draft). Supports Apple code signing via repository secrets.
