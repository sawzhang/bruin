# Bruin

An agent-native markdown note-taking app. AI agents read, write, and organize your knowledge through [MCP](https://modelcontextprotocol.io) — while you stay in control with human-in-the-loop review.

Built with Tauri 2 + Rust + React 19.

## Features

- **MCP Server** — 14 tools across 3 tiers. Agents get the same power as the GUI: create, search, link, and organize notes.
- **Knowledge Graph** — `[[Wiki-links]]` with bidirectional backlinks and D3 force-directed visualization.
- **Semantic Search** — Local embeddings via Hugging Face Transformers. Your data never leaves your machine.
- **Review Workflow** — Notes flow through `draft → review → published`. Agents write, humans approve.
- **iCloud Sync** — Bidirectional sync with SHA-256 hash comparison and conflict resolution.
- **Full-Text Search** — SQLite FTS5 for instant keyword search alongside semantic results.
- **Hierarchical Tags** — Nested tags like `#project/bruin/v2` with tree navigation.
- **Workspaces** — Separate spaces for personal notes, agent output, and projects.
- **Webhooks** — HMAC-signed HTTP callbacks on note events.
- **6 Themes** — Dark Graphite, Charcoal, Solarized, Nord, Dracula, and more.

## Download

Grab the latest `.dmg` from [GitHub Releases](https://github.com/sawzhang/bruin/releases/latest) (Apple Silicon & Intel).

> If macOS shows "app is damaged", run: `xattr -cr /Applications/Bruin.app`

See [CHANGELOG.md](CHANGELOG.md) for version history.

## MCP Server Setup

Add to your `claude_desktop_config.json`:

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

### Available Tools

| Tier | Tool | Description |
|------|------|-------------|
| Core | `create_note` | Create with title, content, tags, workspace |
| Core | `read_note` | Fetch full note by ID |
| Core | `update_note` | Partial or full content update |
| Core | `delete_note` | Soft-delete to trash or permanent |
| Core | `list_notes` | Paginated listing with filters |
| Core | `search_notes` | Full-text search with FTS5 |
| Core | `list_tags` | All tags with note counts |
| Core | `get_note_by_title` | Lookup by exact title match |
| Agent | `batch_create_notes` | Atomic creation of multiple notes |
| Agent | `append_to_note` | Incremental writes, not full replace |
| Agent | `get_backlinks` | Query knowledge graph connections |
| Agent | `get_daily_note` | Idempotent access to today's note |
| Agent | `advanced_query` | Tags AND/OR, dates, word count, FTS |
| Utility | `import_markdown` | Import .md files with frontmatter parsing |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) (stable)
- [Tauri CLI](https://tauri.app/) (`npm install -g @tauri-apps/cli`)

### Setup

```bash
# Install frontend dependencies
npm install

# Install MCP server dependencies
cd mcp-server && npm install && cd ..

# Start in dev mode
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/`

### Tests

```bash
# Frontend tests
npm test

# MCP server tests
cd mcp-server && npm test
```

## Architecture

```
┌─────────────┐     MCP Protocol     ┌─────────────┐     GUI / Editor     ┌─────────────┐
│  AI Agent   │ ◄──────────────────► │  Bruin App  │ ◄──────────────────► │    Human    │
│ Claude, GPT │                      │ Tauri + Rust│                      │   Review &  │
│   custom    │                      │  + React    │                      │   Publish   │
└─────────────┘                      └──────┬──────┘                      └─────────────┘
                                            │
                                    ┌───────┴───────┐
                                    │    SQLite     │
                                    │ FTS5 + Graph  │
                                    │  Embeddings   │
                                    └───────┬───────┘
                                            │
                                     iCloud Sync
                                     Webhooks
                                     File Watcher
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Tauri 2 |
| Backend | Rust, SQLite (rusqlite), FTS5 |
| Frontend | React 19, Tiptap, Zustand, D3 |
| Agent Protocol | MCP SDK (TypeScript) |
| Embeddings | @huggingface/transformers |
| Sync | iCloud Drive + notify file watcher |

## Release

Releases are fully automated via GitHub Actions. To publish a new version:

```bash
# 1. Update version in all three files:
#    - package.json
#    - src-tauri/Cargo.toml
#    - src-tauri/tauri.conf.json

# 2. Update CHANGELOG.md

# 3. Commit, tag, and push
git add -A && git commit -m "Release v0.2.0"
git tag v0.2.0
git push origin master --tags
```

GitHub Actions will build `.dmg` for Apple Silicon and Intel, then publish the release automatically.

## License

MIT
