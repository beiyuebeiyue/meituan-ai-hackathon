import { create } from "zustand";
import { getStoredValue, setStoredValue } from "../utils/sessionStorage";

export type ThemeMode = "light" | "dark";

const APPEARANCE_STORAGE_KEY = "huanjia_theme_mode";

type AppearanceState = {
  mode: ThemeMode;
  hydrated: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
};

export const useAppearanceStore = create<AppearanceState>((set) => ({
  mode: "light",
  hydrated: false,
  setMode: async (mode) => {
    await setStoredValue(APPEARANCE_STORAGE_KEY, mode);
    set({ mode, hydrated: true });
  },
}));

export async function bootstrapAppearance() {
  const storedMode = await getStoredValue(APPEARANCE_STORAGE_KEY);
  const mode: ThemeMode = storedMode === "dark" ? "dark" : "light";
  useAppearanceStore.setState({ mode, hydrated: true });
}
