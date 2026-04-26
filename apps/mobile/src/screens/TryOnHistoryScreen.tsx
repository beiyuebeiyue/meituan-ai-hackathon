import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Alert, FlatList, Image, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { OverlayContent } from "../components/OverlayContent";
import { RequireLogin } from "../components/RequireLogin";
import { SlideOverlayScreen, useOverlayDirection } from "../components/SlideOverlayScreen";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeColors } from "../utils/theme";

function getStatusLabel(status: "pending" | "processing" | "succeeded" | "failed") {
  if (status === "pending") return "排队中";
  if (status === "processing") return "生成中";
  if (status === "succeeded") return "已完成";
  return "已失败";
}

export function TryOnHistoryScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const colors = useThemeColors();
  const direction = useOverlayDirection("right");
  const query = useQuery({
    queryKey: ["tryon-history"],
    queryFn: api.getTryOnHistory,
    enabled: Boolean(token),
  });

  const deleteMutation = useMutation({
    mutationFn: (jobId: string) => api.deleteTryOnJob(jobId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tryon-history"] });
    },
    onError: () => {
      Alert.alert("暂时无法删除", "处理中任务还不能删除，稍后再试。");
    },
  });

  return (
    <SlideOverlayScreen direction={direction} backgroundColor={colors.background} onDismiss={() => navigation.goBack()}>
      {(dismiss) => (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
          <OverlayContent.Header title="AI 焕甲" onBack={dismiss} />
          {!token ? (
            <RequireLogin onLogin={() => navigation.navigate("Login")} message="登录后可查看 AI 焕甲记录" />
          ) : (
            <FlatList
              style={{ backgroundColor: colors.surfaceAlt }}
              data={query.data?.items ?? []}
              keyExtractor={(item) => item.job_id}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <OverlayContent.Empty
                  icon="sparkles-outline"
                  title={query.isLoading ? "正在加载 AI 焕甲记录" : "还没有 AI 焕甲记录"}
                  description={query.isLoading ? "请稍等，正在同步你的试戴记录。" : "在问问小嘉或作品详情发起焕甲后，会出现在这里。"}
                />
              }
              renderItem={({ item }) => {
                const imageUrl = item.result_image_url || item.source_hand_image_url || item.style_image_url;
                const deletingDisabled = item.status === "processing";
                return (
                  <View style={[styles.card, { backgroundColor: colors.surface }]}>
                    <Image source={{ uri: resolveAssetUrl(imageUrl) }} style={[styles.image, { backgroundColor: colors.accentSoft }]} />
                    <View style={styles.body}>
                      <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.text }]}>{item.style_title}</Text>
                        <Text
                          style={[
                            styles.status,
                            { color: item.status === "failed" ? "#c24444" : "#2d8a52" },
                          ]}
                        >
                          {getStatusLabel(item.status)}
                        </Text>
                      </View>
                      <Text style={[styles.meta, { color: colors.subtext }]}>创建于 {item.created_at.replace("T", " ").slice(0, 16)}</Text>
                      <Text style={[styles.prompt, { color: colors.subtext }]} numberOfLines={2}>
                        {item.prompt_text || "未填写额外描述"}
                      </Text>
                      <View style={styles.actions}>
                        <Pressable
                          style={[styles.primaryAction, { backgroundColor: colors.accent }]}
                          onPress={() => navigation.navigate("TryOnResult", { jobId: item.job_id })}
                        >
                          <Text style={styles.primaryActionText}>查看结果</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.secondaryAction, { backgroundColor: colors.dangerSoft }, deletingDisabled && styles.disabledAction]}
                          disabled={deletingDisabled}
                          onPress={() =>
                            Alert.alert("删除 AI 焕甲记录", "删除后将不再保留这次焕甲结果。", [
                              { text: "取消", style: "cancel" },
                              { text: "删除", style: "destructive", onPress: () => deleteMutation.mutate(item.job_id) },
                            ])
                          }
                        >
                          <Text style={[styles.secondaryActionText, { color: colors.dangerText }]}>删除</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </SafeAreaView>
      )}
    </SlideOverlayScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 10, gap: 12, paddingBottom: 120 },
  card: {
    flexDirection: "row",
    gap: 14,
    padding: 14,
    borderRadius: 22,
  },
  image: {
    width: 108,
    height: 138,
    borderRadius: 18,
  },
  body: {
    flex: 1,
    gap: 8,
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
  },
  status: {
    fontWeight: "700",
    fontSize: 12,
  },
  meta: {
    fontSize: 12,
  },
  prompt: {
    lineHeight: 19,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  primaryAction: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  primaryActionText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  secondaryAction: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  disabledAction: {
    opacity: 0.45,
  },
  secondaryActionText: {
    fontWeight: "700",
  },
});
