import { create } from "zustand";
import type { Tag, TagTreeNode } from "../types/tag";
import * as tauri from "../lib/tauri";
import { useToastStore } from "./toastStore";

interface TagState {
  tags: Tag[];
  selectedTags: string[];
  tagTree: TagTreeNode[];
  loadTags: () => Promise<void>;
  selectTag: (tag: string | null) => void;
  toggleTag: (tag: string) => void;
  clearTags: () => void;
  buildTagTree: () => void;
}

function buildTree(tags: Tag[]): TagTreeNode[] {
  const nodeMap = new Map<string, TagTreeNode>();

  // Sort so parents come before children
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

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  selectedTags: [],
  tagTree: [],

  loadTags: async () => {
    try {
      const tags = await tauri.listTags();
      set({ tags });
      get().buildTagTree();
    } catch (err) {
      useToastStore.getState().addToast({ type: "error", message: `Failed to load tags: ${err}` });
    }
  },

  selectTag: (tag: string | null) => {
    set({ selectedTags: tag ? [tag] : [] });
  },

  toggleTag: (tag: string) => {
    const { selectedTags } = get();
    if (selectedTags.includes(tag)) {
      set({ selectedTags: selectedTags.filter((t) => t !== tag) });
    } else {
      set({ selectedTags: [...selectedTags, tag] });
    }
  },

  clearTags: () => {
    set({ selectedTags: [] });
  },

  buildTagTree: () => {
    const { tags } = get();
    const tagTree = buildTree(tags);
    set({ tagTree });
  },
}));
