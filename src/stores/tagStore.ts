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
  pinTag: (name: string, pinned: boolean) => Promise<void>;
  renameTag: (oldName: string, newName: string) => Promise<void>;
  deleteTag: (name: string) => Promise<void>;
  buildTagTree: () => void;
}

function buildTree(tags: Tag[]): TagTreeNode[] {
  const nodeMap = new Map<string, TagTreeNode>();

  // Sort: pinned first, then alphabetical
  const sorted = [...tags].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const tag of sorted) {
    nodeMap.set(tag.name, {
      name: tag.name.split("/").pop() ?? tag.name,
      fullPath: tag.name,
      noteCount: tag.note_count,
      isPinned: tag.is_pinned,
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

  pinTag: async (name: string, pinned: boolean) => {
    try {
      await tauri.pinTag(name, pinned);
      await get().loadTags();
    } catch (err) {
      useToastStore.getState().addToast({ type: "error", message: `Failed to pin tag: ${err}` });
    }
  },

  renameTag: async (oldName: string, newName: string) => {
    try {
      await tauri.renameTag(oldName, newName);
      // Update selection if the renamed tag was selected
      const { selectedTags } = get();
      const updated = selectedTags.map((t) =>
        t === oldName ? newName : t.startsWith(oldName + "/") ? newName + t.slice(oldName.length) : t,
      );
      set({ selectedTags: updated });
      await get().loadTags();
    } catch (err) {
      useToastStore.getState().addToast({ type: "error", message: `${err}` });
    }
  },

  deleteTag: async (name: string) => {
    try {
      await tauri.deleteTag(name);
      // Remove from selection if it was selected
      const { selectedTags } = get();
      set({ selectedTags: selectedTags.filter((t) => t !== name && !t.startsWith(name + "/")) });
      await get().loadTags();
    } catch (err) {
      useToastStore.getState().addToast({ type: "error", message: `Failed to delete tag: ${err}` });
    }
  },

  buildTagTree: () => {
    const { tags } = get();
    const tagTree = buildTree(tags);
    set({ tagTree });
  },
}));
