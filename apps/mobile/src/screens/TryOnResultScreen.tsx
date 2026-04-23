import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { useQuery } from "@tanstack/react-query";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { ActivityIndicator, Image, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { PrimaryButton } from "../components/PrimaryButton";
import { RootStackParamList } from "../navigation/RootNavigator";
import { palette } from "../utils/theme";

type ScreenRoute = RouteProp<RootStackParamList, "TryOnResult">;

export function TryOnResultScreen() {
  const navigation = useNavigation();
  const route = useRoute<ScreenRoute>();
  const query = useQuery({
    queryKey: ["tryon-job", route.params.jobId],
    queryFn: () => api.getTryOnJob(route.params.jobId),
    refetchInterval: (queryState) => {
      const data = queryState.state.data;
      return data?.status === "succeeded" || data?.status === "failed" ? false : 2000;
    },
  });

  const saveResult = async () => {
    if (!query.data?.result_image_url) return;
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) return;
    const download = await FileSystem.downloadAsync(resolveAssetUrl(query.data.result_image_url), `${FileSystem.cacheDirectory}tryon-result.jpg`);
    await MediaLibrary.saveToLibraryAsync(download.uri);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>试戴结果</Text>
        {query.data?.status === "succeeded" && query.data.result_image_url ? (
          <>
            <Image source={{ uri: resolveAssetUrl(query.data.result_image_url) }} style={styles.resultImage} />
            <PrimaryButton label="保存到相册" onPress={saveResult} />
            <PrimaryButton label="返回继续挑选" onPress={() => navigation.goBack()} variant="ghost" />
          </>
        ) : query.data?.status === "failed" ? (
          <>
            <Text style={styles.error}>{query.data.error_message ?? "试戴失败，请稍后再试"}</Text>
            <PrimaryButton label="返回重试" onPress={() => navigation.goBack()} />
          </>
        ) : (
          <>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={palette.accent} />
              <Text style={styles.loadingText}>AI 正在处理中，通常需要几秒钟</Text>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { flex: 1, padding: 18, gap: 14 },
  title: { fontSize: 28, fontWeight: "800", color: palette.text },
  resultImage: { width: "100%", aspectRatio: 1, borderRadius: 26, backgroundColor: palette.accentSoft },
  loadingCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    borderRadius: 26,
    backgroundColor: palette.surface,
  },
  loadingText: { color: palette.subtext },
  error: { color: "#c43333", lineHeight: 22 },
});
