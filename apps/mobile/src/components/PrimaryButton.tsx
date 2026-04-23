import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { palette } from "../utils/theme";

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "filled" | "ghost";
  style?: ViewStyle;
};

export function PrimaryButton({ label, onPress, disabled, loading, variant = "filled", style }: PrimaryButtonProps) {
  return (
    <Pressable
      style={[
        styles.button,
        variant === "ghost" ? styles.buttonGhost : styles.buttonFilled,
        (disabled || loading) && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={variant === "ghost" ? palette.accent : "white"} />
      ) : (
        <Text style={[styles.label, variant === "ghost" ? styles.labelGhost : styles.labelFilled]}>{label}</Text>
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
  buttonFilled: {
    backgroundColor: palette.accent,
  },
  buttonGhost: {
    backgroundColor: palette.accentSoft,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
  },
  labelFilled: {
    color: "white",
  },
  labelGhost: {
    color: palette.accent,
  },
});
