import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useDatabase } from "@/providers/DatabaseProvider";
import { useNoteStore } from "@/stores/noteStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { TagBadge } from "@/components/TagBadge";
import { Colors, Spacing, Typography, Radius } from "@/constants";
import { formatRelativeDate } from "@/utils/format";
import type { NoteState } from "@/types";

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDatabase();
  const colorScheme = useColorScheme();
  const { theme } = useSettingsStore();
  const effectiveTheme =
    theme === "system" ? (colorScheme ?? "dark") : theme;
  const colors = Colors[effectiveTheme];

  const {
    currentNote,
    selectNote,
    updateNote,
    pinNote,
    trashNote,
    setNoteState,
    setDb,
  } = useNoteStore();

  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setDb(db);
    if (id) selectNote(id);
  }, [db, id, setDb, selectNote]);

  const handleSaveContent = useCallback(
    (content: string) => {
      if (!id) return;
      updateNote({ id, content });
    },
    [id, updateNote],
  );

  const handlePin = useCallback(() => {
    if (!id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pinNote(id);
  }, [id, pinNote]);

  const handleTrash = useCallback(() => {
    if (!id) return;
    Alert.alert("Move to Trash", "This note will be moved to trash.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Trash",
        style: "destructive",
        onPress: () => {
          trashNote(id);
          router.back();
        },
      },
    ]);
  }, [id, trashNote, router]);

  const handleStateChange = useCallback(
    (state: NoteState) => {
      if (!id) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setNoteState(id, state);
    },
    [id, setNoteState],
  );

  if (!currentNote) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View
          style={[
            styles.header,
            { paddingTop: insets.top, borderBottomColor: colors.border },
          ]}
        >
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={[styles.backText, { color: colors.accent }]}>
              ← Back
            </Text>
          </Pressable>
        </View>
        <View style={styles.loading}>
          <Text style={{ color: colors.textMuted }}>Loading...</Text>
        </View>
      </View>
    );
  }

  const stateColors: Record<string, string> = {
    draft: "#f39c12",
    review: "#3498db",
    published: "#27ae60",
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.accent }]}>
            ← Back
          </Text>
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable onPress={() => setIsEditing(!isEditing)} style={styles.actionBtn}>
            <Text style={[styles.actionText, { color: colors.accent }]}>
              {isEditing ? "View" : "Edit"}
            </Text>
          </Pressable>
          <Pressable onPress={handlePin} style={styles.actionBtn}>
            <Text style={styles.actionIcon}>
              {currentNote.is_pinned ? "📌" : "📍"}
            </Text>
          </Pressable>
          <Pressable onPress={handleTrash} style={styles.actionBtn}>
            <Text style={styles.actionIcon}>🗑️</Text>
          </Pressable>
        </View>
      </View>

      {/* Note Meta */}
      <View
        style={[styles.meta, { borderBottomColor: colors.border }]}
      >
        <Text style={[styles.noteTitle, { color: colors.text }]}>
          {currentNote.title || "Untitled"}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            {formatRelativeDate(currentNote.updated_at)}
          </Text>
          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            {" · "}
            {currentNote.word_count} words
          </Text>
          <Pressable
            onPress={() => {
              const states: NoteState[] = ["draft", "review", "published"];
              const currentIndex = states.indexOf(currentNote.state);
              const nextState = states[(currentIndex + 1) % states.length];
              handleStateChange(nextState);
            }}
            style={[
              styles.stateBadge,
              {
                backgroundColor:
                  stateColors[currentNote.state] + "20",
              },
            ]}
          >
            <View
              style={[
                styles.stateDot,
                {
                  backgroundColor:
                    stateColors[currentNote.state] ?? "#999",
                },
              ]}
            />
            <Text
              style={[
                styles.stateText,
                { color: stateColors[currentNote.state] ?? "#999" },
              ]}
            >
              {currentNote.state}
            </Text>
          </Pressable>
        </View>
        {currentNote.tags.length > 0 && (
          <View style={styles.tags}>
            {currentNote.tags.map((tag) => (
              <TagBadge key={tag} name={tag} />
            ))}
          </View>
        )}
      </View>

      {/* Content */}
      {isEditing ? (
        <MarkdownEditor
          content={currentNote.content}
          onChangeText={handleSaveContent}
        />
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
        >
          <MarkdownViewer content={currentNote.content} />
        </ScrollView>
      )}
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
  backButton: {
    paddingVertical: Spacing.sm,
  },
  backText: {
    fontSize: 16,
    fontWeight: "500",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  actionBtn: {
    padding: Spacing.sm,
  },
  actionText: {
    fontSize: 15,
    fontWeight: "600",
  },
  actionIcon: {
    fontSize: 18,
  },
  meta: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
  },
  noteTitle: {
    ...Typography.title,
    marginBottom: Spacing.xs,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  metaText: {
    fontSize: 13,
  },
  stateBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    marginLeft: Spacing.sm,
  },
  stateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  stateText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: Spacing.sm,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: Spacing.lg,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
