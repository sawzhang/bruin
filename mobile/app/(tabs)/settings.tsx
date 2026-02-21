import { useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Switch,
  StyleSheet,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSyncStore } from "@/stores/syncStore";
import { useNoteStore } from "@/stores/noteStore";
import { Colors, Spacing, Typography, Radius } from "@/constants";
import { formatRelativeDate } from "@/utils/format";
import type { ThemePreference } from "@/types";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const {
    theme,
    syncOnLaunch,
    setTheme,
    setSyncOnLaunch,
  } = useSettingsStore();
  const { isSyncing, lastSync, filesSynced, iCloudAvailable, triggerSync } =
    useSyncStore();
  const { notes } = useNoteStore();

  const effectiveTheme =
    theme === "system" ? (colorScheme ?? "dark") : theme;
  const colors = Colors[effectiveTheme];

  const handleSync = useCallback(async () => {
    await triggerSync();
  }, [triggerSync]);

  const themeOptions: { label: string; value: ThemePreference }[] = [
    { label: "System", value: "system" },
    { label: "Light", value: "light" },
    { label: "Dark", value: "dark" },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xxl }}
    >
      <View style={{ paddingTop: insets.top + Spacing.sm }}>
        <Text
          style={[
            styles.screenTitle,
            { color: colors.text, paddingHorizontal: Spacing.lg },
          ]}
        >
          Settings
        </Text>
      </View>

      {/* Sync Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          SYNC
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.text }]}>
              iCloud Status
            </Text>
            <Text
              style={[
                styles.value,
                { color: iCloudAvailable ? "#27ae60" : colors.textMuted },
              ]}
            >
              {iCloudAvailable ? "Connected" : "Unavailable"}
            </Text>
          </View>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.text }]}>
              Last Sync
            </Text>
            <Text style={[styles.value, { color: colors.textSecondary }]}>
              {lastSync ? formatRelativeDate(lastSync) : "Never"}
            </Text>
          </View>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.text }]}>
              Files Synced
            </Text>
            <Text style={[styles.value, { color: colors.textSecondary }]}>
              {filesSynced}
            </Text>
          </View>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.text }]}>
              Sync on Launch
            </Text>
            <Switch
              value={syncOnLaunch}
              onValueChange={setSyncOnLaunch}
              trackColor={{ true: colors.accent }}
            />
          </View>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <Pressable
            onPress={handleSync}
            disabled={isSyncing}
            style={[styles.syncButton, { opacity: isSyncing ? 0.5 : 1 }]}
          >
            <Text style={[styles.syncButtonText, { color: colors.accent }]}>
              {isSyncing ? "Syncing..." : "Sync Now"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Appearance Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          APPEARANCE
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {themeOptions.map((option, i) => (
            <View key={option.value}>
              {i > 0 && (
                <View
                  style={[
                    styles.separator,
                    { backgroundColor: colors.border },
                  ]}
                />
              )}
              <Pressable
                onPress={() => setTheme(option.value)}
                style={styles.row}
              >
                <Text style={[styles.label, { color: colors.text }]}>
                  {option.label}
                </Text>
                {theme === option.value && (
                  <Text style={{ color: colors.accent, fontSize: 16 }}>✓</Text>
                )}
              </Pressable>
            </View>
          ))}
        </View>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          ABOUT
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.text }]}>Version</Text>
            <Text style={[styles.value, { color: colors.textSecondary }]}>
              1.0.0
            </Text>
          </View>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.text }]}>
              Total Notes
            </Text>
            <Text style={[styles.value, { color: colors.textSecondary }]}>
              {notes.length}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenTitle: {
    ...Typography.title,
    marginBottom: Spacing.lg,
  },
  section: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  card: {
    borderRadius: Radius.md,
    borderWidth: 0.5,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 48,
  },
  separator: {
    height: 0.5,
    marginLeft: Spacing.lg,
  },
  label: {
    fontSize: 16,
  },
  value: {
    fontSize: 16,
  },
  syncButton: {
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  syncButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
