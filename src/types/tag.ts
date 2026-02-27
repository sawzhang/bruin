export interface Tag {
  id: number;
  name: string;
  parent_name: string | null;
  note_count: number;
  is_pinned: boolean;
}

export interface TagTreeNode {
  name: string;
  fullPath: string;
  noteCount: number;
  isPinned: boolean;
  children: TagTreeNode[];
}
