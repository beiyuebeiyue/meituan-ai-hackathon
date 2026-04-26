import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Alert, FlatList, Image, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { RequireLogin } from "../components/RequireLogin";
import { SlideOverlayScreen } from "../components/SlideOverlayScreen";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeColors } from "../utils/theme";

export function HandPhotoManagementScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const colors = useThemeColors();
  const query = useQuery({
    queryKey: ["saved-hand-photos"],
    queryFn: api.getSavedHandPhotos,
    enabled: Boolean(token),
  });

  const deleteMutation = useMutation({
    mutationFn: (handPhotoId: string) => api.deleteSavedHandPhoto(handPhotoId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["saved-hand-photos"] });
    },
  });

  return (
    <SlideOverlayScreen direction="right" backgroundColor={colors.background} onDismiss={() => navigation.goBack()}>
      {(dismiss) => (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.overlayHeader, { borderBottomColor: colors.border }]}>
            <Pressable style={styles.backButton} onPress={dismiss}>
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.text }]}>手图管理</Text>
            <View style={styles.headerAction} />
          </View>
          {!token ? (
            <RequireLogin onLogin={() => navigation.navigate("Login")} message="登录后可管理已上传手图" />
          ) : (
            <FlatList
              data={query.data?.items ?? []}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={styles.list}
              columnWrapperStyle={styles.row}
              ListEmptyComponent={<Text style={[styles.empty, { color: colors.subtext }]}>你还没有保存过手图</Text>}
              renderItem={({ item }) => (
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                  <Image source={{ uri: resolveAssetUrl(item.image_url) }} style={[styles.image, { backgroundColor: colors.accentSoft }]} />
                  <Text style={[styles.meta, { color: colors.subtext }]}>{item.created_at.replace("T", " ").slice(0, 16)}</Text>
                  <Pressable
                    style={[styles.deleteButton, { backgroundColor: colors.dangerSoft }]}
                    onPress={() =>
                      Alert.alert("删除手图", "删除后这张手图将不能继续复用。", [
                        { text: "取消", style: "cancel" },
                        { text: "删除", style: "destructive", onPress: () => deleteMutation.mutate(item.id) },
                      ])
                    }
                  >
                    <Text style={[styles.deleteLabel, { color: colors.dangerText }]}>删除</Text>
                  </Pressable>
                </View>
              )}
            />
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
  },
  list: { padding: 18, gap: 14, paddingBottom: 120 },
  row: {
    gap: 14,
  },
  empty: {
    width: "100%",
    paddingTop: 80,
    textAlign: "center",
    fontSize: 15,
  },
  card: {
    flex: 1,
    padding: 12,
    gap: 10,
    borderRadius: 22,
  },
  image: {
    width: "100%",
    aspectRatio: 0.88,
    borderRadius: 18,
  },
  meta: {
    fontSize: 12,
  },
  deleteButton: {
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 14,
  },
  deleteLabel: {
    fontWeight: "700",
  },
});
