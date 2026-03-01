import type { TagTreeNode } from "../../types/tag";
import { TagTreeItem } from "./TagTreeItem";

interface TagTreeProps {
  tree: TagTreeNode[];
  selectedTags: string[];
  onSelectTag: (tag: string, shiftKey: boolean) => void;
  onContextMenu: (e: React.MouseEvent, node: TagTreeNode) => void;
}

export function TagTree({ tree, selectedTags, onSelectTag, onContextMenu }: TagTreeProps) {
  if (tree.length === 0) {
    return (
      <p data-testid="tag-tree-empty" className="px-3 py-2 text-[11px] text-bear-text-muted">
        No tags yet
      </p>
    );
  }

  return (
    <div data-testid="tag-tree" className="flex flex-col gap-0.5">
      {tree.map((node) => (
        <TagTreeItem
          key={node.fullPath}
          node={node}
          depth={0}
          selectedTags={selectedTags}
          onSelectTag={onSelectTag}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}
