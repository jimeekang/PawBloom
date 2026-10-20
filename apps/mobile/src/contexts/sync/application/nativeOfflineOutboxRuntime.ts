import * as SQLite from "expo-sqlite";
import { supabase } from "../../../shared-kernel/supabase/client";

let database: SQLite.SQLiteDatabase | null = null;

export function nativeOutboxDatabase() {
  database ??= SQLite.openDatabaseSync("pawbloom_outbox.db");
  return database;
}

export async function currentNativeOutboxUserId() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  return error ? null : data.session?.user.id ?? null;
}
