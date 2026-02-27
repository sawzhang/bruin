import { useTagStore } from "../stores/tagStore";

export function useTags() {
  const tags = useTagStore((s) => s.tags);
  const tagTree = useTagStore((s) => s.tagTree);
  const selectedTags = useTagStore((s) => s.selectedTags);
  const loadTags = useTagStore((s) => s.loadTags);
  const selectTag = useTagStore((s) => s.selectTag);
  const toggleTag = useTagStore((s) => s.toggleTag);
  const clearTags = useTagStore((s) => s.clearTags);

  return { tags, tagTree, selectedTags, loadTags, selectTag, toggleTag, clearTags };
}
