import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation, useRoute } from "@react-navigation/native";
import { FlatList, Image, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { useSlideOverlayDismiss } from "../components/SlideOverlayScreen";
import { useAuthStore } from "../store/useAuthStore";
import { UserSummary } from "../types/api";
import { useThemeColors } from "../utils/theme";

const defaultAvatar = require("../../assets/profile/default_avatar.png");
type FollowTab = "following" | "followers";

export function FollowListScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const dismissOverlay = useSlideOverlayDismiss();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const currentUser = useAuthStore((state) => state.user);
  const {
    authorId,
    kind,
    title,
  } = route.params as { authorId: string; kind: "following" | "followers"; title?: string };
  const displayTab: FollowTab = kind === "followers" ? "followers" : "following";

  const followingQuery = useQuery({
    queryKey: ["follow-list", authorId, "following"],
    queryFn: () => api.getUserFollowing(authorId),
    enabled: displayTab === "following",
  });

  const followersQuery = useQuery({
    queryKey: ["follow-list", authorId, "followers"],
    queryFn: () => api.getUserFollowers(authorId),
    enabled: displayTab === "followers",
  });

  const toggleFollowMutation = useMutation({
    mutationFn: (item: UserSummary) => (item.is_following ? api.unfollowUser(item.id) : api.followUser(item.id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-list", authorId] });
      queryClient.invalidateQueries({ queryKey: ["author-profile"] });
    },
  });

  const following = followingQuery.data?.items ?? [];
  const followers = followersQuery.data?.items ?? [];

  const activeUsers = displayTab === "following" ? following : followers;
  const activeIsLoading =
    displayTab === "following"
        ? followingQuery.isLoading
        : followersQuery.isLoading;
  const activeIsError =
    displayTab === "following"
        ? followingQuery.isError
        : followersQuery.isError;

  const sectionTitle =
    displayTab === "following"
      ? `关注（${following.length}）`
      : `粉丝（${followers.length}）`;

  const emptyText =
    displayTab === "following"
        ? "还没有关注任何商家"
        : "还没有粉丝";

  const getSubtitle = (item: UserSummary) => {
    if (displayTab === "followers") {
      return `粉丝 · IP：${item.city || "广东"}`;
    }
    return item.is_following ? `已关注 · IP：${item.city || "广东"}` : `IP：${item.city || "广东"}`;
  };

  const renderUser = ({ item }: { item: UserSummary }) => {
    const canToggleFollow = displayTab === "following" && item.id !== currentUser?.id;
    const actionText = item.is_following ? "取消关注" : "关注";
    return (
    <Pressable
      style={[styles.userRow, { backgroundColor: colors.background }]}
      onPress={() => navigation.navigate("AuthorProfile", { authorId: item.id })}
    >
      <Image source={item.avatar_url ? { uri: resolveAssetUrl(item.avatar_url) } : defaultAvatar} style={styles.avatar} />
      <View style={styles.userBody}>
        <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
          {item.username}
        </Text>
        <Text style={[styles.meta, { color: colors.subtext }]} numberOfLines={1}>
          {getSubtitle(item)}
        </Text>
        {item.bio ? (
          <Text style={[styles.bio, { color: colors.subtext }]} numberOfLines={1}>
            {item.bio}
          </Text>
        ) : null}
      </View>
      {canToggleFollow ? (
        <Pressable
          disabled={toggleFollowMutation.isPending}
          style={[
            styles.followBadge,
            {
              borderColor: colors.accent,
              backgroundColor: item.is_following ? colors.accentSoft : "transparent",
              opacity: toggleFollowMutation.isPending ? 0.7 : 1,
            },
          ]}
          onPress={(event) => {
            event.stopPropagation();
            toggleFollowMutation.mutate(item);
          }}
        >
          <Text style={[styles.followBadgeText, { color: colors.accent }]}>
            {actionText}
          </Text>
        </Pressable>
      ) : null}
    </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => dismissOverlay?.() ?? navigation.goBack()}>
          <Ionicons name="chevron-back" size={30} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {title ?? (displayTab === "followers" ? "粉丝" : "关注")}
        </Text>
      </View>

      {activeIsError ? (
        <View style={styles.stateWrap}>
          <Ionicons name="lock-closed-outline" size={30} color={colors.subtext} />
          <Text style={[styles.stateText, { color: colors.subtext }]}>该列表暂不可见</Text>
        </View>
      ) : (
        <FlatList
          data={activeUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          ListHeaderComponent={
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {sectionTitle}
            </Text>
          }
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.subtext }]}>
              {activeIsLoading ? "正在加载..." : emptyText}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    minHeight: 66,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
  },
  backButton: {
    position: "absolute",
    left: 18,
    top: 16,
    zIndex: 2,
  },
  headerTitle: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
  },
  list: {
    paddingTop: 24,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    paddingHorizontal: 22,
    marginBottom: 20,
  },
  userRow: {
    minHeight: 96,
    paddingHorizontal: 22,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },
  userBody: {
    flex: 1,
    gap: 4,
  },
  username: {
    fontSize: 18,
    fontWeight: "800",
  },
  meta: {
    fontSize: 14,
  },
  bio: {
    fontSize: 12,
  },
  followBadge: {
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderWidth: 1,
    minWidth: 72,
    alignItems: "center",
  },
  followBadgeText: {
    fontSize: 15,
    fontWeight: "800",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 98,
    opacity: 0.35,
  },
  stateWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  stateText: {
    fontSize: 15,
    fontWeight: "700",
  },
  empty: {
    textAlign: "center",
    marginTop: 80,
    fontWeight: "700",
  },
});
