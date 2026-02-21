import { useColorScheme, StyleSheet } from "react-native";
import Markdown from "react-native-markdown-display";
import { useSettingsStore } from "@/stores/settingsStore";
import { Colors, Spacing } from "@/constants";

interface MarkdownViewerProps {
  content: string;
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  const colorScheme = useColorScheme();
  const { theme } = useSettingsStore();
  const effectiveTheme =
    theme === "system" ? (colorScheme ?? "dark") : theme;
  const colors = Colors[effectiveTheme];

  const mdStyles = StyleSheet.create({
    body: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 26,
    },
    heading1: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "700",
      marginTop: Spacing.xl,
      marginBottom: Spacing.md,
    },
    heading2: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "600",
      marginTop: Spacing.xl,
      marginBottom: Spacing.sm,
    },
    heading3: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "600",
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    link: {
      color: colors.link,
      textDecorationLine: "underline" as const,
    },
    blockquote: {
      backgroundColor: colors.inlineCode,
      borderLeftColor: colors.accent,
      borderLeftWidth: 3,
      paddingLeft: Spacing.md,
      paddingVertical: Spacing.sm,
      marginVertical: Spacing.sm,
    },
    code_inline: {
      backgroundColor: colors.inlineCode,
      color: colors.text,
      fontFamily: "Menlo",
      fontSize: 14,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
    },
    fence: {
      backgroundColor: colors.inlineCode,
      color: colors.text,
      fontFamily: "Menlo",
      fontSize: 14,
      padding: Spacing.md,
      borderRadius: 8,
      marginVertical: Spacing.sm,
    },
    hr: {
      backgroundColor: colors.border,
      height: 1,
      marginVertical: Spacing.lg,
    },
    list_item: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 26,
    },
    strong: {
      fontWeight: "700" as const,
    },
    em: {
      fontStyle: "italic" as const,
    },
    image: {
      borderRadius: 8,
    },
  });

  return <Markdown style={mdStyles}>{content}</Markdown>;
}
