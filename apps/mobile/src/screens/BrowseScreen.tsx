import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import * as Location from "expo-location";
import { ActivityIndicator, FlatList, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { BrowseFeedCard } from "../components/BrowseFeedCard";
import { RequireLogin } from "../components/RequireLogin";
import { NailStyle } from "../types/api";
import { useAuthStore } from "../store/useAuthStore";
import { useContentPreferenceStore } from "../store/useContentPreferenceStore";
import { useIsDarkMode, useThemeColors } from "../utils/theme";
import { DEFAULT_MARKET_CITY, findMarketCity } from "../utils/marketCities";
import { trackEvent } from "../utils/analytics";

type FeedTab = "local" | "following" | "discover";
type FilterableTab = "local" | "discover";
type RoleFilterKey = "all" | "merchant" | "consumer";
type LocalLocationStatus = "pending" | "granted" | "denied" | "unavailable";
type BrowseFilterState = {
  role: RoleFilterKey;
  style: string;
};

const defaultBrowseFilterState: BrowseFilterState = {
  role: "all",
  style: "all",
};

export function BrowseScreen() {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<FeedTab>("discover");
  const [filterStates, setFilterStates] = useState<Record<FilterableTab, BrowseFilterState>>({
    discover: defaultBrowseFilterState,
    local: defaultBrowseFilterState,
  });
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
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
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const discoverRoleFilters = useMemo(
    () =>
      [
        { key: "all", label: "综合" },
        { key: "merchant", label: "商家" },
        { key: "consumer", label: "顾客" },
      ] as const,
    [],
  );
  const discoverStyleFilters = useMemo(
    () => [
      { key: "all", label: "全部类型" },
      { key: "法式", label: "法式" },
      { key: "猫眼", label: "猫眼" },
      { key: "裸粉", label: "裸粉" },
      { key: "通勤", label: "通勤" },
      { key: "显白", label: "显白" },
      { key: "渐变", label: "渐变" },
    ],
    [],
  );
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

  const topTabs = isMerchant
    ? ([
        { key: "following", label: "我的关注" },
        { key: "discover", label: "发现" },
        { key: "local", label: localTabLabel },
      ] as const)
    : ([
        { key: "following", label: "关注" },
        { key: "discover", label: "发现" },
        { key: "local", label: localTabLabel },
      ] as const);

  const query = useQuery({
    queryKey: ["browse", tab, authScope, localCity, includeXhsPosts],
    queryFn: () => (tab === "following" ? api.getFollowingStyles() : tab === "local" ? api.getLocalStyles(localCity) : api.getDiscover()),
    enabled: hydrated && contentPreferenceHydrated && (tab === "discover" || (tab === "local" && canUseLocalFeed) || hasToken),
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

  const rawFeedItems = tab === "following" && !hasToken ? [] : tab === "local" && !canUseLocalFeed ? [] : query.data?.items ?? [];
  const usesDiscoverFilters = tab === "discover" || tab === "local";
  const showBrowseFilters = usesDiscoverFilters && (tab !== "local" || canUseLocalFeed);
  const activeFilterState = usesDiscoverFilters ? filterStates[tab] : defaultBrowseFilterState;
  const activeStyleFilter = discoverStyleFilters.find((item) => item.key === activeFilterState.style) ?? discoverStyleFilters[0];
  const activeRoleFilter = discoverRoleFilters.find((item) => item.key === activeFilterState.role) ?? discoverRoleFilters[0];
  const updateActiveFilter = (patch: Partial<BrowseFilterState>) => {
    if (!usesDiscoverFilters) return;
    setFilterStates((current) => ({
      ...current,
      [tab]: {
        ...current[tab],
        ...patch,
      },
    }));
  };
  const feedItems =
    !usesDiscoverFilters
      ? rawFeedItems
      : rawFeedItems
          .filter((item) => {
            if (activeFilterState.role === "merchant") return item.author_is_shop;
            if (activeFilterState.role === "consumer") return !item.author_is_shop;
            return true;
          })
          .filter((item) => {
            if (activeStyleFilter.key === "all") return true;
            const keyword = activeStyleFilter.key;
            return (
              item.tags.some((tag) => tag.includes(keyword)) ||
              item.title.includes(keyword) ||
              item.description.includes(keyword)
            );
          });
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
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? "#17171b" : colors.background }]}>
      <View style={[styles.topBar, { backgroundColor: isDark ? "#17171b" : colors.background, borderBottomColor: colors.border }]}>
        <Pressable
          style={styles.iconButton}
          onPress={() => navigation.navigate("MessagesInbox", { entryEdge: "left" })}
        >
          <Ionicons name={hasUnreadMessages ? "chatbubble-ellipses-outline" : "chatbubble-outline"} size={24} color={colors.text} />
          {hasStrangerUnread ? <View style={[styles.dotBadge, { backgroundColor: colors.accent }]} /> : null}
          {!hasStrangerUnread && messageBadgeText ? (
            <View style={[styles.countBadge, { backgroundColor: colors.accent }]}>
              <Text style={styles.countBadgeText}>{messageBadgeText}</Text>
            </View>
          ) : null}
        </Pressable>
        <View style={styles.topTabs}>
          {topTabs.map((item) => (
            <Pressable key={item.key} onPress={() => setTab(item.key)} style={styles.topTabButton}>
              <Text
                style={[
                  styles.topTabText,
                  { color: tab === item.key ? colors.text : colors.subtext },
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              <View
                style={[
                  styles.topTabUnderline,
                  { backgroundColor: tab === item.key ? colors.accent : "transparent" },
                ]}
              />
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.iconButton} onPress={() => navigation.navigate("BrowseSearch")}>
          <Ionicons name="search-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      {showBrowseFilters ? (
        <View style={[styles.filterWrap, { backgroundColor: isDark ? "#17171b" : colors.background, borderBottomColor: colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
            <Pressable style={styles.sourceDropdownButton} onPress={() => setSourceMenuOpen(true)}>
              <View style={styles.textFilterInner}>
                <Text style={[styles.filterChipText, { color: colors.text }]}>{activeRoleFilter.label}</Text>
                <Ionicons name="chevron-down" size={14} color={colors.text} />
              </View>
              <View style={[styles.filterUnderline, { backgroundColor: sourceMenuOpen ? colors.accent : "transparent" }]} />
            </Pressable>
            {discoverStyleFilters.map((item) => {
              const active = activeFilterState.style === item.key;
              return (
                <Pressable
                  key={item.key}
                  style={styles.filterChip}
                  onPress={() => updateActiveFilter({ style: item.key })}
                >
                  <Text style={[styles.filterChipText, { color: active ? colors.text : colors.subtext }]}>{item.label}</Text>
                  <View style={[styles.filterUnderline, { backgroundColor: active ? colors.accent : "transparent" }]} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <Modal transparent visible={sourceMenuOpen && showBrowseFilters} animationType="fade" onRequestClose={() => setSourceMenuOpen(false)}>
        <Pressable style={styles.sourceMenuBackdrop} onPress={() => setSourceMenuOpen(false)}>
          <View
            style={[
              styles.sourceMenu,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: isDark ? "#000000" : "#9f7d70",
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            {discoverRoleFilters.map((item) => {
              const active = activeFilterState.role === item.key;
              return (
                <Pressable
                  key={item.key}
                  style={[styles.sourceMenuItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    updateActiveFilter({ role: item.key });
                    setSourceMenuOpen(false);
                  }}
                >
                  <Text style={[styles.sourceMenuText, { color: active ? colors.accent : colors.text }]}>{item.label}</Text>
                  {active ? <Ionicons name="checkmark" size={18} color={colors.accent} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {tab === "following" && !hasToken ? (
        <RequireLogin onLogin={() => navigation.navigate("Login")} message="登录后可查看已关注作者发布的新美甲图" />
      ) : (
        <FlatList
          data={feedItems}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          refreshing={isPullRefreshing}
          onRefresh={handleRefresh}
          progressViewOffset={8}
          renderItem={({ item }) => (
            <View style={styles.gridItem}>
              <BrowseFeedCard
                item={item}
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
            </View>
          )}
          ListEmptyComponent={
            tab === "following" ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>你的关注页还是空的</Text>
              <Text style={[styles.emptyText, { color: colors.subtext }]}>去任意美甲详情页关注作者后，这里会优先显示对方发布的新图片。</Text>
            </View>
          ) : tab === "local" ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {canUseLocalFeed
                  ? "同城还没有商家作品"
                  : localLocationStatus === "pending"
                    ? "正在获取 GPS 定位"
                    : "开启 GPS 查看同城美甲"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.subtext }]}>
                {canUseLocalFeed
                  ? `当前城市：${localCity}。商家发布后会优先出现在这里。`
                  : localLocationStatus === "pending"
                    ? "正在确认你的城市位置，请稍等。"
                    : "需要允许定位权限后，才能查看你所在城市的同城美甲推文。"}
              </Text>
            </View>
          ) : tab === "discover" ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>没有匹配的美甲</Text>
              <Text style={[styles.emptyText, { color: colors.subtext }]}>换一个标签，或回到“全部”查看更多作品。</Text>
            </View>
          ) : null
        }
          contentContainerStyle={styles.list}
        />
      )}

      {isPullRefreshing ? (
        <View style={styles.refreshIndicatorWrap} pointerEvents="none">
          <View style={[styles.refreshIndicator, { backgroundColor: isDark ? "#222228" : colors.surface }]}>
            <ActivityIndicator size="small" color={isDark ? "#ffffff" : "#111111"} />
            <Text style={[styles.refreshIndicatorText, { color: isDark ? "#ffffff" : "#111111" }]}>刷新中...</Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  dotBadge: {
    position: "absolute",
    top: 5,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
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
  },
  countBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
  topTabs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  topTabButton: {
    alignItems: "center",
    gap: 6,
    minWidth: 56,
    maxWidth: 76,
  },
  topTabText: {
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 22,
  },
  topTabUnderline: {
    width: 28,
    height: 3,
    borderRadius: 999,
  },
  filterWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 24,
  },
  filterChip: {
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  sourceDropdownButton: {
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  textFilterInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  filterUnderline: {
    width: 22,
    height: 3,
    borderRadius: 999,
  },
  filterChipText: {
    fontSize: 15,
    fontWeight: "800",
  },
  sourceMenuBackdrop: {
    flex: 1,
    paddingTop: 122,
    paddingHorizontal: 14,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  sourceMenu: {
    width: 168,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  sourceMenuItem: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sourceMenuText: {
    fontSize: 15,
    fontWeight: "800",
  },
  row: {
    alignItems: "flex-start",
  },
  gridItem: {
    width: "50%",
  },
  list: {
    padding: 12,
    paddingBottom: 120,
  },
  emptyState: {
    marginTop: 80,
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
    color: "#8f8f98",
    lineHeight: 20,
    textAlign: "center",
  },
  refreshIndicatorWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 108,
    alignItems: "center",
  },
  refreshIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  refreshIndicatorText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
