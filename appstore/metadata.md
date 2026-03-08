# Bruin Notes — App Store Metadata

## App Name
Bruin Notes

## Subtitle (30 chars max)
AI-Native Knowledge Manager

## Promotional Text (170 chars max, can be updated without review)
The first note-taking app built for AI agents. 60 MCP tools, knowledge graphs, iCloud sync, and a human-in-the-loop review workflow. Your second brain, supercharged.

## Description (4000 chars max)

Bruin Notes is a personal knowledge management app designed from the ground up for AI collaboration. Connect any AI agent via the Model Context Protocol (MCP) and let it read, write, and organize your notes — while you maintain full control through a built-in review workflow.

KEY FEATURES

Rich Markdown Editor
Write with a powerful editor featuring slash commands, syntax-highlighted code blocks, tables, task lists, images, and wiki-links. Auto-save keeps your work safe.

Knowledge Graph
Visualize how your notes connect. An interactive D3-powered force graph reveals relationships through wiki-links and backlinks. Zoom, pan, filter by depth, and color-code by tag.

AI Agent Integration (MCP)
60 tools available via the Model Context Protocol. Any AI model — Claude, GPT, or your custom agents — can create notes, search your knowledge base, manage tasks, and run workflows. No vendor lock-in.

Human-in-the-Loop Review
Agents write drafts. You review and publish. The three-state lifecycle (Draft, Review, Published) ensures you always have the final say on what enters your knowledge base.

Semantic Search
Find notes by meaning, not just keywords. Built-in local embeddings (no API key needed) power semantic search alongside full-text search with boolean filters, tag filtering, and date ranges.

iCloud Sync
Notes sync as Markdown files with YAML frontmatter via iCloud Drive. Access your notes across all your Macs. Conflict resolution uses SHA-256 hashing with automatic merge.

Workspaces
Organize notes into separate workspaces for personal, project, or team use. Scope AI agents to specific workspaces for controlled access.

Task Management
Create tasks with priorities and due dates, link them to notes for context, and assign them to AI agents for delegation.

Workflow Automation
Build multi-step workflow templates and execute them on demand. Pre-built templates for daily standups, research summaries, and more.

Webhooks
Subscribe to note events with HMAC-SHA256 signed webhooks. Full delivery logs and retry mechanisms included.

6 Beautiful Themes
Dark Graphite, Red Graphite, Charcoal, High Contrast, Solarized Light, and Solarized Dark. Each with carefully tuned syntax highlighting.

Templates & Daily Notes
Start from templates for journals, meetings, or custom formats. Automatic daily note creation keeps your routine on track.

Privacy First
All data stored locally in SQLite. Embeddings run on-device. iCloud sync is optional. No telemetry, no tracking, no third-party analytics.

WHAT MAKES BRUIN DIFFERENT

Most note apps treat AI as an afterthought — a chatbot bolted onto a text editor. Bruin is different. Every feature is accessible to AI agents through a standardized protocol. Your AI assistant can search your knowledge graph, create tasks, trigger workflows, and draft notes — all while you maintain control through the review pipeline.

Built with Tauri 2 (Rust backend, React frontend) for native performance and a small footprint.

## Keywords (100 chars max, comma-separated)
notes,markdown,AI,MCP,knowledge,graph,wiki,agent,sync,iCloud,PKM,search,semantic,productivity,tasks

## Category
Primary: Productivity
Secondary: Developer Tools

## What's New (v0.4.0)
- Expanded MCP server to 60 tools across 6 categories
- Semantic search with local embeddings
- Task management with agent assignment
- Workflow automation templates
- Webhook delivery logs
- 6 color themes with syntax highlighting

## Copyright
Copyright 2026 Bruin. All rights reserved.

## Age Rating
4+ (No objectionable content)

## Price
Free

---

# Privacy Policy Requirements

App Store requires a privacy URL. Minimum content:

## Data Collection Summary (for App Store privacy labels)
- Data Not Collected: Bruin does not collect any data
- Data Not Linked to You: No analytics, no tracking
- Data Used to Track You: None

## Privacy Practices
- All notes stored locally on device
- iCloud sync is optional and uses Apple's infrastructure
- Embeddings computed on-device (no external API calls)
- No telemetry or crash reporting
- No third-party SDKs that collect data

---

# Screenshots Guide

## Required Sizes (macOS)
- 1280 x 800 pixels (minimum)
- 2560 x 1600 pixels (retina, recommended)
- Up to 10 screenshots

## Recommended Screenshots (6-8)

### Screenshot 1: Hero — Editor View
Show the main editor with a well-formatted note containing:
- Headings, bold text, code block
- Sidebar with note list visible
- A nice theme (Dark Graphite recommended)
Caption: "A powerful Markdown editor built for AI collaboration"

### Screenshot 2: Knowledge Graph
Show the force-directed graph with 15-20 connected nodes:
- Different colored nodes (tag-based colors)
- Visible connections between notes
- Zoom controls visible
Caption: "Visualize connections in your knowledge base"

### Screenshot 3: Semantic Search
Show search results with the search bar active:
- Mix of semantic and keyword results
- Tag pills visible in results
- Clear relevance indicators
Caption: "Find notes by meaning with on-device AI search"

### Screenshot 4: Review Workflow
Show the note state indicators (Draft/Review/Published):
- A note in "Review" state
- Activity feed showing state transitions
- Agent attribution visible
Caption: "Review AI-generated content before publishing"

### Screenshot 5: Task Management
Show the task interface with:
- Tasks at different priorities
- Some assigned to agents
- Due dates visible
Caption: "Manage tasks and delegate to AI agents"

### Screenshot 6: Themes
Show a collage or side-by-side of 2-3 themes:
- Dark Graphite vs Solarized Light
- Same note content in different themes
Caption: "6 beautiful themes for every preference"

### Screenshot 7: iCloud Sync
Show the sync status indicator:
- "Synced" status visible
- iCloud path shown in settings
Caption: "Seamless iCloud sync across all your Macs"

### Screenshot 8: MCP Integration
Show the agent registry or webhook interface:
- Registered agents listed
- Tool count visible
Caption: "60 MCP tools for any AI model — Claude, GPT, and more"
