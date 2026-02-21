import { View, Text, Pressable, StyleSheet, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import type { NoteListItem } from "@/types";
import { TagBadge } from "./TagBadge";
import { useSettingsStore } from "@/stores/settingsStore";
import { Colors, Spacing, Radius } from "@/constants";
import { formatRelativeDate } from "@/utils/format";

interface NoteCardProps {
  note: NoteListItem;
}

const stateColors: Record<string, string> = {
  draft: "#f39c12",
  review: "#3498db",
  published: "#27ae60",
};

export function NoteCard({ note }: NoteCardProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { theme } = useSettingsStore();
  const effectiveTheme =
    theme === "system" ? (colorScheme ?? "dark") : theme;
  const colors = Colors[effectiveTheme];

  return (
    <Pressable
      onPress={() => router.push(`/note/${note.id}`)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? colors.hover : colors.surface,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {note.is_pinned && <Text style={styles.pin}>📌</Text>}
          <Text
            style={[styles.title, { color: colors.text }]}
            numberOfLines={1}
          >
            {note.title || "Untitled"}
          </Text>
        </View>
        <View style={styles.meta}>
          <View
            style={[
              styles.stateDot,
              { backgroundColor: stateColors[note.state] ?? "#999" },
            ]}
          />
          <Text style={[styles.date, { color: colors.textMuted }]}>
            {formatRelativeDate(note.updated_at)}
          </Text>
        </View>
      </View>

      {note.preview ? (
        <Text
          style={[styles.preview, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {note.preview}
        </Text>
      ) : null}

      {note.tags.length > 0 && (
        <View style={styles.tags}>
          {note.tags.slice(0, 3).map((tag) => (
            <TagBadge key={tag} name={tag} />
          ))}
          {note.tags.length > 3 && (
            <Text style={[styles.moreTag, { color: colors.textMuted }]}>
              +{note.tags.length - 3}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: Spacing.sm,
  },
  pin: {
    fontSize: 12,
    marginRight: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
  },
  stateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  date: {
    fontSize: 12,
  },
  preview: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  tags: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  moreTag: {
    fontSize: 12,
    marginLeft: 4,
  },
});
