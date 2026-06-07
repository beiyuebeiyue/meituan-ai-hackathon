import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import * as Location from "expo-location";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api, resolveAssetUrl } from "../api/client";
import { RequireLogin } from "../components/RequireLogin";
import { defaultAvatarSourceFor } from "../constants/imageSources";
import { NailStyle } from "../types/api";
import { useAuthStore } from "../store/useAuthStore";
import { useContentPreferenceStore } from "../store/useContentPreferenceStore";
import { DEFAULT_MARKET_CITY, findMarketCity } from "../utils/marketCities";
import { trackEvent } from "../utils/analytics";
import { getNailTypeLabel, getNailTypeTone } from "../utils/nailType";
import { useIsDarkMode } from "../utils/theme";

type FeedTab = "local" | "following" | "discover";
type LocalLocationStatus = "pending" | "granted" | "denied" | "unavailable";

const DISCOVER_BG = "#111116";
const DISCOVER_SURFACE = "#1a1a20";
const DISCOVER_SURFACE_ALT = "#23232a";
const DISCOVER_TEXT = "#f2f2f4";
const DISCOVER_MUTED = "#9a9aa2";
const DISCOVER_DIM = "#686872";
const DISCOVER_BORDER = "#24242b";
const DISCOVER_RED = "#ff2d55";
const AI_GOLD = "#F6E38F";
const LIGHT_DISCOVER_BG = "#ffffff";
const LIGHT_DISCOVER_SURFACE = "#ffffff";
const LIGHT_DISCOVER_SURFACE_ALT = "#f3f3f3";
const LIGHT_DISCOVER_TEXT = "#111111";
const LIGHT_DISCOVER_MUTED = "#777777";
const LIGHT_DISCOVER_DIM = "#8f8f98";
const LIGHT_DISCOVER_BORDER = "#eeeeee";
const categoryTabs = ["综合", "全部类型", "法式", "猫眼", "裸粉", "通勤", "显白"] as const;
const cardAspectPattern = [1.3, 0.75, 1.05, 1.35, 0.88, 1.18, 0.8] as const;

type MasonryItem = {
  item: NailStyle;
  imageHeight: number;
};

function avatarSource(item: NailStyle) {
  return defaultAvatarSourceFor({ is_shop: item.author_is_shop });
}

function estimateTitleLines(item: NailStyle) {
  return item.title.length > 18 ? 2 : 1;
}

function buildMasonryColumns(items: NailStyle[], columnWidth: number) {
  const columns: [MasonryItem[], MasonryItem[]] = [[], []];
  const heights = [0, 0];
  items.forEach((item, index) => {
    const aspect = cardAspectPattern[index % cardAspectPattern.length];
    const imageHeight = Math.round(columnWidth * aspect);
    const bodyHeight = 10 + estimateTitleLines(item) * 20 + 32 + 10;
    const targetIndex = heights[0] <= heights[1] ? 0 : 1;
    columns[targetIndex].push({ item, imageHeight });
    heights[targetIndex] += imageHeight + bodyHeight + 7;
  });
  return columns;
}

function matchesCategory(item: NailStyle, category: (typeof categoryTabs)[number]) {
  if (category === "综合" || category === "全部类型") return true;
  const normalizedCategory = category.trim().toLowerCase();
  const text = [item.title, item.description, ...(item.tags ?? [])].join(" ").toLowerCase();
  return text.includes(normalizedCategory);
}

