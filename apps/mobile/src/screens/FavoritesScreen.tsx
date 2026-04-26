import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { FlatList, SafeAreaView, StyleSheet, View } from "react-native";
import { api } from "../api/client";
import { NailCard } from "../components/NailCard";
import { RequireLogin } from "../components/RequireLogin";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeColors } from "../utils/theme";

export function FavoritesScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const colors = useThemeColors();
  const query = useQuery({
    queryKey: ["likes"],
    queryFn: api.getLikedStyles,
    enabled: Boolean(token),
  });

  const mutation = useMutation({
    mutationFn: (styleId: string) => api.unlikeStyle(styleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["likes"] });
      void queryClient.invalidateQueries({ queryKey: ["browse"] });
      void queryClient.invalidateQueries({ queryKey: ["style"] });
    },
  });

  if (!token) {
    return <RequireLogin onLogin={() => navigation.navigate("Login" as never)} message="登录后可查看你点赞过的美甲" />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={query.data?.items ?? []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <View style={styles.column}>
            <NailCard
              item={item}
              onToggleLike={() => mutation.mutate(item.id)}
              onPress={(selected) => navigation.navigate("StylePreview", { styleId: selected.id })}
            />
          </View>
        )}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 12, paddingBottom: 120 },
  row: {
    alignItems: "flex-start",
  },
  column: {
    width: "50%",
  },
});
