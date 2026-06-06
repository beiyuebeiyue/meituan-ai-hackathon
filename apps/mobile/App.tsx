import "react-native-gesture-handler";

import { NavigationContainer } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthSessionGate } from "./src/components/AuthSessionGate";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { bootstrapAppearance, useAppearanceStore } from "./src/store/useAppearanceStore";
import { bootstrapContentPreferences } from "./src/store/useContentPreferenceStore";
import { hydrateAuthFromStorage } from "./src/store/useAuthStore";
import { initAnalytics, trackEvent } from "./src/utils/analytics";
import { getNavigationTheme } from "./src/utils/theme";

const queryClient = new QueryClient();
const SPLASH_MIN_VISIBLE_MS = 2000;

void SplashScreen.preventAutoHideAsync();

export default function App() {
  const mode = useAppearanceStore((state) => state.mode);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const minVisible = new Promise((resolve) => setTimeout(resolve, SPLASH_MIN_VISIBLE_MS));
      await Promise.all([
        (async () => {
          await hydrateAuthFromStorage();
          await initAnalytics();
          await trackEvent("app_open", { screen: "app", source: "startup" });
        })(),
        bootstrapAppearance(),
        bootstrapContentPreferences(),
        minVisible,
      ]);
      setIsReady(true);
    })();
  }, []);

  const handleRootLayout = useCallback(() => {
    if (isReady) {
      void SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider onLayout={handleRootLayout}>
        <AuthSessionGate>
          <NavigationContainer theme={getNavigationTheme(mode)}>
            <StatusBar style={mode === "dark" ? "light" : "dark"} />
            <RootNavigator />
          </NavigationContainer>
        </AuthSessionGate>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
