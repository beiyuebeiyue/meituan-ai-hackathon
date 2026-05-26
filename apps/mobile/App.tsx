import "react-native-gesture-handler";

import { NavigationContainer } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthSessionGate } from "./src/components/AuthSessionGate";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { bootstrapAppearance, useAppearanceStore } from "./src/store/useAppearanceStore";
import { hydrateAuthFromStorage } from "./src/store/useAuthStore";
import { initAnalytics, trackEvent } from "./src/utils/analytics";
import { getNavigationTheme } from "./src/utils/theme";

const queryClient = new QueryClient();
const welcomeLogo = require("./assets/login/logo.png");
const WELCOME_VISIBLE_MS = 2000;
const WELCOME_FADE_MS = 360;

export default function App() {
  const mode = useAppearanceStore((state) => state.mode);
  const [showWelcome, setShowWelcome] = useState(true);
  const welcomeOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    void (async () => {
      await hydrateAuthFromStorage();
      await initAnalytics();
      await trackEvent("app_open", { screen: "app", source: "startup" });
    })();
    void bootstrapAppearance();
  }, []);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const show = () => {
      if (hideTimer) clearTimeout(hideTimer);
      welcomeOpacity.stopAnimation();
      welcomeOpacity.setValue(1);
      setShowWelcome(true);
      hideTimer = setTimeout(() => {
        Animated.timing(welcomeOpacity, {
          toValue: 0,
          duration: WELCOME_FADE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) setShowWelcome(false);
        });
      }, WELCOME_VISIBLE_MS);
    };

    show();
    return () => {
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [welcomeOpacity]);

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
      {showWelcome ? (
        <Animated.View pointerEvents="none" style={[styles.welcomeOverlay, { opacity: welcomeOpacity }]}>
          <View style={styles.logoBox}>
            <Image source={welcomeLogo} style={styles.welcomeLogo} resizeMode="contain" />
          </View>
        </Animated.View>
      ) : null}
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  welcomeOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "#f4f1ed",
    justifyContent: "center",
    zIndex: 9999,
  },
  logoBox: {
    alignItems: "center",
    height: 156,
    justifyContent: "center",
    maxWidth: 340,
    transform: [{ translateY: -52 }],
    width: "48%",
  },
  welcomeLogo: {
    height: "100%",
    width: "100%",
  },
});
