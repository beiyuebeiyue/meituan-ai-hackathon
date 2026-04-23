import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { NailCard } from "../components/NailCard";
import { NailStyle } from "../types/api";
import { useAuthStore } from "../store/useAuthStore";
import { palette } from "../utils/theme";

export function BrowseScreen() {
  const [tab, setTab] = useState<"hot" | "latest">("hot");
  const queryClient = useQueryClient();
  const hasToken = Boolean(useAuthStore((state) => state.token));
  const query = useQuery({
    queryKey: ["browse", tab],
    queryFn: () => (tab === "hot" ? api.getHot() : api.getLatest()),
  });

  const favoriteMutation = useMutation({
    mutationFn: async (item: NailStyle) => {
      if (item.is_favorited) {
        await api.removeFavorite(item.id);
      } else {
        await api.addFavorite(item.id);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["browse"] });
      void queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  const onToggleFavorite = (item: NailStyle) => {
    if (!hasToken) return;
    favoriteMutation.mutate(item);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>NailTry AI</Text>
        <Text style={styles.subtitle}>热门灵感与真实图库</Text>
      </View>
      <View style={styles.segment}>
        {(["hot", "latest"] as const).map((item) => (
          <Text
            key={item}
            style={[styles.segmentItem, tab === item && styles.segmentItemActive]}
            onPress={() => setTab(item)}
          >
            {item === "hot" ? "热门" : "最新"}
          </Text>
        ))}
      </View>
      <FlatList
        data={query.data?.items ?? []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => <NailCard item={item} onToggleFavorite={onToggleFavorite} />}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: palette.text,
  },
  subtitle: {
    marginTop: 6,
    color: palette.subtext,
  },
  segment: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  segmentItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#ffe9dd",
    color: palette.accent,
    fontWeight: "700",
  },
  segmentItemActive: {
    backgroundColor: palette.accent,
    color: "white",
  },
  list: {
    padding: 12,
    paddingBottom: 120,
  },
});
