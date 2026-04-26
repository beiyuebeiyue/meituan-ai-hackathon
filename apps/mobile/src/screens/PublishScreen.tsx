import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api/client";
import { PrimaryButton } from "../components/PrimaryButton";
import { RequireLogin } from "../components/RequireLogin";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeColors } from "../utils/theme";

export function PublishScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const colors = useThemeColors();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.createPost({ title, description, tags, imageUri: imageUri! }),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setTags("");
      setImageUri(null);
      void queryClient.invalidateQueries({ queryKey: ["browse"] });
    },
  });

  if (!token) {
    return <RequireLogin onLogin={() => navigation.navigate("Login" as never)} message="登录后才能发布内容" />;
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>发布你的美甲内容</Text>
        <Pressable
          style={[
            styles.uploadCard,
            { borderColor: colors.border, backgroundColor: colors.background },
            imageUri && styles.uploadCardFilled,
            imageUri && { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
          onPress={pickImage}
        >
          {imageUri ? (
            <>
              <Image source={{ uri: imageUri }} style={[styles.preview, { backgroundColor: colors.accentSoft }]} />
              <View style={[styles.previewOverlay, { backgroundColor: colors.overlay }]}>
                <Ionicons name="image-outline" size={18} color="#ffffff" />
                <Text style={styles.previewOverlayText}>点击更换图片</Text>
              </View>
            </>
          ) : (
            <View style={styles.uploadPlaceholder}>
              <View style={[styles.uploadIconWrap, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="image-outline" size={30} color={colors.accent} />
              </View>
              <Text style={[styles.uploadTitle, { color: colors.text }]}>点击上传图片</Text>
              <Text style={[styles.uploadHint, { color: colors.subtext }]}>展示你心仪的美甲款式或实拍图</Text>
            </View>
          )}
        </Pressable>
        <TextInput
          placeholder="标题"
          placeholderTextColor={colors.subtext}
          value={title}
          onChangeText={setTitle}
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        />
        <TextInput
          placeholder="描述"
          placeholderTextColor={colors.subtext}
          value={description}
          onChangeText={setDescription}
          style={[styles.input, styles.textarea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          multiline
        />
        <TextInput
          placeholder="标签，逗号分隔"
          placeholderTextColor={colors.subtext}
          value={tags}
          onChangeText={setTags}
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        />
        <PrimaryButton
          label="提交发布"
          onPress={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!title || !imageUri}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, gap: 14, paddingBottom: 120 },
  title: { fontSize: 24, fontWeight: "800" },
  uploadCard: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: "dashed",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadCardFilled: {
    borderStyle: "solid",
  },
  uploadPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  uploadIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  uploadHint: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  preview: {
    width: "100%",
    height: "100%",
  },
  previewOverlay: {
    position: "absolute",
    right: 14,
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(36, 26, 21, 0.58)",
  },
  previewOverlayText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  input: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
  },
  textarea: { minHeight: 110, textAlignVertical: "top" },
});
