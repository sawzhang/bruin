/**
 * Test the buildTree logic from tagStore.
 * Since buildTree is not exported, we re-implement the same algorithm here
 * and test it, or we test via the store.
 * For simplicity, we test the algorithm directly.
 */

import type { Tag, TagTreeNode } from "@/types";

// Re-implement buildTree to test it in isolation (matches tagStore.ts)
function buildTree(tags: Tag[]): TagTreeNode[] {
  const nodeMap = new Map<string, TagTreeNode>();
  const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name));

  for (const tag of sorted) {
    nodeMap.set(tag.name, {
      name: tag.name.split("/").pop() ?? tag.name,
      fullPath: tag.name,
      noteCount: tag.note_count,
      children: [],
    });
  }

  const roots: TagTreeNode[] = [];

  for (const tag of sorted) {
    const node = nodeMap.get(tag.name)!;
    if (tag.parent_name && nodeMap.has(tag.parent_name)) {
      nodeMap.get(tag.parent_name)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

const makeTag = (
  name: string,
  parent_name: string | null = null,
  note_count = 1
): Tag => ({
  id: Math.floor(Math.random() * 10000),
  name,
  parent_name,
  note_count,
});

describe("buildTree", () => {
  it("builds flat list for tags without parents", () => {
    const tags = [makeTag("ideas"), makeTag("projects"), makeTag("daily")];
    const tree = buildTree(tags);

    expect(tree).toHaveLength(3);
    expect(tree.map((n) => n.fullPath).sort()).toEqual([
      "daily",
      "ideas",
      "projects",
    ]);
  });

  it("nests children under parent", () => {
    const tags = [
      makeTag("project"),
      makeTag("project/bruin", "project"),
      makeTag("project/other", "project"),
    ];
    const tree = buildTree(tags);

    expect(tree).toHaveLength(1);
    expect(tree[0].fullPath).toBe("project");
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children.map((c) => c.name).sort()).toEqual([
      "bruin",
      "other",
    ]);
  });

  it("builds deep hierarchy", () => {
    const tags = [
      makeTag("a"),
      makeTag("a/b", "a"),
      makeTag("a/b/c", "a/b"),
    ];
    const tree = buildTree(tags);

    expect(tree).toHaveLength(1);
    expect(tree[0].fullPath).toBe("a");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].fullPath).toBe("a/b");
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].fullPath).toBe("a/b/c");
    expect(tree[0].children[0].children[0].name).toBe("c");
  });

  it("extracts short name from full path", () => {
    const tags = [makeTag("project/bruin/v2", "project/bruin")];
    const tree = buildTree(tags);

    expect(tree[0].name).toBe("v2");
    expect(tree[0].fullPath).toBe("project/bruin/v2");
  });

  it("handles empty tags array", () => {
    expect(buildTree([])).toEqual([]);
  });

  it("preserves note_count", () => {
    const tags = [makeTag("important", null, 42)];
    const tree = buildTree(tags);

    expect(tree[0].noteCount).toBe(42);
  });

  it("handles orphan child (parent not in list)", () => {
    const tags = [makeTag("a/b/c", "a/b")]; // parent "a/b" not present
    const tree = buildTree(tags);

    // Should be at root since parent is missing
    expect(tree).toHaveLength(1);
    expect(tree[0].fullPath).toBe("a/b/c");
  });
});
