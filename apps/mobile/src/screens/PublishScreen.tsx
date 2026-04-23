import * as ImagePicker from "expo-image-picker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api/client";
import { PrimaryButton } from "../components/PrimaryButton";
import { RequireLogin } from "../components/RequireLogin";
import { useAuthStore } from "../store/useAuthStore";
import { palette } from "../utils/theme";

export function PublishScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
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
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>发布你的美甲内容</Text>
        <PrimaryButton label={imageUri ? "重新选择图片" : "上传图片"} onPress={pickImage} />
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} /> : null}
        <TextInput placeholder="标题" value={title} onChangeText={setTitle} style={styles.input} />
        <TextInput placeholder="描述" value={description} onChangeText={setDescription} style={[styles.input, styles.textarea]} multiline />
        <TextInput placeholder="标签，逗号分隔" value={tags} onChangeText={setTags} style={styles.input} />
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
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 18, gap: 14, paddingBottom: 120 },
  title: { fontSize: 24, fontWeight: "800", color: palette.text },
  preview: { width: "100%", aspectRatio: 1, borderRadius: 22, backgroundColor: palette.accentSoft },
  input: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  textarea: { minHeight: 110, textAlignVertical: "top" },
});
