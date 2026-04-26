import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Alert, FlatList, Image, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { UserSummary } from "../types/api";
import { useThemeColors } from "../utils/theme";

const defaultAvatar = require("../../assets/profile/default_avatar.png");

export function BlockedUsersScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["blocked-users"],
    queryFn: api.getBlockedUsers,
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => api.unblockUser(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["blocked-users"] });
      void queryClient.invalidateQueries({ queryKey: ["author-profile"] });
      void queryClient.invalidateQueries({ queryKey: ["conversation"] });
    },
  });

  const renderUser = ({ item }: { item: UserSummary }) => (
    <Pressable
      style={[styles.userRow, { backgroundColor: colors.surface }]}
      onPress={() => navigation.navigate("AuthorProfile", { authorId: item.id })}
    >
      <Image source={item.avatar_url ? { uri: resolveAssetUrl(item.avatar_url) } : defaultAvatar} style={styles.avatar} />
      <View style={styles.userBody}>
        <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
          {item.username}
        </Text>
        <Text style={[styles.meta, { color: colors.subtext }]} numberOfLines={1}>
          焕甲号：{item.uid} · IP：{item.city}
        </Text>
      </View>
      <Pressable
        style={[styles.unblockButton, { backgroundColor: colors.accentSoft }]}
        onPress={(event) => {
          event.stopPropagation();
          Alert.alert("解除拉黑", `确认将 ${item.username} 移出黑名单吗？`, [
            { text: "取消", style: "cancel" },
            { text: "解除", onPress: () => unblockMutation.mutate(item.id) },
          ]);
        }}
      >
        <Text style={[styles.unblockText, { color: colors.accent }]}>解除</Text>
      </Pressable>
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surfaceAlt }]}>
      <FlatList
        data={query.data?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="shield-checkmark-outline" size={34} color={colors.subtext} />
            <Text style={[styles.empty, { color: colors.subtext }]}>{query.isLoading ? "正在加载..." : "当前没有拉黑用户"}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: {
    padding: 16,
    gap: 10,
  },
  userRow: {
    minHeight: 82,
    borderRadius: 20,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  userBody: {
    flex: 1,
    gap: 5,
  },
  username: {
    fontSize: 16,
    fontWeight: "800",
  },
  meta: {
    fontSize: 12,
  },
  unblockButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  unblockText: {
    fontWeight: "800",
    fontSize: 12,
  },
  emptyWrap: {
    marginTop: 120,
    alignItems: "center",
    gap: 10,
  },
  empty: {
    fontWeight: "700",
  },
});
