import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../utils/theme";

type AuthorRoleBadgeProps = {
  isMerchant: boolean;
  compact?: boolean;
};

export function AuthorRoleBadge({ isMerchant, compact = false }: AuthorRoleBadgeProps) {
  const colors = useThemeColors();

  if (!isMerchant) return null;

  return (
    <View style={[styles.badge, compact && styles.compactBadge, { backgroundColor: colors.accentSoft }]}>
      <Text style={[styles.text, compact && styles.compactText, { color: colors.accent }]}>商家</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  compactBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: {
    fontSize: 11,
    fontWeight: "900",
  },
  compactText: {
    fontSize: 10,
  },
});
