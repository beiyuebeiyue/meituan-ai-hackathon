import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { PrimaryButton } from "../components/PrimaryButton";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useAskAIStore } from "../store/useAskAIStore";
import { useAuthStore } from "../store/useAuthStore";
import { palette } from "../utils/theme";

export function AskAIScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const { handImageUri, promptText, selectedHandPhotoId, setHandImageUri, setPromptText, setSelectedHandPhotoId } = useAskAIStore();
  const token = useAuthStore((state) => state.token);
  const savedHandsQuery = useQuery({
    queryKey: ["saved-hand-photos"],
    queryFn: api.getSavedHandPhotos,
    enabled: !!token,
  });
  const recommendMutation = useMutation({
    mutationFn: () => api.recommend(promptText),
  });
  const tryonMutation = useMutation({
    mutationFn: ({ styleId }: { styleId: string }) =>
      api.createTryOnJob({ styleId, promptText, handImageUri, savedHandPhotoId: selectedHandPhotoId }),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ["saved-hand-photos"] });
      navigation.navigate("TryOnResult", { jobId: job.job_id });
    },
  });

  useEffect(() => {
    if (!token && selectedHandPhotoId) {
      setSelectedHandPhotoId(null);
    }
  }, [selectedHandPhotoId, setSelectedHandPhotoId, token]);

  useEffect(() => {
    if (!selectedHandPhotoId) return;
    if (!savedHandsQuery.isSuccess) return;
    const hasCurrent = savedHandsQuery.data.items.some((item) => item.id === selectedHandPhotoId);
    if (!hasCurrent) {
      setSelectedHandPhotoId(null);
    }
  }, [savedHandsQuery.data, savedHandsQuery.isSuccess, selectedHandPhotoId, setSelectedHandPhotoId]);

  const pickHandImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (!result.canceled) {
      setSelectedHandPhotoId(null);
      setHandImageUri(result.assets[0].uri);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Ask AI 试戴</Text>
        <Text style={styles.subtitle}>上传你的手部照片，用自然语言描述想要的美甲风格。</Text>
        <Text style={styles.helper}>登录后，新上传的手图会自动保存到账户里，下次可以直接复用。</Text>
        <PrimaryButton label={handImageUri ? "重新上传手图" : "上传手部照片"} onPress={pickHandImage} />
        {token && savedHandsQuery.data?.items.length ? (
          <View style={styles.savedSection}>
            <Text style={styles.savedTitle}>我保存的手图</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedList}>
              {savedHandsQuery.data.items.map((item) => {
                const selected = item.id === selectedHandPhotoId;
                const previewUrl = resolveAssetUrl(item.image_url);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      setSelectedHandPhotoId(item.id);
                      setHandImageUri(previewUrl);
                    }}
                    style={[styles.savedCard, selected && styles.savedCardActive]}
                  >
                    <Image source={{ uri: previewUrl }} style={styles.savedImage} />
                    <Text style={[styles.savedLabel, selected && styles.savedLabelActive]} numberOfLines={1}>
                      {selected ? "当前使用" : "点此复用"}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
        {handImageUri ? <Image source={{ uri: handImageUri }} style={styles.handPreview} /> : null}
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="例如：适合黄皮的温柔裸粉法式，通勤显白"
          value={promptText}
          onChangeText={setPromptText}
          multiline
        />
        <PrimaryButton
          label="获取 5 款真实推荐"
          onPress={() => recommendMutation.mutate()}
          loading={recommendMutation.isPending}
          disabled={!promptText}
        />
        <View style={styles.recommendList}>
          {recommendMutation.data?.items.map((item) => (
            <View key={item.style_id} style={styles.recommendCard}>
              <Image source={{ uri: resolveAssetUrl(item.image_url) }} style={styles.recommendImage} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.recommendTitle}>{item.title}</Text>
                <Text style={styles.recommendReason}>{item.reason}</Text>
                <PrimaryButton
                  label={token ? "选它试戴" : "先登录再试戴"}
                  onPress={() => {
                    if (!token) {
                      navigation.navigate("Login");
                      return;
                    }
                    if (!handImageUri && !selectedHandPhotoId) return;
                    tryonMutation.mutate({ styleId: item.style_id });
                  }}
                  loading={tryonMutation.isPending}
                  style={{ marginTop: 8 }}
                />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 18, gap: 14, paddingBottom: 120 },
  title: { fontSize: 28, fontWeight: "800", color: palette.text },
  subtitle: { color: palette.subtext, lineHeight: 20 },
  helper: { color: palette.accent, lineHeight: 20, fontWeight: "600" },
  handPreview: { width: "100%", aspectRatio: 1, borderRadius: 24, backgroundColor: palette.accentSoft },
  input: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  textarea: { minHeight: 100, textAlignVertical: "top" },
  savedSection: { gap: 10 },
  savedTitle: { fontSize: 16, fontWeight: "700", color: palette.text },
  savedList: { gap: 10, paddingRight: 6 },
  savedCard: {
    width: 110,
    padding: 8,
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  savedCardActive: {
    borderColor: palette.accent,
    backgroundColor: "#fff0e7",
  },
  savedImage: { width: 94, height: 94, borderRadius: 14, backgroundColor: palette.accentSoft },
  savedLabel: { fontSize: 12, color: palette.subtext, fontWeight: "600" },
  savedLabelActive: { color: palette.accent },
  recommendList: { gap: 14 },
  recommendCard: {
    flexDirection: "row",
    gap: 14,
    padding: 14,
    borderRadius: 24,
    backgroundColor: palette.surface,
  },
  recommendImage: { width: 108, height: 140, borderRadius: 18, backgroundColor: palette.accentSoft },
  recommendTitle: { fontSize: 18, fontWeight: "700", color: palette.text },
  recommendReason: { color: palette.subtext, lineHeight: 18 },
});
