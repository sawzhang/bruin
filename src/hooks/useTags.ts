import { useTagStore } from "../stores/tagStore";

export function useTags() {
  const tags = useTagStore((s) => s.tags);
  const tagTree = useTagStore((s) => s.tagTree);
  const selectedTag = useTagStore((s) => s.selectedTag);
  const loadTags = useTagStore((s) => s.loadTags);
  const selectTag = useTagStore((s) => s.selectTag);

  return { tags, tagTree, selectedTag, loadTags, selectTag };
}
