import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { MessageThreadRow } from "../components/MessageThreadRow";
import { RequireLogin } from "../components/RequireLogin";
import { MessageInboxThread } from "../types/api";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeColors } from "../utils/theme";

export function StrangerMessagesScreen() {
  const navigation = useNavigation<any>();
  const token = useAuthStore((state) => state.token);
  const colors = useThemeColors();

  const query = useQuery({
    queryKey: ["stranger-messages"],
    queryFn: () => api.getStrangerMessages(),
    enabled: Boolean(token),
  });

  const handleOpenThread = (item: MessageInboxThread) => {
    navigation.navigate("DirectMessage", { userId: item.target.id });
  };

  if (!token) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <RequireLogin onLogin={() => navigation.navigate("Login")} message="登录后查看陌生人消息" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={query.data?.items ?? []}
        keyExtractor={(item) => item.target.id}
        renderItem={({ item }) => <MessageThreadRow item={item} colors={colors} onPress={handleOpenThread} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Pressable style={styles.headerAction} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </Pressable>
            <Text style={[styles.title, { color: colors.text }]}>陌生人消息</Text>
            <View style={styles.headerAction} />
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>没有未回复的陌生人消息</Text>
            <Text style={[styles.emptyText, { color: colors.subtext }]}>当你回复一次后，对话会迁入主消息列表。</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 80,
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    paddingBottom: 16,
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
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
});