function DiscoverFeedCard({
  item,
  width,
  imageHeight,
  showLike,
  onToggleLike,
  onPress,
  colors,
  isDark,
}: {
  item: NailStyle;
  width: number;
  imageHeight: number;
  showLike: boolean;
  onToggleLike: (item: NailStyle) => void;
  onPress: (item: NailStyle) => void;
  colors: {
    surface: string;
    surfaceAlt: string;
    text: string;
    muted: string;
    dim: string;
  };
  isDark: boolean;
}) {
  const nailTypeTone = getNailTypeTone(item.nail_type, isDark);
  const nailTypeIcon = item.nail_type === "handmade" ? "brush-outline" : "cube-outline";

  return (
    <Pressable style={[styles.card, { width, backgroundColor: colors.surface }]} onPress={() => onPress(item)}>
      <View style={[styles.cardImageWrap, { width, height: imageHeight }]}>
        <Image
          source={{ uri: resolveAssetUrl(item.image_url) }}
          style={[styles.cardImage, { width, height: imageHeight, backgroundColor: colors.surfaceAlt }]}
          resizeMode="cover"
        />
        <View
          style={[
            styles.discoverTypeBadge,
            {
              backgroundColor: nailTypeTone.backgroundColor,
              borderColor: nailTypeTone.borderColor,
            },
          ]}
        >
          <Ionicons name={nailTypeIcon} size={13} color={nailTypeTone.textColor} />
          <Text style={[styles.discoverTypeBadgeText, { color: nailTypeTone.textColor }]}>
            {getNailTypeLabel(item.nail_type)}
          </Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.cardFooter}>
          <View style={styles.authorBlock}>
            <Image source={avatarSource(item)} style={[styles.authorAvatar, { backgroundColor: colors.surfaceAlt }]} />
            <Text style={[styles.authorName, { color: colors.muted }]} numberOfLines={1}>
              {item.author_name}
            </Text>
          </View>
          {showLike ? (
            <Pressable style={styles.likeBlock} onPress={() => onToggleLike(item)} hitSlop={8}>
              <Ionicons name={item.is_liked ? "heart" : "heart-outline"} size={15} color={item.is_liked ? DISCOVER_RED : colors.dim} />
              <Text style={[styles.likeText, { color: colors.dim }]}>{item.like_count}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function BrowseScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const isDarkMode = useIsDarkMode();
  const discoverColors = {
    bg: isDarkMode ? DISCOVER_BG : LIGHT_DISCOVER_BG,
    surface: isDarkMode ? DISCOVER_SURFACE : LIGHT_DISCOVER_SURFACE,
    surfaceAlt: isDarkMode ? DISCOVER_SURFACE_ALT : LIGHT_DISCOVER_SURFACE_ALT,
    text: isDarkMode ? DISCOVER_TEXT : LIGHT_DISCOVER_TEXT,
    muted: isDarkMode ? DISCOVER_MUTED : LIGHT_DISCOVER_MUTED,
    dim: isDarkMode ? DISCOVER_DIM : LIGHT_DISCOVER_DIM,
    border: isDarkMode ? DISCOVER_BORDER : LIGHT_DISCOVER_BORDER,
  };
  const { width: screenWidth } = useWindowDimensions();
  const lastAutoRefreshKey = useRef("");
  const [tab, setTab] = useState<FeedTab>("discover");
  const [activeCategory, setActiveCategory] = useState<(typeof categoryTabs)[number]>("全部类型");
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [localLikeState, setLocalLikeState] = useState<Record<string, boolean>>({});
  const [localCity, setLocalCity] = useState(DEFAULT_MARKET_CITY);
  const [localLocationStatus, setLocalLocationStatus] = useState<LocalLocationStatus>("pending");
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const includeXhsPosts = useContentPreferenceStore((state) => state.includeXhsPosts);
  const contentPreferenceHydrated = useContentPreferenceStore((state) => state.hydrated);
  const hasToken = Boolean(token);
  const isMerchant = user?.role === "merchant";
  const authScope = !hydrated ? "booting" : hasToken ? "authed" : "anon";
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          if (!cancelled) setLocalLocationStatus("denied");
          return;
        }
        const position = await Location.getCurrentPositionAsync({});
        const geocoded = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (cancelled) return;
        const matched = findMarketCity(geocoded[0]?.city ?? geocoded[0]?.subregion ?? geocoded[0]?.region ?? "");
        if (matched) setLocalCity(matched.name);
        setLocalLocationStatus("granted");
      } catch {
        if (!cancelled) setLocalLocationStatus("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canUseLocalFeed = localLocationStatus === "granted";
  const localTabLabel = canUseLocalFeed ? localCity : "同城";
  const topTabs = [
    { key: "following", label: "关注" },
    { key: "discover", label: "发现" },
    { key: "local", label: localTabLabel === "同城" ? "深圳" : localTabLabel },
  ] as const;

  const query = useQuery({
    queryKey: ["browse", tab, authScope, localCity, includeXhsPosts],
    queryFn: () => (tab === "following" ? api.getFollowingStyles() : tab === "local" ? api.getLocalStyles(localCity) : api.getDiscover()),
    enabled: hydrated && contentPreferenceHydrated && (tab === "discover" || (tab === "local" && canUseLocalFeed) || hasToken),
    refetchOnMount: "always",
    refetchOnReconnect: true,
    staleTime: 0,
    retry: 2,
  });
  const messageInboxQuery = useQuery({
    queryKey: ["message-inbox"],
    queryFn: api.getMessageInbox,
    enabled: Boolean(token),
    staleTime: 5000,
    refetchInterval: token ? 15000 : false,
  });
  const hasStrangerUnread = Boolean(messageInboxQuery.data?.badge.has_stranger_unread);
  const mainUnreadCount = messageInboxQuery.data?.badge.main_unread_count ?? 0;
  const hasUnreadMessages = hasStrangerUnread || mainUnreadCount > 0;
  const messageBadgeText = mainUnreadCount > 99 ? "99+" : mainUnreadCount > 0 ? String(mainUnreadCount) : "";

  const likeMutation = useMutation({
    mutationFn: async (item: NailStyle) => {
      if (item.is_liked) {
        await api.unlikeStyle(item.id);
      } else {
        await api.likeStyle(item.id);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["browse"] });
      void queryClient.invalidateQueries({ queryKey: ["likes"] });
      void queryClient.invalidateQueries({ queryKey: ["style"] });
    },
  });

  const onToggleLike = (item: NailStyle) => {
    if (isMerchant) return;
    if (tab === "discover") {
      setLocalLikeState((current) => ({
        ...current,
        [item.id]: !(current[item.id] ?? item.is_liked),
      }));
      return;
    }
    if (!hasToken) return;
    likeMutation.mutate(item);
  };

  const allFeedItems = useMemo(() => {
    const items = tab === "following" && !hasToken ? [] : tab === "local" && !canUseLocalFeed ? [] : query.data?.items ?? [];
    if (tab !== "discover") return items;
    return items.map((item) => {
      const isLiked = localLikeState[item.id] ?? item.is_liked;
      const likeDelta = isLiked && !item.is_liked ? 1 : !isLiked && item.is_liked ? -1 : 0;
      return {
        ...item,
        is_liked: isLiked,
        like_count: Math.max(0, item.like_count + likeDelta),
      };
    });
  }, [canUseLocalFeed, hasToken, localLikeState, query.data?.items, tab]);
  const feedItems = useMemo(() => allFeedItems.filter((item) => matchesCategory(item, activeCategory)), [activeCategory, allFeedItems]);
  useEffect(() => {
    if (!feedItems.length) return;
    void Promise.all(
      feedItems.slice(0, 12).map((item) =>
        trackEvent("style_impression", {
          styleId: item.id,
          source: tab,
          screen: "browse",
          properties: { role: item.author_is_shop ? "merchant" : "consumer" },
        }),
      ),
    );
  }, [feedItems.map((item) => item.id).join(","), tab]);
  const canRefresh = hydrated && contentPreferenceHydrated && (tab === "discover" || (tab === "local" && canUseLocalFeed) || hasToken);
  const autoRefreshKey = `${tab}:${authScope}:${localCity}:${includeXhsPosts}`;
  useEffect(() => {
    if (!isFocused || !canRefresh) return;
    if (lastAutoRefreshKey.current === autoRefreshKey) return;
    lastAutoRefreshKey.current = autoRefreshKey;
    void query.refetch();
  }, [autoRefreshKey, canRefresh, isFocused, query.refetch]);
  const showInitialLoading = canRefresh && !query.data && (query.isLoading || query.isFetching);
  const gap = Math.max(4, Math.round(screenWidth * 0.011));
  const columnWidth = Math.floor((screenWidth - gap * 3) / 2);
  const masonryColumns = useMemo(() => buildMasonryColumns(feedItems, columnWidth), [feedItems, columnWidth]);
  const scrollPaddingBottom = 78 + insets.bottom;
  const handleRefresh = async () => {
    if (!canRefresh) return;
    setIsPullRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setIsPullRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: discoverColors.bg }]} edges={["top"]}>
      <View style={[styles.topBar, { backgroundColor: discoverColors.bg, borderBottomColor: discoverColors.border }]}>
        <Pressable
          style={styles.iconButton}
          onPress={() => navigation.navigate("MessagesInbox", { entryEdge: "left" })}
        >
          <Ionicons name={hasUnreadMessages ? "chatbubble-ellipses-outline" : "chatbubble-outline"} size={24} color={discoverColors.text} />
          {hasStrangerUnread ? <View style={styles.dotBadge} /> : null}
          {!hasStrangerUnread && messageBadgeText ? (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{messageBadgeText}</Text>
            </View>
          ) : null}
        </Pressable>
        <View style={styles.topTabs}>
          {topTabs.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => {
                setTab(item.key);
              }}
              style={styles.topTabButton}
            >
              <Text
                style={[
                  styles.topTabText,
                  { color: tab === item.key ? discoverColors.text : discoverColors.muted },
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              <View
                style={[
                  styles.topTabUnderline,
                  { backgroundColor: tab === item.key ? AI_GOLD : "transparent" },
                ]}
              />
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.iconButton} onPress={() => navigation.navigate("BrowseSearch")}>
          <Ionicons name="search-outline" size={23} color={discoverColors.text} />
        </Pressable>
      </View>

      <View style={[styles.categoryBar, { backgroundColor: discoverColors.bg }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryContent}>
          {categoryTabs.map((item) => {
            const active = activeCategory === item;
            return (
              <Pressable key={item} style={styles.categoryItem} onPress={() => setActiveCategory(item)}>
                <Text style={[styles.categoryText, { color: active ? discoverColors.text : discoverColors.muted }]}>{item}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {tab === "following" && !hasToken ? (
        <RequireLogin onLogin={() => navigation.navigate("Login")} message="登录后可查看已关注作者发布的新美甲图" />
      ) : (
        <ScrollView
          style={[styles.feedScroll, { backgroundColor: discoverColors.bg }]}
          contentContainerStyle={[styles.feedContent, { paddingHorizontal: gap, paddingBottom: scrollPaddingBottom }]}
          refreshControl={
            <RefreshControl
              refreshing={isPullRefreshing}
              onRefresh={handleRefresh}
              tintColor={AI_GOLD}
              colors={["#111111"]}
              progressBackgroundColor={AI_GOLD}
            />
          }
        >
          {showInitialLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color={AI_GOLD} />
              <Text style={[styles.emptyTitle, { color: discoverColors.text }]}>正在加载美甲</Text>
              <Text style={[styles.emptyText, { color: discoverColors.muted }]}>请稍等，发现页会自动刷新。</Text>
            </View>
          ) : !feedItems.length ? (
            tab === "following" ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: discoverColors.text }]}>你的关注页还是空的</Text>
              <Text style={[styles.emptyText, { color: discoverColors.muted }]}>去任意美甲详情页关注作者后，这里会优先显示对方发布的新图片。</Text>
            </View>
          ) : tab === "local" ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: discoverColors.text }]}>
                {canUseLocalFeed
                  ? "同城还没有商家作品"
                  : localLocationStatus === "pending"
                    ? "正在获取 GPS 定位"
                    : "开启 GPS 查看同城美甲"}
              </Text>
              <Text style={[styles.emptyText, { color: discoverColors.muted }]}>
                {canUseLocalFeed
                  ? `当前城市：${localCity}。商家发布后会优先出现在这里。`
                  : localLocationStatus === "pending"
                    ? "正在确认你的城市位置，请稍等。"
                    : "需要允许定位权限后，才能查看你所在城市的同城美甲推文。"}
              </Text>
            </View>
          ) : tab === "discover" ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: discoverColors.text }]}>没有匹配的美甲</Text>
              <Text style={[styles.emptyText, { color: discoverColors.muted }]}>换一个标签，或回到“全部类型”查看更多作品。</Text>
            </View>
            ) : null
          ) : (
            <View style={[styles.masonry, { columnGap: gap }]}>
              {masonryColumns.map((column, columnIndex) => (
                <View key={columnIndex} style={[styles.masonryColumn, { width: columnWidth, gap: 7 }]}>
                  {column.map(({ item, imageHeight }) => (
                    <DiscoverFeedCard
                      key={item.id}
                      item={item}
                      width={columnWidth}
                      imageHeight={imageHeight}
                      colors={discoverColors}
                      isDark={isDarkMode}
                      onToggleLike={onToggleLike}
                      showLike={!isMerchant}
                      onPress={(selected) => {
                        queryClient.setQueryData(["style", selected.id, authScope], selected);
                        void Image.prefetch(resolveAssetUrl(selected.image_url));
                        void trackEvent("style_click", {
                          styleId: selected.id,
                          source: tab,
                          screen: "browse",
                          properties: { role: selected.author_is_shop ? "merchant" : "consumer" },
                        });
                        navigation.navigate("StylePreview", { styleId: selected.id });
                      }}
                    />
                  ))}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DISCOVER_BG,
  },
  topBar: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    backgroundColor: DISCOVER_BG,
    borderBottomColor: DISCOVER_BORDER,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconButton: {
    width: "12%",
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderRadius: 18,
  },
  dotBadge: {
    position: "absolute",
    top: 5,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: DISCOVER_RED,
  },
  countBadge: {
    position: "absolute",
    top: 2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: DISCOVER_RED,
  },
  countBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
  topTabs: {
    width: "65%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  topTabButton: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minWidth: 42,
    maxWidth: 58,
    height: 42,
  },
  topTabText: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 20,
  },
  topTabUnderline: {
    width: 24,
    height: 3,
    borderRadius: 999,
  },
  categoryBar: {
    height: 40,
    backgroundColor: DISCOVER_BG,
    justifyContent: "center",
  },
  categoryContent: {
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 28,
  },
  categoryItem: {
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryText: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 18,
  },
  feedScroll: {
    flex: 1,
    backgroundColor: DISCOVER_BG,
  },
  feedContent: {
    paddingTop: 4,
  },
  masonry: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  masonryColumn: {
    flexDirection: "column",
  },
  card: {
    backgroundColor: DISCOVER_SURFACE,
    borderRadius: 7,
    overflow: "hidden",
  },
  cardImage: {
    backgroundColor: DISCOVER_SURFACE_ALT,
  },
  cardImageWrap: {
    position: "relative",
  },
  cardBody: {
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 8,
    gap: 8,
  },
  cardTitle: {
    color: DISCOVER_TEXT,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  discoverTypeBadge: {
    position: "absolute",
    left: 8,
    top: 8,
    minHeight: 27,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  discoverTypeBadgeText: {
    fontSize: 12,
    fontWeight: "900",
  },
  cardFooter: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  authorBlock: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  authorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: DISCOVER_SURFACE_ALT,
  },
  authorName: {
    flex: 1,
    color: DISCOVER_MUTED,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "600",
  },
  likeBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  likeText: {
    color: "#8f8f98",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyState: {
    marginTop: 96,
    paddingHorizontal: 28,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  emptyText: {
    color: DISCOVER_MUTED,
    lineHeight: 20,
    textAlign: "center",
  },
});
