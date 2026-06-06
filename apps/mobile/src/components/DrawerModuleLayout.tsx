import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { Image, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useIsDarkMode, useThemeColors } from "../utils/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];
type PillTone = "accent" | "success" | "danger" | "muted";

export function DrawerModuleCard({
  children,
  onPress,
  selected = false,
  disabled = false,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  const cardStyle = [
    styles.card,
    {
      backgroundColor: colors.surface,
      borderColor: selected ? colors.accent : colors.border,
      opacity: disabled ? 0.55 : 1,
      shadowColor: colors.overlay,
    },
    style,
  ];

  if (!onPress) {
    return <View style={cardStyle}>{children}</View>;
  }

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? colors.accent : colors.border,
          opacity: pressed ? 0.92 : disabled ? 0.55 : 1,
          shadowColor: colors.overlay,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function DrawerModuleThumbnail({
  uri,
  icon = "image-outline",
  round = false,
  size = "medium",
}: {
  uri?: string | null;
  icon?: IconName;
  round?: boolean;
  size?: "small" | "medium" | "large";
}) {
  const colors = useThemeColors();
  const sizeStyle = size === "small" ? styles.thumbnailSmall : size === "large" ? styles.thumbnailLarge : styles.thumbnail;
  const radiusStyle = round ? styles.thumbnailRound : styles.thumbnailRadius;

  if (uri) {
    return <Image source={{ uri }} style={[sizeStyle, radiusStyle, { backgroundColor: colors.surfaceAlt }]} />;
  }

  return (
    <View style={[sizeStyle, radiusStyle, styles.thumbnailPlaceholder, { backgroundColor: colors.surfaceAlt }]}>
      <Ionicons name={icon} size={size === "small" ? 20 : 28} color={colors.subtext} />
    </View>
  );
}

export function DrawerModulePill({
  label,
  icon,
  tone = "accent",
}: {
  label: string;
  icon?: IconName;
  tone?: PillTone;
}) {
  const colors = useThemeColors();
  const isDarkMode = useIsDarkMode();
  const toneStyle =
    tone === "success"
      ? { backgroundColor: colors.accentSoft, color: colors.accent }
      : tone === "danger"
        ? { backgroundColor: colors.dangerSoft, color: colors.dangerText }
        : tone === "muted"
          ? { backgroundColor: colors.surfaceAlt, color: colors.subtext }
          : { backgroundColor: colors.accentSoft, color: colors.accent };

  return (
    <View style={[styles.pill, { backgroundColor: toneStyle.backgroundColor }]}>
      {icon ? <Ionicons name={icon} size={12} color={toneStyle.color} /> : null}
      <Text style={[styles.pillText, { color: toneStyle.color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function DrawerModuleInfoBanner({
  icon,
  title,
  description,
}: {
  icon: IconName;
  title: string;
  description?: string;
}) {
  const colors = useThemeColors();

  return (
    <View style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.bannerIcon, { backgroundColor: colors.accentSoft }]}>
        <Ionicons name={icon} size={18} color={colors.accent} />
      </View>
      <View style={styles.bannerBody}>
        <Text style={[styles.bannerTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {description ? (
          <Text style={[styles.bannerDescription, { color: colors.subtext }]} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export const drawerModuleListStyles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 120,
  },
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  thumbnail: {
    width: 88,
    height: 108,
  },
  thumbnailSmall: {
    width: 64,
    height: 64,
  },
  thumbnailLarge: {
    width: 104,
    height: 128,
  },
  thumbnailRadius: {
    borderRadius: 16,
  },
  thumbnailRound: {
    borderRadius: 999,
  },
  thumbnailPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    minHeight: 26,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: 120,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "900",
  },
  banner: {
    minHeight: 64,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerBody: {
    flex: 1,
    gap: 3,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  bannerDescription: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
});
