import { useState, useEffect, useRef } from "react";
import type { NoteListItem } from "../types/note";
import * as tauri from "../lib/tauri";

export function useSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NoteListItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        const res = await tauri.searchNotes({ query: query.trim(), limit: 20 });
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timerRef.current);
  }, [query]);

  return { query, setQuery, results, isSearching };
}
