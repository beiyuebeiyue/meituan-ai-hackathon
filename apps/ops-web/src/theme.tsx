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
            colorInfo: isDark ? "#d1d5db" : "#374151",
            colorLink: isDark ? "#f9fafb" : "#111827",
            colorBgLayout: isDark ? "#0b1120" : "#f6f6f6",
            colorBgContainer: isDark ? "#111827" : "#ffffff",
            colorBorder: isDark ? "#273449" : "#e5e7eb",
            colorText: isDark ? "#f9fafb" : "#111827",
            colorTextSecondary: isDark ? "#aeb8c8" : "#6b7280",
            borderRadius: 8,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
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
