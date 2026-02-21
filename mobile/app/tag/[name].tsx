import { useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  useColorScheme,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDatabase } from "@/providers/DatabaseProvider";
import { useNoteStore } from "@/stores/noteStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { NoteCard } from "@/components/NoteCard";
import { EmptyState } from "@/components/EmptyState";
import { Colors, Spacing, Typography } from "@/constants";
import type { NoteListItem } from "@/types";

export default function TagScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDatabase();
  const colorScheme = useColorScheme();
  const { theme } = useSettingsStore();
  const effectiveTheme =
    theme === "system" ? (colorScheme ?? "dark") : theme;
  const colors = Colors[effectiveTheme];

  const { notes, loadNotes, setDb } = useNoteStore();

  const tagName = name ? decodeURIComponent(name) : "";

  useEffect(() => {
    setDb(db);
    if (tagName) {
      loadNotes({
        tag: tagName,
        trashed: false,
        sort_by: "updated_at",
        sort_order: "desc",
      });
    }
  }, [db, tagName, setDb, loadNotes]);

  const renderItem = useCallback(
    ({ item }: { item: NoteListItem }) => <NoteCard note={item} />,
    [],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.accent }]}>
            ← Back
          </Text>
        </Pressable>
        <Text style={[styles.tagTitle, { color: colors.tag }]}>
          #{tagName}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <FlatList
        data={notes}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={notes.length === 0 ? styles.emptyList : undefined}
        ListEmptyComponent={
          <EmptyState
            icon="🏷️"
            title="No notes"
            message={`No notes with tag #${tagName}`}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 0.5,
  },
  backBtn: {
    paddingVertical: Spacing.sm,
    width: 60,
  },
  backText: {
    fontSize: 16,
    fontWeight: "500",
  },
  tagTitle: {
    ...Typography.heading,
    textAlign: "center",
    flex: 1,
  },
  emptyList: {
    flex: 1,
  },
});
