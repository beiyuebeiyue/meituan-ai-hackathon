import "react-native-gesture-handler";

import { NavigationContainer } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { bootstrapAppearance, useAppearanceStore } from "./src/store/useAppearanceStore";
import { bootstrapAuth } from "./src/store/useAuthStore";
import { getNavigationTheme } from "./src/utils/theme";

const queryClient = new QueryClient();

export default function App() {
  const mode = useAppearanceStore((state) => state.mode);

  useEffect(() => {
    void bootstrapAuth();
    void bootstrapAppearance();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer theme={getNavigationTheme(mode)}>
        <StatusBar style={mode === "dark" ? "light" : "dark"} />
        <RootNavigator />
      </NavigationContainer>
    </QueryClientProvider>
  );
}
