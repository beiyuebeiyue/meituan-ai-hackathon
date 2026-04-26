import { DarkTheme, DefaultTheme, Theme } from "@react-navigation/native";
import { useAppearanceStore, type ThemeMode } from "../store/useAppearanceStore";

export type AppPalette = {
  background: string;
  surface: string;
  surfaceAlt: string;
  accent: string;
  accentSoft: string;
  text: string;
  subtext: string;
  border: string;
  warm: string;
  dangerSoft: string;
  dangerText: string;
  navBackground: string;
  navInactive: string;
  input: string;
  overlay: string;
};

export const lightPalette: AppPalette = {
  background: "#fff7f2",
  surface: "#ffffff",
  surfaceAlt: "#f3f2f0",
  accent: "#f46e43",
  accentSoft: "#ffe0d3",
  text: "#2c1a15",
  subtext: "#7d5c51",
  border: "#f4d6cb",
  warm: "#ffb884",
  dangerSoft: "#fff1ea",
  dangerText: "#d85b35",
  navBackground: "rgba(255,255,255,0.96)",
  navInactive: "#8f7b72",
  input: "#f8f5f2",
  overlay: "rgba(36, 26, 21, 0.58)",
};

export const darkPalette: AppPalette = {
  background: "#121214",
  surface: "#1b1c20",
  surfaceAlt: "#17171b",
  accent: "#f08b6d",
  accentSoft: "#2a2320",
  text: "#f6f2ee",
  subtext: "#9c9690",
  border: "#2a2b31",
  warm: "#ffb884",
  dangerSoft: "#2b211f",
  dangerText: "#ff9a7b",
  navBackground: "#17171b",
  navInactive: "#7f8087",
  input: "#232328",
  overlay: "rgba(7, 7, 9, 0.62)",
};

export const palette = lightPalette;

export function getPalette(mode: ThemeMode): AppPalette {
  return mode === "dark" ? darkPalette : lightPalette;
}

export function useThemeColors(): AppPalette {
  const mode = useAppearanceStore((state) => state.mode);
  return getPalette(mode);
}

export function useIsDarkMode(): boolean {
  return useAppearanceStore((state) => state.mode === "dark");
}

export function getNavigationTheme(mode: ThemeMode): Theme {
  const colors = getPalette(mode);
  const baseTheme = mode === "dark" ? DarkTheme : DefaultTheme;

  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.accent,
      notification: colors.accent,
    },
  };
}
