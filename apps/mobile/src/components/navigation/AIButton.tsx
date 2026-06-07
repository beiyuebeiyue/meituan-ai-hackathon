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
import { useIsDarkMode } from "../../utils/theme";
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
  const isDarkMode = useIsDarkMode();
  const thinking = status === "thinking";
  const tabSurface = isDarkMode ? "#111116" : "#ffffff";
  const { buttonStyle, ringStyle, runPressAnimation } =
    useAIPulseAnimation({ thinking });

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
        <View
          pointerEvents="none"
          style={[
            styles.hill,
            {
              backgroundColor: tabSurface,
              borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(17,17,17,0.06)",
            },
          ]}
        />
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
    minWidth: 90,
    minHeight: 96,
    marginTop: -34,
  },
  stage: {
    width: 112,
    height: 108,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 8,
  },
  hill: {
    position: "absolute",
    bottom: 0,
    width: 112,
    height: 62,
    borderTopLeftRadius: 56,
    borderTopRightRadius: 56,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  button: {
    width: 68,
    height: 68,
    borderRadius: 34,
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
    overflow: "hidden",
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
