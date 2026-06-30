import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { env, isSupabaseConfigured } from "../config";
import type { Database } from "./database.types";

const webStorageAdapter = {
  getItem: (key: string) => {
    try {
      return Promise.resolve(globalThis.localStorage?.getItem(key) ?? null);
    } catch {
      return Promise.resolve(null);
    }
  },
  setItem: (key: string, value: string) => {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Storage can be unavailable in private browsing or restricted webviews.
    }
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Storage can be unavailable in private browsing or restricted webviews.
    }
    return Promise.resolve();
  },
};

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const authStorageAdapter =
  Platform.OS === "web" ? webStorageAdapter : secureStoreAdapter;

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
      auth: {
        storage: authStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
