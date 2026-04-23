import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { resolveAssetUrl } from "../api/client";
import { NailStyle } from "../types/api";
import { palette } from "../utils/theme";

type NailCardProps = {
  item: NailStyle;
  onToggleFavorite: (item: NailStyle) => void;
  onPress?: (item: NailStyle) => void;
};

export function NailCard({ item, onToggleFavorite, onPress }: NailCardProps) {
  return (
    <Pressable style={styles.card} onPress={() => onPress?.(item)}>
      <Image source={{ uri: resolveAssetUrl(item.image_url) }} style={styles.image} />
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <Pressable onPress={() => onToggleFavorite(item)} hitSlop={8}>
            <Ionicons
              name={item.is_favorited ? "heart" : "heart-outline"}
              size={18}
              color={item.is_favorited ? palette.accent : palette.subtext}
            />
          </Pressable>
        </View>
        <Text style={styles.desc} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.tagRow}>
          {item.tags.slice(0, 2).map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
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
    backgroundColor: palette.surface,
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
    backgroundColor: palette.accentSoft,
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
    color: palette.text,
  },
  desc: {
    color: palette.subtext,
    lineHeight: 18,
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
    backgroundColor: "#fff0e7",
  },
  tagText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: "600",
  },
});
