import { serializeFrontmatter, parseFrontmatter } from "@/services/frontmatter";

describe("serializeFrontmatter", () => {
  it("serializes a note with tags", () => {
    const result = serializeFrontmatter({
      id: "abc-123",
      title: "Test Note",
      content: "Hello world",
      tags: ["project", "ideas"],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
      is_pinned: false,
    });

    expect(result).toContain("---");
    expect(result).toContain('id: "abc-123"');
    expect(result).toContain('title: "Test Note"');
    expect(result).toContain("tags:");
    expect(result).toContain('  - "project"');
    expect(result).toContain('  - "ideas"');
    expect(result).toContain("is_pinned: false");
    expect(result).toContain("Hello world");
  });

  it("serializes empty tags as []", () => {
    const result = serializeFrontmatter({
      id: "abc",
      title: "No Tags",
      content: "",
      tags: [],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      is_pinned: false,
    });

    expect(result).toContain("tags: []");
  });

  it("escapes quotes in title", () => {
    const result = serializeFrontmatter({
      id: "abc",
      title: 'Title with "quotes"',
      content: "",
      tags: [],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      is_pinned: false,
    });

    expect(result).toContain('title: "Title with \\"quotes\\""');
  });

  it("serializes is_pinned true", () => {
    const result = serializeFrontmatter({
      id: "abc",
      title: "Pinned",
      content: "",
      tags: [],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      is_pinned: true,
    });

    expect(result).toContain("is_pinned: true");
  });
});

describe("parseFrontmatter", () => {
  it("parses valid frontmatter with tags", () => {
    const input = `---
id: "abc-123"
title: "Test Note"
tags:
  - "project"
  - "ideas"
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-02T00:00:00Z"
is_pinned: false
---
Hello world`;

    const { frontmatter, body } = parseFrontmatter(input);
    expect(frontmatter.id).toBe("abc-123");
    expect(frontmatter.title).toBe("Test Note");
    expect(frontmatter.tags).toEqual(["project", "ideas"]);
    expect(frontmatter.created_at).toBe("2026-01-01T00:00:00Z");
    expect(frontmatter.updated_at).toBe("2026-01-02T00:00:00Z");
    expect(frontmatter.is_pinned).toBe(false);
    expect(body).toBe("Hello world");
  });

  it("parses empty tags as empty array", () => {
    const input = `---
id: "abc"
title: "No Tags"
tags: []
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-01T00:00:00Z"
is_pinned: false
---
Body`;

    const { frontmatter } = parseFrontmatter(input);
    expect(frontmatter.tags).toEqual([]);
  });

  it("returns empty result for content without frontmatter", () => {
    const { frontmatter, body } = parseFrontmatter("Just plain text");
    expect(frontmatter.id).toBeNull();
    expect(frontmatter.title).toBeNull();
    expect(frontmatter.tags).toEqual([]);
    expect(body).toBe("Just plain text");
  });

  it("handles is_pinned true", () => {
    const input = `---
id: "abc"
title: "Pinned"
tags: []
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-01T00:00:00Z"
is_pinned: true
---
Content`;

    const { frontmatter } = parseFrontmatter(input);
    expect(frontmatter.is_pinned).toBe(true);
  });

  it("handles inline array tags", () => {
    const input = `---
id: "abc"
title: "Inline"
tags: ["one", "two"]
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-01T00:00:00Z"
is_pinned: false
---
Body`;

    const { frontmatter } = parseFrontmatter(input);
    expect(frontmatter.tags).toEqual(["one", "two"]);
  });

  it("roundtrips serialize → parse", () => {
    const note = {
      id: "roundtrip-id",
      title: "Roundtrip Test",
      content: "Some content here",
      tags: ["alpha", "beta/child"],
      created_at: "2026-02-01T12:00:00Z",
      updated_at: "2026-02-02T15:30:00Z",
      is_pinned: true,
    };

    const serialized = serializeFrontmatter(note);
    const { frontmatter, body } = parseFrontmatter(serialized);

    expect(frontmatter.id).toBe(note.id);
    expect(frontmatter.title).toBe(note.title);
    expect(frontmatter.tags).toEqual(note.tags);
    expect(frontmatter.is_pinned).toBe(note.is_pinned);
    expect(body).toBe(note.content);
  });

  it("handles frontmatter with no body", () => {
    const input = `---
id: "abc"
title: "No Body"
tags: []
created_at: "2026-01-01T00:00:00Z"
updated_at: "2026-01-01T00:00:00Z"
is_pinned: false
---`;

    const { frontmatter, body } = parseFrontmatter(input);
    expect(frontmatter.id).toBe("abc");
    expect(body).toBe("");
  });
});
