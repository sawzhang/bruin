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

# MCP server
cd mcp-server && npm run build # Build TypeScript
cd mcp-server && npm test      # Run tests
```

## Architecture

Bruin is a Tauri 2 desktop app: Rust backend + React 19 frontend + a separate MCP server.

### Data flow

```
AI Agent ──MCP (stdio)──► MCP Server (Node.js) ──► SQLite ◄── Rust Backend ◄──IPC──► React Frontend
                                                      │
                                                 iCloud Sync
                                              (bidirectional .md files)
```

All three processes (Tauri app, MCP server, iCloud sync) share the same SQLite database at `~/Library/Application Support/com.bruin.app/bruin.db`. The MCP server notifies Tauri of changes by writing a trigger file that Tauri's file watcher detects.

### Frontend (src/)

- **IPC bridge**: `src/lib/tauri.ts` — every Tauri `invoke()` call is wrapped here. Stores never call `invoke()` directly.
- **State**: Zustand stores in `src/stores/` — `noteStore`, `workspaceStore`, `graphStore`, `tagStore`, `activityStore`, `uiStore`. Each store calls functions from `tauri.ts` and manages its own slice.
- **Editor**: TipTap-based rich markdown editor in `src/components/editor/`.
- **Graph**: D3 force-directed visualization in `src/components/graph/`.
- **Themes**: 6 themes defined in `src/lib/themes.ts`, applied via CSS variables with Tailwind's `bear.*` namespace.

### Backend (src-tauri/src/)

- **Commands**: `commands/*.rs` — each file is a group of `#[tauri::command]` handlers. Registered in `lib.rs` via `generate_handler![]`.
- **Database**: `db/migrations.rs` — 8-phase migration system. Schema includes: `notes`, `tags`, `note_tags`, `notes_fts` (FTS5), `activity_events`, `templates`, `webhooks`, `workspaces`, `note_links` (knowledge graph), `note_embeddings`.
- **Sync**: `sync/` — three layers: `icloud.rs` (file I/O, hash computation), `reconciler.rs` (merge strategy using SHA-256 + last-write-wins), `watcher.rs` (notify crate with debounced events).
- **DB access pattern**: All commands receive `State<'_, Mutex<Connection>>` via Tauri managed state. Lock the mutex, do work, return `Result<T, String>`.

### MCP Server (mcp-server/)

- `server.ts` — registers 14 tools + 4 resources with `@modelcontextprotocol/sdk`.
- `db/queries.ts` — all database operations (~1000 LOC). Uses `better-sqlite3` for synchronous access.
- Tools in `tools/` each export a handler function.
- After writes, calls `notifyTauri()` which writes `.bruin-sync-trigger` to wake Tauri's watcher.

### Key patterns

- **Note states**: `draft → review → published`. Agents write drafts, humans review and publish.
- **Activity logging**: Every note mutation calls `log_activity()` which inserts into `activity_events` and fires webhooks (HMAC-SHA256 signed, async with retry).
- **Tag hierarchy**: Tags like `#project/bruin/v2` are stored flat in `tags.name` with `parent_name` tracking the hierarchy.
- **Wiki-links**: `[[Note Title]]` syntax creates entries in `note_links` table. Parsed during `sync_note_links()`.
- **UTF-8 safe slicing**: When truncating content for previews, always use `is_char_boundary()` loop before slicing (multi-byte characters like Chinese/emoji will panic otherwise).
- **Sync state**: `SyncState` (managed Tauri state) must be updated after any sync path — startup reconcile, watcher events, and manual trigger — or the UI shows "Not synced".

## Database

SQLite with WAL mode. FTS5 virtual table `notes_fts` auto-syncs via triggers. Migrations run sequentially on app startup in `db/migrations.rs`. Add new migrations as the next phase number.

The MCP server accesses the same database file. Both use WAL mode for concurrent reads.

## iCloud Sync

Notes sync as individual `.md` files with YAML frontmatter to `~/Library/Mobile Documents/com~apple~CloudDocs/Bruin/notes/`. The reconciler compares SHA-256 hashes of `title+content` to detect changes, with `updated_at` as tiebreaker for conflicts.

## Releasing

Version is tracked in three files (keep in sync):
- `package.json` → `"version"`
- `src-tauri/Cargo.toml` → `version`
- `src-tauri/tauri.conf.json` → `"version"`

Update `CHANGELOG.md` with new entries under `## [x.y.z] - YYYY-MM-DD`, following Keep a Changelog format (Added/Changed/Fixed/Removed sections). Add a link reference at the bottom.

Release is fully automated — push a `v*` tag and GitHub Actions builds + publishes:

```bash
git tag v0.2.0
git push origin master --tags
```

## CI/CD

- **CI** (`.github/workflows/ci.yml`): Runs on push/PR to `master`. Frontend type check + tests, MCP server tests, Rust check + clippy.
- **Release** (`.github/workflows/release.yml`): Triggered by `v*` tags. Builds Mac `.dmg` for both `aarch64-apple-darwin` and `x86_64-apple-darwin` via `tauri-apps/tauri-action`. Auto-publishes (not draft). Supports Apple code signing via repository secrets.
