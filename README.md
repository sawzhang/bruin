# Bruin

**The note-taking app built for AI agents — 60 MCP tools, knowledge graph, human-in-the-loop review, all local-first.**

> AI agents don't just answer questions. They should read, write, and organize your knowledge — with your approval.

[![CI](https://github.com/sawzhang/bruin/actions/workflows/ci.yml/badge.svg)](https://github.com/sawzhang/bruin/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**[Download for macOS](https://github.com/sawzhang/bruin/releases/latest)** · **[Website](https://sawzhang.github.io/bruin/)**

> If macOS shows "app is damaged", run: `xattr -cr /Applications/Bruin.app`

## Why Bruin

Every note app is adding "AI features" — a chatbot here, a summarizer there. Bruin takes the opposite approach: **the AI agent is a first-class citizen, not a bolt-on.**

| Traditional Note Apps | Bruin |
|----------------------|-------|
| AI is a sidebar chatbot | AI agents have 60 MCP tools — full CRUD, search, tagging, workflows |
| Notes are for humans only | Notes flow through `draft → review → published` — agents write, humans approve |
| Cloud-dependent | Local-first SQLite + iCloud sync — your data never leaves your machine |
| Flat file lists | Knowledge graph with `[[wiki-links]]`, backlinks, and force-directed visualization |

## Features

| Area | What you get |
|------|--------------|
| **Editor** | TipTap markdown with syntax highlighting, tables, images, slash commands |
| **Search** | FTS5 full-text + semantic search with local Hugging Face embeddings |
| **Knowledge Graph** | D3 force-directed visualization, backlinks, BFS traversal |
| **Agent Registry** | Register, track, and audit every agent that touches your notes |
| **Task Management** | Create, assign, and track tasks linked to notes and agents |
| **Workflow Templates** | Multi-step agent automation with variable interpolation |
| **Webhooks** | HMAC-SHA256 signed callbacks with delivery logs and retry |
| **iCloud Sync** | Bidirectional sync with SHA-256 conflict resolution |
| **6 Themes** | Dark Graphite, Charcoal, Solarized, Nord, Dracula, and more |

## MCP Server (60 Tools)

Add to your agent's config (Claude Desktop, Claude Code, Cursor, etc.):

```json
{
  "mcpServers": {
    "bruin": {
      "command": "npx",
      "args": ["bruin-mcp-server"]
    }
  }
}
```

Or run from a local clone:

```json
{
  "mcpServers": {
    "bruin": {
      "command": "node",
      "args": ["<path-to-bruin>/mcp-server/dist/index.js"]
    }
  }
}
```

| Category | Count | Key tools |
|----------|-------|-----------|
| Notes & Search | 16 | `create_note`, `search_notes`, `semantic_search`, `advanced_query`, `get_backlinks` |
| Agent Registry | 6 | `register_agent`, `update_agent`, `deactivate_agent`, `get_agent_audit_log` |
| Tasks & Workflows | 10 | `create_task`, `assign_task`, `execute_workflow`, `create_workflow_template` |
| Webhooks | 5 | `register_webhook`, `test_webhook`, `get_webhook_logs` |
| Workspaces & Tags | 8 | `create_workspace`, `bind_agent_workspace`, `list_tags`, `switch_workspace` |
| Utilities & Export | 15 | `import_markdown`, `export_note_html`, `pin_note`, `get_setting`, `get_daily_note` |

4 MCP resources: `bruin://notes`, `bruin://notes/{noteId}`, `bruin://tags`, `bruin://daily`

## Architecture

```
AI Agent ──MCP (stdio)──► MCP Server (Node.js) ──► SQLite ◄── Rust Backend ◄──IPC──► React Frontend
                                                      │
                                                 iCloud Sync
                                              (bidirectional .md files)
```

All three processes share the same SQLite database. The MCP server notifies the Tauri app of changes via a trigger file that the file watcher detects.

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Tauri 2 |
| Backend | Rust, SQLite (WAL + FTS5), rusqlite |
| Frontend | React 19, TipTap, Zustand, D3 |
| Agent Protocol | MCP SDK (TypeScript) |
| Embeddings | @huggingface/transformers (all-MiniLM-L6-v2) |
| Sync | iCloud Drive + notify file watcher |

## Development

### Prerequisites

- Node.js 18+
- Rust (stable) via [rustup](https://rustup.rs/)
- Xcode Command Line Tools

### Setup

```bash
npm install
cd mcp-server && npm install && cd ..
npm run tauri dev          # Vite + Tauri hot reload
```

### Build

```bash
npm run tauri build        # → .dmg in src-tauri/target/release/bundle/
```

### Tests

```bash
npm test                                # Frontend (Vitest)
cd mcp-server && npm test               # MCP server (96 tests)
cd src-tauri && cargo check             # Rust type check
cd src-tauri && cargo clippy            # Rust lint
```

## Roadmap

- [ ] iOS / iPadOS companion app (read + quick capture)
- [ ] Collaborative workspaces (multi-user, shared knowledge graphs)
- [ ] Plugin system for custom MCP tool bundles
- [ ] PDF / web clipper import with auto-tagging
- [ ] End-to-end encryption for synced notes

## Releasing

Version is tracked in three files (keep in sync): `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`.

```bash
git tag v0.4.0
git push origin master --tags
```

GitHub Actions builds `.dmg` for Apple Silicon and Intel, then auto-publishes to Releases. See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

[MIT](LICENSE)
