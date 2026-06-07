import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, resolveAssetUrl } from "../api/client";
import { BrowseFeedCard } from "../components/BrowseFeedCard";
import {
  SlideOverlayScreen,
  useOverlayDirection,
} from "../components/SlideOverlayScreen";
import { useAuthStore } from "../store/useAuthStore";
import { useContentPreferenceStore } from "../store/useContentPreferenceStore";
import { useSearchHistoryStore } from "../store/useSearchHistoryStore";
import { NailStyle, UserSummary } from "../types/api";
import { useIsDarkMode, useThemeColors } from "../utils/theme";

const HISTORY_MAX_ROWS = 6;
const HISTORY_CHIP_GAP = 12;
const HISTORY_CONTAINER_HORIZONTAL_PADDING = 40;
const defaultAvatar = require("../../assets/profile/default_avatar.png");

function estimateChipWidth(label: string, availableWidth: number) {
  const textWidth = Array.from(label).reduce((sum, char) => {
    if (/[\u4e00-\u9fff]/.test(char)) return sum + 15;
    if (/\s/.test(char)) return sum + 6;
    return sum + 9;
  }, 0);

  return Math.min(Math.max(textWidth + 38, 76), availableWidth);
}

function clampHistoryToRows(
  items: string[],
  availableWidth: number,
  maxRows: number,
) {
  if (!items.length || availableWidth <= 0) return items;

  let rows = 1;
  let currentRowWidth = 0;
  const visibleItems: string[] = [];

  for (const item of items) {
    const chipWidth = estimateChipWidth(item, availableWidth);
    const nextWidth =
      currentRowWidth === 0
        ? chipWidth
        : currentRowWidth + HISTORY_CHIP_GAP + chipWidth;

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
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  const includeXhsPosts = useContentPreferenceStore(
    (state) => state.includeXhsPosts,
  );
  const contentPreferenceHydrated = useContentPreferenceStore(
    (state) => state.hydrated,
  );
  const hasToken = Boolean(token);
  const authScope = !hydrated ? "booting" : hasToken ? "authed" : "anon";
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const direction = useOverlayDirection("right");
  const inputRef = useRef<TextInput>(null);
  const [draftQuery, setDraftQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [resultMode, setResultMode] = useState<"posts" | "users">("posts");
  const appliedInitialQueryRef = useRef(false);
  const historyItems = useSearchHistoryStore((state) => state.items);
  const historyHydrated = useSearchHistoryStore((state) => state.hydrated);
  const loadHistory = useSearchHistoryStore((state) => state.load);
  const addHistoryItem = useSearchHistoryStore((state) => state.addItem);
  const removeHistoryItem = useSearchHistoryStore((state) => state.removeItem);
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

  useEffect(() => {
    const initialQuery =
      typeof route.params?.initialQuery === "string"
        ? route.params.initialQuery.trim()
        : "";
    if (appliedInitialQueryRef.current || !initialQuery) return;
    appliedInitialQueryRef.current = true;
    setDraftQuery(initialQuery);
    setSubmittedQuery(initialQuery);
    void addHistoryItem(initialQuery);
  }, [addHistoryItem, route.params?.initialQuery]);

  const stylesQuery = useQuery({
    queryKey: ["browse-search", submittedQuery, authScope, includeXhsPosts],
    queryFn: () => api.searchStyles(submittedQuery),
    enabled:
      hydrated &&
      contentPreferenceHydrated &&
      submittedQuery.length > 0 &&
      resultMode === "posts",
  });

  const usersQuery = useQuery({
    queryKey: ["user-search", submittedQuery, authScope],
    queryFn: () => api.searchUsers(submittedQuery),
    enabled: hydrated && submittedQuery.length > 0 && resultMode === "users",
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
    void clearHistory();
  };

  const postResults = stylesQuery.data?.items ?? [];
  const userResults = usersQuery.data?.items ?? [];
  const visibleHistoryItems = useMemo(() => {
    const availableWidth = Math.max(
      windowWidth - HISTORY_CONTAINER_HORIZONTAL_PADDING,
      0,
    );
    return clampHistoryToRows(historyItems, availableWidth, HISTORY_MAX_ROWS);
  }, [historyItems, windowWidth]);

  const renderUserItem = (item: UserSummary) => {
    const avatarSource = item.avatar_url
      ? { uri: resolveAssetUrl(item.avatar_url) }
      : defaultAvatar;

    return (
      <Pressable
        style={[styles.userRow, { borderBottomColor: colors.border }]}
        onPress={() =>
          navigation.navigate("AuthorProfile", { authorId: item.id })
        }
      >
        <Image
          source={avatarSource}
          style={[styles.userAvatar, { backgroundColor: colors.input }]}
        />
        <View style={styles.userContent}>
          <Text
            style={[styles.userName, { color: colors.text }]}
            numberOfLines={1}
          >
            {item.username}
          </Text>
          <Text
            style={[styles.userMeta, { color: colors.subtext }]}
            numberOfLines={1}
          >
            {item.is_shop ? "商家" : "用户"} · IP {item.ip_location || "未知"} ·
            焕甲号 {item.uid}
          </Text>
          {item.bio ? (
            <Text
              style={[styles.userBio, { color: colors.subtext }]}
              numberOfLines={1}
            >
              {item.bio}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
      </Pressable>
    );
  };

  return (
    <SlideOverlayScreen
      direction={direction}
      backgroundColor={isDark ? "#17171b" : colors.background}
      onDismiss={() => navigation.goBack()}
    >
      {(dismiss) => (
        <SafeAreaView
          style={[
            styles.container,
            { backgroundColor: isDark ? "#17171b" : colors.background },
          ]}
        >
          <KeyboardAvoidingView behavior="padding" style={styles.container}>
            <View style={styles.header}>
              <Pressable style={styles.backButton} onPress={dismiss}>
                <Ionicons name="chevron-back" size={28} color={colors.text} />
              </Pressable>
              <View
                style={[
                  styles.searchShell,
                  { backgroundColor: colors.input, borderColor: colors.border },
                ]}
              >
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
                <View
                  style={[
                    styles.searchDivider,
                    { backgroundColor: colors.border },
                  ]}
                />
                <Pressable
                  style={styles.searchAction}
                  onPress={() => void submitSearch()}
                >
                  <Ionicons
                    name="search-outline"
                    size={18}
                    color={colors.subtext}
                  />
                  <Text
                    style={[styles.searchActionText, { color: colors.text }]}
                  >
                    搜索
                  </Text>
                </Pressable>
              </View>
            </View>

            {submittedQuery.length > 0 ? (
              <View style={styles.resultsWrap}>
                <View
                  style={[
                    styles.modeTabs,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  {[
                    { key: "posts", label: "作品" },
                    { key: "users", label: "用户" },
                  ].map((tab) => {
                    const active = resultMode === tab.key;
                    return (
                      <Pressable
                        key={tab.key}
                        style={styles.modeTab}
                        onPress={() =>
                          setResultMode(tab.key as "posts" | "users")
                        }
                      >
                        <Text
                          style={[
                            styles.modeTabText,
                            { color: active ? colors.text : colors.subtext },
                          ]}
                        >
                          {tab.label}
                        </Text>
                        <View
                          style={[
                            styles.modeTabUnderline,
                            {
                              backgroundColor: active
                                ? colors.accent
                                : "transparent",
                            },
                          ]}
                        />
                      </Pressable>
                    );
                  })}
                </View>

                {resultMode === "posts" ? (
                  <FlatList
                    key="posts"
                    data={postResults}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    columnWrapperStyle={styles.row}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => (
                      <View style={styles.gridItem}>
                        <BrowseFeedCard
                          item={item}
                          onToggleLike={onToggleLike}
                          onPress={(selected) =>
                            navigation.navigate("StylePreview", {
                              styleId: selected.id,
                            })
                          }
                        />
                      </View>
                    )}
                    ListEmptyComponent={
                      <View style={styles.emptyState}>
                        <Text
                          style={[styles.emptyTitle, { color: colors.text }]}
                        >
                          没有找到相关作品
                        </Text>
                        <Text
                          style={[styles.emptyText, { color: colors.subtext }]}
                        >
                          试试换个关键词，或者用 #猫眼、#法式 这样的标签搜索。
                        </Text>
                      </View>
                    }
                  />
                ) : (
                  <FlatList
                    key="users"
                    data={userResults}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.userList}
                    renderItem={({ item }) => renderUserItem(item)}
                    ListEmptyComponent={
                      <View style={styles.emptyState}>
                        <Text
                          style={[styles.emptyTitle, { color: colors.text }]}
                        >
                          没有找到相关用户
                        </Text>
                        <Text
                          style={[styles.emptyText, { color: colors.subtext }]}
                        >
                          可以搜索昵称、简介、城市，或输入焕甲号。
                        </Text>
                      </View>
                    }
                  />
                )}
              </View>
            ) : (
              <View style={styles.historySection}>
                <View style={styles.historyHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    历史记录
                  </Text>
                  <Pressable
                    onPress={onClearHistory}
                    disabled={!historyItems.length}
                    style={{ opacity: historyItems.length ? 1 : 0.35 }}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={colors.subtext}
                    />
                  </Pressable>
                </View>
                {visibleHistoryItems.length ? (
                  <View style={styles.historyChips}>
                    {visibleHistoryItems.map((item) => (
                      <Pressable
                        key={item}
                        style={[
                          styles.historyChip,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                          },
                        ]}
                        onPress={() => void submitSearch(item)}
                      >
                        <Text
                          style={[
                            styles.historyChipText,
                            { color: colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {item}
                        </Text>
                        <Pressable
                          hitSlop={8}
                          style={styles.historyChipRemove}
                          onPress={(event) => {
                            event.stopPropagation();
                            void removeHistoryItem(item);
                          }}
                        >
                          <Ionicons name="close" size={15} color={colors.subtext} />
                        </Pressable>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text
                    style={[styles.emptyHistoryText, { color: colors.subtext }]}
                  >
                    还没有搜索记录
                  </Text>
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  historyChipText: {
    fontSize: 15,
    fontWeight: "600",
  },
  historyChipRemove: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyHistoryText: {
    fontSize: 14,
  },
  resultsWrap: {
    flex: 1,
  },
  modeTabs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 2,
  },
  modeTab: {
    alignItems: "center",
    gap: 7,
    paddingVertical: 8,
  },
  modeTabText: {
    fontSize: 18,
    fontWeight: "800",
  },
  modeTabUnderline: {
    width: 28,
    height: 3,
    borderRadius: 999,
  },
  row: {
    alignItems: "flex-start",
  },
  gridItem: {
    width: "50%",
  },
  list: {
    padding: 12,
    paddingBottom: 120,
  },
  userList: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
  },
  userRow: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  userContent: {
    flex: 1,
    gap: 5,
  },
  userName: {
    fontSize: 17,
    fontWeight: "800",
  },
  userMeta: {
    fontSize: 13,
    fontWeight: "600",
  },
  userBio: {
    fontSize: 13,
    lineHeight: 18,
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
