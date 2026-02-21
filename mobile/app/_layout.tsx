import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { DatabaseProvider } from "@/providers/DatabaseProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { useSettingsStore } from "@/stores/settingsStore";
import { Colors } from "@/constants";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { theme, isLoaded, loadSettings } = useSettingsStore();

  const effectiveTheme =
    theme === "system" ? (colorScheme ?? "dark") : theme;
  const colors = Colors[effectiveTheme];

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (isLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isLoaded]);

  if (!isLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <DatabaseProvider>
          <QueryProvider>
            <StatusBar style={effectiveTheme === "dark" ? "light" : "dark"} />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: "slide_from_right",
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="note/[id]"
                options={{ animation: "slide_from_right" }}
              />
              <Stack.Screen
                name="note/create"
                options={{
                  presentation: "modal",
                  animation: "slide_from_bottom",
                }}
              />
              <Stack.Screen
                name="tag/[name]"
                options={{ animation: "slide_from_right" }}
              />
            </Stack>
          </QueryProvider>
        </DatabaseProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
