import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { BrowseFeedCard } from "../components/BrowseFeedCard";
import { RequireLogin } from "../components/RequireLogin";
import { NailStyle } from "../types/api";
import { useAuthStore } from "../store/useAuthStore";
import { useIsDarkMode, useThemeColors } from "../utils/theme";

export function BrowseScreen() {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<"following" | "discover">("discover");
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  const hasToken = Boolean(token);
  const authScope = !hydrated ? "booting" : hasToken ? "authed" : "anon";
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const inboxQuery = useQuery({
    queryKey: ["message-inbox"],
    queryFn: () => api.getMessageInbox(),
    enabled: hydrated && hasToken,
  });
  const query = useQuery({
    queryKey: ["browse", tab, authScope],
    queryFn: () => (tab === "following" ? api.getFollowingStyles() : api.getDiscover()),
    enabled: hydrated && (tab === "discover" || hasToken),
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
    if (!hasToken) return;
    likeMutation.mutate(item);
  };

  const feedItems = tab === "following" && !hasToken ? [] : query.data?.items ?? [];
  const canRefresh = hydrated && (tab === "discover" || hasToken);
  const messageBadge =
    inboxQuery.data?.badge.has_stranger_unread
      ? "dot"
      : inboxQuery.data?.badge.main_unread_count
        ? inboxQuery.data.badge.main_unread_count > 99
          ? "99+"
          : String(inboxQuery.data.badge.main_unread_count)
        : null;
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
        <Pressable style={styles.iconButton} onPress={() => (hasToken ? navigation.navigate("MessagesInbox") : navigation.navigate("Login"))}>
          <Ionicons name="chatbubble-ellipses-outline" size={26} color={colors.text} />
          {messageBadge === "dot" ? <View style={[styles.dotBadge, { backgroundColor: colors.accent }]} /> : null}
          {messageBadge && messageBadge !== "dot" ? (
            <View style={[styles.countBadge, { backgroundColor: colors.accent }]}>
              <Text style={styles.countBadgeText}>{messageBadge}</Text>
            </View>
          ) : null}
        </Pressable>
        <View style={styles.topTabs}>
          {([
            { key: "following", label: "关注" },
            { key: "discover", label: "发现" },
          ] as const).map((item) => (
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
              onPress={(selected) => navigation.navigate("StylePreview", { styleId: selected.id })}
            />
          )}
          ListEmptyComponent={
            tab === "following" ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>你的关注页还是空的</Text>
              <Text style={[styles.emptyText, { color: colors.subtext }]}>去任意美甲详情页关注作者后，这里会优先显示对方发布的新图片。</Text>
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
