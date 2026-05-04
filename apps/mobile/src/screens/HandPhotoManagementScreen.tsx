import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Alert, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import {
  DrawerModuleCard,
  DrawerModuleInfoBanner,
  DrawerModulePill,
  DrawerModuleThumbnail,
  drawerModuleListStyles,
} from "../components/DrawerModuleLayout";
import { OverlayContent } from "../components/OverlayContent";
import { RequireLogin } from "../components/RequireLogin";
import { SlideOverlayScreen, useOverlayDirection } from "../components/SlideOverlayScreen";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeColors } from "../utils/theme";

export function HandPhotoManagementScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const colors = useThemeColors();
  const direction = useOverlayDirection("right");
  const query = useQuery({
    queryKey: ["saved-hand-photos", user?.id ?? "anonymous"],
    queryFn: api.getSavedHandPhotos,
    enabled: Boolean(token && user),
  });

  const deleteMutation = useMutation({
    mutationFn: (handPhotoId: string) => api.deleteSavedHandPhoto(handPhotoId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["saved-hand-photos"] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (imageUri: string) => api.uploadSavedHandPhoto(imageUri),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["saved-hand-photos"] });
    },
    onError: () => {
      Alert.alert("保存失败", "手图暂时没有保存成功，请稍后再试。");
    },
  });

  const uploadFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (!result.canceled) {
      uploadMutation.mutate(result.assets[0].uri);
    }
  };

  const takePhotoNow = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.85,
      });
      if (!result.canceled) {
        uploadMutation.mutate(result.assets[0].uri);
      }
    } catch {
      Alert.alert("暂时无法打开相机", "你也可以先从相册里选一张之前拍好的手图。");
    }
  };

  const openUploadOptions = () => {
    Alert.alert("添加手图", "选择一张清晰的手部照片，只会保存到你的本地手图管理中。", [
      { text: "取消", style: "cancel" },
      { text: "拍照", onPress: takePhotoNow },
      { text: "从相册选择", onPress: uploadFromLibrary },
    ]);
  };

  const formatCreatedAt = (value: string) => {
    const normalized = value.replace("T", " ");
    return normalized.length >= 16 ? normalized.slice(0, 16) : normalized;
  };

  const statusLabel = (status: "pending" | "processing" | "succeeded" | "failed" | null | undefined) => {
    if (status === "processing") return "分析中";
    if (status === "succeeded") return "已保存";
    if (status === "failed") return "分析失败";
    if (status === "pending") return "等待分析";
    return "已保存";
  };

  const statusTone = (status: "pending" | "processing" | "succeeded" | "failed" | null | undefined) => {
    if (status === "failed") return "danger";
    if (status === "succeeded") return "success";
    if (status === "processing" || status === "pending") return "accent";
    return "success";
  };

  return (
    <SlideOverlayScreen direction={direction} backgroundColor={colors.background} onDismiss={() => navigation.goBack()}>
      {(dismiss) => (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
          <OverlayContent.Header title="手图管理" onBack={dismiss} />
          {!token ? (
            <RequireLogin onLogin={() => navigation.navigate("Login")} message="登录后可管理本地手图" />
          ) : (
            <FlatList
              style={{ backgroundColor: colors.surfaceAlt }}
              data={query.data?.items ?? []}
              keyExtractor={(item) => item.id}
              contentContainerStyle={drawerModuleListStyles.list}
              ListHeaderComponent={
                <DrawerModuleInfoBanner
                  icon="shield-checkmark-outline"
                  title="手图仅用于 AI 焕甲"
                  description="你可以在这里添加、查看和删除试戴用手部照片。"
                />
              }
              ListEmptyComponent={
                <OverlayContent.Empty
                  icon="hand-left-outline"
                  title={query.isLoading ? "正在加载手图" : query.isError ? "手图加载失败" : "还没有保存过手图"}
                  description={
                    query.isLoading
                      ? "请稍等，正在同步你的手图记录。"
                      : query.isError
                        ? "请确认后端服务正常运行，然后下拉或重新进入页面刷新。"
                        : "点击右下角加号添加一张手部照片。"
                  }
                />
              }
              renderItem={({ item }) => (
                <DrawerModuleCard>
                  <DrawerModuleThumbnail uri={resolveAssetUrl(item.image_url)} size="medium" />
                  <View style={styles.cardContent}>
                    <View style={styles.cardTitleRow}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>手部照片</Text>
                      <DrawerModulePill label={statusLabel(item.processing_status)} tone={statusTone(item.processing_status)} />
                    </View>
                    <Text style={[styles.meta, { color: colors.subtext }]}>添加于 {formatCreatedAt(item.created_at)}</Text>
                  </View>
                  <Pressable
                    style={[styles.deleteButton, { backgroundColor: colors.dangerSoft }]}
                    onPress={() =>
                      Alert.alert("删除手图", "删除后这张手图将从本地记录中移除。", [
                        { text: "取消", style: "cancel" },
                        { text: "删除", style: "destructive", onPress: () => deleteMutation.mutate(item.id) },
                      ])
                    }
                  >
                    <Ionicons name="trash-outline" size={13} color={colors.dangerText} />
                    <Text style={[styles.deleteLabel, { color: colors.dangerText }]}>删除</Text>
                  </Pressable>
                </DrawerModuleCard>
              )}
            />
          )}
          {token ? (
            <Pressable
              style={[
                styles.fab,
                {
                  backgroundColor: uploadMutation.isPending ? colors.subtext : colors.accent,
                  shadowColor: colors.accent,
                },
              ]}
              onPress={openUploadOptions}
              disabled={uploadMutation.isPending}
            >
              <Ionicons name={uploadMutation.isPending ? "cloud-upload-outline" : "add"} size={34} color="#fff" />
            </Pressable>
          ) : null}
        </SafeAreaView>
      )}
    </SlideOverlayScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  cardContent: { flex: 1, gap: 8, minWidth: 0 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  meta: {
    fontSize: 12,
    fontWeight: "600",
  },
  deleteButton: {
    minWidth: 58,
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  deleteLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 34,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});
