import { useState, useCallback, useEffect } from "react";
import {
  View,
  TextInput,
  FlatList,
  StyleSheet,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDatabase } from "@/providers/DatabaseProvider";
import { useSettingsStore } from "@/stores/settingsStore";
import { searchNotes } from "@/services/database";
import { useDebounce } from "@/hooks/useDebounce";
import { NoteCard } from "@/components/NoteCard";
import { EmptyState } from "@/components/EmptyState";
import { Colors, Spacing, Radius, DEBOUNCE_SEARCH } from "@/constants";
import type { NoteListItem } from "@/types";

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const db = useDatabase();
  const colorScheme = useColorScheme();
  const { theme } = useSettingsStore();
  const effectiveTheme =
    theme === "system" ? (colorScheme ?? "dark") : theme;
  const colors = Colors[effectiveTheme];

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NoteListItem[]>([]);
  const debouncedQuery = useDebounce(query, DEBOUNCE_SEARCH);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    try {
      const found = searchNotes(db, { query: debouncedQuery });
      setResults(found);
    } catch {
      setResults([]);
    }
  }, [db, debouncedQuery]);

  const renderItem = useCallback(
    ({ item }: { item: NoteListItem }) => <NoteCard note={item} />,
    [],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + Spacing.sm, backgroundColor: colors.bg },
        ]}
      >
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.hover,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="Search notes..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={results}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          results.length === 0 && query ? styles.emptyList : undefined
        }
        ListEmptyComponent={
          query.trim() ? (
            <EmptyState
              icon="🔍"
              title="No results"
              message={`No notes matching "${query}"`}
            />
          ) : (
            <EmptyState
              icon="🔍"
              title="Search your notes"
              message="Type to search by title or content"
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  searchInput: {
    height: 44,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    borderWidth: 0.5,
  },
  emptyList: {
    flex: 1,
  },
});
