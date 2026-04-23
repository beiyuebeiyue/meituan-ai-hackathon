import { useQuery } from "@tanstack/react-query";
import { FlatList, Image, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { palette } from "../utils/theme";

export function MyPostsScreen() {
  const query = useQuery({
    queryKey: ["my-posts"],
    queryFn: api.getMyPosts,
  });

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={query.data?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={{ uri: resolveAssetUrl(item.image_url) }} style={styles.image} />
            <View style={styles.body}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.desc}>{item.description}</Text>
            </View>
          </View>
        )}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  list: { padding: 18, gap: 16 },
  card: { borderRadius: 22, overflow: "hidden", backgroundColor: palette.surface },
  image: { width: "100%", aspectRatio: 1 },
  body: { padding: 14, gap: 6 },
  title: { fontSize: 18, fontWeight: "700", color: palette.text },
  desc: { color: palette.subtext },
});
