# Changelog

All notable changes to Bruin will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/sawzhang/bruin/releases/tag/v0.1.0
