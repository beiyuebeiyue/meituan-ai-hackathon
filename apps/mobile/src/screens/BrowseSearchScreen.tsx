import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { api } from "../api/client";
import { BrowseFeedCard } from "../components/BrowseFeedCard";
import { SlideOverlayScreen } from "../components/SlideOverlayScreen";
import { useAuthStore } from "../store/useAuthStore";
import { useSearchHistoryStore } from "../store/useSearchHistoryStore";
import { NailStyle } from "../types/api";
import { useIsDarkMode, useThemeColors } from "../utils/theme";

const HISTORY_MAX_ROWS = 6;
const HISTORY_CHIP_GAP = 12;
const HISTORY_CONTAINER_HORIZONTAL_PADDING = 40;

function estimateChipWidth(label: string, availableWidth: number) {
  const textWidth = Array.from(label).reduce((sum, char) => {
    if (/[\u4e00-\u9fff]/.test(char)) return sum + 15;
    if (/\s/.test(char)) return sum + 6;
    return sum + 9;
  }, 0);

  return Math.min(Math.max(textWidth + 38, 76), availableWidth);
}

function clampHistoryToRows(items: string[], availableWidth: number, maxRows: number) {
  if (!items.length || availableWidth <= 0) return items;

  let rows = 1;
  let currentRowWidth = 0;
  const visibleItems: string[] = [];

  for (const item of items) {
    const chipWidth = estimateChipWidth(item, availableWidth);
    const nextWidth = currentRowWidth === 0 ? chipWidth : currentRowWidth + HISTORY_CHIP_GAP + chipWidth;

    if (nextWidth > availableWidth) {
      rows += 1;
      if (rows > maxRows) break;
      currentRowWidth = chipWidth;
    } else {
      currentRowWidth = nextWidth;
    }

    visibleItems.push(item);
  }

  return visibleItems;
}

