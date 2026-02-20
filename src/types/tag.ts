export interface Tag {
  id: number;
  name: string;
  parent_name: string | null;
  note_count: number;
}

export interface TagTreeNode {
  name: string;
  fullPath: string;
  noteCount: number;
  children: TagTreeNode[];
}
