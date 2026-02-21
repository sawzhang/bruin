import { useEffect, useCallback } from "react";
import {
  View,
  FlatList,
  Pressable,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNoteStore } from "@/stores/noteStore";
import { useTagStore } from "@/stores/tagStore";
import { useSyncStore } from "@/stores/syncStore";
import { useDatabase } from "@/providers/DatabaseProvider";
import { useSettingsStore } from "@/stores/settingsStore";
import { NoteCard } from "@/components/NoteCard";
import { EmptyState } from "@/components/EmptyState";
import { Colors, Spacing, Typography } from "@/constants";
import type { NoteListItem } from "@/types";

export default function NotesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDatabase();
  const colorScheme = useColorScheme();
  const { theme } = useSettingsStore();
  const effectiveTheme =
    theme === "system" ? (colorScheme ?? "dark") : theme;
  const colors = Colors[effectiveTheme];

  const { notes, isLoading, showTrash, loadNotes, setDb } = useNoteStore();
  const {
    tags,
    selectedTag,
    loadTags,
    selectTag,
    setDb: setTagDb,
  } = useTagStore();
  const { isSyncing, triggerSync, setDb: setSyncDb } = useSyncStore();

  useEffect(() => {
    setDb(db);
    setTagDb(db);
    setSyncDb(db);
    loadNotes();
    loadTags();
  }, [db, setDb, setTagDb, setSyncDb, loadNotes, loadTags]);

  const handleRefresh = useCallback(async () => {
    await triggerSync();
    loadNotes();
    loadTags();
  }, [triggerSync, loadNotes, loadTags]);

  const handleTagFilter = useCallback(
    (tag: string | null) => {
      selectTag(tag);
      if (tag) {
        loadNotes({ tag, trashed: false, sort_by: "updated_at", sort_order: "desc" });
      } else {
        loadNotes();
      }
    },
    [selectTag, loadNotes],
  );

  const handleCreate = useCallback(() => {
    router.push("/note/create");
  }, [router]);

  const renderItem = useCallback(
    ({ item }: { item: NoteListItem }) => <NoteCard note={item} />,
    [],
  );

  const keyExtractor = useCallback((item: NoteListItem) => item.id, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + Spacing.sm, backgroundColor: colors.bg },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {showTrash ? "Trash" : "Notes"}
        </Text>
      </View>

      {tags.length > 0 && !showTrash && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagScroll}
          contentContainerStyle={styles.tagScrollContent}
        >
          <Pressable
            onPress={() => handleTagFilter(null)}
            style={[
              styles.tagChip,
              {
                backgroundColor: selectedTag === null
                  ? colors.accent
                  : colors.hover,
              },
            ]}
          >
            <Text
              style={[
                styles.tagChipText,
                {
                  color: selectedTag === null ? "#fff" : colors.textSecondary,
                },
              ]}
            >
              All
            </Text>
          </Pressable>
          {tags.map((tag) => (
            <Pressable
              key={tag.name}
              onPress={() => handleTagFilter(tag.name)}
              style={[
                styles.tagChip,
                {
                  backgroundColor:
                    selectedTag === tag.name ? colors.accent : colors.hover,
                },
              ]}
            >
              <Text
                style={[
                  styles.tagChipText,
                  {
                    color:
                      selectedTag === tag.name ? "#fff" : colors.textSecondary,
                  },
                ]}
              >
                #{tag.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <FlatList
        data={notes}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={notes.length === 0 ? styles.emptyList : undefined}
        refreshControl={
          <RefreshControl
            refreshing={isSyncing || isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="📝"
            title={showTrash ? "Trash is empty" : "No notes yet"}
            message={
              showTrash
                ? "Deleted notes will appear here"
                : "Create your first note to get started"
            }
            actionLabel={showTrash ? undefined : "Create Note"}
            onAction={showTrash ? undefined : handleCreate}
          />
        }
      />

      {!showTrash && (
        <Pressable
          onPress={handleCreate}
          style={[
            styles.fab,
            { backgroundColor: colors.accent, bottom: Spacing.xl },
          ]}
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    ...Typography.title,
  },
  tagScroll: {
    maxHeight: 40,
    marginBottom: Spacing.sm,
  },
  tagScrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  tagChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  emptyList: {
    flex: 1,
  },
  fab: {
    position: "absolute",
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "300",
    marginTop: -2,
  },
});
