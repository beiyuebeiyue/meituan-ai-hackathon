import { create } from "zustand";
import { deleteStoredValue, getStoredValue, setStoredValue } from "../utils/sessionStorage";

const SEARCH_HISTORY_STORAGE_KEY = "huanjia_search_history";
const MAX_STORED_HISTORY_ITEMS = 30;

type SearchHistoryState = {
  items: string[];
  hydrated: boolean;
  load: () => Promise<void>;
  addItem: (query: string) => Promise<void>;
  clear: () => Promise<void>;
};

function normalizeQuery(query: string): string {
  return query.trim();
}

export const useSearchHistoryStore = create<SearchHistoryState>((set, get) => ({
  items: [],
  hydrated: false,
  load: async () => {
    const raw = await getStoredValue(SEARCH_HISTORY_STORAGE_KEY);
    if (!raw) {
      set({ items: [], hydrated: true });
      return;
    }
    try {
      const parsed = JSON.parse(raw) as string[];
      set({ items: Array.isArray(parsed) ? parsed.slice(0, MAX_STORED_HISTORY_ITEMS) : [], hydrated: true });
    } catch {
      set({ items: [], hydrated: true });
    }
  },
  addItem: async (query) => {
    const normalized = normalizeQuery(query);
    if (!normalized) return;
    const currentItems = get().items;
    const nextItems = [normalized, ...currentItems.filter((item) => item !== normalized)].slice(0, MAX_STORED_HISTORY_ITEMS);
    await setStoredValue(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(nextItems));
    set({ items: nextItems, hydrated: true });
  },
  clear: async () => {
    await deleteStoredValue(SEARCH_HISTORY_STORAGE_KEY);
    set({ items: [], hydrated: true });
  },
}));
