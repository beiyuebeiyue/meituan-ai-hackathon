import "react-native-gesture-handler";

import { NavigationContainer } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthSessionGate } from "./src/components/AuthSessionGate";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { bootstrapAppearance, useAppearanceStore } from "./src/store/useAppearanceStore";
import { bootstrapContentPreferences } from "./src/store/useContentPreferenceStore";
import { hydrateAuthFromStorage } from "./src/store/useAuthStore";
import { initAnalytics, trackEvent } from "./src/utils/analytics";
import { getNavigationTheme } from "./src/utils/theme";

const queryClient = new QueryClient();

export default function App() {
  const mode = useAppearanceStore((state) => state.mode);

  useEffect(() => {
    void (async () => {
      await hydrateAuthFromStorage();
      await initAnalytics();
      await trackEvent("app_open", { screen: "app", source: "startup" });
    })();
    void bootstrapAppearance();
    void bootstrapContentPreferences();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
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
