import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { useIsDarkMode, useThemeColors } from "../utils/theme";

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "filled" | "ghost";
  style?: ViewStyle;
};

export function PrimaryButton({ label, onPress, disabled, loading, variant = "filled", style }: PrimaryButtonProps) {
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const filledContentColor = isDark ? "#111111" : "#ffffff";

  return (
    <Pressable
      style={[
        styles.button,
        { backgroundColor: variant === "ghost" ? colors.accentSoft : colors.accent },
        (disabled || loading) && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={variant === "ghost" ? colors.accent : filledContentColor} />
      ) : (
        <Text style={[styles.label, { color: variant === "ghost" ? colors.accent : filledContentColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
  },
});
