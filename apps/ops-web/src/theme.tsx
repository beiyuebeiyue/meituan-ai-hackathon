import React, { useEffect, useMemo, useState } from "react";
import { App as AntApp, ConfigProvider, theme } from "antd";
import { BrowserRouter } from "react-router-dom";

export type OpsThemeMode = "light" | "dark";

export const OpsThemeContext = React.createContext<{
  mode: OpsThemeMode;
  setMode: (mode: OpsThemeMode) => void;
  toggleMode: () => void;
}>({
  mode: "light",
  setMode: () => undefined,
  toggleMode: () => undefined,
});

function getInitialTheme(): OpsThemeMode {
  const savedTheme = window.localStorage.getItem("ops-theme");
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function OpsThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<OpsThemeMode>(getInitialTheme);
  const isDark = mode === "dark";

  useEffect(() => {
    window.localStorage.setItem("ops-theme", mode);
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      toggleMode: () => setMode((current) => (current === "dark" ? "light" : "dark")),
    }),
    [mode],
  );

  return (
    <OpsThemeContext.Provider value={value}>
      <ConfigProvider
        theme={{
          algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            colorPrimary: isDark ? "#f9fafb" : "#111827",
            colorInfo: isDark ? "#93c5fd" : "#2563eb",
            colorSuccess: "#10b981",
            colorWarning: "#f59e0b",
            colorError: "#ef4444",
            colorLink: isDark ? "#f9fafb" : "#111827",
            colorBgLayout: isDark ? "#0a0f1d" : "#f5f7fb",
            colorBgContainer: isDark ? "#111827" : "#ffffff",
            colorBgElevated: isDark ? "#172033" : "#ffffff",
            colorBorder: isDark ? "#253047" : "#e6eaf0",
            colorText: isDark ? "#f9fafb" : "#111827",
            colorTextSecondary: isDark ? "#aeb8c8" : "#6b7280",
            borderRadius: 10,
            borderRadiusLG: 14,
            controlHeight: 36,
            controlHeightLG: 42,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
          },
          components: {
            Button: {
              borderRadius: 10,
              controlHeight: 36,
              fontWeight: 700,
            },
            Card: {
              borderRadiusLG: 14,
              headerFontSize: 15,
              headerFontSizeSM: 14,
              headerHeight: 52,
            },
            Menu: {
              itemBorderRadius: 10,
              itemHeight: 42,
              itemMarginInline: 8,
            },
            Table: {
              borderColor: isDark ? "#253047" : "#edf0f5",
              headerBg: isDark ? "#172033" : "#f8fafc",
              headerColor: isDark ? "#dbe4f0" : "#475569",
              rowHoverBg: isDark ? "#172033" : "#f8fafc",
            },
            Tag: {
              borderRadiusSM: 999,
            },
          },
        }}
      >
        <AntApp>
          <BrowserRouter>{children}</BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </OpsThemeContext.Provider>
  );
}
