import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { NailStyle } from "../types/api";
import { getStoredValue, setStoredValue } from "../utils/sessionStorage";
import { useThemeColors } from "../utils/theme";

type WeeklyHotNailsModalProps = {
  enabled: boolean;
  merchantUid?: number | null;
  visible?: boolean;
  auto?: boolean;
  onClose?: () => void;
  onStylePress?: (styleId: string) => void;
};

const TOP_COUNT = 10;

function isMonday(date: Date) {
  return date.getDay() === 1;
}

function getWeekStamp(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() + 4 - day);
  const yearStart = new Date(copy.getFullYear(), 0, 1);
  const week = Math.ceil(((copy.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${copy.getFullYear()}-${String(week).padStart(2, "0")}`;
}

function countTopTags(items: NailStyle[]) {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    item.tags.slice(0, 6).forEach((tag) => {
      const normalized = tag.trim();
      if (!normalized) return;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    });
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag]) => tag);
}

export function WeeklyHotNailsModal({
  enabled,
  merchantUid,
  visible,
  auto = true,
  onClose,
  onStylePress,
}: WeeklyHotNailsModalProps) {
  const colors = useThemeColors();
  const [autoVisible, setAutoVisible] = useState(false);
  const currentWeekKey = useMemo(() => getWeekStamp(new Date()), []);
  const storageKey = merchantUid !== undefined && merchantUid !== null ? `weekly-hot-modal:${merchantUid}:${currentWeekKey}` : null;
  const isControlled = typeof visible === "boolean";
  const actualVisible = Boolean(isControlled ? visible : autoVisible);

  const hotQuery = useQuery({
    queryKey: ["weekly-hot-nails"],
    queryFn: api.getHot,
    enabled: enabled && actualVisible,
    staleTime: 60000,
  });

  const items = useMemo(() => {
    return [...(hotQuery.data?.items ?? [])].sort((a, b) => b.like_count - a.like_count).slice(0, TOP_COUNT);
  }, [hotQuery.data?.items]);

  const topTags = useMemo(() => countTopTags(items), [items]);

  useEffect(() => {
    if (!auto || isControlled || !enabled || !storageKey || !isMonday(new Date())) return;
    let mounted = true;
    void getStoredValue(storageKey).then((value) => {
      if (!mounted || value === "seen") return;
      setAutoVisible(true);
    });
    return () => {
      mounted = false;
    };
  }, [auto, enabled, isControlled, storageKey]);

  const close = () => {
    if (auto && storageKey) {
      void setStoredValue(storageKey, "seen");
    }
    if (!isControlled) {
      setAutoVisible(false);
    }
    onClose?.();
  };

  const handleStylePress = (styleId: string) => {
    close();
    onStylePress?.(styleId);
  };

  return (
    <Modal visible={actualVisible} transparent animationType="fade" onRequestClose={close}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[styles.kicker, { color: colors.accent }]}>每周一更新</Text>
              <Text style={[styles.title, { color: colors.text }]}>本周热门美甲趋势</Text>
              <Text style={[styles.subtitle, { color: colors.subtext }]}>根据平台点赞热度生成，先看高频款式和标签。</Text>
            </View>
            <Pressable style={[styles.closeButton, { backgroundColor: colors.surfaceAlt }]} onPress={close} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          {topTags.length ? (
            <View style={styles.tagsRow}>
              {topTags.map((tag) => (
                <Text key={tag} style={[styles.tagText, { color: colors.accent }]}>
                  #{tag}
                </Text>
              ))}
            </View>
          ) : null}

          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {hotQuery.isLoading ? <Text style={[styles.emptyText, { color: colors.subtext }]}>正在整理本周趋势...</Text> : null}
            {!hotQuery.isLoading && !items.length ? <Text style={[styles.emptyText, { color: colors.subtext }]}>暂无热门美甲数据。</Text> : null}
            {items.map((item, index) => (
              <Pressable key={item.id} style={[styles.card, { backgroundColor: colors.surfaceAlt }]} onPress={() => handleStylePress(item.id)}>
                <Image source={{ uri: resolveAssetUrl(item.image_url) }} style={styles.image} />
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={[styles.cardMeta, { color: colors.subtext }]}>{item.like_count} 赞</Text>
                  <Text style={[styles.cardTags, { color: colors.accent }]} numberOfLines={1}>
                    {item.tags.slice(0, 3).map((tag) => `#${tag}`).join(" ")}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={close}>
            <Text style={styles.primaryText}>我知道了</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  sheet: {
    width: "100%",
    maxHeight: "86%",
    borderRadius: 28,
    padding: 18,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "900",
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagText: {
    fontSize: 13,
    fontWeight: "900",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    width: "48%",
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
  },
  image: {
    width: "100%",
    aspectRatio: 1,
  },
  rankBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.86)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },
  rankText: {
    color: "white",
    fontSize: 12,
    fontWeight: "900",
  },
  cardBody: {
    padding: 10,
    gap: 5,
  },
  cardTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
  },
  cardMeta: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardTags: {
    fontSize: 11,
    fontWeight: "800",
  },
  primaryButton: {
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
  },
});
