import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMemo, useState } from "react";
import { FlatList, Image, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { UserSummary } from "../types/api";
import { useThemeColors } from "../utils/theme";

const defaultAvatar = require("../../assets/profile/default_avatar.png");
type FollowTab = "mutual" | "following" | "followers" | "recommend";

const tabs: Array<{ key: FollowTab; label: string }> = [
  { key: "mutual", label: "互相关注" },
  { key: "following", label: "关注" },
  { key: "followers", label: "粉丝" },
  { key: "recommend", label: "推荐" },
];

export function FollowListScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const { authorId, kind } = route.params as { authorId: string; kind: "following" | "followers" };
  const [activeTab, setActiveTab] = useState<FollowTab>(kind === "followers" ? "followers" : "following");

  const followingQuery = useQuery({
    queryKey: ["follow-list", authorId, "following"],
    queryFn: () => api.getUserFollowing(authorId),
  });

  const followersQuery = useQuery({
    queryKey: ["follow-list", authorId, "followers"],
    queryFn: () => api.getUserFollowers(authorId),
  });

  const followMutation = useMutation({
    mutationFn: (userId: string) => api.followUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-list", authorId] });
      queryClient.invalidateQueries({ queryKey: ["author-profile"] });
    },
  });

  const following = followingQuery.data?.items ?? [];
  const followers = followersQuery.data?.items ?? [];
  const mutual = useMemo(() => {
    const followingIds = new Set(following.map((item) => item.id));
    return followers.filter((item) => followingIds.has(item.id) || item.is_following);
  }, [followers, following]);

  const activeUsers = activeTab === "mutual" ? mutual : activeTab === "following" ? following : activeTab === "followers" ? followers : [];
  const activeIsLoading =
    activeTab === "mutual"
      ? followingQuery.isLoading || followersQuery.isLoading
      : activeTab === "following"
        ? followingQuery.isLoading
        : activeTab === "followers"
          ? followersQuery.isLoading
          : false;
  const activeIsError =
    activeTab === "mutual"
      ? followingQuery.isError || followersQuery.isError
      : activeTab === "following"
        ? followingQuery.isError
        : activeTab === "followers"
          ? followersQuery.isError
          : false;

  const sectionTitle =
    activeTab === "mutual"
      ? `互相关注（${mutual.length}）`
      : activeTab === "following"
        ? `我的关注（${following.length}）`
        : activeTab === "followers"
          ? `我的粉丝（${followers.length}）`
          : "推荐关注";

  const emptyText =
    activeTab === "mutual"
      ? "还没有互相关注的用户"
      : activeTab === "following"
        ? "还没有关注任何用户"
        : activeTab === "followers"
          ? "还没有粉丝"
          : "暂无推荐用户";

  const getSubtitle = (item: UserSummary) => {
    if (activeTab === "followers") {
      return item.is_following ? `已互相关注 · 焕甲号 ${item.uid}` : `粉丝 · 焕甲号 ${item.uid}`;
    }
    if (activeTab === "mutual") {
      return `互相关注 · 焕甲号 ${item.uid}`;
    }
    return item.is_following ? `已关注 · 焕甲号 ${item.uid}` : `焕甲号 ${item.uid}`;
  };

  const renderUser = ({ item }: { item: UserSummary }) => {
    const canFollow = !item.is_following;
    const actionText = activeTab === "followers" && canFollow ? "回关" : canFollow ? "关注" : "已关注";
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
      <Pressable
        disabled={!canFollow || followMutation.isPending}
        style={[
          styles.followBadge,
          {
            borderColor: canFollow ? colors.accent : colors.border,
            backgroundColor: canFollow ? "transparent" : colors.surfaceAlt,
            opacity: followMutation.isPending ? 0.7 : 1,
          },
        ]}
        onPress={(event) => {
          event.stopPropagation();
          if (canFollow) {
            followMutation.mutate(item.id);
          }
        }}
      >
        <Text style={[styles.followBadgeText, { color: canFollow ? colors.accent : colors.subtext }]}>
          {actionText}
        </Text>
      </Pressable>
    </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={30} color={colors.text} />
        </Pressable>
        <View style={styles.tabBar}>
          {tabs.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <Pressable key={tab.key} style={styles.tabButton} onPress={() => setActiveTab(tab.key)}>
                <View style={styles.tabLabelRow}>
                  <Text style={[styles.tabText, { color: selected ? colors.text : colors.subtext }]}>{tab.label}</Text>
                  {tab.key === "recommend" ? <Ionicons name="information-circle-outline" size={16} color={selected ? colors.text : colors.subtext} /> : null}
                </View>
                <View style={[styles.tabUnderline, { backgroundColor: selected ? colors.accent : "transparent" }]} />
              </Pressable>
            );
          })}
        </View>
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
  tabBar: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 48,
    gap: 24,
  },
  tabButton: {
    alignItems: "center",
    gap: 7,
    paddingTop: 12,
  },
  tabLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  tabText: {
    fontSize: 16,
    fontWeight: "800",
  },
  tabUnderline: {
    width: 28,
    height: 3,
    borderRadius: 999,
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
