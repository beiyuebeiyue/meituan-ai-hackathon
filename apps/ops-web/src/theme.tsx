import React, { useEffect, useMemo } from "react";
import { App as AntApp, ConfigProvider, theme } from "antd";
import { BrowserRouter } from "react-router-dom";

export type OpsThemeMode = "light";

export const OpsThemeContext = React.createContext<{
  mode: OpsThemeMode;
  setMode: (mode: OpsThemeMode) => void;
  toggleMode: () => void;
}>({
  mode: "light",
  setMode: () => undefined,
  toggleMode: () => undefined,
});

export function OpsThemeProvider({ children }: { children: React.ReactNode }) {
  const mode: OpsThemeMode = "light";

  useEffect(() => {
    window.localStorage.removeItem("ops-theme");
    document.documentElement.dataset.theme = "light";
  }, []);

  const value = useMemo(
    () => ({
      mode,
      setMode: () => undefined,
      toggleMode: () => undefined,
    }),
    [],
  );

  return (
    <OpsThemeContext.Provider value={value}>
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: "#111827",
            colorInfo: "#2563eb",
            colorSuccess: "#10b981",
            colorWarning: "#f59e0b",
            colorError: "#ef4444",
            colorLink: "#111827",
            colorBgLayout: "#f5f7fb",
            colorBgContainer: "#ffffff",
            colorBgElevated: "#ffffff",
            colorBorder: "#e6eaf0",
            colorText: "#111827",
            colorTextSecondary: "#6b7280",
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
              borderColor: "#edf0f5",
              headerBg: "#f8fafc",
              headerColor: "#475569",
              rowHoverBg: "#f8fafc",
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
