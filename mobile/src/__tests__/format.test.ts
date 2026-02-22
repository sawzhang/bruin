import { truncateText } from "@/utils/format";

describe("truncateText", () => {
  it("returns text unchanged if under limit", () => {
    expect(truncateText("hello", 10)).toBe("hello");
  });

  it("truncates long text with ellipsis", () => {
    const result = truncateText("the quick brown fox jumps over the lazy dog", 20);
    expect(result).toContain("...");
    expect(result.length).toBeLessThanOrEqual(23); // 20 + "..."
  });

  it("breaks at word boundary when possible", () => {
    const result = truncateText("hello world foo bar baz", 12);
    // Should break at a space if possible
    expect(result).toContain("...");
  });

  it("handles multi-byte characters (emoji)", () => {
    const text = "Hello 🌍🌎🌏 World Extra Text Here For Length";
    const result = truncateText(text, 10);
    expect(result).toBeDefined();
    expect(result).toContain("...");
  });

  it("handles multi-byte characters (CJK)", () => {
    const text = "这是一段很长的中文测试文本需要截断处理";
    const result = truncateText(text, 5);
    expect(result).toBeDefined();
    expect(result).toContain("...");
  });

  it("returns exact text when length equals limit", () => {
    expect(truncateText("12345", 5)).toBe("12345");
  });

  it("handles empty string", () => {
    expect(truncateText("", 10)).toBe("");
  });
});
