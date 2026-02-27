import { useTagStore } from "../stores/tagStore";

export function useTags() {
  const tags = useTagStore((s) => s.tags);
  const tagTree = useTagStore((s) => s.tagTree);
  const selectedTags = useTagStore((s) => s.selectedTags);
  const loadTags = useTagStore((s) => s.loadTags);
  const selectTag = useTagStore((s) => s.selectTag);
  const toggleTag = useTagStore((s) => s.toggleTag);
  const clearTags = useTagStore((s) => s.clearTags);
  const pinTag = useTagStore((s) => s.pinTag);
  const renameTag = useTagStore((s) => s.renameTag);
  const deleteTag = useTagStore((s) => s.deleteTag);

  return {
    tags, tagTree, selectedTags,
    loadTags, selectTag, toggleTag, clearTags,
    pinTag, renameTag, deleteTag,
  };
}
