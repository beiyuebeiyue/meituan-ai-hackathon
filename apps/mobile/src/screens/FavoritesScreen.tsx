import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { FlatList, SafeAreaView, StyleSheet } from "react-native";
import { api } from "../api/client";
import { NailCard } from "../components/NailCard";
import { RequireLogin } from "../components/RequireLogin";
import { useAuthStore } from "../store/useAuthStore";
import { palette } from "../utils/theme";

export function FavoritesScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const query = useQuery({
    queryKey: ["favorites"],
    queryFn: api.getFavorites,
    enabled: Boolean(token),
  });

  const mutation = useMutation({
    mutationFn: (styleId: string) => api.removeFavorite(styleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["favorites"] });
      void queryClient.invalidateQueries({ queryKey: ["browse"] });
    },
  });

  if (!token) {
    return <RequireLogin onLogin={() => navigation.navigate("Login" as never)} message="登录后可查看收藏夹" />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={query.data?.items ?? []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => <NailCard item={item} onToggleFavorite={() => mutation.mutate(item.id)} />}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  list: { padding: 12, paddingBottom: 120 },
});
