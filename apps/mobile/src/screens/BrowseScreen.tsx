import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import * as Location from "expo-location";
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { BrowseFeedCard } from "../components/BrowseFeedCard";
import { ConsumerDrawerActionKey, ConsumerSideDrawer, MerchantDrawerActionKey, MerchantSideDrawer } from "../components/MerchantSideDrawer";
import { RequireLogin } from "../components/RequireLogin";
import { NailStyle } from "../types/api";
import { useAuthStore } from "../store/useAuthStore";
import { useIsDarkMode, useThemeColors } from "../utils/theme";
import { DEFAULT_MARKET_CITY, findMarketCity } from "../utils/marketCities";

export function BrowseScreen() {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<"local" | "following" | "discover">("discover");
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [merchantDrawerVisible, setMerchantDrawerVisible] = useState(false);
  const [consumerDrawerVisible, setConsumerDrawerVisible] = useState(false);
  const [localCity, setLocalCity] = useState(DEFAULT_MARKET_CITY);
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const hasToken = Boolean(token);
  const isMerchant = user?.role === "merchant";
  const authScope = !hydrated ? "booting" : hasToken ? "authed" : "anon";
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") return;
        const position = await Location.getCurrentPositionAsync({});
        const geocoded = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (cancelled) return;
        const matched = findMarketCity(geocoded[0]?.city ?? geocoded[0]?.subregion ?? geocoded[0]?.region ?? "");
        if (matched) setLocalCity(matched.name);
      } catch {
        // 定位失败时默认深圳，保证同城 feed 可演示。
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isMerchant && tab === "following") {
      setTab("discover");
    }
  }, [isMerchant, tab]);

  const topTabs = isMerchant
    ? ([
        { key: "discover", label: "发现" },
        { key: "local", label: "同城" },
      ] as const)
    : ([
        { key: "following", label: "关注" },
        { key: "discover", label: "发现" },
        { key: "local", label: "同城" },
      ] as const);

  const query = useQuery({
    queryKey: ["browse", tab, authScope, localCity],
    queryFn: () => (tab === "following" ? api.getFollowingStyles() : tab === "local" ? api.getLocalStyles(localCity) : api.getDiscover()),
    enabled: hydrated && (tab === "discover" || tab === "local" || hasToken),
  });

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

  const feedItems = tab === "following" && !hasToken ? [] : query.data?.items ?? [];
  const canRefresh = hydrated && (tab === "discover" || tab === "local" || hasToken);
  const handleRefresh = async () => {
    if (!canRefresh) return;
    setIsPullRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setIsPullRefreshing(false);
    }
  };

  const handleMerchantDrawerAction = (key: MerchantDrawerActionKey) => {
    if (key === "market-data") {
      navigation.navigate("MerchantMarketData", { entryEdge: "left" });
      return;
    }
    if (key === "booking-management") {
      navigation.navigate("MerchantBookings", { entryEdge: "left" });
      return;
    }
    if (key === "order-management") {
      navigation.navigate("MerchantOrders", { entryEdge: "left" });
      return;
    }
    if (key === "settings") {
      navigation.navigate("ProfileSettings", { entryEdge: "left" });
      return;
    }
  };

  const handleConsumerDrawerAction = (key: ConsumerDrawerActionKey) => {
    if (key === "orders") {
      navigation.navigate("ConsumerOrders", { entryEdge: "left" });
      return;
    }
    if (key === "browse-history") {
      navigation.navigate("BrowseHistory", { entryEdge: "left" });
      return;
    }
    if (key === "likes") {
      navigation.navigate("ConsumerLikes", { entryEdge: "left" });
      return;
    }
    if (key === "tryon-history") {
      navigation.navigate("TryOnHistory", { entryEdge: "left" });
      return;
    }
    if (key === "hand-photos") {
      navigation.navigate("HandPhotoManagement", { entryEdge: "left" });
      return;
    }
    if (key === "settings") {
      navigation.navigate("ProfileSettings", { entryEdge: "left" });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? "#17171b" : colors.background }]}>
      <View style={[styles.topBar, { backgroundColor: isDark ? "#17171b" : colors.background, borderBottomColor: colors.border }]}>
        <Pressable
          style={styles.iconButton}
          onPress={() => {
            if (isMerchant) {
              setMerchantDrawerVisible(true);
              return;
            }
            setConsumerDrawerVisible(true);
          }}
        >
          <Ionicons name="menu-outline" size={28} color={colors.text} />
        </Pressable>
        <View style={styles.topTabs}>
          {topTabs.map((item) => (
            <Pressable key={item.key} onPress={() => setTab(item.key)} style={styles.topTabButton}>
              <Text
                style={[
                  styles.topTabText,
                  { color: tab === item.key ? colors.text : colors.subtext },
                ]}
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
            <BrowseFeedCard
              item={item}
              onToggleLike={onToggleLike}
              showLike={!isMerchant}
              onPress={(selected) => navigation.navigate("StylePreview", { styleId: selected.id })}
            />
          )}
          ListEmptyComponent={
            tab === "following" ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>你的关注页还是空的</Text>
              <Text style={[styles.emptyText, { color: colors.subtext }]}>去任意美甲详情页关注作者后，这里会优先显示对方发布的新图片。</Text>
            </View>
          ) : tab === "local" ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>同城还没有商家作品</Text>
              <Text style={[styles.emptyText, { color: colors.subtext }]}>当前城市：{localCity}。商家发布后会优先出现在这里。</Text>
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

      {isMerchant ? (
        <MerchantSideDrawer
          visible={merchantDrawerVisible}
          onClose={() => setMerchantDrawerVisible(false)}
          onAction={handleMerchantDrawerAction}
        />
      ) : (
        <ConsumerSideDrawer
          visible={consumerDrawerVisible}
          onClose={() => setConsumerDrawerVisible(false)}
          onAction={handleConsumerDrawerAction}
        />
      )}
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
    gap: 20,
  },
  topTabButton: {
    alignItems: "center",
    gap: 6,
    minWidth: 56,
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
  row: {
    alignItems: "flex-start",
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
