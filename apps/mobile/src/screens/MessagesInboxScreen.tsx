import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Alert, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { MessageThreadRow } from "../components/MessageThreadRow";
import { RequireLogin } from "../components/RequireLogin";
import { SlideOverlayScreen, useOverlayDirection } from "../components/SlideOverlayScreen";
import { MessageInboxResponse, MessageInboxThread } from "../types/api";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeColors } from "../utils/theme";

type MessagesInboxScreenProps = {
  asTab?: boolean;
};

function markInboxReadLocally(payload: MessageInboxResponse | undefined): MessageInboxResponse | undefined {
  if (!payload) return payload;
  return {
    ...payload,
    stranger_bucket: payload.stranger_bucket
      ? {
          ...payload.stranger_bucket,
          unread_count: 0,
        }
      : payload.stranger_bucket,
    items: payload.items.map((item) => ({
      ...item,
      unread_count: 0,
    })),
    badge: {
      ...payload.badge,
      has_stranger_unread: false,
      main_unread_count: 0,
    },
  };
}

export function MessagesInboxScreen({ asTab = false }: MessagesInboxScreenProps) {
  const navigation = useNavigation<any>();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const colors = useThemeColors();
  const direction = useOverlayDirection("left");
  const inboxTitle = "消息";
  const emptyLabel = "还没有会话";
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["message-inbox"],
    queryFn: () => api.getMessageInbox(),
    enabled: Boolean(token),
  });
  const trendNotificationsQuery = useQuery({
    queryKey: ["merchant-trend-notifications"],
    queryFn: () => api.getMerchantTrendNotifications(),
    enabled: Boolean(token && user?.role === "merchant"),
  });

  const unreadCount = (query.data?.badge.main_unread_count ?? 0) + (query.data?.stranger_bucket?.unread_count ?? 0);
  const readAllMutation = useMutation({
    mutationFn: () => api.markAllMessagesRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["message-inbox"] });
      const previousInbox = queryClient.getQueriesData<MessageInboxResponse>({ queryKey: ["message-inbox"] });
      queryClient.setQueriesData<MessageInboxResponse>({ queryKey: ["message-inbox"] }, markInboxReadLocally);
      return { previousInbox };
    },
    onError: (_error, _variables, context) => {
      context?.previousInbox.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSuccess: () => {
      queryClient.setQueriesData<MessageInboxResponse>({ queryKey: ["message-inbox"] }, markInboxReadLocally);
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["message-inbox"] }),
        queryClient.invalidateQueries({ queryKey: ["conversation"] }),
      ]);
    },
  });

  const handleOpenThread = (item: MessageInboxThread) => {
    navigation.navigate("DirectMessage", { userId: item.target.id });
  };

  const socialCards = [
    { key: "likes", title: "点赞", icon: "heart", color: "#ff7a8a" },
    { key: "follows", title: "新增关注", icon: "person", color: "#4f8bff" },
    { key: "comments", title: "评论和@", icon: "chatbubble-ellipses", color: "#36c98f" },
  ] as const;

  const handleReadAll = () => {
    if (!unreadCount || readAllMutation.isPending) return;
    readAllMutation.mutate();
  };

  const renderContent = (dismiss?: () => void) =>
    !token ? (
          <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <RequireLogin onLogin={() => navigation.navigate("Login")} message="登录后查看你的消息中心" />
          </SafeAreaView>
        ) : (
          <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <FlatList
              data={query.data?.items ?? []}
              keyExtractor={(item) => item.target.id}
              renderItem={({ item }) => <MessageThreadRow item={item} colors={colors} onPress={handleOpenThread} />}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={
                <View style={styles.headerWrap}>
                  <View style={styles.headerRow}>
                    {asTab ? (
                      <View style={styles.headerAction} />
                    ) : (
                      <Pressable style={styles.headerAction} onPress={dismiss}>
                        <Ionicons name="chevron-back" size={28} color={colors.text} />
                      </Pressable>
                    )}
                    <Text style={[styles.title, { color: colors.text }]}>{inboxTitle}</Text>
                    <View style={styles.headerAction} />
                  </View>

                  <View style={styles.socialCards}>
                    {socialCards.map((item) => (
                      <Pressable
                        key={item.key}
                        style={[styles.socialCard, { backgroundColor: colors.surface }]}
                        onPress={() => Alert.alert(item.title, "通知详情后续接入。")}
                      >
                        <View style={[styles.socialIconWrap, { backgroundColor: `${item.color}22` }]}>
                          <Ionicons name={item.icon} size={24} color={item.color} />
                        </View>
                        <Text style={[styles.socialTitle, { color: colors.text }]}>{item.title}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {user?.role === "merchant" ? (
                    <Pressable
                      style={[styles.trendNoticeRow, { backgroundColor: colors.surface }]}
                      onPress={() => navigation.navigate("MerchantTrendNotifications", { entryEdge: "right" })}
                    >
                      <View style={[styles.trendNoticeIcon, { backgroundColor: colors.accentSoft }]}>
                        <Ionicons name="flame-outline" size={22} color={colors.accent} />
                      </View>
                      <View style={styles.strangerText}>
                        <Text style={[styles.strangerTitle, { color: colors.text }]}>运营热门手工甲推送</Text>
                        <Text style={[styles.strangerPreview, { color: colors.subtext }]} numberOfLines={1}>
                          {(trendNotificationsQuery.data?.items.length ?? 0) > 0
                            ? `${trendNotificationsQuery.data?.items.length ?? 0} 条推送，可登记你能做的款式`
                            : "暂无新的趋势推送"}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
                    </Pressable>
                  ) : null}

                  {query.data?.stranger_bucket ? (
                    <Pressable
                      style={[styles.strangerRow, { backgroundColor: colors.surface }]}
                      onPress={() => navigation.navigate("StrangerMessages")}
                    >
                      <View style={styles.strangerText}>
                        <Text style={[styles.strangerTitle, { color: colors.text }]}>陌生人消息</Text>
                        <Text style={[styles.strangerPreview, { color: colors.subtext }]} numberOfLines={1}>
                          {query.data.stranger_bucket.latest_message_preview || `${query.data.stranger_bucket.thread_count} 个陌生人会话`}
                        </Text>
                      </View>
                      {query.data.stranger_bucket.unread_count ? (
                        <View style={[styles.strangerBadge, { backgroundColor: colors.accent }]}>
                          <Text style={styles.strangerBadgeText}>
                            {query.data.stranger_bucket.unread_count > 99 ? "99+" : query.data.stranger_bucket.unread_count}
                          </Text>
                        </View>
                      ) : null}
                      <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
                    </Pressable>
                  ) : null}

                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>会话</Text>
                    <Pressable
                      disabled={!unreadCount || readAllMutation.isPending}
                      hitSlop={10}
                      onPress={handleReadAll}
                      style={({ pressed }) => [
                        styles.readAllButton,
                        {
                          opacity: !unreadCount ? 0.45 : pressed ? 0.72 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.readAllText, { color: unreadCount ? colors.accent : colors.subtext }]}>
                        {readAllMutation.isPending ? "处理中" : "一键已读"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              }
              ListEmptyComponent={
                query.isLoading ? (
                  <View style={styles.emptyWrap}>
                    <Text style={[styles.emptyText, { color: colors.subtext }]}>正在加载消息...</Text>
                  </View>
                ) : (
                  <View style={styles.emptyWrap}>
                    <Text style={[styles.emptyText, { color: colors.subtext }]}>{emptyLabel}</Text>
                  </View>
                )
              }
            />
          </SafeAreaView>
        );

  if (asTab) {
    return renderContent();
  }

  return (
    <SlideOverlayScreen backgroundColor={colors.background} direction={direction} onDismiss={() => navigation.goBack()}>
      {(dismiss) => renderContent(dismiss)}
    </SlideOverlayScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 110,
  },
  headerWrap: {
    paddingTop: 10,
    paddingBottom: 14,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerAction: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  sectionHeaderRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  socialCards: {
    flexDirection: "row",
    gap: 12,
  },
  socialCard: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 18,
    alignItems: "center",
    gap: 10,
  },
  socialIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  socialTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  strangerRow: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  trendNoticeRow: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  trendNoticeIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  strangerText: {
    flex: 1,
    gap: 4,
  },
  strangerTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  strangerPreview: {
    fontSize: 13,
  },
  strangerBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  strangerBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  readAllButton: {
    minHeight: 32,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  readAllText: {
    fontSize: 14,
    fontWeight: "700",
  },
  emptyWrap: {
    paddingTop: 56,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
  },
});
