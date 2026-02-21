import { Text, Pressable, StyleSheet, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { useSettingsStore } from "@/stores/settingsStore";
import { Colors, Radius, Spacing } from "@/constants";

interface TagBadgeProps {
  name: string;
  onPress?: () => void;
}

export function TagBadge({ name, onPress }: TagBadgeProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { theme } = useSettingsStore();
  const effectiveTheme =
    theme === "system" ? (colorScheme ?? "dark") : theme;
  const colors = Colors[effectiveTheme];

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/tag/${encodeURIComponent(name)}`);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.badge, { backgroundColor: colors.tagBg }]}
    >
      <Text style={[styles.text, { color: colors.tag }]}>#{name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    marginRight: Spacing.xs,
  },
  text: {
    fontSize: 12,
    fontWeight: "500",
  },
});
