# Bruin

**The note-taking app built for AI agents — local-first, MCP-native, human-in-the-loop.**

> AI agents don't just answer questions. They should read, write, and organize your knowledge — with your approval.

[![CI](https://github.com/sawzhang/bruin/actions/workflows/ci.yml/badge.svg)](https://github.com/sawzhang/bruin/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**[Mac App Store](https://apps.apple.com/app/bruin-notes/id6759669768)** · **[Direct Download](https://github.com/sawzhang/bruin/releases/latest)** · **[bruin.me](https://bruin.me)**

> Direct download only: if macOS shows "app is damaged": `xattr -cr /Applications/Bruin.app`

---

## Quick Start — Claude Code / OpenClaw

**Tell Claude this one sentence:**

```
Read https://bruin.me/skills.md and help me install and set up Bruin.
```

Claude will read the skills file, walk you through adding the MCP config, and start using your knowledge base immediately.

**Or set up manually in 2 steps:**

**1. Add to your MCP config** (auto-writes the correct config):

```bash
/Applications/Bruin.app/Contents/MacOS/bruin --write-config
```

This writes to `~/.claude.json`. The MCP server is **built into the app** — no npm, no Node.js required.

**2. Install the Claude Code skill** (makes Claude natively understand Bruin across all sessions):

```bash
/Applications/Bruin.app/Contents/MacOS/bruin --install-skill
```

That's it. Claude can now write notes, run daily logs, do research capture, build knowledge graphs, and more — all through natural conversation.

---

## What Makes Bruin Different

| Traditional Note Apps | Bruin |
|----------------------|-------|
| AI is a sidebar chatbot | AI agents have 60 MCP tools — full CRUD, search, tagging, workflows |
| Notes are for humans only | Notes flow through `draft → review → published` — agents write, humans approve |
| Cloud-dependent | Local-first SQLite + iCloud sync — your data never leaves your machine |
| Flat file lists | Knowledge graph with `[[wiki-links]]`, backlinks, force-directed visualization |

---

## MCP Primitives

### 4 Prompts — Invoke directly in Claude Code

```
/mcp:bruin-notes:daily_log                                  # Append to today's log
/mcp:bruin-notes:research_capture topic="AI frameworks"     # Save research from any source
/mcp:bruin-notes:weekly_review                              # Summarize the week's notes
/mcp:bruin-notes:link_knowledge note_id="<id>"             # Build wiki-links between notes
```

### 4 Resources — Reference with @bruin

| Resource | Contents |
|---------|---------|
| `bruin://notes` | All notes list |
| `bruin://notes/{id}` | Single note content |
| `bruin://tags` | All tags with counts |
| `bruin://daily` | Today's daily note |

### 60 Tools — Full reference at [bruin.me/skills.md](https://bruin.me/skills.md)

| Category | Count | Key tools |
|----------|-------|-----------|
| Notes & Search | 16 | `create_note`, `append_to_note`, `search_notes`, `semantic_search`, `advanced_query` |
| Knowledge Graph | 3 | `get_knowledge_graph`, `get_forward_links`, `get_backlinks` |
| Agent Registry | 6 | `register_agent`, `get_agent_audit_log`, `set_current_agent` |
| Workspaces | 7 | `create_workspace`, `bind_agent_workspace`, `switch_workspace` |
| Tasks & Workflows | 10 | `create_task`, `assign_task`, `create_workflow_template`, `execute_workflow` |
| Webhooks | 6 | `register_webhook`, `test_webhook`, `get_webhook_logs` |
| Settings & Export | 5 | `get_setting`, `export_note_markdown`, `export_note_html` |
| Utility | 3 | `pin_note`, `restore_note`, `list_tags` |

---

## Features

| Area | What you get |
|------|--------------|
| **Editor** | TipTap markdown with syntax highlighting, tables, images, slash commands |
| **Search** | FTS5 full-text + semantic search (all-MiniLM-L6-v2, auto-indexed) |
| **Knowledge Graph** | D3 force-directed visualization, backlinks, BFS traversal |
| **Agent Registry** | Register, track, and audit every agent that touches your notes |
| **Task Management** | Create, assign, and track tasks linked to notes and agents |
| **Workflow Templates** | Multi-step agent automation with variable chaining |
| **Webhooks** | HMAC-SHA256 signed callbacks with delivery logs and retry |
| **iCloud Sync** | Bidirectional sync with SHA-256 conflict resolution |
| **6 Themes** | Dark Graphite, Charcoal, Solarized, Nord, Dracula, and more |

---

## Architecture

```
AI Agent ──MCP (stdio)──► MCP Server (Node.js) ──► SQLite ◄── Rust Backend ◄──IPC──► React Frontend
                                                      │
                                                 iCloud Sync
                                              (bidirectional .md files)
```

All three processes share the same SQLite database at `~/Library/Application Support/com.bruin.app/bruin.db`. The MCP server notifies the Tauri app of changes via a trigger file that the file watcher detects.

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Tauri 2 |
| Backend | Rust, SQLite (WAL + FTS5), rusqlite |
| Frontend | React 19, TipTap, Zustand, D3 |
| Agent Protocol | MCP SDK (TypeScript) — Tools + Resources + Prompts |
| Embeddings | @huggingface/transformers (all-MiniLM-L6-v2, local) |
| Sync | iCloud Drive + notify file watcher |

---

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
npm test                        # Frontend (Vitest)
cd mcp-server && npm test       # MCP server (96 tests)
cd src-tauri && cargo check     # Rust type check
cd src-tauri && cargo clippy    # Rust lint
```

---

## Roadmap

- [ ] iOS / iPadOS companion app (read + quick capture)
- [ ] Collaborative workspaces (multi-user, shared knowledge graphs)
- [ ] Plugin system for custom MCP tool bundles
- [ ] PDF / web clipper import with auto-tagging
- [ ] End-to-end encryption for synced notes

---

## Releasing

Version is tracked in three files (keep in sync): `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`.

```bash
git tag v1.0.0
git push origin master --tags
```

GitHub Actions builds `.dmg` for Apple Silicon and Intel, then auto-publishes to Releases. See [CHANGELOG.md](CHANGELOG.md) for version history.

---

## License

[MIT](LICENSE)
