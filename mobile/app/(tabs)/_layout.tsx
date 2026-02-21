import { Tabs } from "expo-router";
import { useColorScheme } from "react-native";
import { useSettingsStore } from "@/stores/settingsStore";
import { Colors } from "@/constants";

function TabBarIcon({ name, color }: { name: string; color: string }) {
  // Simple text-based icons to avoid additional icon library dependency
  const icons: Record<string, string> = {
    notes: "📝",
    search: "🔍",
    settings: "⚙️",
  };
  const { Text } = require("react-native");
  return <Text style={{ fontSize: 22 }}>{icons[name] ?? "●"}</Text>;
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
