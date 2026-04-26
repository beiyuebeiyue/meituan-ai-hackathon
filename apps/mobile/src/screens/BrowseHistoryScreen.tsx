import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Image, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, resolveAssetUrl } from "../api/client";
import { RequireLogin } from "../components/RequireLogin";
import { SlideOverlayScreen } from "../components/SlideOverlayScreen";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeColors } from "../utils/theme";

function formatViewedAt(value: string) {
  return value.replace("T", " ").slice(0, 16);
}

export function BrowseHistoryScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [manageMode, setManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const query = useQuery({
    queryKey: ["browse-history"],
    queryFn: api.getBrowseHistory,
    enabled: Boolean(token),
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (historyIds: string[]) => api.deleteBrowseHistoryBatch(historyIds),
    onSuccess: () => {
      setSelectedIds([]);
      setManageMode(false);
      void queryClient.invalidateQueries({ queryKey: ["browse-history"] });
    },
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const selectedCount = selectedIds.length;

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => items.some((item) => item.id === id)));
    if (items.length === 0) {
      setManageMode(false);
    }
  }, [items]);

  const contentPaddingBottom = useMemo(() => (manageMode ? 130 + insets.bottom : 120), [insets.bottom, manageMode]);

  const toggleSelect = (historyId: string) => {
    setSelectedIds((prev) => (prev.includes(historyId) ? prev.filter((id) => id !== historyId) : [...prev, historyId]));
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : items.map((item) => item.id));
  };

  const confirmDelete = () => {
    if (!selectedCount) return;
    const isDeleteAll = selectedCount === items.length;
    Alert.alert(
      isDeleteAll ? "删除全部浏览记录" : "删除浏览记录",
      isDeleteAll ? "确认删除全部浏览记录吗？" : `确认删除选中的 ${selectedCount} 条浏览记录吗？`,
      [
        { text: "取消", style: "cancel" },
        { text: "删除", style: "destructive", onPress: () => batchDeleteMutation.mutate(selectedIds) },
      ],
    );
  };

  return (
    <SlideOverlayScreen direction="right" backgroundColor={colors.background} onDismiss={() => navigation.goBack()}>
      {(dismiss) => (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.overlayHeader, { borderBottomColor: colors.border }]}>
            <Pressable style={styles.backButton} onPress={dismiss}>
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.text }]}>浏览记录</Text>
            {token && items.length > 0 ? (
              <Pressable
                style={styles.headerAction}
                onPress={() => {
                  setManageMode((prev) => !prev);
                  setSelectedIds([]);
                }}
              >
                <Text style={[styles.manageAction, { color: colors.text }]}>{manageMode ? "完成" : "管理"}</Text>
              </Pressable>
            ) : (
              <View style={styles.headerAction} />
            )}
          </View>
          {!token ? (
            <RequireLogin onLogin={() => navigation.navigate("Login")} message="登录后可查看浏览记录" />
          ) : (
            <>
              <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[styles.list, { paddingBottom: contentPaddingBottom }]}
                ListHeaderComponent={
                  items.length ? (
                    <Text style={[styles.tip, { color: colors.subtext }]}>仅保留最近 30 天浏览记录</Text>
                  ) : null
                }
                ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>你还没有浏览记录</Text>}
                renderItem={({ item }) => (
                  <Pressable
                    style={[
                      styles.card,
                      {
                        backgroundColor: colors.surface,
                        shadowColor: colors.overlay,
                        borderColor: selectedIds.includes(item.id) ? colors.accent : "transparent",
                      },
                    ]}
                    onPress={() => {
                      if (manageMode) {
                        toggleSelect(item.id);
                        return;
                      }
                      navigation.navigate("StylePreview", { styleId: item.style.id });
                    }}
                  >
                    {manageMode ? (
                      <View style={styles.selectionWrap}>
                        <View
                          style={[
                            styles.selectionCircle,
                            {
                              backgroundColor: selectedIds.includes(item.id) ? colors.accent : colors.surfaceAlt,
                              borderColor: selectedIds.includes(item.id) ? colors.accent : colors.border,
                            },
                          ]}
                        >
                          {selectedIds.includes(item.id) ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                        </View>
                      </View>
                    ) : null}
                    <Image source={{ uri: resolveAssetUrl(item.style.image_url) }} style={[styles.image, { backgroundColor: colors.accentSoft }]} />
                    <View style={styles.body}>
                      <Text style={[styles.title, { color: colors.text }]}>{item.style.title}</Text>
                      <Text style={[styles.meta, { color: colors.subtext }]}>浏览时间 {formatViewedAt(item.viewed_at)}</Text>
                      <Text style={[styles.desc, { color: colors.subtext }]} numberOfLines={2}>
                        {item.style.description}
                      </Text>
                    </View>
                  </Pressable>
                )}
              />
              {manageMode ? (
                <View
                  style={[
                    styles.manageBar,
                    {
                      backgroundColor: colors.surface,
                      borderTopColor: colors.border,
                      paddingBottom: Math.max(insets.bottom, 14),
                    },
                  ]}
                >
                  <Pressable
                    style={[styles.manageButton, { backgroundColor: allSelected ? colors.surfaceAlt : colors.accentSoft }]}
                    onPress={toggleSelectAll}
                  >
                    <Text style={[styles.manageButtonText, { color: allSelected ? colors.text : colors.accent }]}>
                      {allSelected ? "取消全选" : "全选"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.manageButton,
                      styles.manageConfirmButton,
                      {
                        backgroundColor: selectedCount ? colors.dangerText : colors.surfaceAlt,
                        opacity: selectedCount ? 1 : 0.55,
                      },
                    ]}
                    disabled={!selectedCount || batchDeleteMutation.isPending}
                    onPress={confirmDelete}
                  >
                    <Text style={[styles.manageConfirmText, { color: selectedCount ? "#fff" : colors.subtext }]}>
                      确认删除
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          )}
        </SafeAreaView>
      )}
    </SlideOverlayScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlayHeader: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "800",
  },
  headerAction: {
    width: 44,
    alignItems: "flex-end",
  },
  list: { padding: 18, gap: 14, paddingBottom: 120 },
  empty: {
    paddingTop: 80,
    textAlign: "center",
    fontSize: 15,
  },
  tip: {
    fontSize: 13,
    marginBottom: 2,
  },
  card: {
    flexDirection: "row",
    gap: 14,
    padding: 14,
    borderRadius: 22,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  selectionWrap: {
    alignSelf: "center",
    paddingRight: 4,
  },
  selectionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  image: {
    width: 104,
    height: 132,
    borderRadius: 18,
  },
  body: {
    flex: 1,
    gap: 8,
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  meta: {
    fontSize: 12,
  },
  desc: {
    lineHeight: 20,
  },
  manageAction: {
    fontSize: 15,
    fontWeight: "700",
  },
  manageBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 18,
    paddingHorizontal: 22,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  manageButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  manageButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  manageConfirmButton: {
    flex: 1.2,
  },
  manageConfirmText: {
    fontSize: 15,
    fontWeight: "800",
  },
});
