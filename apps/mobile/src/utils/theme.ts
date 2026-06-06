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
  background: "#f7f7f7",
  surface: "#ffffff",
  surfaceAlt: "#eeeeee",
  accent: "#111111",
  accentSoft: "#e8e8e8",
  text: "#111111",
  subtext: "#666666",
  border: "#dedede",
  warm: "#4a4a4a",
  dangerSoft: "#eeeeee",
  dangerText: "#2b2b2b",
  navBackground: "rgba(255,255,255,0.96)",
  navInactive: "#8a8a8a",
  input: "#f1f1f1",
  overlay: "rgba(0, 0, 0, 0.58)",
};

export const darkPalette: AppPalette = {
  background: "#0f0f0f",
  surface: "#1a1a1a",
  surfaceAlt: "#242424",
  accent: "#ffffff",
  accentSoft: "#2f2f2f",
  text: "#f7f7f7",
  subtext: "#a8a8a8",
  border: "#343434",
  warm: "#d8d8d8",
  dangerSoft: "#252525",
  dangerText: "#f0f0f0",
  navBackground: "#111111",
  navInactive: "#8a8a8a",
  input: "#242424",
  overlay: "rgba(0, 0, 0, 0.66)",
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
