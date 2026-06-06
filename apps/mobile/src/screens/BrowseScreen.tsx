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
import { NailStyle } from "../types/api";
import { useAuthStore } from "../store/useAuthStore";
import { useContentPreferenceStore } from "../store/useContentPreferenceStore";
import { DEFAULT_MARKET_CITY, findMarketCity } from "../utils/marketCities";
import { trackEvent } from "../utils/analytics";

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
const categoryTabs = ["推荐", "视频", "直播", "短剧", "美食", "穿搭", "旅行"] as const;
const cardAspectPattern = [1.3, 0.75, 1.05, 1.35, 0.88, 1.18, 0.8] as const;

type MasonryItem = {
  item: NailStyle;
  imageHeight: number;
};

function avatarSource(item: NailStyle) {
  const defaultAvatar = require("../../assets/profile/default_avatar.png");
  return item.author_avatar_url ? { uri: resolveAssetUrl(item.author_avatar_url) } : defaultAvatar;
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

function DiscoverFeedCard({
  item,
  width,
  imageHeight,
  showLike,
  onToggleLike,
  onPress,
}: {
  item: NailStyle;
  width: number;
  imageHeight: number;
  showLike: boolean;
  onToggleLike: (item: NailStyle) => void;
  onPress: (item: NailStyle) => void;
}) {
  return (
    <Pressable style={[styles.card, { width }]} onPress={() => onPress(item)}>
      <Image
        source={{ uri: resolveAssetUrl(item.image_url) }}
        style={[styles.cardImage, { width, height: imageHeight }]}
        resizeMode="cover"
      />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.cardFooter}>
          <View style={styles.authorBlock}>
            <Image source={avatarSource(item)} style={styles.authorAvatar} />
            <Text style={styles.authorName} numberOfLines={1}>
              {item.author_name}
            </Text>
          </View>
          {showLike ? (
            <Pressable style={styles.likeBlock} onPress={() => onToggleLike(item)} hitSlop={8}>
              <Ionicons name={item.is_liked ? "heart" : "heart-outline"} size={15} color={item.is_liked ? DISCOVER_RED : "#8f8f98"} />
              <Text style={styles.likeText}>{item.like_count}</Text>
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
  const { width: screenWidth } = useWindowDimensions();
  const lastAutoRefreshKey = useRef("");
  const [tab, setTab] = useState<FeedTab>("discover");
  const [activeCategory, setActiveCategory] = useState<(typeof categoryTabs)[number]>("推荐");
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
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
    { key: "worldcup", label: "世界杯" },
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
    if (!hasToken) return;
    likeMutation.mutate(item);
  };

  const feedItems = tab === "following" && !hasToken ? [] : tab === "local" && !canUseLocalFeed ? [] : query.data?.items ?? [];
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
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.iconButton}
          onPress={() => navigation.navigate("MessagesInbox", { entryEdge: "left" })}
        >
          <Ionicons name={hasUnreadMessages ? "chatbubble-ellipses-outline" : "chatbubble-outline"} size={24} color={DISCOVER_TEXT} />
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
                if (item.key === "worldcup") {
                  setTab("discover");
                  return;
                }
                setTab(item.key);
              }}
              style={styles.topTabButton}
            >
              <Text
                style={[
                  styles.topTabText,
                  { color: tab === item.key ? DISCOVER_TEXT : DISCOVER_MUTED },
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              <View
                style={[
                  styles.topTabUnderline,
                  { backgroundColor: tab === item.key ? DISCOVER_RED : "transparent" },
                ]}
              />
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.iconButton} onPress={() => navigation.navigate("BrowseSearch")}>
          <Ionicons name="search-outline" size={23} color={DISCOVER_TEXT} />
        </Pressable>
      </View>

      <View style={styles.categoryBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryContent}>
          {categoryTabs.map((item) => {
            const active = activeCategory === item;
            return (
              <Pressable key={item} style={styles.categoryItem} onPress={() => setActiveCategory(item)}>
                <Text style={[styles.categoryText, { color: active ? DISCOVER_TEXT : DISCOVER_MUTED }]}>{item}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {tab === "following" && !hasToken ? (
        <RequireLogin onLogin={() => navigation.navigate("Login")} message="登录后可查看已关注作者发布的新美甲图" />
      ) : (
        <ScrollView
          style={styles.feedScroll}
          contentContainerStyle={[styles.feedContent, { paddingHorizontal: gap, paddingBottom: scrollPaddingBottom }]}
          refreshControl={
            <RefreshControl
              refreshing={isPullRefreshing}
              onRefresh={handleRefresh}
              tintColor={DISCOVER_RED}
              colors={[DISCOVER_RED]}
              progressBackgroundColor={DISCOVER_SURFACE}
            />
          }
        >
          {showInitialLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color={DISCOVER_RED} />
              <Text style={styles.emptyTitle}>正在加载美甲</Text>
              <Text style={styles.emptyText}>请稍等，发现页会自动刷新。</Text>
            </View>
          ) : !feedItems.length ? (
            tab === "following" ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>你的关注页还是空的</Text>
              <Text style={styles.emptyText}>去任意美甲详情页关注作者后，这里会优先显示对方发布的新图片。</Text>
            </View>
          ) : tab === "local" ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {canUseLocalFeed
                  ? "同城还没有商家作品"
                  : localLocationStatus === "pending"
                    ? "正在获取 GPS 定位"
                    : "开启 GPS 查看同城美甲"}
              </Text>
              <Text style={styles.emptyText}>
                {canUseLocalFeed
                  ? `当前城市：${localCity}。商家发布后会优先出现在这里。`
                  : localLocationStatus === "pending"
                    ? "正在确认你的城市位置，请稍等。"
                    : "需要允许定位权限后，才能查看你所在城市的同城美甲推文。"}
              </Text>
            </View>
          ) : tab === "discover" ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>没有匹配的美甲</Text>
              <Text style={styles.emptyText}>换一个频道，或稍后回来查看更多作品。</Text>
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
                      onToggleLike={onToggleLike}
                      showLike={!isMerchant}
                      onPress={(selected) => {
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
