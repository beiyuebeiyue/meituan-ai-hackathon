import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { resolveAssetUrl } from "../api/client";
import { AuthorRoleBadge } from "./AuthorRoleBadge";
import { NailStyle } from "../types/api";
import { getNailTypeLabel } from "../utils/nailType";
import { useIsDarkMode, useThemeColors } from "../utils/theme";

const defaultAvatar = require("../../assets/profile/default_avatar.png");

type BrowseFeedCardProps = {
  item: NailStyle;
  onPress: (item: NailStyle) => void;
  onToggleLike: (item: NailStyle) => void;
  showLike?: boolean;
};

export function BrowseFeedCard({ item, onPress, onToggleLike, showLike = true }: BrowseFeedCardProps) {
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const avatarSource = item.author_avatar_url ? { uri: resolveAssetUrl(item.author_avatar_url) } : defaultAvatar;

  return (
    <Pressable style={[styles.card, { backgroundColor: isDark ? "#1f1f24" : colors.surface }]} onPress={() => onPress(item)}>
      <Image source={{ uri: resolveAssetUrl(item.image_url) }} style={[styles.image, { backgroundColor: isDark ? "#2a2a30" : colors.accentSoft }]} />
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={[styles.typePill, { backgroundColor: isDark ? "#2a2a30" : colors.surfaceAlt }]}>
          <Text style={[styles.typePillText, { color: colors.subtext }]}>{getNailTypeLabel(item.nail_type)}</Text>
        </View>
        <View style={styles.footer}>
          <View style={styles.authorWrap}>
            <Image source={avatarSource} style={[styles.avatar, { backgroundColor: isDark ? "#34343a" : colors.surfaceAlt }]} />
            <View style={styles.authorTextBlock}>
              <View style={styles.authorNameRow}>
                <Text style={[styles.authorName, { color: colors.subtext }]} numberOfLines={1}>
                  {item.author_name}
                </Text>
              <AuthorRoleBadge isMerchant={item.author_is_shop} compact />
            </View>
            </View>
          </View>
          {showLike ? (
            <Pressable style={styles.likeWrap} onPress={() => onToggleLike(item)} hitSlop={8}>
              <Ionicons
                name={item.is_liked ? "heart" : "heart-outline"}
                size={17}
                color={item.is_liked ? "#ff7a8a" : "#d0d0d5"}
              />
              <Text style={[styles.likeText, { color: isDark ? "#d0d0d5" : colors.subtext }]}>{item.like_count}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 6,
    borderRadius: 16,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    aspectRatio: 1,
  },
  body: {
    padding: 10,
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
    minHeight: 40,
  },
  typePill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    paddingRight: 52,
  },
  authorWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  authorTextBlock: {
    flex: 1,
  },
  authorNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  authorName: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 14,
  },
  likeWrap: {
    position: "absolute",
    right: 0,
    top: 3,
    width: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  likeText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
