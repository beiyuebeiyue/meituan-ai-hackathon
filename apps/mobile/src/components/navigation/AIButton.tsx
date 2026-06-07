import { Ionicons } from "@expo/vector-icons";
import { memo, useCallback } from "react";
import {
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { AIButtonGlow } from "./AIButtonGlow";
import { AIButtonThinkingRing } from "./AIButtonThinkingRing";
import { useAIPulseAnimation } from "./useAIPulseAnimation";

export type AIButtonStatus = "idle" | "thinking" | "success";

export type AIButtonProps = {
  label: "问问小嘉";
  focused: boolean;
  status?: AIButtonStatus;
  onPress?: (event: GestureResponderEvent) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  testID?: string;
};

export const AIButton = memo(function AIButton({
  label,
  focused,
  status = "idle",
  onPress,
  onLongPress,
  accessibilityLabel,
  testID,
}: AIButtonProps) {
  const thinking = status === "thinking";
  const { buttonStyle, glowStyle, ringStyle, runPressAnimation } =
    useAIPulseAnimation({ focused, thinking });

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      runPressAnimation();
      onPress?.(event);
    },
    [onPress, runPressAnimation],
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      onPress={handlePress}
      onLongPress={onLongPress}
      style={styles.touchTarget}
    >
      <View style={styles.stage}>
        <AIButtonGlow animatedStyle={glowStyle} focused={focused || thinking} />
        <AIButtonThinkingRing animatedStyle={ringStyle} />
        <Animated.View
          style={[
            styles.button,
            focused ? styles.buttonFocused : null,
            status === "success" ? styles.buttonSuccess : null,
            buttonStyle,
          ]}
        >
          <Ionicons
            name={focused || thinking ? "sparkles" : "sparkles-outline"}
            size={25}
            color={focused || thinking ? "#fff8c7" : "#111111"}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.label,
              focused || thinking ? styles.labelFocused : null,
            ]}
          >
            {label}
          </Text>
        </Animated.View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  touchTarget: {
    alignItems: "center",
    justifyContent: "flex-start",
    minWidth: 78,
    minHeight: 82,
    marginTop: -20,
  },
  stage: {
    width: 92,
    height: 92,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    backgroundColor: "#F6E38F",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.72)",
    shadowColor: "#F6E38F",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.34,
    shadowRadius: 18,
    elevation: 11,
  },
  buttonFocused: {
    backgroundColor: "#151515",
    borderColor: "rgba(255, 248, 199, 0.9)",
    shadowOpacity: 0.48,
    shadowRadius: 24,
  },
  buttonSuccess: {
    backgroundColor: "#182018",
    borderColor: "rgba(186, 255, 190, 0.72)",
  },
  label: {
    maxWidth: 58,
    color: "#111111",
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 12,
    letterSpacing: 0,
    textAlign: "center",
  },
  labelFocused: {
    color: "#fff8c7",
  },
});
