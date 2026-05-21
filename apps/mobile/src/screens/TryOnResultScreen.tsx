import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { useQuery } from "@tanstack/react-query";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { BookingSheet } from "../components/BookingSheet";
import { trackEvent } from "../utils/analytics";
import { PrimaryButton } from "../components/PrimaryButton";
import { useSlideOverlayDismiss } from "../components/SlideOverlayScreen";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useThemeColors } from "../utils/theme";

type ScreenRoute = RouteProp<RootStackParamList, "TryOnResult">;

export function TryOnResultScreen() {
  const navigation = useNavigation<any>();
  const dismissOverlay = useSlideOverlayDismiss();
  const route = useRoute<ScreenRoute>();
  const colors = useThemeColors();
  const [bookingVisible, setBookingVisible] = useState(false);
  const query = useQuery({
    queryKey: ["tryon-job", route.params.jobId],
    queryFn: () => api.getTryOnJob(route.params.jobId),
    refetchInterval: (queryState) => {
      const data = queryState.state.data;
      return data?.status === "succeeded" || data?.status === "failed" ? false : 2000;
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
    const download = await FileSystem.downloadAsync(resolveAssetUrl(query.data.result_image_url), `${FileSystem.cacheDirectory}tryon-result.jpg`);
    await MediaLibrary.saveToLibraryAsync(download.uri);
  };
  const openBooking = () => {
    if (!query.data?.selected_style_id) return;
    if (!styleQuery.data?.shop_id) {
      Alert.alert("暂不能预约", "这款美甲还没有绑定商家门店。");
      return;
    }
    setBookingVisible(true);
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surfaceAlt }]}>
      <View style={styles.content}>
        {query.data?.status === "succeeded" && query.data.result_image_url ? (
          <>
            <Image source={{ uri: resolveAssetUrl(query.data.result_image_url) }} style={[styles.resultImage, { backgroundColor: colors.accentSoft }]} />
            <PrimaryButton label="保存到相册" onPress={saveResult} />
            <PrimaryButton label="预约门店" onPress={openBooking} />
            <PrimaryButton label="返回继续挑选" onPress={() => dismissOverlay?.() ?? navigation.goBack()} variant="ghost" />
          </>
        ) : query.data?.status === "failed" ? (
          <>
            <Text style={styles.error}>{query.data.error_message ?? "试戴失败，请稍后再试"}</Text>
            <PrimaryButton label="返回重试" onPress={() => dismissOverlay?.() ?? navigation.goBack()} />
          </>
        ) : (
          <>
            <View style={[styles.loadingCard, { backgroundColor: colors.surface }]}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.subtext }]}>{loadingText}</Text>
            </View>
          </>
        )}
      </View>
      <BookingSheet
        visible={bookingVisible}
        onClose={() => setBookingVisible(false)}
        shopId={styleQuery.data?.shop_id}
        shopName={styleQuery.data?.shop_name}
        shopCity={styleQuery.data?.shop_city}
        styleId={query.data?.selected_style_id}
        onSuccess={() => Alert.alert("预约已提交", "商家会在预约列表里处理你的意向单。")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 16, paddingBottom: 120, gap: 14 },
  resultImage: { width: "100%", aspectRatio: 1, borderRadius: 26 },
  loadingCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    borderRadius: 26,
  },
  loadingText: {},
  error: { color: "#c43333", lineHeight: 22 },
});
