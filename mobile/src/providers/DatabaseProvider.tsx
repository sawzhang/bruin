import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { SQLiteDatabase } from "expo-sqlite";
import { initDatabase } from "@/services/database";

const DatabaseContext = createContext<SQLiteDatabase | null>(null);

export function useDatabase(): SQLiteDatabase {
  const db = useContext(DatabaseContext);
  if (!db) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return db;
}

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<SQLiteDatabase | null>(null);

  useEffect(() => {
    const database = initDatabase();
    setDb(database);
  }, []);

  if (!db) {
    return null;
  }

  return (
    <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>
  );
}
