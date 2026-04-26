import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { MessageThreadRow } from "../components/MessageThreadRow";
import { RequireLogin } from "../components/RequireLogin";
import { SlideOverlayScreen, useOverlayDirection } from "../components/SlideOverlayScreen";
import { MessageInboxThread } from "../types/api";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeColors } from "../utils/theme";

type MessagesInboxScreenProps = {
  asTab?: boolean;
};

export function MessagesInboxScreen({ asTab = false }: MessagesInboxScreenProps) {
  const navigation = useNavigation<any>();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const colors = useThemeColors();
  const direction = useOverlayDirection("left");
  const isMerchant = user?.role === "merchant";
  const inboxTitle = isMerchant ? "客户消息" : "商家消息";
  const emptyLabel = isMerchant ? "还没有客户咨询" : "还没有商家会话";

  const query = useQuery({
    queryKey: ["message-inbox"],
    queryFn: () => api.getMessageInbox(),
    enabled: Boolean(token),
  });

  const handleOpenThread = (item: MessageInboxThread) => {
    navigation.navigate("DirectMessage", { userId: item.target.id });
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
