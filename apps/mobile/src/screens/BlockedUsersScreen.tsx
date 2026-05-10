import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Alert, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { DrawerModuleCard, DrawerModuleThumbnail, drawerModuleListStyles } from "../components/DrawerModuleLayout";
import { OverlayContent } from "../components/OverlayContent";
import { UserSummary } from "../types/api";
import { useThemeColors } from "../utils/theme";

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
    <DrawerModuleCard
      onPress={() => navigation.navigate("AuthorProfile", { authorId: item.id })}
    >
      <DrawerModuleThumbnail uri={item.avatar_url ? resolveAssetUrl(item.avatar_url) : null} icon="person-outline" size="small" round />
      <View style={styles.userBody}>
        <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
          {item.username}
        </Text>
        <Text style={[styles.meta, { color: colors.subtext }]} numberOfLines={1}>
          焕甲号：{item.uid} · IP：{item.ip_location || "未知"}
        </Text>
      </View>
      <Pressable
        style={[styles.unblockButton, { backgroundColor: colors.accentSoft }]}
        onPress={(event) => {
          event.stopPropagation();
          Alert.alert("恢复查看", `确认重新查看 ${item.username} 的内容吗？`, [
            { text: "取消", style: "cancel" },
            { text: "恢复", onPress: () => unblockMutation.mutate(item.id) },
          ]);
        }}
      >
        <Text style={[styles.unblockText, { color: colors.accent }]}>恢复</Text>
      </Pressable>
    </DrawerModuleCard>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surfaceAlt }]}>
      <FlatList
        data={query.data?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        contentContainerStyle={drawerModuleListStyles.list}
        ListEmptyComponent={
          <OverlayContent.Empty
            icon="shield-checkmark-outline"
            title={query.isLoading ? "正在加载" : "当前没有不再看的用户"}
            description="被你设置为不再看的用户会出现在这里。"
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
});
