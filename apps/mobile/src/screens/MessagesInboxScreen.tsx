import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Alert, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { MessageThreadRow } from "../components/MessageThreadRow";
import { RequireLogin } from "../components/RequireLogin";
import { SlideOverlayScreen } from "../components/SlideOverlayScreen";
import { MessageInboxThread } from "../types/api";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeColors } from "../utils/theme";

const shortcutCards = [
  { key: "likes", icon: "heart", label: "赞和收藏", tint: "#ff6d8f" },
  { key: "follows", icon: "person", label: "新增关注", tint: "#5b8cff" },
  { key: "comments", icon: "chatbubble", label: "评论和@", tint: "#48c782" },
] as const;

export function MessagesInboxScreen() {
  const navigation = useNavigation<any>();
  const token = useAuthStore((state) => state.token);
  const colors = useThemeColors();

  const query = useQuery({
    queryKey: ["message-inbox"],
    queryFn: () => api.getMessageInbox(),
    enabled: Boolean(token),
  });

  const handlePlaceholder = (title: string) => {
    Alert.alert(title, "这个入口后续再接真实消息数据。");
  };

  const handleOpenThread = (item: MessageInboxThread) => {
    navigation.navigate("DirectMessage", { userId: item.target.id });
  };

  return (
    <SlideOverlayScreen backgroundColor={colors.background} direction="left" onDismiss={() => navigation.goBack()}>
      {(dismiss) =>
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
                    <Pressable style={styles.headerAction} onPress={dismiss}>
                      <Ionicons name="chevron-back" size={28} color={colors.text} />
                    </Pressable>
                    <Text style={[styles.title, { color: colors.text }]}>消息</Text>
                    <View style={styles.headerRight}>
                      <Pressable style={styles.headerAction} onPress={() => handlePlaceholder("搜索")}>
                        <Ionicons name="search-outline" size={24} color={colors.text} />
                      </Pressable>
                      <Pressable style={styles.headerAction} onPress={() => handlePlaceholder("新建")}>
                        <Ionicons name="add-outline" size={26} color={colors.text} />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.shortcutRow}>
                    {shortcutCards.map((item) => (
                      <Pressable
                        key={item.key}
                        style={[styles.shortcutCard, { backgroundColor: colors.surface }]}
                        onPress={() => handlePlaceholder(item.label)}
                      >
                        <View style={[styles.shortcutIcon, { backgroundColor: `${item.tint}22` }]}>
                          <Ionicons name={item.icon} size={26} color={item.tint} />
                        </View>
                        <Text style={[styles.shortcutLabel, { color: colors.text }]}>{item.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Pressable
                    style={[styles.strangerRow, { backgroundColor: colors.surface }]}
                    onPress={() => navigation.navigate("StrangerMessages")}
                  >
                    <View style={[styles.strangerIconWrap, { backgroundColor: colors.surfaceAlt }]}>
                      <Ionicons name="mail-unread-outline" size={22} color={colors.accent} />
                    </View>
                    <View style={styles.strangerBody}>
                      <Text style={[styles.strangerTitle, { color: colors.text }]}>陌生人消息</Text>
                      <Text style={[styles.strangerSubtitle, { color: colors.subtext }]} numberOfLines={1}>
                        {query.data?.stranger_bucket
                          ? `${query.data.stranger_bucket.thread_count} 个会话 · ${query.data.stranger_bucket.latest_message_preview ?? "查看未回复的陌生人消息"}`
                          : "还没有陌生人消息"}
                      </Text>
                    </View>
                    {query.data?.stranger_bucket?.unread_count ? (
                      <View style={[styles.countBadge, { backgroundColor: colors.accent }]}>
                        <Text style={styles.countBadgeText}>
                          {query.data.stranger_bucket.unread_count > 99 ? "99+" : query.data.stranger_bucket.unread_count}
                        </Text>
                      </View>
                    ) : null}
                    <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
                  </Pressable>

                  <Text style={[styles.sectionTitle, { color: colors.text }]}>会话</Text>
                </View>
              }
              ListEmptyComponent={
                query.isLoading ? (
                  <View style={styles.emptyWrap}>
                    <Text style={[styles.emptyText, { color: colors.subtext }]}>正在加载消息...</Text>
                  </View>
                ) : (
                  <View style={styles.emptyWrap}>
                    <Text style={[styles.emptyText, { color: colors.subtext }]}>还没有进入主列表的聊天会话</Text>
                  </View>
                )
              }
            />
          </SafeAreaView>
        )
      }
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
    gap: 18,
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  shortcutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  shortcutCard: {
    flex: 1,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: "center",
    gap: 10,
  },
  shortcutIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  strangerRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  strangerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  strangerBody: {
    flex: 1,
    gap: 4,
  },
  strangerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  strangerSubtitle: {
    fontSize: 14,
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },
  emptyWrap: {
    paddingTop: 56,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
  },
});
