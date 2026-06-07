import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { useQuery } from "@tanstack/react-query";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useEffect } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, resolveAssetUrl } from "../api/client";
import { trackEvent } from "../utils/analytics";
import { PrimaryButton } from "../components/PrimaryButton";
import { useSlideOverlayDismiss } from "../components/SlideOverlayScreen";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useMarketStore } from "../store/useMarketStore";
import { getNailTypeLabel, isHandmadeNail } from "../utils/nailType";
import { useThemeColors } from "../utils/theme";

type ScreenRoute = RouteProp<RootStackParamList, "TryOnResult">;

export function TryOnResultScreen() {
  const navigation = useNavigation<any>();
  const dismissOverlay = useSlideOverlayDismiss();
  const route = useRoute<ScreenRoute>();
  const colors = useThemeColors();
  const setPendingBookingStyleId = useMarketStore(
    (state) => state.setPendingBookingStyleId,
  );
  const setPendingBookingTryOnJobId = useMarketStore(
    (state) => state.setPendingBookingTryOnJobId,
  );
  const query = useQuery({
    queryKey: ["tryon-job", route.params.jobId],
    queryFn: () => api.getTryOnJob(route.params.jobId),
    refetchInterval: (queryState) => {
      const data = queryState.state.data;
      return data?.status === "succeeded" || data?.status === "failed" || data?.status === "awaiting_confirmation"
        ? false
        : 2000;
    },
  });
  const styleQuery = useQuery({
    queryKey: ["style", query.data?.selected_style_id, "tryon-result"],
    queryFn: () => api.getStyle(query.data?.selected_style_id ?? ""),
    enabled: Boolean(query.data?.selected_style_id),
  });

  const saveResult = async () => {
    if (!query.data?.result_image_url) return;
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) return;
    const download = await FileSystem.downloadAsync(
      resolveAssetUrl(query.data.result_image_url),
      `${FileSystem.cacheDirectory}tryon-result.jpg`,
    );
    await MediaLibrary.saveToLibraryAsync(download.uri);
  };
  const openNextStep = () => {
    const styleId = query.data?.selected_style_id;
    if (!styleId || !styleQuery.data) return;
    if (isHandmadeNail(styleQuery.data.nail_type)) {
      setPendingBookingStyleId(styleId);
      setPendingBookingTryOnJobId(query.data?.job_id ?? null);
      navigation.navigate("MainTabs", { screen: "Market" });
      return;
    }
    navigation.navigate("WearableStore", { styleId, entryEdge: "right" });
  };
  useEffect(() => {
    if (query.data?.status !== "succeeded") return;
    void trackEvent("tryon_result_viewed", {
      styleId: query.data.selected_style_id,
      tryonJobId: query.data.job_id,
      source: "tryon_result",
      screen: "tryon_result",
    });
  }, [query.data?.job_id, query.data?.status, query.data?.selected_style_id]);
  const loadingText =
    query.data?.stage === "preprocessing"
      ? "正在分析手部并分割美甲参考图，首次处理会稍慢"
      : query.data?.stage === "generating"
        ? "正在生成焕甲结果"
        : "AI 正在处理中，通常需要几秒钟";
  const nextStepLabel = !styleQuery.data
    ? "正在确认款式类型..."
    : isHandmadeNail(styleQuery.data.nail_type)
      ? "选择美甲商家预约"
      : "去焕甲生活超市下单";

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.surfaceAlt }]}
    >
      <View style={styles.content}>
        {query.data?.status === "awaiting_confirmation" ? (
          <>
            <View style={[styles.reviewCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.reviewTitle, { color: colors.text }]}>
                已完成手图分析
              </Text>
              <Text style={[styles.reviewText, { color: colors.subtext }]}>
                指甲区域 mask 已经生成。测试阶段先停在这里，不会发送到 EvoLink，也不会产生模型费用。
              </Text>
              <View style={styles.previewRow}>
                {query.data.source_hand_image_url ? (
                  <View style={styles.previewItem}>
                    <Image
                      source={{ uri: resolveAssetUrl(query.data.source_hand_image_url) }}
                      style={[styles.previewImage, { backgroundColor: colors.accentSoft }]}
                    />
                    <Text style={[styles.previewLabel, { color: colors.subtext }]}>
                      原始手图
                    </Text>
                  </View>
                ) : null}
                {query.data.mask_url ? (
                  <View style={styles.previewItem}>
                    <Image
                      source={{ uri: resolveAssetUrl(query.data.mask_url) }}
                      style={[styles.previewImage, { backgroundColor: colors.accentSoft }]}
                    />
                    <Text style={[styles.previewLabel, { color: colors.subtext }]}>
                      指甲 mask
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.checkList}>
                <Text style={[styles.checkItem, { color: colors.text }]}>手图已保存</Text>
                <Text style={[styles.checkItem, { color: colors.text }]}>YOLO 指甲分割完成</Text>
                <Text style={[styles.checkItem, { color: colors.text }]}>EvoLink 生成请求已拦截</Text>
              </View>
            </View>
            <PrimaryButton
              label="暂不发送，返回继续挑选"
              onPress={() => dismissOverlay?.() ?? navigation.goBack()}
            />
            <PrimaryButton
              label="发送生成（测试阶段关闭）"
              onPress={() => undefined}
              disabled
              variant="ghost"
            />
          </>
        ) : query.data?.status === "succeeded" && query.data.result_image_url ? (
          <>
            <Image
              source={{ uri: resolveAssetUrl(query.data.result_image_url) }}
              style={[
                styles.resultImage,
                { backgroundColor: colors.accentSoft },
              ]}
            />
            {styleQuery.data ? (
              <View
                style={[styles.typePill, { backgroundColor: colors.surface }]}
              >
                <Text style={[styles.typePillText, { color: colors.subtext }]}>
                  {getNailTypeLabel(styleQuery.data.nail_type)}
                </Text>
              </View>
            ) : null}
            <PrimaryButton label="保存到相册" onPress={saveResult} />
            <PrimaryButton
              label={nextStepLabel}
              onPress={openNextStep}
              disabled={!styleQuery.data}
            />
            <PrimaryButton
              label="返回继续挑选"
              onPress={() => dismissOverlay?.() ?? navigation.goBack()}
              variant="ghost"
            />
          </>
        ) : query.data?.status === "failed" ? (
          <>
            <Text style={styles.error}>
              {query.data.error_message ?? "试戴失败，请稍后再试"}
            </Text>
            <PrimaryButton
              label="返回重试"
              onPress={() => dismissOverlay?.() ?? navigation.goBack()}
            />
          </>
        ) : (
          <>
            <View
              style={[styles.loadingCard, { backgroundColor: colors.surface }]}
            >
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.subtext }]}>
                {loadingText}
              </Text>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 16, paddingBottom: 120, gap: 14 },
  resultImage: { width: "100%", aspectRatio: 1, borderRadius: 26 },
  typePill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  typePillText: {
    fontSize: 13,
    fontWeight: "800",
  },
  loadingCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    borderRadius: 26,
  },
  loadingText: {},
  reviewCard: {
    borderRadius: 26,
    padding: 18,
    gap: 14,
  },
  reviewTitle: {
    fontSize: 24,
    fontWeight: "800",
  },
  reviewText: {
    fontSize: 15,
    lineHeight: 22,
  },
  previewRow: {
    flexDirection: "row",
    gap: 10,
  },
  previewItem: {
    flex: 1,
    gap: 7,
  },
  previewImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 18,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  checkList: {
    gap: 8,
  },
  checkItem: {
    fontSize: 14,
    fontWeight: "700",
  },
  error: { color: "#111111", lineHeight: 22 },
});
