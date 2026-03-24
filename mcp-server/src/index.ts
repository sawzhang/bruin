#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function installSkill() {
  const skillsDir = path.join(os.homedir(), ".claude", "skills");
  const skillSrc = path.join(__dirname, "..", "..", ".claude", "skills", "bruin.md");
  const skillDst = path.join(skillsDir, "bruin.md");

  try {
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.copyFile(skillSrc, skillDst);
    console.log(`✓ Bruin skill installed → ${skillDst}`);
    console.log("");
    console.log("In Claude Code, Claude now understands Bruin natively.");
    console.log("Try: /mcp:bruin-notes:daily_log");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`✗ Failed to install skill: ${message}`);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`bruin-mcp-server — Bruin MCP Server v${process.env.npm_package_version ?? "0.4.0"}

USAGE
  npx bruin-mcp-server              Start MCP server (stdio transport)
  npx bruin-mcp-server --help       Show this help
  npx bruin-mcp-server --install-skill   Install Claude Code skill to ~/.claude/skills/

CLAUDE CODE SETUP
  Add to ~/.claude.json or claude_desktop_config.json:
  {
    "mcpServers": {
      "bruin": {
        "command": "npx",
        "args": ["bruin-mcp-server"]
      }
    }
  }

TOOLS  60 tools across: notes, search, knowledge graph, agents, tasks, webhooks, workspaces
PROMPTS  /mcp:bruin-notes:daily_log | research_capture | weekly_review | link_knowledge
RESOURCES  bruin://notes | bruin://notes/{id} | bruin://tags | bruin://daily

  https://github.com/sawzhang/bruin
`);
}

async function main() {
  const arg = process.argv[2];

  if (arg === "--help" || arg === "-h") {
    printHelp();
    return;
  }

  if (arg === "--install-skill") {
    await installSkill();
    return;
  }

  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
