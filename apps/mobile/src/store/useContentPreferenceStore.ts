import { create } from "zustand";
import { getStoredValue, setStoredValue } from "../utils/sessionStorage";

const CONTENT_PREFERENCE_STORAGE_KEY = "huanjia_content_preferences";

type ContentPreferenceState = {
  includeXhsPosts: boolean;
  hydrated: boolean;
  setIncludeXhsPosts: (includeXhsPosts: boolean) => Promise<void>;
};

export const useContentPreferenceStore = create<ContentPreferenceState>((set) => ({
  includeXhsPosts: true,
  hydrated: false,
  setIncludeXhsPosts: async (includeXhsPosts) => {
    await setStoredValue(CONTENT_PREFERENCE_STORAGE_KEY, JSON.stringify({ includeXhsPosts }));
    set({ includeXhsPosts, hydrated: true });
  },
}));

export async function bootstrapContentPreferences() {
  const storedValue = await getStoredValue(CONTENT_PREFERENCE_STORAGE_KEY);
  let includeXhsPosts = true;
  if (storedValue) {
    try {
      const parsed = JSON.parse(storedValue) as { includeXhsPosts?: unknown };
      includeXhsPosts = parsed.includeXhsPosts !== false;
    } catch {
      includeXhsPosts = true;
    }
  }
  useContentPreferenceStore.setState({ includeXhsPosts, hydrated: true });
}
