import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, resolveAssetUrl } from "../api/client";
import { SlideOverlayScreen, useOverlayDirection } from "../components/SlideOverlayScreen";
import { useAuthStore } from "../store/useAuthStore";
import type { NailStyle } from "../types/api";
import { useIsDarkMode, useThemeColors } from "../utils/theme";

const defaultAvatar = require("../../assets/profile/default_avatar.png");

function normalizeTag(raw?: string) {
  return (raw ?? "").trim().replace(/^#+/, "");
}

function formatCompact(value: number) {
  if (value >= 100000) return "10万+";
  if (value >= 10000) return `${(value / 10000).toFixed(1).replace(/\.0$/, "")}万`;
  return `${value}`;
}

function HashtagCard({
  item,
  onPress,
  onToggleLike,
  isDark,
  colors,
}: {
  item: NailStyle;
  onPress: (item: NailStyle) => void;
  onToggleLike: (item: NailStyle) => void;
  isDark: boolean;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const avatarSource = item.author_avatar_url ? { uri: resolveAssetUrl(item.author_avatar_url) } : defaultAvatar;
  const cardBg = isDark ? "#202026" : colors.surface;
  const imageBg = isDark ? "#2a2a30" : colors.surfaceAlt;
  const subtleText = isDark ? "#a4a4ad" : colors.subtext;
  const likeColor = item.is_liked ? "#ff4f7f" : isDark ? "#d9d9df" : "#b9aca5";

  return (
    <Pressable style={[styles.card, { backgroundColor: cardBg, borderColor: isDark ? "transparent" : colors.border }]} onPress={() => onPress(item)}>
      <Image source={{ uri: resolveAssetUrl(item.image_url) }} style={[styles.cardImage, { backgroundColor: imageBg }]} />
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.cardFooter}>
          <View style={styles.authorLine}>
            <Image source={avatarSource} style={[styles.avatar, { backgroundColor: imageBg }]} />
            <Text style={[styles.authorName, { color: subtleText }]} numberOfLines={1}>
              {item.author_name}
            </Text>
          </View>
          <Pressable style={styles.likeButton} onPress={() => onToggleLike(item)} hitSlop={8}>
            <Ionicons name={item.is_liked ? "heart" : "heart-outline"} size={18} color={likeColor} />
            <Text style={[styles.likeCount, { color: subtleText }]}>{item.like_count}</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

export function HashtagScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const direction = useOverlayDirection("right");
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  const authScope = !hydrated ? "booting" : token ? "authed" : "anon";
  const tag = normalizeTag(route.params?.tag);
  const [sortMode, setSortMode] = useState<"hot" | "latest">("hot");
  const [followed, setFollowed] = useState(false);

  const hashtagQuery = useQuery({
    queryKey: ["hashtag", tag, sortMode, authScope],
    queryFn: () => api.searchStyles(`#${tag}`),
    enabled: hydrated && tag.length > 0,
  });

  const items = useMemo(() => {
    const next = [...(hashtagQuery.data?.items ?? [])];
    if (sortMode === "latest") {
      next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return next;
    }
    next.sort((a, b) => b.like_count - a.like_count || b.popularity_score - a.popularity_score);
    return next;
  }, [hashtagQuery.data?.items, sortMode]);

  const heroImage = items[0]?.image_url ? resolveAssetUrl(items[0].image_url) : null;
  const total = hashtagQuery.data?.total ?? items.length;
  const commentTotal = items.reduce((sum, item) => sum + item.comment_count, 0);
  const likeTotal = items.reduce((sum, item) => sum + item.like_count, 0);
  const viewTotal = Math.max(total * 2700 + likeTotal * 11, total);
  const pageBg = isDark ? "#15151b" : colors.background;
  const stickyBg = isDark ? "rgba(21,21,27,0.98)" : "rgba(255,247,242,0.98)";
  const heroShadeBg = isDark ? "rgba(14,14,18,0.74)" : "rgba(255,247,242,0.82)";
  const activeSortColor = colors.text;
  const inactiveSortColor = isDark ? "#7f7f89" : colors.subtext;
  const stickyHeaderHeight = 118 + insets.top;

  const likeMutation = useMutation({
    mutationFn: async (item: NailStyle) => {
      if (!token) throw new Error("未登录");
      if (item.is_liked) {
        await api.unlikeStyle(item.id);
      } else {
        await api.likeStyle(item.id);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["hashtag"] });
      void queryClient.invalidateQueries({ queryKey: ["browse"] });
      void queryClient.invalidateQueries({ queryKey: ["browse-search"] });
      void queryClient.invalidateQueries({ queryKey: ["likes"] });
      void queryClient.invalidateQueries({ queryKey: ["style"] });
    },
  });

  const onToggleLike = (item: NailStyle) => {
    if (!token) {
      navigation.navigate("Login", { entryEdge: "right" });
      return;
    }
    likeMutation.mutate(item);
  };

  const openPublish = () => {
    navigation.navigate("MainTabs", { screen: "Publish" });
  };

  return (
    <SlideOverlayScreen direction={direction} backgroundColor={pageBg} onDismiss={() => navigation.goBack()}>
      {(dismiss) => (
        <View style={[styles.container, { backgroundColor: pageBg }]}>
          <View style={[styles.stickyHeader, { backgroundColor: stickyBg, borderBottomColor: colors.border, paddingTop: insets.top }]}>
            <View style={styles.stickyTopBar}>
              <Pressable style={styles.iconButton} onPress={dismiss}>
                <Ionicons name="chevron-back" size={32} color={colors.text} />
              </Pressable>
              <Text style={[styles.stickyTitle, { color: colors.text }]} numberOfLines={1}>
                #{tag || "美甲"}
              </Text>
              <View style={styles.topActions}>
                <Pressable style={styles.iconButton} onPress={() => navigation.navigate("BrowseSearch", { entryEdge: "right" })}>
                  <Ionicons name="search-outline" size={28} color={colors.text} />
                </Pressable>
                <Pressable style={styles.iconButton} onPress={() => Alert.alert("分享话题", `#${tag}`)}>
                  <Ionicons name="arrow-redo-outline" size={28} color={colors.text} />
                </Pressable>
              </View>
            </View>
            <View style={styles.sortBar}>
              {[
                { key: "hot", label: "最热" },
                { key: "latest", label: "最新" },
              ].map((tab) => {
                const active = sortMode === tab.key;
                return (
                  <Pressable key={tab.key} style={styles.sortTab} onPress={() => setSortMode(tab.key as "hot" | "latest")}>
                    <Text style={[styles.sortText, { color: active ? activeSortColor : inactiveSortColor }, active && styles.sortTextActive]}>{tab.label}</Text>
                    <View style={[styles.sortUnderline, active && styles.sortUnderlineActive]} />
                  </Pressable>
                );
              })}
              <Pressable style={styles.filterButton} onPress={() => Alert.alert("筛选", "筛选能力后续接入")}>
                <Text style={[styles.filterText, { color: inactiveSortColor }]}>筛选</Text>
                <Ionicons name="menu-outline" size={21} color={inactiveSortColor} />
              </Pressable>
            </View>
          </View>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            numColumns={2}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContent, { paddingTop: stickyHeaderHeight, paddingBottom: 108 + insets.bottom }]}
            columnWrapperStyle={styles.cardRow}
            refreshControl={
              <RefreshControl
                refreshing={hashtagQuery.isRefetching}
                onRefresh={() => void hashtagQuery.refetch()}
                tintColor={colors.accent}
                colors={[colors.accent]}
                progressViewOffset={stickyHeaderHeight}
              />
            }
            ListHeaderComponent={
              <View style={styles.headerWrap}>
                {heroImage ? <Image source={{ uri: heroImage }} blurRadius={22} style={styles.heroImage} /> : null}
                <View style={[styles.heroShade, { backgroundColor: heroShadeBg }]} />
                <View style={styles.topicIntro}>
                  <View style={styles.titleRow}>
                    <View style={styles.titleBlock}>
                      <Text style={[styles.topicTitle, { color: colors.text }]} numberOfLines={2}>
                        # {tag || "美甲"}
                      </Text>
                      <Text style={[styles.topicStats, { color: colors.subtext }]}>
                        {formatCompact(viewTotal)}浏览 ｜ {formatCompact(Math.max(commentTotal, total * 18))}讨论
                      </Text>
                    </View>
                    <Pressable
                      style={[
                        styles.followButton,
                        { borderColor: colors.accent },
                        followed && { borderColor: colors.border, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : colors.surface },
                      ]}
                      onPress={() => setFollowed((value) => !value)}
                    >
                      <Text style={[styles.followText, { color: colors.accent }, followed && { color: colors.subtext }]}>
                        {followed ? "已关注" : "关注"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.gridItem}>
                <HashtagCard
                  item={item}
                  colors={colors}
                  isDark={isDark}
                  onToggleLike={onToggleLike}
                  onPress={(selected) => navigation.navigate("StylePreview", { styleId: selected.id, entryEdge: "right" })}
                />
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="images-outline" size={48} color={colors.subtext} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>{hashtagQuery.isLoading ? "正在加载话题内容" : "这个话题还没有作品"}</Text>
                <Text style={[styles.emptyText, { color: colors.subtext }]}>发布一篇带 #{tag || "美甲"} 的美甲灵感，成为第一批参与者。</Text>
              </View>
            }
          />
          <Pressable style={[styles.publishButton, { bottom: 26 + insets.bottom }]} onPress={openPublish}>
            <Ionicons name="add" size={28} color="#fff" />
            <Text style={styles.publishText}>去发布</Text>
          </Pressable>
        </View>
      )}
    </SlideOverlayScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#15151b",
  },
  listContent: {
    paddingBottom: 108,
  },
  headerWrap: {
    overflow: "hidden",
    paddingBottom: 16,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.38,
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(14,14,18,0.72)",
  },
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stickyTopBar: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 6,
  },
  stickyTitle: {
    position: "absolute",
    left: 98,
    right: 98,
    textAlign: "center",
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "900",
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  topicIntro: {
    paddingHorizontal: 24,
    paddingTop: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 16,
  },
  titleBlock: {
    flex: 1,
  },
  topicTitle: {
    color: "#f8f8fb",
    fontSize: 31,
    lineHeight: 39,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  topicStats: {
    color: "#b5b5bf",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 10,
  },
  followButton: {
    borderWidth: 1,
    borderColor: "#ff3d68",
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 10,
    marginBottom: 2,
  },
  followButtonActive: {
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  followText: {
    color: "#ff3d68",
    fontSize: 16,
    fontWeight: "800",
  },
  sortBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 30,
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 12,
  },
  sortTab: {
    alignItems: "flex-start",
    gap: 7,
  },
  sortText: {
    color: "#7f7f89",
    fontSize: 20,
    fontWeight: "800",
  },
  sortTextActive: {
    fontWeight: "900",
  },
  sortUnderline: {
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: "transparent",
  },
  sortUnderlineActive: {
    backgroundColor: "#ff3d68",
  },
  filterButton: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
  },
  filterText: {
    color: "#85858e",
    fontSize: 18,
    fontWeight: "700",
  },
  cardRow: {
    paddingHorizontal: 6,
  },
  gridItem: {
    width: "50%",
    padding: 5,
  },
  card: {
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "#202026",
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardImage: {
    width: "100%",
    aspectRatio: 0.82,
    backgroundColor: "#2a2a30",
  },
  cardBody: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 14,
  },
  cardTitle: {
    color: "#f0f0f4",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  authorLine: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#34343a",
  },
  authorName: {
    flex: 1,
    color: "#a4a4ad",
    fontSize: 13,
    fontWeight: "700",
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  likeCount: {
    color: "#d2d2d8",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 30,
    paddingTop: 90,
  },
  emptyTitle: {
    color: "#f0f0f4",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 16,
  },
  emptyText: {
    color: "#8f8f98",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
  },
  publishButton: {
    position: "absolute",
    left: "50%",
    bottom: 26,
    transform: [{ translateX: -84 }],
    width: 168,
    height: 58,
    borderRadius: 29,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ff2456",
    shadowColor: "#ff2456",
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  publishText: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "900",
  },
});
