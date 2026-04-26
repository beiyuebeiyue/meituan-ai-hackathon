import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { Pressable, ScrollView, ScrollViewProps, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../utils/theme";

type ScrollProps = {
  children: ReactNode;
  contentStyle?: ScrollViewProps["contentContainerStyle"];
} & Omit<ScrollViewProps, "contentContainerStyle">;

type EmptyProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
};

type HeaderProps = {
  title: string;
  onBack: () => void;
  right?: ReactNode;
};

function Header({ title, onBack, right }: HeaderProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <Pressable style={styles.headerButton} onPress={onBack}>
        <Ionicons name="chevron-back" size={28} color={colors.text} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerButton}>{right}</View>
    </View>
  );
}

function Scroll({ children, contentStyle, showsVerticalScrollIndicator = false, ...props }: ScrollProps) {
  const colors = useThemeColors();

  return (
    <ScrollView
      {...props}
      style={[styles.scroll, { backgroundColor: colors.surfaceAlt }, props.style]}
      contentContainerStyle={[styles.content, contentStyle]}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
    >
      {children}
    </ScrollView>
  );
}

function Empty({ icon, title, description }: EmptyProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.empty, { backgroundColor: colors.surface }]}>
      <Ionicons name={icon} size={32} color={colors.subtext} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyText, { color: colors.subtext }]}>{description}</Text>
    </View>
  );
}

export const OverlayContent = {
  Header,
  Scroll,
  Empty,
};

const styles = StyleSheet.create({
  header: {
    height: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "800",
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
    gap: 14,
  },
  empty: {
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
