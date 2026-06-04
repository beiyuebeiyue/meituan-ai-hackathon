import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const WEB_PREFIX = "huanjia:";

export async function setStoredValue(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(`${WEB_PREFIX}${key}`, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function getStoredValue(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(`${WEB_PREFIX}${key}`);
  }
  return SecureStore.getItemAsync(key);
}

export async function deleteStoredValue(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(`${WEB_PREFIX}${key}`);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function clearStoredValues(keys: string[]): Promise<void> {
  if (Platform.OS === "web") {
    keys.forEach((key) => localStorage.removeItem(`${WEB_PREFIX}${key}`));
    return;
  }
  await Promise.allSettled(keys.map(async (key) => SecureStore.deleteItemAsync(key)));
}
