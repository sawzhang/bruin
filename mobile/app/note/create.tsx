import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useDatabase } from "@/providers/DatabaseProvider";
import { useNoteStore } from "@/stores/noteStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { Colors, Spacing, Typography, Radius } from "@/constants";

export default function CreateNoteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDatabase();
  const colorScheme = useColorScheme();
  const { theme } = useSettingsStore();
  const effectiveTheme =
    theme === "system" ? (colorScheme ?? "dark") : theme;
  const colors = Colors[effectiveTheme];

  const { setDb, loadNotes } = useNoteStore();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const handleSave = useCallback(() => {
    if (!title.trim() && !content.trim()) return;

    setDb(db);
    const { createNote: _create, ...rest } = useNoteStore.getState();
    // Direct database call for create to pass title/content
    const database = require("@/services/database");
    const note = database.createNote(db, {
      title: title.trim() || "Untitled",
      content: content.trim(),
      tags: [],
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    loadNotes();
    router.back();
    // Navigate to the newly created note
    setTimeout(() => {
      router.push(`/note/${note.id}`);
    }, 100);
  }, [db, title, content, setDb, loadNotes, router]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing.sm,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
            Cancel
          </Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          New Note
        </Text>
        <Pressable
          onPress={handleSave}
          disabled={!title.trim() && !content.trim()}
          style={[
            styles.saveBtn,
            {
              backgroundColor: colors.accent,
              opacity: !title.trim() && !content.trim() ? 0.4 : 1,
            },
          ]}
        >
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      </View>

      {/* Title */}
      <TextInput
        style={[
          styles.titleInput,
          { color: colors.text, borderBottomColor: colors.border },
        ]}
        placeholder="Title"
        placeholderTextColor={colors.textMuted}
        value={title}
        onChangeText={setTitle}
        autoFocus
        returnKeyType="next"
      />

      {/* Content */}
      <TextInput
        style={[styles.contentInput, { color: colors.text }]}
        placeholder="Start writing..."
        placeholderTextColor={colors.textMuted}
        value={content}
        onChangeText={setContent}
        multiline
        textAlignVertical="top"
        autoCapitalize="sentences"
        autoCorrect
      />
    </KeyboardAvoidingView>
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
    paddingBottom: Spacing.md,
    borderBottomWidth: 0.5,
  },
  cancelBtn: {
    paddingVertical: Spacing.sm,
  },
  cancelText: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  saveBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  saveText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  titleInput: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    fontSize: 24,
    fontWeight: "700",
    borderBottomWidth: 0.5,
  },
  contentInput: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: "Menlo",
  },
});
