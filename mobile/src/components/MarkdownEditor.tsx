import { useRef, useCallback, useEffect } from "react";
import {
  TextInput,
  StyleSheet,
  useColorScheme,
  type NativeSyntheticEvent,
  type TextInputChangeEventData,
} from "react-native";
import { useSettingsStore } from "@/stores/settingsStore";
import { Colors, Spacing, Typography } from "@/constants";
import { DEBOUNCE_AUTOSAVE } from "@/constants";

interface MarkdownEditorProps {
  content: string;
  onChangeText: (text: string) => void;
  autoFocus?: boolean;
}

export function MarkdownEditor({
  content,
  onChangeText,
  autoFocus = false,
}: MarkdownEditorProps) {
  const colorScheme = useColorScheme();
  const { theme } = useSettingsStore();
  const effectiveTheme =
    theme === "system" ? (colorScheme ?? "dark") : theme;
  const colors = Colors[effectiveTheme];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<string>(content);

  const handleChange = useCallback(
    (text: string) => {
      pendingRef.current = text;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        onChangeText(pendingRef.current);
      }, DEBOUNCE_AUTOSAVE);
    },
    [onChangeText],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        // Flush on unmount
        onChangeText(pendingRef.current);
      }
    };
  }, [onChangeText]);

  return (
    <TextInput
      style={[
        styles.editor,
        {
          color: colors.text,
          backgroundColor: colors.bg,
        },
      ]}
      defaultValue={content}
      onChangeText={handleChange}
      multiline
      autoFocus={autoFocus}
      textAlignVertical="top"
      placeholderTextColor={colors.textMuted}
      placeholder="Start writing..."
      autoCapitalize="sentences"
      autoCorrect
      scrollEnabled
    />
  );
}

const styles = StyleSheet.create({
  editor: {
    flex: 1,
    ...Typography.mono,
    padding: Spacing.lg,
    lineHeight: 22,
  },
});
