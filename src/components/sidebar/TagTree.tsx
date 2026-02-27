import type { TagTreeNode } from "../../types/tag";
import { TagTreeItem } from "./TagTreeItem";

interface TagTreeProps {
  tree: TagTreeNode[];
  selectedTags: string[];
  onSelectTag: (tag: string, shiftKey: boolean) => void;
}

export function TagTree({ tree, selectedTags, onSelectTag }: TagTreeProps) {
  if (tree.length === 0) {
    return (
      <p className="px-3 py-2 text-[11px] text-bear-text-muted">
        No tags yet
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {tree.map((node) => (
        <TagTreeItem
          key={node.fullPath}
          node={node}
          depth={0}
          selectedTags={selectedTags}
          onSelectTag={onSelectTag}
        />
      ))}
    </div>
  );
}
