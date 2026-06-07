import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";

type AIButtonGlowProps = {
  animatedStyle: AnimatedStyle;
  focused: boolean;
};

export const AIButtonGlow = memo(function AIButtonGlow({
  animatedStyle,
  focused,
}: AIButtonGlowProps) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.glow,
        focused ? styles.glowFocused : null,
        animatedStyle,
      ]}
    >
      <View style={styles.glowCore} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  glow: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "rgba(246, 227, 143, 0.34)",
    shadowColor: "#F6E38F",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.58,
    shadowRadius: 24,
  },
  glowFocused: {
    backgroundColor: "rgba(255, 235, 161, 0.44)",
    shadowOpacity: 0.72,
    shadowRadius: 30,
  },
  glowCore: {
    flex: 1,
    margin: 16,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
});
