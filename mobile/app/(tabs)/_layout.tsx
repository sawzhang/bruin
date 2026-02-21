import { Tabs } from "expo-router";
import { Text, useColorScheme } from "react-native";
import { useSettingsStore } from "@/stores/settingsStore";
import { Colors } from "@/constants";

const TAB_ICONS: Record<string, string> = {
  notes: "\u{1F4DD}",
  search: "\u{1F50D}",
  settings: "\u2699\uFE0F",
};

function TabBarIcon({ name }: { name: string; color: string }) {
  return <Text style={{ fontSize: 22 }}>{TAB_ICONS[name] ?? "\u25CF"}</Text>;
}

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const { theme } = useSettingsStore();

  const effectiveTheme =
    theme === "system" ? (colorScheme ?? "dark") : theme;
  const colors = Colors[effectiveTheme];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="notes"
        options={{
          title: "Notes",
          tabBarIcon: ({ color }) => <TabBarIcon name="notes" color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="search" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="settings" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
