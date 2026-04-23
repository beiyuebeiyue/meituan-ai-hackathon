import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { Image, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { api, resolveAssetUrl } from "../api/client";
import { PrimaryButton } from "../components/PrimaryButton";
import { RequireLogin } from "../components/RequireLogin";
import { useAuthStore } from "../store/useAuthStore";
import { palette } from "../utils/theme";
import { useState } from "react";
import { useEffect } from "react";

export function ProfileScreen() {
  const navigation = useNavigation();
  const { token, user } = useAuthStore();
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [username, setUsername] = useState(user?.username ?? "");
  const [avatarUri, setAvatarUri] = useState<string | undefined>(undefined);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: api.getMe,
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (meQuery.data) {
      useAuthStore.getState().setUser(meQuery.data);
      setUsername(meQuery.data.username);
    }
  }, [meQuery.data]);

  const mutation = useMutation({
    mutationFn: () => api.updateMe({ username, avatarUri }),
    onSuccess: async (nextUser) => {
      if (token) {
        await setSession(token, nextUser);
      }
    },
  });

  if (!token || !user) {
    return <RequireLogin onLogin={() => navigation.navigate("Login" as never)} message="登录后可查看个人主页" />;
  }

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.profileCard}>
          <Image
            source={{ uri: avatarUri || resolveAssetUrl(user.avatar_url) || "https://placehold.co/200x200/png" }}
            style={styles.avatar}
          />
          <Text style={styles.name}>{user.username}</Text>
          <Text style={styles.email}>{user.phone || "未绑定手机号"}</Text>
        </View>
        <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="用户名" />
        <PrimaryButton label="更换头像" onPress={pickAvatar} variant="ghost" />
        <PrimaryButton label="保存资料" onPress={() => mutation.mutate()} loading={mutation.isPending} />
        <PrimaryButton label="查看我的发布" onPress={() => navigation.navigate("MyPosts" as never)} variant="ghost" />
        <PrimaryButton
          label="退出登录"
          onPress={() => {
            void api.logout();
            void clearSession();
          }}
          variant="ghost"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 18, gap: 14 },
  profileCard: {
    alignItems: "center",
    padding: 24,
    borderRadius: 28,
    backgroundColor: palette.surface,
    gap: 8,
  },
  avatar: { width: 112, height: 112, borderRadius: 56, backgroundColor: palette.accentSoft },
  name: { fontSize: 22, fontWeight: "800", color: palette.text },
  email: { color: palette.subtext },
  input: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
});
