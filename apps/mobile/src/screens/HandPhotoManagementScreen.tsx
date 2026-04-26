import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Alert, FlatList, Image, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { OverlayContent } from "../components/OverlayContent";
import { RequireLogin } from "../components/RequireLogin";
import { SlideOverlayScreen, useOverlayDirection } from "../components/SlideOverlayScreen";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeColors } from "../utils/theme";

export function HandPhotoManagementScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const colors = useThemeColors();
  const direction = useOverlayDirection("right");
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
    <SlideOverlayScreen direction={direction} backgroundColor={colors.background} onDismiss={() => navigation.goBack()}>
      {(dismiss) => (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
          <OverlayContent.Header title="手图管理" onBack={dismiss} />
          {!token ? (
            <RequireLogin onLogin={() => navigation.navigate("Login")} message="登录后可管理已上传手图" />
          ) : (
            <FlatList
              style={{ backgroundColor: colors.surfaceAlt }}
              data={query.data?.items ?? []}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={styles.list}
              columnWrapperStyle={styles.row}
              ListEmptyComponent={
                <OverlayContent.Empty
                  icon="hand-left-outline"
                  title={query.isLoading ? "正在加载手图" : "还没有保存过手图"}
                  description={query.isLoading ? "请稍等，正在同步你的手图记录。" : "在问问小嘉或作品详情上传手图后，会出现在这里。"}
                />
              }
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
  list: { padding: 10, gap: 8, paddingBottom: 120 },
  row: {
    gap: 8,
  },
  card: {
    flex: 1,
    margin: 4,
    padding: 12,
    gap: 10,
    borderRadius: 16,
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
