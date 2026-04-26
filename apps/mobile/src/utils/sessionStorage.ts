import * as FileSystem from "expo-file-system";
import * as SecureStore from "expo-secure-store";

const fallbackFileUri = (() => {
  const base = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  return base ? `${base}nailtry-session.json` : null;
})();

async function readFallbackStore(): Promise<Record<string, string>> {
  if (typeof localStorage !== "undefined") {
    const raw = localStorage.getItem("nailtry-session");
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  }

  if (!fallbackFileUri) return {};
  const fileInfo = await FileSystem.getInfoAsync(fallbackFileUri);
  if (!fileInfo.exists) return {};

  try {
    const raw = await FileSystem.readAsStringAsync(fallbackFileUri);
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

async function writeFallbackStore(store: Record<string, string>): Promise<void> {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("nailtry-session", JSON.stringify(store));
    return;
  }

  if (!fallbackFileUri) return;
  await FileSystem.writeAsStringAsync(fallbackFileUri, JSON.stringify(store));
}

function canUseSecureStore(): boolean {
  return (
    typeof SecureStore.getItemAsync === "function" &&
    typeof SecureStore.setItemAsync === "function" &&
    typeof SecureStore.deleteItemAsync === "function"
  );
}

async function deleteFallbackKeys(keys: string[]): Promise<void> {
  const store = await readFallbackStore();
  for (const key of keys) {
    delete store[key];
  }
  await writeFallbackStore(store);
}

export async function setStoredValue(key: string, value: string): Promise<void> {
  if (canUseSecureStore()) {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch {
      // Fall through to non-secure fallback when the native SecureStore module is mismatched.
    }
  }

  const store = await readFallbackStore();
  store[key] = value;
  await writeFallbackStore(store);
}

export async function getStoredValue(key: string): Promise<string | null> {
  if (canUseSecureStore()) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      // Fall through to non-secure fallback when the native SecureStore module is mismatched.
    }
  }

  const store = await readFallbackStore();
  return store[key] ?? null;
}

export async function deleteStoredValue(key: string): Promise<void> {
  if (canUseSecureStore()) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Fall through to non-secure fallback when the native SecureStore module is mismatched.
    }
  }

  await deleteFallbackKeys([key]);
}

export async function clearStoredValues(keys: string[]): Promise<void> {
  if (canUseSecureStore()) {
    await Promise.allSettled(keys.map(async (key) => SecureStore.deleteItemAsync(key)));
  }

  await deleteFallbackKeys(keys);
}
