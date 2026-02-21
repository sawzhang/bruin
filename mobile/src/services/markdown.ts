/**
 * Extract hashtags from markdown content, ignoring tags inside fenced code blocks.
 * Matches: #tag, #parent/child, #a/b/c (alphanumeric + underscore, slash-separated).
 * Returns sorted, deduplicated array.
 */
export function extractTags(content: string): string[] {
  // Remove fenced code blocks before extracting tags
  const cleaned = content.replace(/```[\s\S]*?```/g, "");

  const tagRe = /#([a-zA-Z0-9_]+(?:\/[a-zA-Z0-9_]+)*)/g;
  const tags = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(cleaned)) !== null) {
    tags.add(match[1]);
  }

  return Array.from(tags).sort();
}

/**
 * Generate a plain-text preview from markdown content.
 * Strips markdown syntax (headers, bold, italic, links, images, code blocks, etc.)
 * and truncates safely for multi-byte characters.
 */
export function generatePreview(content: string, maxLength = 120): string {
  let text = content;

  // Remove fenced code blocks
  text = text.replace(/```[\s\S]*?```/g, "");

  // Remove inline code
  text = text.replace(/`[^`]+`/g, "");

  // Remove images: ![alt](url)
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "");

  // Remove links: [text](url) → text
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

  // Remove headers: # ## ### etc
  text = text.replace(/^#{1,6}\s+/gm, "");

  // Remove bold: **text** or __text__
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/__([^_]+)__/g, "$1");

  // Remove italic: *text* or _text_
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/_([^_]+)_/g, "$1");

  // Remove strikethrough: ~~text~~
  text = text.replace(/~~([^~]+)~~/g, "$1");

  // Remove blockquotes: > text
  text = text.replace(/^>\s+/gm, "");

  // Remove horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, "");

  // Remove list markers: - item, * item, 1. item, - [ ] item
  text = text.replace(/^[\s]*[-*+]\s+(\[[ x]\]\s+)?/gm, "");
  text = text.replace(/^[\s]*\d+\.\s+/gm, "");

  // Collapse multiple newlines/whitespace into single space
  text = text.replace(/\s+/g, " ").trim();

  // Truncate safely for multi-byte characters
  if (text.length <= maxLength) {
    return text;
  }

  const chars = Array.from(text);
  if (chars.length <= maxLength) {
    return text;
  }

  return chars.slice(0, maxLength).join("") + "...";
}

/**
 * Count words in text content.
 * Splits on whitespace, filters empty strings.
 */
export function countWords(content: string): number {
  return content
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}
