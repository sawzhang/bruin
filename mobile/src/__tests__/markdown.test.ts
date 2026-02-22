import { extractTags, generatePreview, countWords } from "@/services/markdown";

describe("extractTags", () => {
  it("extracts simple tags", () => {
    expect(extractTags("Hello #world #test")).toEqual(["test", "world"]);
  });

  it("extracts hierarchical tags", () => {
    expect(extractTags("#project/bruin/v2 some text #ideas")).toEqual([
      "ideas",
      "project/bruin/v2",
    ]);
  });

  it("deduplicates tags", () => {
    expect(extractTags("#foo #bar #foo")).toEqual(["bar", "foo"]);
  });

  it("returns sorted results", () => {
    expect(extractTags("#zebra #alpha #middle")).toEqual([
      "alpha",
      "middle",
      "zebra",
    ]);
  });

  it("ignores tags inside fenced code blocks", () => {
    const content = "```\n#not_a_tag\n```\n#real_tag";
    expect(extractTags(content)).toEqual(["real_tag"]);
  });

  it("returns empty array for no tags", () => {
    expect(extractTags("No tags here")).toEqual([]);
  });

  it("handles tags with underscores", () => {
    expect(extractTags("#my_tag #another_one")).toEqual([
      "another_one",
      "my_tag",
    ]);
  });

  it("does not match hash followed by space or special chars", () => {
    expect(extractTags("# heading\n## subheading")).toEqual([]);
  });
});

describe("generatePreview", () => {
  it("strips markdown headers", () => {
    expect(generatePreview("# Hello World")).toBe("Hello World");
  });

  it("strips bold and italic", () => {
    expect(generatePreview("**bold** and *italic*")).toBe("bold and italic");
  });

  it("strips links, keeps text", () => {
    expect(generatePreview("[click here](https://example.com)")).toBe(
      "click here"
    );
  });

  it("strips images completely", () => {
    expect(generatePreview("![alt](image.png) text")).toBe("text");
  });

  it("strips fenced code blocks", () => {
    expect(generatePreview("before\n```\ncode\n```\nafter")).toBe(
      "before after"
    );
  });

  it("strips inline code", () => {
    expect(generatePreview("use `const x = 1` here")).toBe("use here");
  });

  it("strips blockquotes", () => {
    expect(generatePreview("> quoted text")).toBe("quoted text");
  });

  it("strips list markers", () => {
    expect(generatePreview("- item one\n- item two")).toBe("item one item two");
  });

  it("truncates long text with ellipsis", () => {
    const long = "a".repeat(200);
    const result = generatePreview(long, 50);
    expect(result.length).toBeLessThanOrEqual(53); // 50 + "..."
    expect(result).toContain("...");
  });

  it("handles empty content", () => {
    expect(generatePreview("")).toBe("");
  });

  it("handles multi-byte characters safely", () => {
    const emoji = "Hello 🌍🌎🌏 World";
    const result = generatePreview(emoji, 10);
    expect(result).toBeDefined();
    // Should not throw on multi-byte truncation
  });
});

describe("countWords", () => {
  it("counts simple words", () => {
    expect(countWords("hello world")).toBe(2);
  });

  it("handles multiple spaces", () => {
    expect(countWords("hello    world")).toBe(2);
  });

  it("handles newlines and tabs", () => {
    expect(countWords("hello\nworld\tfoo")).toBe(3);
  });

  it("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });

  it("returns 0 for whitespace only", () => {
    expect(countWords("   \n\t  ")).toBe(0);
  });

  it("counts single word", () => {
    expect(countWords("hello")).toBe(1);
  });
});
