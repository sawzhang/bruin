import type { FrontmatterData } from "@/types";

interface SerializableNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  is_pinned: boolean;
}

/**
 * Serialize a Note into a markdown string with YAML frontmatter.
 * Port of Rust serialize_frontmatter — uses manual string building for exact format match.
 */
export function serializeFrontmatter(note: SerializableNote): string {
  let fm = "";
  fm += "---\n";
  fm += `id: "${note.id}"\n`;
  fm += `title: "${note.title.replace(/"/g, '\\"')}"\n`;
  if (note.tags.length > 0) {
    fm += "tags:\n";
    for (const tag of note.tags) {
      fm += `  - "${tag}"\n`;
    }
  } else {
    fm += "tags: []\n";
  }
  fm += `created_at: "${note.created_at}"\n`;
  fm += `updated_at: "${note.updated_at}"\n`;
  fm += `is_pinned: ${note.is_pinned}\n`;
  fm += "---\n";
  fm += note.content;
  return fm;
}

/**
 * Parse a markdown string with YAML frontmatter into FrontmatterData and body content.
 * Port of Rust parse_frontmatter — manual YAML parsing for exact compatibility.
 */
export function parseFrontmatter(content: string): {
  frontmatter: FrontmatterData;
  body: string;
} {
  const emptyResult: FrontmatterData = {
    id: null,
    title: null,
    tags: [],
    created_at: null,
    updated_at: null,
    is_pinned: false,
  };

  if (!content.startsWith("---")) {
    return { frontmatter: emptyResult, body: content };
  }

  const rest = content.slice(3);

  // Find closing --- delimiter. Try \n---\n first (has body after), then \n--- at end.
  let yamlEnd: number;
  let bodyOffset: number;

  const posWithBody = rest.indexOf("\n---\n");
  if (posWithBody !== -1) {
    yamlEnd = posWithBody;
    bodyOffset = posWithBody + 5; // skip \n---\n
  } else {
    const posAtEnd = rest.indexOf("\n---");
    if (posAtEnd !== -1) {
      const after = posAtEnd + 4;
      if (after >= rest.length || rest.slice(after).trim() === "") {
        yamlEnd = posAtEnd;
        bodyOffset = rest.length; // no body
      } else {
        yamlEnd = posAtEnd;
        bodyOffset = after;
      }
    } else {
      // No closing ---, return as-is with error behavior matching Rust (returns error)
      // but for resilience in mobile, treat as no frontmatter
      return { frontmatter: emptyResult, body: content };
    }
  }

  const yamlStr = rest.slice(0, yamlEnd).trim();
  const body = bodyOffset < rest.length ? rest.slice(bodyOffset) : "";

  if (yamlStr.length === 0) {
    return { frontmatter: emptyResult, body };
  }

  // Manual YAML parsing to match Rust yaml_rust2 behavior
  const frontmatter = parseYamlFields(yamlStr);

  return { frontmatter, body };
}

/**
 * Parse YAML key-value pairs from frontmatter string.
 * Handles: quoted strings, booleans, arrays (both inline [] and multi-line - "item").
 */
function parseYamlFields(yamlStr: string): FrontmatterData {
  const result: FrontmatterData = {
    id: null,
    title: null,
    tags: [],
    created_at: null,
    updated_at: null,
    is_pinned: false,
  };

  const lines = yamlStr.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      i++;
      continue;
    }

    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1).trim();

    switch (key) {
      case "id":
        result.id = parseYamlString(rawValue);
        break;
      case "title":
        result.title = parseYamlString(rawValue);
        break;
      case "created_at":
        result.created_at = parseYamlString(rawValue);
        break;
      case "updated_at":
        result.updated_at = parseYamlString(rawValue);
        break;
      case "is_pinned":
        result.is_pinned = rawValue === "true";
        break;
      case "tags": {
        // Could be inline `tags: []` or `tags:` followed by `  - "item"` lines
        if (rawValue === "[]" || rawValue === "") {
          // Check if next lines are array items
          if (rawValue === "") {
            const items: string[] = [];
            while (i + 1 < lines.length) {
              const nextLine = lines[i + 1];
              const trimmed = nextLine.trim();
              if (trimmed.startsWith("- ")) {
                items.push(parseYamlString(trimmed.slice(2).trim()));
                i++;
              } else {
                break;
              }
            }
            result.tags = items;
          } else {
            result.tags = [];
          }
        } else if (rawValue.startsWith("[")) {
          // Inline array: [tag1, tag2] or ["tag1", "tag2"]
          const inner = rawValue.slice(1, -1).trim();
          if (inner === "") {
            result.tags = [];
          } else {
            result.tags = inner.split(",").map((s) => parseYamlString(s.trim()));
          }
        } else {
          // Single value on same line (unlikely but handle it)
          result.tags = [parseYamlString(rawValue)];
        }
        break;
      }
      default:
        break;
    }

    i++;
  }

  return result;
}

/**
 * Parse a YAML string value, handling quoted and unquoted forms.
 * Removes surrounding quotes and unescapes \" sequences.
 */
function parseYamlString(value: string): string {
  if (value.length === 0) {
    return "";
  }

  // Double-quoted string
  if (value.startsWith('"') && value.endsWith('"')) {
    return value
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }

  // Single-quoted string
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }

  // Unquoted
  return value;
}
