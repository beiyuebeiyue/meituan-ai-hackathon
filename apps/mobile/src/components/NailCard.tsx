import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { resolveAssetUrl } from "../api/client";
import { AuthorRoleBadge } from "./AuthorRoleBadge";
import { NailStyle } from "../types/api";
import { getNailTypeLabel } from "../utils/nailType";
import { useThemeColors } from "../utils/theme";

type NailCardProps = {
  item: NailStyle;
  onToggleLike: (item: NailStyle) => void;
  onPress?: (item: NailStyle) => void;
};

export function NailCard({ item, onToggleLike, onPress }: NailCardProps) {
  const colors = useThemeColors();

  return (
    <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={() => onPress?.(item)}>
      <Image source={{ uri: resolveAssetUrl(item.image_url) }} style={[styles.image, { backgroundColor: colors.accentSoft }]} />
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Pressable onPress={() => onToggleLike(item)} hitSlop={8}>
            <Ionicons
              name={item.is_liked ? "heart" : "heart-outline"}
              size={18}
              color={item.is_liked ? colors.accent : colors.subtext}
            />
          </Pressable>
        </View>
        <Text style={[styles.desc, { color: colors.subtext }]} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.typePill, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.typePillText, { color: colors.subtext }]}>{getNailTypeLabel(item.nail_type)}</Text>
          </View>
          <AuthorRoleBadge isMerchant={item.author_is_shop} compact />
        </View>
        <View style={styles.tagRow}>
          {item.tags.slice(0, 2).map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.tagText, { color: colors.accent }]}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 6,
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  image: {
    width: "100%",
    aspectRatio: 0.86,
  },
  body: {
    padding: 12,
    gap: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  desc: {
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  typePill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  tagRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
