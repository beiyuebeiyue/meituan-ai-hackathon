import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { OverlayContent } from "../components/OverlayContent";
import { RequireLogin } from "../components/RequireLogin";
import { useAuthStore } from "../store/useAuthStore";
import { NailStyle } from "../types/api";
import { useThemeColors } from "../utils/theme";

const defaultAvatar = require("../../assets/profile/default_avatar.png");
const HEART_ACTIVE_COLOR = "#ff7a8a";
const HEART_INACTIVE_COLOR = "#d0d0d5";

export function ConsumerLikesScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  const authScope = !hydrated ? "booting" : token ? "authed" : "anon";

  const likedQuery = useQuery({
    queryKey: ["consumer-liked-styles", authScope],
    queryFn: api.getLikedStyles,
    enabled: hydrated && Boolean(token),
  });

  const toggleLikeMutation = useMutation({
    mutationFn: ({ styleId, isLiked }: { styleId: string; isLiked: boolean }) =>
      isLiked ? api.unlikeStyle(styleId) : api.likeStyle(styleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["consumer-liked-styles"] });
      void queryClient.invalidateQueries({ queryKey: ["user-liked-styles"] });
      void queryClient.invalidateQueries({ queryKey: ["browse"] });
      void queryClient.invalidateQueries({ queryKey: ["browse-search"] });
      void queryClient.invalidateQueries({ queryKey: ["style"] });
      void queryClient.invalidateQueries({ queryKey: ["author-profile"] });
    },
  });

  if (!token) {
    return <RequireLogin onLogin={() => navigation.navigate("Login")} message="登录后可查看赞过的美甲" />;
  }

  const items = likedQuery.data?.items ?? [];

  const renderItem = ({ item }: { item: NailStyle }) => (
    <Pressable
      style={[styles.card, { backgroundColor: colors.surface }]}
      onPress={() => navigation.navigate("StylePreview", { styleId: item.id })}
    >
      <Image source={{ uri: resolveAssetUrl(item.image_url) }} style={[styles.image, { backgroundColor: colors.surfaceAlt }]} />
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.authorWrap}>
            <Image
              source={item.author_avatar_url ? { uri: resolveAssetUrl(item.author_avatar_url) } : defaultAvatar}
              style={[styles.avatar, { backgroundColor: colors.surfaceAlt }]}
            />
            <Text style={[styles.author, { color: colors.subtext }]} numberOfLines={1}>
              {item.author_name}
            </Text>
          </View>
          <Pressable
            style={styles.likeButton}
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation();
              toggleLikeMutation.mutate({ styleId: item.id, isLiked: item.is_liked });
            }}
          >
            <Ionicons
              name={item.is_liked ? "heart" : "heart-outline"}
              size={18}
              color={item.is_liked ? HEART_ACTIVE_COLOR : HEART_INACTIVE_COLOR}
            />
            <Text style={[styles.likeCount, { color: colors.subtext }]}>{item.like_count}</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceAlt }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={renderItem}
        columnWrapperStyle={styles.columnWrap}
        contentContainerStyle={styles.list}
        refreshing={likedQuery.isFetching}
        onRefresh={() => void likedQuery.refetch()}
        ListEmptyComponent={
          <OverlayContent.Empty
            icon="heart-outline"
            title={likedQuery.isLoading ? "正在加载喜爱" : "还没有赞过的美甲"}
            description={likedQuery.isLoading ? "请稍等，正在同步你的喜爱记录。" : "在浏览页或作品详情点亮红心后，会出现在这里。"}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: 10,
    paddingBottom: 120,
  },
  columnWrap: {
    gap: 8,
  },
  card: {
    flex: 1,
    margin: 4,
    borderRadius: 16,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    aspectRatio: 1,
  },
  body: {
    padding: 10,
    gap: 10,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    minHeight: 40,
    fontWeight: "800",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  authorWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  author: {
    flex: 1,
    fontSize: 12,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  likeCount: {
    fontSize: 12,
    fontWeight: "700",
  },
});
