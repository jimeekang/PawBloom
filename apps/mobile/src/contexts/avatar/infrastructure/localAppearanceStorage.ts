import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { AppearanceStorage } from "../domain/appearanceStorage";

export const localAppearanceStorage: AppearanceStorage = Platform.OS === "web" ? {
  getItem: async (key) => globalThis.localStorage.getItem(key),
  setItem: async (key, value) => globalThis.localStorage.setItem(key, value),
} : { getItem: SecureStore.getItemAsync, setItem: SecureStore.setItemAsync };
