import { useState } from "react";
import clsx from "clsx";
import type { TagTreeNode } from "../../types/tag";

interface TagTreeItemProps {
  node: TagTreeNode;
  depth: number;
  selectedTags: string[];
  onSelectTag: (tag: string, shiftKey: boolean) => void;
  onContextMenu: (e: React.MouseEvent, node: TagTreeNode) => void;
}

export function TagTreeItem({
  node,
  depth,
  selectedTags,
  onSelectTag,
  onContextMenu,
}: TagTreeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedTags.includes(node.fullPath);

  return (
    <div>
      <button
        onClick={(e) => onSelectTag(node.fullPath, e.shiftKey)}
        onContextMenu={(e) => onContextMenu(e, node)}
        className={clsx(
          "flex items-center w-full text-left px-2 py-1 text-[13px] rounded transition-colors duration-150",
          isSelected
            ? "bg-bear-active text-bear-text"
            : "text-bear-text-secondary hover:bg-bear-hover hover:text-bear-text",
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {hasChildren && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="mr-1 text-[10px] text-bear-text-muted w-3 inline-flex justify-center cursor-pointer"
          >
            {expanded ? "\u25BC" : "\u25B6"}
          </span>
        )}
        {!hasChildren && <span className="mr-1 w-3" />}
        {node.isPinned && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="currentColor"
            className="text-bear-accent shrink-0 mr-1"
          >
            <circle cx="5" cy="5" r="3" />
          </svg>
        )}
        <span className="truncate flex-1">{node.name}</span>
        <span className="text-[11px] text-bear-text-muted ml-1">
          {node.noteCount}
        </span>
      </button>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <TagTreeItem
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              selectedTags={selectedTags}
              onSelectTag={onSelectTag}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}
