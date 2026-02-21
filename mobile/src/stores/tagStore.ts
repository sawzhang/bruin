import { create } from "zustand";
import type { Tag, TagTreeNode } from "@/types";
import * as database from "@/services/database";
import type { SQLiteDatabase } from "expo-sqlite";

interface TagState {
  tags: Tag[];
  selectedTag: string | null;
  tagTree: TagTreeNode[];
  db: SQLiteDatabase | null;
  setDb: (db: SQLiteDatabase) => void;
  loadTags: () => void;
  selectTag: (tag: string | null) => void;
  buildTagTree: () => void;
}

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

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  selectedTag: null,
  tagTree: [],
  db: null,

  setDb: (db: SQLiteDatabase) => {
    set({ db });
  },

  loadTags: () => {
    const { db } = get();
    if (!db) return;
    try {
      const tags = database.listTags(db);
      set({ tags });
      get().buildTagTree();
    } catch {
      // ignore
    }
  },

  selectTag: (tag: string | null) => {
    set({ selectedTag: tag });
  },

  buildTagTree: () => {
    const { tags } = get();
    const tagTree = buildTree(tags);
    set({ tagTree });
  },
}));
