import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Alert, FlatList, Image, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { RequireLogin } from "../components/RequireLogin";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeColors } from "../utils/theme";

export function MyPostsScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const colors = useThemeColors();
  const query = useQuery({
    queryKey: ["my-posts"],
    queryFn: api.getMyPosts,
    enabled: Boolean(token),
  });

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => api.deleteMyPost(postId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-posts"] });
    },
  });

  if (!token) {
    return <RequireLogin onLogin={() => navigation.navigate("Login")} message="登录后可查看和管理我的发布" />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={query.data?.items ?? []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>你还没有发布过美甲内容</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Image source={{ uri: resolveAssetUrl(item.image_url) }} style={styles.image} />
            <View style={styles.body}>
              <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.desc, { color: colors.subtext }]}>{item.description}</Text>
              <View style={styles.tags}>
                {item.tags.map((tag) => (
                  <View key={tag} style={[styles.tag, { backgroundColor: colors.accentSoft }]}>
                    <Text style={[styles.tagText, { color: colors.accent }]}>{tag}</Text>
                  </View>
                ))}
              </View>
              <Pressable
                style={[styles.deleteButton, { backgroundColor: colors.dangerSoft }]}
                onPress={() =>
                  Alert.alert("删除我的发布", "删除后将不再显示在我的发布列表中。", [
                    { text: "取消", style: "cancel" },
                    { text: "删除", style: "destructive", onPress: () => deleteMutation.mutate(item.id) },
                  ])
                }
              >
                <Text style={[styles.deleteLabel, { color: colors.dangerText }]}>删除</Text>
              </Pressable>
            </View>
          </View>
        )}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 18, gap: 16 },
  empty: {
    paddingTop: 80,
    textAlign: "center",
    fontSize: 15,
  },
  card: { borderRadius: 22, overflow: "hidden" },
  image: { width: "100%", aspectRatio: 1 },
  body: { padding: 14, gap: 6 },
  title: { fontSize: 18, fontWeight: "700" },
  desc: {},
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
  },
  deleteButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
  },
  deleteLabel: {
    fontWeight: "700",
  },
});