export function BrowseSearchScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  const hasToken = Boolean(token);
  const authScope = !hydrated ? "booting" : hasToken ? "authed" : "anon";
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const inputRef = useRef<TextInput>(null);
  const [draftQuery, setDraftQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const historyItems = useSearchHistoryStore((state) => state.items);
  const historyHydrated = useSearchHistoryStore((state) => state.hydrated);
  const loadHistory = useSearchHistoryStore((state) => state.load);
  const addHistoryItem = useSearchHistoryStore((state) => state.addItem);
  const clearHistory = useSearchHistoryStore((state) => state.clear);
  const { width: windowWidth } = useWindowDimensions();

  useEffect(() => {
    if (!historyHydrated) {
      void loadHistory();
    }
  }, [historyHydrated, loadHistory]);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, []);

  const query = useQuery({
    queryKey: ["browse-search", submittedQuery, authScope],
    queryFn: () => api.searchStyles(submittedQuery),
    enabled: hydrated && submittedQuery.length > 0,
  });

  const likeMutation = useMutation({
    mutationFn: async (item: NailStyle) => {
      if (item.is_liked) {
        await api.unlikeStyle(item.id);
      } else {
        await api.likeStyle(item.id);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["browse-search"] });
      void queryClient.invalidateQueries({ queryKey: ["browse"] });
      void queryClient.invalidateQueries({ queryKey: ["likes"] });
      void queryClient.invalidateQueries({ queryKey: ["style"] });
    },
  });

  const onToggleLike = (item: NailStyle) => {
    if (!hasToken) return;
    likeMutation.mutate(item);
  };

  const submitSearch = async (value?: string) => {
    const nextQuery = (value ?? draftQuery).trim();
    if (!nextQuery) {
      setSubmittedQuery("");
      return;
    }
    setDraftQuery(nextQuery);
    setSubmittedQuery(nextQuery);
    await addHistoryItem(nextQuery);
  };

  const onClearHistory = () => {
    Alert.alert("清空搜索历史", "确认删除全部搜索历史吗？", [
      { text: "取消", style: "cancel" },
      { text: "清空", style: "destructive", onPress: () => void clearHistory() },
    ]);
  };

  const results = query.data?.items ?? [];
  const visibleHistoryItems = useMemo(() => {
    const availableWidth = Math.max(windowWidth - HISTORY_CONTAINER_HORIZONTAL_PADDING, 0);
    return clampHistoryToRows(historyItems, availableWidth, HISTORY_MAX_ROWS);
  }, [historyItems, windowWidth]);

  return (
    <SlideOverlayScreen
      direction="right"
      backgroundColor={isDark ? "#17171b" : colors.background}
      onDismiss={() => navigation.goBack()}
    >
      {(dismiss) => (
        <SafeAreaView style={[styles.container, { backgroundColor: isDark ? "#17171b" : colors.background }]}>
          <KeyboardAvoidingView behavior="padding" style={styles.container}>
            <View style={styles.header}>
              <Pressable style={styles.backButton} onPress={dismiss}>
                <Ionicons name="chevron-back" size={28} color={colors.text} />
              </Pressable>
              <View style={[styles.searchShell, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <TextInput
                  ref={inputRef}
                  style={[styles.searchInput, { color: colors.text }]}
                  value={draftQuery}
                  onChangeText={setDraftQuery}
                  placeholder="搜索你喜欢的美甲"
                  placeholderTextColor={colors.subtext}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  onSubmitEditing={() => void submitSearch()}
                />
                <View style={[styles.searchDivider, { backgroundColor: colors.border }]} />
                <Pressable style={styles.searchAction} onPress={() => void submitSearch()}>
                  <Ionicons name="search-outline" size={18} color={colors.subtext} />
                  <Text style={[styles.searchActionText, { color: colors.text }]}>搜索</Text>
                </Pressable>
              </View>
            </View>

            {submittedQuery.length > 0 ? (
              <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={styles.row}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                  <BrowseFeedCard
                    item={item}
                    onToggleLike={onToggleLike}
                    onPress={(selected) => navigation.navigate("StylePreview", { styleId: selected.id })}
                  />
                )}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>没有找到相关美甲</Text>
                    <Text style={[styles.emptyText, { color: colors.subtext }]}>试试换个关键词，或者用 #猫眼、#法式 这样的标签搜索。</Text>
                  </View>
                }
              />
            ) : (
              <View style={styles.historySection}>
                <View style={styles.historyHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>历史记录</Text>
                  <Pressable onPress={onClearHistory} disabled={!historyItems.length} style={{ opacity: historyItems.length ? 1 : 0.35 }}>
                    <Ionicons name="trash-outline" size={20} color={colors.subtext} />
                  </Pressable>
                </View>
                {visibleHistoryItems.length ? (
                  <View style={styles.historyChips}>
                    {visibleHistoryItems.map((item) => (
                      <Pressable
                        key={item}
                        style={[styles.historyChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={() => void submitSearch(item)}
                      >
                        <Text style={[styles.historyChipText, { color: colors.text }]} numberOfLines={1}>
                          {item}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.emptyHistoryText, { color: colors.subtext }]}>还没有搜索记录</Text>
                )}
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      )}
    </SlideOverlayScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  searchShell: {
    flex: 1,
    minHeight: 56,
    borderRadius: 24,
    borderWidth: 1,
    paddingLeft: 18,
    paddingRight: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
  searchDivider: {
    width: 1,
    height: 24,
    marginHorizontal: 10,
  },
  searchAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
  searchActionText: {
    fontSize: 16,
    fontWeight: "700",
  },
  historySection: {
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  historyChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  historyChip: {
    maxWidth: "100%",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  historyChipText: {
    fontSize: 15,
    fontWeight: "600",
  },
  emptyHistoryText: {
    fontSize: 14,
  },
  row: {
    alignItems: "flex-start",
  },
  list: {
    padding: 12,
    paddingBottom: 120,
  },
  emptyState: {
    marginTop: 80,
    paddingHorizontal: 28,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  emptyText: {
    lineHeight: 20,
    textAlign: "center",
  },
});
