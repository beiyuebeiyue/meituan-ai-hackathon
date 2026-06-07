import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";

type AIButtonThinkingRingProps = {
  animatedStyle: AnimatedStyle;
};

export const AIButtonThinkingRing = memo(function AIButtonThinkingRing({
  animatedStyle,
}: AIButtonThinkingRingProps) {
  return (
    <Animated.View pointerEvents="none" style={[styles.ring, animatedStyle]}>
      <View style={[styles.spark, styles.sparkTop]} />
      <View style={[styles.spark, styles.sparkRight]} />
      <View style={[styles.spark, styles.sparkBottom]} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  ring: {
    position: "absolute",
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderTopColor: "#fff7c2",
    borderRightColor: "#f6e38f",
    borderBottomColor: "rgba(246, 227, 143, 0.22)",
    borderLeftColor: "rgba(255, 255, 255, 0.12)",
  },
  spark: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#fff7c2",
    shadowColor: "#F6E38F",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  sparkTop: {
    top: -2,
    left: 36,
  },
  sparkRight: {
    top: 18,
    right: 3,
    opacity: 0.78,
  },
  sparkBottom: {
    bottom: 7,
    left: 12,
    opacity: 0.56,
  },
});
